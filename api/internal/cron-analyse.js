// api/internal/cron-analyse.js — pattern analysis for a user
import { createClient } from "@supabase/supabase-js";
import { analyseUser } from "../_lib/patternAnalyser.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) return res.status(401).end();
  const { user_id } = req.body ?? {};
  if (!user_id) return res.status(400).end("user_id required");
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  try {
    const insights = await analyseUser(admin, user_id);
    res.status(200).json({ ok: true, insights: insights.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
