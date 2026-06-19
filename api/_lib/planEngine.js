// api/_lib/planEngine.js
// Shared headless plan generator (no SSE). Used by:
//   • /api/plan/daily/generate.js  (Edge runtime, wraps SSE around this)
//   • /api/internal/cron-generate-plan.js  (cron job, called by Supabase cron)
//
// Returns { plan, ctxHash } and persists day_plans + time_blocks.

import { buildPlanContext } from "./planContextBuilder.js";
import { buildDailyPlanPrompt } from "./promptBuilder.js";
import { generateBuffered } from "./aiProviderManager.js";
import { validatePlan } from "./planValidator.js";
import { buildDeterministicPlan } from "./deterministicPlanner.js";

function hashContext(ctx) {
  const json = JSON.stringify({
    tasks: ctx.tasks.map((t) => [t.id, t.status, t.priority, t.deadline]),
    checkIn: ctx.checkIn?.id ?? null,
    fixed: ctx.fixedEvents.map((e) => e.id),
  });
  // Cross-runtime base64 (works on Node + Edge + Deno)
  if (typeof btoa === "function") return btoa(unescape(encodeURIComponent(json))).slice(0, 32);
  return Buffer.from(json).toString("base64").slice(0, 32);
}

export async function generateAndPersistPlan(supabase, userId, date) {
  const ctx = await buildPlanContext(supabase, userId);
  const ctxHash = hashContext(ctx);

  let plan = null;
  if (ctx.profile.ai_data_consent) {
    const { system, user } = buildDailyPlanPrompt(ctx);
    let lastErrors = [];
    for (let attempt = 1; attempt <= 3 && !plan; attempt++) {
      const sys = attempt > 1 ? system + "\nPrev errors: " + lastErrors.join("; ") : system;
      const { providerUsed, text } = await generateBuffered({ system: sys, user });
      if (!providerUsed) break;
      const r = validatePlan(text, {
        wakeTime: ctx.profile.wake_time,
        sleepTime: ctx.profile.sleep_time,
        fixedWindows: ctx.fixedEvents.map((e) => ({ start_time: e.start_time, end_time: e.end_time })),
        highPriorityDueSoon: ctx.highPriorityDueSoon,
      });
      if (r.ok) { plan = r.plan; plan.provider_used = providerUsed; }
      else lastErrors = r.errors;
    }
  }
  if (!plan) plan = buildDeterministicPlan({ profile: ctx.profile, tasks: ctx.tasks, fixedEvents: ctx.fixedEvents });

  const { data: dpRow, error } = await supabase.from("day_plans").upsert({
    user_id: userId, date,
    daily_insight: plan.daily_insight,
    energy_score: plan.energy_score,
    estimated_focus_hours: plan.estimated_focus_hours,
    deferred_tasks: plan.deferred_tasks, tips: plan.tips,
    provider_used: plan.provider_used,
    context_hash: ctxHash,
  }, { onConflict: "user_id,date" }).select("id").single();
  if (error) throw error;

  await supabase.from("time_blocks").delete().eq("day_plan_id", dpRow.id);
  if (plan.time_blocks.length) {
    await supabase.from("time_blocks").insert(plan.time_blocks.map((b, i) => ({
      id: b.id, day_plan_id: dpRow.id, user_id: userId,
      start_time: b.start_time, end_time: b.end_time, title: b.title,
      type: b.type, priority: b.priority, rationale: b.rationale,
      task_id: b.task_id, is_fixed: b.is_fixed, status: "pending", sort_index: i,
    })));
  }

  return { plan, ctxHash };
}
