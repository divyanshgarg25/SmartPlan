// api/plan/weekly/refine/[date].js
// §3.11 Lazy daily refinement on day tap. Reuses the daily generate
// pipeline but for a future date. For Phase 2 we use DeterministicPlanner
// against that day's tasks; full AI generation lives in /api/plan/daily/generate.
import { createClient } from "@supabase/supabase-js";
import { buildDeterministicPlan } from "../../../_lib/deterministicPlanner.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).end("Unauthorized");
  const date = req.query.date;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).end("Bad date");

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: ures } = await admin.auth.getUser(token);
  if (!ures?.user) return res.status(401).end("Unauthorized");
  const userId = ures.user.id;

  const dow = new Date(date + "T00:00:00Z").getUTCDay();
  const [{ data: profile }, { data: tasks }, { data: fixedEvents }] = await Promise.all([
    admin.from("profiles").select("*").eq("id", userId).single(),
    admin.from("tasks").select("*").eq("user_id", userId).in("status", ["inbox", "scheduled"]).limit(30),
    admin.from("fixed_events").select("*").eq("user_id", userId).eq("day_of_week", dow),
  ]);

  const plan = buildDeterministicPlan({
    profile, tasks: tasks ?? [], fixedEvents: fixedEvents ?? [], date,
  });

  // Persist into day_plans/time_blocks
  const { data: dpRow } = await admin.from("day_plans").upsert({
    user_id: userId, date,
    daily_insight: plan.daily_insight,
    energy_score: plan.energy_score,
    estimated_focus_hours: plan.estimated_focus_hours,
    deferred_tasks: plan.deferred_tasks, tips: plan.tips,
    provider_used: plan.provider_used,
  }, { onConflict: "user_id,date" }).select("id").single();

  await admin.from("time_blocks").delete().eq("day_plan_id", dpRow.id);
  if (plan.time_blocks.length) {
    await admin.from("time_blocks").insert(plan.time_blocks.map((b, i) => ({
      id: b.id, day_plan_id: dpRow.id, user_id: userId,
      start_time: b.start_time, end_time: b.end_time, title: b.title,
      type: b.type, priority: b.priority, rationale: b.rationale,
      task_id: b.task_id, is_fixed: b.is_fixed, status: "pending", sort_index: i,
    })));
  }

  res.status(200).json({ ok: true, date, blocks: plan.time_blocks.length });
}
