// api/plan/daily/generate.js
//
// EDGE RUNTIME — required for SSE (§1.4). Standard serverless timeout (10s)
// would kill long AI generations.
//
// Flow §3.5:
//   1. Auth → user
//   2. Consent check (route to DeterministicPlanner if false)
//   3. Atomic rate limit (increment_plan_count, cap 30/day)
//   4. Cache check (same-day plan with matching context_hash)
//   5. Check-in validation
//   6. Build context + prompt
//   7. AIProviderManager — buffered
//   8. PlanValidator — retry x2 on failure, then fall through to DeterministicPlanner
//   9. Persist day_plans + time_blocks
//  10. Re-stream SSE: clear → block × N → done
//  11. RPC recalculate_job_times
//  12. behavior_logs (consent-gated)

import { authenticate, supabaseAdmin } from "../../_lib/supabaseAdmin.js";
import { buildPlanContext } from "../../_lib/planContextBuilder.js";
import { buildDailyPlanPrompt } from "../../_lib/promptBuilder.js";
import { generateBuffered } from "../../_lib/aiProviderManager.js";
import { validatePlan } from "../../_lib/planValidator.js";
import { buildDeterministicPlan } from "../../_lib/deterministicPlanner.js";

// MUST be exported per §1.4 "non-negotiable".
export const config = { runtime: "edge" };

function sseChunk(event, data) {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

function makeStream() {
  let controllerRef;
  const stream = new ReadableStream({
    start(controller) { controllerRef = controller; },
  });
  return {
    stream,
    send: (event, data) => controllerRef.enqueue(sseChunk(event, data)),
    close: () => controllerRef.close(),
  };
}

function hashContext(ctx) {
  // simple stable hash; ok for cache key
  return btoa(unescape(encodeURIComponent(JSON.stringify({
    tasks: ctx.tasks.map((t) => [t.id, t.status, t.priority, t.deadline]),
    checkIn: ctx.checkIn?.id ?? null,
    fixed: ctx.fixedEvents.map((e) => e.id),
  })))).slice(0, 32);
}

export default async function handler(req) {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });

  let user;
  try { ({ user } = await authenticate(req)); }
  catch (e) { return new Response(e.message, { status: e.status ?? 401 }); }

  const body = await req.json().catch(() => ({}));
  const force_deterministic = !!body.force_deterministic;

  const supabase = supabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  // Step 3 — atomic rate limit
  const { data: count, error: rlErr } = await supabase.rpc("increment_plan_count", {
    p_user_id: user.id, p_date: today,
  });
  if (rlErr) return new Response("Rate limit error", { status: 500 });
  if (count > 30) return new Response("Rate limit exceeded (30/day)", { status: 429 });

  // Step 5 — check-in required
  const { data: checkInRows } = await supabase
    .from("check_ins").select("id").eq("user_id", user.id).eq("date", today).limit(1);
  if (!checkInRows || checkInRows.length === 0) {
    return new Response(JSON.stringify({ need_check_in: true }), {
      status: 409, headers: { "Content-Type": "application/json" },
    });
  }

  // Step 6 — context + prompt
  const ctx = await buildPlanContext(supabase, user.id);
  const ctxHash = hashContext(ctx);

  // Step 4 — cache check
  const { data: cached } = await supabase
    .from("day_plans")
    .select("id, context_hash")
    .eq("user_id", user.id).eq("date", today).maybeSingle();

  const { stream, send, close } = makeStream();
  const response = new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });

  // Detach async work
  (async () => {
    try {
      send("clear", {});

      if (cached && cached.context_hash === ctxHash) {
        const { data: blocks } = await supabase
          .from("time_blocks").select("*").eq("day_plan_id", cached.id).order("sort_index");
        for (const b of blocks) send("block", b);
        send("done", { provider_used: "cache" });
        close();
        return;
      }

      // Step 2/8 — consent OR all-providers-down OR force_deterministic → DeterministicPlanner
      let plan = null;
      const goDeterministic = !ctx.profile.ai_data_consent || force_deterministic;

      if (!goDeterministic) {
        const { system, user: userMsg } = buildDailyPlanPrompt(ctx);
        let attempt = 0;
        let lastErrors = [];
        while (attempt < 3 && !plan) {
          attempt++;
          if (attempt > 1) send("thinking", { reason: "retrying", attempt });
          const augSystem = attempt > 1
            ? system + "\nPrevious attempt failed validation: " + lastErrors.join("; ")
            : system;
          const { providerUsed, text } = await generateBuffered({ system: augSystem, user: userMsg });
          if (!providerUsed) break;
          const result = validatePlan(text, {
            wakeTime: ctx.profile.wake_time,
            sleepTime: ctx.profile.sleep_time,
            fixedWindows: ctx.fixedEvents.map((e) => ({ start_time: e.start_time, end_time: e.end_time })),
            highPriorityDueSoon: ctx.highPriorityDueSoon,
          });
          if (result.ok) {
            plan = result.plan;
            plan.provider_used = providerUsed;
          } else {
            lastErrors = result.errors;
          }
        }
      }

      if (!plan) {
        plan = buildDeterministicPlan({
          profile: ctx.profile, tasks: ctx.tasks, fixedEvents: ctx.fixedEvents,
          velocity: ctx.velocity, failureZones: ctx.failureZones
        });
      }

      // Step 9 — persist
      const { data: dpRow, error: dpErr } = await supabase
        .from("day_plans")
        .upsert({
          user_id: user.id,
          date: today,
          daily_insight: plan.daily_insight,
          energy_score: plan.energy_score,
          estimated_focus_hours: plan.estimated_focus_hours,
          deferred_tasks: plan.deferred_tasks,
          tips: plan.tips,
          provider_used: plan.provider_used,
          context_hash: ctxHash,
        }, { onConflict: "user_id,date" })
        .select("id").single();

      if (dpErr) throw dpErr;

      await supabase.from("time_blocks").delete().eq("day_plan_id", dpRow.id);
      const blockRows = plan.time_blocks.map((b, i) => ({
        id: b.id, day_plan_id: dpRow.id, user_id: user.id,
        start_time: b.start_time, end_time: b.end_time, title: b.title,
        type: b.type, priority: b.priority, rationale: b.rationale,
        task_id: b.task_id, is_fixed: b.is_fixed, status: "pending", sort_index: i,
      }));
      if (blockRows.length) await supabase.from("time_blocks").insert(blockRows);

      // Step 10 — re-stream blocks
      for (const b of plan.time_blocks) send("block", b);
      send("done", { provider_used: plan.provider_used });

      // Step 11 — reschedule next job
      await supabase.rpc("recalculate_job_times", { p_user_id: user.id });

      // Step 12 — behavior_logs (consent-gated)
      if (ctx.profile.ai_data_consent) {
        await supabase.from("behavior_logs").insert({
          user_id: user.id, event_type: "plan_generated",
          payload: { provider: plan.provider_used, blocks: plan.time_blocks.length },
        });
      }
    } catch (e) {
      console.error("plan/generate error", e);
      try { send("error", { message: e.message ?? "unknown" }); } catch {}
    } finally {
      close();
    }
  })();

  return response;
}
