// api/user/export.js — GET: full GDPR user data export as JSON.
import { createClient } from "@supabase/supabase-js";

const TABLES = [
  "profiles", "integrations", "tasks", "check_ins", "day_plans", "time_blocks",
  "week_plans", "behavior_logs", "fixed_events", "user_insights",
  "week_templates", "analytics_snapshots",
];

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end("Method Not Allowed");
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).end("Unauthorized");

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: ures, error: uErr } = await admin.auth.getUser(token);
  if (uErr || !ures?.user) return res.status(401).end("Unauthorized");
  const userId = ures.user.id;

  const dump = { exported_at: new Date().toISOString(), user_id: userId };
  for (const t of TABLES) {
    const idCol = t === "profiles" ? "id" : "user_id";
    const { data } = await admin.from(t).select("*").eq(idCol, userId);
    dump[t] = data ?? [];
  }
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Content-Disposition", `attachment; filename="smartplan-export-${Date.now()}.json"`);
  res.status(200).end(JSON.stringify(dump, null, 2));
}
