// api/plan/daily/edit.js
// §3.7 Surgical AI-assisted edit on existing day plan.
// Standard serverless (Node) — single request/response. No SSE.
//
// Input: { date, instruction, blockId? }
// Output: { time_blocks: [...] } updated set (full replacement for the date).
import { createClient } from "@supabase/supabase-js";
import { generateBuffered } from "../../_lib/aiProviderManager.js";

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;
const TYPES = new Set(["deep_work", "light_work", "admin", "break", "fixed_event", "social", "health", "personal"]);

function validateEditBlocks(blocks, sleep) {
  if (!Array.isArray(blocks) || blocks.length === 0) return "time_blocks empty";
  if (blocks.length > 30) return "more than 30 blocks";
  const sleepMin = (() => { const [h, m] = sleep.split(":").map(Number); return h * 60 + m; })();
  const sorted = [];
  for (const b of blocks) {
    if (!HHMM.test(b.start_time) || !HHMM.test(b.end_time)) return "bad time";
    if (!TYPES.has(b.type)) return "bad type";
    if (typeof b.title !== "string" || !b.title.trim()) return "missing title";
    const [sh, sm] = b.start_time.split(":").map(Number);
    const [eh, em] = b.end_time.split(":").map(Number);
    const s = sh * 60 + sm, e = eh * 60 + em;
    if (e <= s) return "end <= start";
    if (e > sleepMin) return "after sleep_time";
    sorted.push([s, e]);
  }
  sorted.sort((a, b) => a[0] - b[0]);
  for (let i = 1; i < sorted.length; i++) if (sorted[i][0] < sorted[i - 1][1]) return "overlap";
  return null;
}

const SYS = `You are an editor for an existing daily plan. Return JSON ONLY:
{ "time_blocks": [...] }
Each block: { start_time "HH:MM", end_time "HH:MM", title, type, priority, rationale, task_id?, is_fixed?:bool }
RULES:
 - Preserve all is_fixed blocks (do not remove or shift).
 - Apply the user's instruction; only adjust blocks needed.
 - Keep within 06:00..sleep_time window.
 - <=30 blocks. No overlaps.`;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end("Method Not Allowed");
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) return res.status(401).end("Unauthorized");

  const { date, instruction } = req.body ?? {};
  if (!date || !instruction) return res.status(400).end("date + instruction required");

  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data: ures } = await admin.auth.getUser(token);
  if (!ures?.user) return res.status(401).end("Unauthorized");
  const userId = ures.user.id;

  const { data: profile } = await admin.from("profiles").select("sleep_time, ai_data_consent").eq("id", userId).single();
  if (!profile?.ai_data_consent) return res.status(403).end("AI consent required");

  const { data: dp } = await admin.from("day_plans").select("id, time_blocks(*)").eq("user_id", userId).eq("date", date).maybeSingle();
  if (!dp) return res.status(404).end("No plan for this date");

  const userMsg = JSON.stringify({
    instruction,
    sleep_time: profile.sleep_time,
    current_blocks: dp.time_blocks.map((b) => ({
      id: b.id, start: b.start_time, end: b.end_time,
      title: b.title, type: b.type, is_fixed: b.is_fixed,
    })),
  });

  const { text, providerUsed } = await generateBuffered({ system: SYS, user: userMsg, maxTokens: 1500 });
  if (!text) return res.status(503).json({ error: "All AI providers unavailable" });
  let parsed;
  try { parsed = JSON.parse(text); }
  catch { return res.status(502).json({ error: "AI did not return JSON" }); }
  const reason = validateEditBlocks(parsed?.time_blocks, profile.sleep_time);
  if (reason) return res.status(422).json({ error: reason });
  const blocks = parsed.time_blocks;

  await admin.from("time_blocks").delete().eq("day_plan_id", dp.id);
  await admin.from("time_blocks").insert(blocks.map((b, i) => ({
    day_plan_id: dp.id, user_id: userId,
    start_time: b.start_time, end_time: b.end_time, title: b.title,
    type: b.type, priority: b.priority ?? "medium", rationale: b.rationale ?? "",
    task_id: b.task_id ?? null, is_fixed: !!b.is_fixed,
    status: "pending", sort_index: i,
  })));
  await admin.from("day_plans").update({ provider_used: providerUsed }).eq("id", dp.id);

  res.status(200).json({ ok: true, count: blocks.length });
}
