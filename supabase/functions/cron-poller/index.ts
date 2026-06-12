// supabase/functions/cron-poller/index.ts
//
// Single Supabase Scheduled Edge Function — runs every 15 minutes (UTC).
// UTC Timestamp Queue pattern (spec §5.3). NO live timezone math.
//
// Schedule (Supabase → Database → Cron):
//   */15 * * * *
//
// This is the dispatcher. Heavy work (AI gen, dev-sync, analyser, review)
// lives in Vercel Functions (so it shares code with the SSE endpoint).
// We invoke them via HTTP with a CRON_SECRET shared header.

// @ts-nocheck — Deno edge runtime
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  { auth: { persistSession: false } }
);

const APP_BASE_URL = Deno.env.get("APP_BASE_URL")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET")!;

async function invoke(path: string, body: Record<string, unknown>) {
  const r = await fetch(`${APP_BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-cron-secret": CRON_SECRET },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} ${r.status}`);
  return r.json();
}

function getMondayDate(d = new Date()): string {
  const dow = d.getUTCDay();
  const diff = (dow + 6) % 7;
  d.setUTCDate(d.getUTCDate() - diff);
  return d.toISOString().slice(0, 10);
}
function tomorrowISO(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

Deno.serve(async () => {
  const now = new Date().toISOString();
  const counts = { plan: 0, analyse: 0, reEval: 0, devSync: 0, review: 0, errors: 0 };

  // ---- PreGenerationJob ----------------------------------------------------
  const { data: planUsers } = await supabase
    .from("profiles")
    .select("id, ai_data_consent")
    .lte("next_plan_gen_at", now)
    .eq("onboarding_done", true);
  const tomorrow = tomorrowISO();
  for (const user of planUsers ?? []) {
    try {
      await invoke("/api/internal/cron-generate-plan", { user_id: user.id, date: tomorrow });
      counts.plan++;
    } catch (e) { console.error("[cron] plan", e); counts.errors++; }
    finally { await supabase.rpc("recalculate_job_times", { p_user_id: user.id }); }
  }

  // ---- PatternAnalyserJob (consent-gated) --------------------------------
  const { data: analyseUsers } = await supabase
    .from("profiles").select("id")
    .lte("next_pattern_analyse_at", now)
    .eq("ai_data_consent", true);
  for (const u of analyseUsers ?? []) {
    try {
      await invoke("/api/internal/cron-analyse", { user_id: u.id });
      counts.analyse++;
    } catch (e) { console.error("[cron] analyse", e); counts.errors++; }
    finally { await supabase.rpc("recalculate_job_times", { p_user_id: u.id }); }
  }

  // ---- WeekReEvalJob -----------------------------------------------------
  const { data: reEvalUsers } = await supabase
    .from("profiles").select("id")
    .lte("next_week_reeval_at", now);
  for (const u of reEvalUsers ?? []) {
    try {
      await invoke("/api/internal/cron-weekly-regenerate", { user_id: u.id });
      counts.reEval++;
    } catch (e) { console.error("[cron] reeval", e); counts.errors++; }
    finally { await supabase.rpc("recalculate_job_times", { p_user_id: u.id }); }
  }

  // ---- DevSyncJob (Phase 3) ----------------------------------------------
  const currentWeek = getMondayDate();
  const { data: devSyncUsers } = await supabase
    .from("integrations").select("user_id");
  for (const u of devSyncUsers ?? []) {
    const { data: snap } = await supabase
      .from("analytics_snapshots").select("external_stats")
      .eq("user_id", u.user_id).eq("week_start", currentWeek).maybeSingle();
      
    if (snap?.external_stats) continue;

    try {
      await invoke("/api/internal/cron-dev-sync", { user_id: u.user_id });
      counts.devSync++;
    } catch (e) { console.error("[cron] dev-sync", e); counts.errors++; }
  }

  // ---- WeeklyReviewJob (Phase 3) -----------------------------------------
  const currentWeek = getMondayDate();
  const { data: reviewUsers } = await supabase
    .from("profiles").select("id").eq("onboarding_done", true);
  for (const u of reviewUsers ?? []) {
    const { data: snap } = await supabase
      .from("analytics_snapshots").select("id")
      .eq("user_id", u.id).eq("week_start", currentWeek).maybeSingle();
    if (snap) continue;
    try {
      await invoke("/api/internal/cron-weekly-review", { user_id: u.id, week_start: currentWeek });
      counts.review++;
    } catch (e) { console.error("[cron] review", e); counts.errors++; }
  }

  return new Response(JSON.stringify({ ok: true, counts }), {
    headers: { "Content-Type": "application/json" },
  });
});
