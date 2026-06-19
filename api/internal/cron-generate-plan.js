// api/internal/cron-generate-plan.js — invoked by Supabase cron-poller
// Body: { user_id, date }. Header x-cron-secret must match CRON_SECRET.
import { createClient } from "@supabase/supabase-js";
import { generateAndPersistPlan } from "../_lib/planEngine.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (req.headers["x-cron-secret"] !== process.env.CRON_SECRET) return res.status(401).end();
  const { user_id, date } = req.body ?? {};
  if (!user_id || !date) return res.status(400).end("user_id + date required");

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  try {
    const { plan } = await generateAndPersistPlan(admin, user_id, date);
    res.status(200).json({ ok: true, blocks: plan.time_blocks.length, provider: plan.provider_used });
  } catch (e) {
    console.error("[cron-gen]", e);
    res.status(500).json({ error: e.message });
  }
}
