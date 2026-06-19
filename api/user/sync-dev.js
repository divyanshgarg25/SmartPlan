import { createClient } from "@supabase/supabase-js";
import { runDevSync } from "../_lib/devSyncEngine.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return res.status(401).json({ error: "Unauthorized" });

  // Use service role to write to analytics_snapshots
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  
  try {
    const stats = await runDevSync(admin, user.id);
    res.status(200).json({ ok: true, stats });
  } catch (e) {
    console.error("Manual dev sync failed:", e);
    res.status(500).json({ error: e.message });
  }
}
