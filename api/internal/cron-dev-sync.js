import { createClient } from "@supabase/supabase-js";
import { runDevSync } from "../_lib/devSyncEngine.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) return res.status(401).end();
  const { user_id } = req.body ?? {};
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  try {
    const stats = await runDevSync(admin, user_id);
    res.status(200).json({ ok: true, stats });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
