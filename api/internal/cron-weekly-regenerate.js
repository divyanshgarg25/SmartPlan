// api/internal/cron-weekly-regenerate.js — refresh weekly skeleton
import { createClient } from "@supabase/supabase-js";
import { planByDeadlines } from "../_lib/deadlinePlanner.js";

function mondayOf(date = new Date()) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) return res.status(401).end();
  const { user_id } = req.body ?? {};
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  const { data: profile } = await admin.from("profiles").select("daily_hour_cap").eq("id", user_id).single();
  const { data: tasks } = await admin.from("tasks").select("*")
    .eq("user_id", user_id).in("status", ["inbox", "scheduled"]);
  const flex = (tasks ?? []).filter((t) => !t.is_fixed && t.deadline);
  const { perDay, overflowTaskIds } = planByDeadlines(flex, profile?.daily_hour_cap ?? 8);
  const weekStart = mondayOf();
  const dayLoads = Object.values(perDay).map((arr) => arr.reduce((s, x) => s + x.hours, 0));
  const loadScore = dayLoads.length ? +(dayLoads.reduce((a, b) => a + b, 0) / dayLoads.length / (profile?.daily_hour_cap ?? 8)).toFixed(2) : 0;
  await admin.from("week_plans").upsert({
    user_id, week_start: weekStart,
    skeleton: { perDay, overflowTaskIds },
    load_score: loadScore,
    insight: "Re-evaluated mid-week based on remaining tasks.",
  }, { onConflict: "user_id,week_start" });
  res.status(200).json({ ok: true, load_score: loadScore });
}
