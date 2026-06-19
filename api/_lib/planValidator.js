// api/_lib/planValidator.js
//
// Pure function. Validates a complete buffered AI response against §3.7
// schema + §3.8 rules. Returns { ok, plan, errors }. On failure the caller
// re-prompts (max 2 retries) with errors injected, per §3.2.

const VALID_BLOCK_TYPES = new Set([
  "deep_work", "light_work", "admin", "break",
  "fixed_event", "social", "health", "personal",
]);
const VALID_PRIORITIES = new Set(["high", "medium", "low", "none"]);

const HHMM = /^([01]\d|2[0-3]):([0-5]\d)$/;

function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * @param {string|object} raw — buffered AI output (string OR pre-parsed object)
 * @param {object} ctx
 * @param {string} ctx.wakeTime   — "HH:MM"
 * @param {string} ctx.sleepTime  — "HH:MM" (may be < wakeTime for night-shift; we treat as same-day)
 * @param {Array}  [ctx.fixedWindows] — [{start_time,end_time}] inviolable
 * @param {Array}  [ctx.highPriorityDueSoon] — [task_id] that MUST be scheduled
 * @returns {{ ok: boolean, plan: object|null, errors: string[] }}
 */
export function validatePlan(raw, ctx) {
  const errors = [];

  // --- Truncation detection (§3.8) -----------------------------------------
  let parsed = null;
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed.endsWith("}")) {
      errors.push("TRUNCATED: response does not end with closing '}' of DayPlan.");
      return { ok: false, plan: null, errors };
    }
    try {
      parsed = JSON.parse(trimmed);
    } catch (e) {
      errors.push(`PARSE_ERROR: ${e.message}`);
      return { ok: false, plan: null, errors };
    }
  } else if (raw && typeof raw === "object") {
    parsed = raw;
  } else {
    errors.push("EMPTY_RESPONSE");
    return { ok: false, plan: null, errors };
  }

  // --- Schema --------------------------------------------------------------
  const required = ["date", "daily_insight", "energy_score", "estimated_focus_hours", "time_blocks", "deferred_tasks", "tips", "provider_used"];
  for (const k of required) {
    if (!(k in parsed)) errors.push(`MISSING_FIELD: ${k}`);
  }
  if (errors.length) return { ok: false, plan: null, errors };

  if (typeof parsed.date !== "string") errors.push("TYPE: date must be string");
  if (typeof parsed.daily_insight !== "string") errors.push("TYPE: daily_insight must be string");
  if (!Number.isInteger(parsed.energy_score) || parsed.energy_score < 1 || parsed.energy_score > 10)
    errors.push("RANGE: energy_score must be int 1..10");
  if (typeof parsed.estimated_focus_hours !== "number") errors.push("TYPE: estimated_focus_hours must be number");
  if (!Array.isArray(parsed.time_blocks)) errors.push("TYPE: time_blocks must be array");
  if (!Array.isArray(parsed.deferred_tasks)) errors.push("TYPE: deferred_tasks must be array");
  if (!Array.isArray(parsed.tips) || parsed.tips.length < 2 || parsed.tips.length > 3)
    errors.push("RANGE: tips must be 2..3 strings");
  if (typeof parsed.provider_used !== "string") errors.push("TYPE: provider_used must be string");
  if (errors.length) return { ok: false, plan: null, errors };

  // --- Per-block validation ------------------------------------------------
  const wakeMin = toMinutes(ctx.wakeTime);
  const sleepMin = toMinutes(ctx.sleepTime);
  const fixedWindows = (ctx.fixedWindows || []).map((w) => [toMinutes(w.start_time), toMinutes(w.end_time)]);

  const blocks = parsed.time_blocks;
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    const tag = `time_blocks[${i}]`;
    for (const f of ["id", "start_time", "end_time", "title", "type", "priority", "rationale", "is_fixed", "status"]) {
      if (!(f in b)) errors.push(`${tag}.${f}: MISSING`);
    }
    if (errors.length) continue;

    if (!HHMM.test(b.start_time)) errors.push(`${tag}.start_time invalid HH:MM`);
    if (!HHMM.test(b.end_time)) errors.push(`${tag}.end_time invalid HH:MM`);
    if (!VALID_BLOCK_TYPES.has(b.type)) errors.push(`${tag}.type invalid: ${b.type}`);
    if (!VALID_PRIORITIES.has(b.priority)) errors.push(`${tag}.priority invalid`);
    if (typeof b.rationale !== "string" || b.rationale.trim().length === 0)
      errors.push(`${tag}.rationale is required and must be non-empty`);
    if (b.status !== "pending") errors.push(`${tag}.status must be "pending"`);

    if (errors.length) continue;

    const s = toMinutes(b.start_time);
    const e = toMinutes(b.end_time);
    if (e <= s) errors.push(`${tag}: end_time must be after start_time`);
    if (s < wakeMin || e > sleepMin) errors.push(`${tag}: outside wake..sleep window`);
    for (const [fs, fe] of fixedWindows) {
      if (!b.is_fixed && rangesOverlap(s, e, fs, fe)) {
        errors.push(`${tag}: overlaps an inviolable fixed window ${fs}-${fe}`);
      }
    }
  }
  if (errors.length) return { ok: false, plan: null, errors };

  // --- Chronological + no-overlap ------------------------------------------
  const sorted = [...blocks].map((b, i) => ({ i, s: toMinutes(b.start_time), e: toMinutes(b.end_time) }))
                            .sort((a, b) => a.s - b.s);
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].i !== i) errors.push("ORDER: time_blocks not sorted chronologically");
    if (i > 0 && sorted[i].s < sorted[i - 1].e) {
      errors.push(`OVERLAP: blocks [${sorted[i - 1].i},${sorted[i].i}]`);
    }
  }

  // --- High-priority deadline < 24h MUST be scheduled ----------------------
  const scheduledTaskIds = new Set(blocks.map((b) => b.task_id).filter(Boolean));
  for (const taskId of ctx.highPriorityDueSoon || []) {
    if (!scheduledTaskIds.has(taskId) && parsed.deferred_tasks.includes(taskId)) {
      errors.push(`DEFERRED_HIGH_PRIORITY: ${taskId} due in <24h was deferred`);
    }
  }

  if (errors.length) return { ok: false, plan: null, errors };
  return { ok: true, plan: parsed, errors: [] };
}
