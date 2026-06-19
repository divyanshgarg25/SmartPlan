// api/tasks/categorise.js — NLP task parsing. Consent-gated per §4.3.
// Standard serverless (not Edge).
import { createClient } from "@supabase/supabase-js";
import { generateBuffered } from "../_lib/aiProviderManager.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");

  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).end("Unauthorized");
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: ures, error } = await admin.auth.getUser(token);
  if (error || !ures?.user) return res.status(401).end("Unauthorized");

  const { data: profile } = await admin.from("profiles")
    .select("ai_data_consent, timezone").eq("id", ures.user.id).single();
  if (!profile?.ai_data_consent) {
    return res.status(403).json({ error: "ai_data_consent is false; manual entry only." });
  }

  let body;
  try { body = await readJson(req); } catch { return res.status(400).end("Invalid JSON"); }
  const text = (body?.text || "").toString().trim();
  if (!text) return res.status(400).end("Missing text");

  const system = [
    "Extract a single task. Respond as JSON only with keys:",
    'title, type ("deep_work"|"light_work"|"admin"|"social"|"health"|"personal"),',
    'priority ("high"|"medium"|"low"), is_fixed (bool), fixed_time ("HH:MM"|null),',
    "estimated_hours (number), deadline (ISO|null), subject (string|null).",
  ].join(" ");
  const result = await generateBuffered({ system, user: text });
  if (!result.providerUsed) return res.status(503).json({ error: "All AI providers down" });

  try {
    const parsed = JSON.parse(result.text);
    res.status(200).json({ task: parsed, provider_used: result.providerUsed });
  } catch {
    res.status(502).json({ error: "AI returned malformed JSON" });
  }
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => { try { resolve(JSON.parse(data)); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}
