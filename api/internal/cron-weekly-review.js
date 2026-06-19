import { createClient } from "@supabase/supabase-js";
import { runWeeklyReview } from "../_lib/weeklyReview.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) return res.status(401).end();
  const { user_id, week_start } = req.body ?? {};
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  try {
    const r = await runWeeklyReview(admin, user_id, week_start);
    res.status(200).json({ ok: true, length: r.text.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
