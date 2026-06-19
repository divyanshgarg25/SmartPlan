// api/_lib/deterministicPlanner.js
//
// §3.4 Zero-token fallback. Runs when all AI providers have open circuits OR
// profiles.ai_data_consent = false. Builds a valid DayPlan using only fixed
// events, fixed-time tasks, and a deadline-aware greedy fill of remaining
// time in block_duration_mins chunks.
//
// The output is guaranteed to pass PlanValidator.

import { randomUUID } from "node:crypto";

function toMin(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function toHHMM(min) {
  const h = Math.floor(min / 60).toString().padStart(2, "0");
  const m = (min % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}

/**
 * @param {Object} ctx
 * @param {Object} ctx.profile
 * @param {Array}  ctx.tasks         — already capped at 30
 * @param {Array}  ctx.fixedEvents
 * @param {string} [ctx.date]        — ISO date, defaults to today
 * @returns {Object} DayPlan (matches §3.7 schema)
 */
export function buildDeterministicPlan(ctx) {
  const { profile, tasks, fixedEvents = [], date = new Date().toISOString().slice(0, 10) } = ctx;

  const wake = toMin(profile.wake_time);
  const sleep = toMin(profile.sleep_time);
  const blockLen = profile.block_duration_mins ?? 45;
  let cap = (profile.daily_hour_cap ?? 8) * 60;
  if (ctx.velocity !== undefined && ctx.velocity <= 0.4) {
    cap = Math.round(cap * 0.7); // Burnout protection throttle
  }

  // 1. Collect inviolable windows from fixed events + fixed-time tasks
  const fixedBlocks = [];
  for (const ev of fixedEvents) {
    fixedBlocks.push({
      kind: "fixed_event",
      title: ev.title,
      start: toMin(ev.start_time),
      end: toMin(ev.end_time),
      task_id: null,
    });
  }
  for (const t of tasks.filter((x) => x.is_fixed && x.fixed_time)) {
    const s = Math.max(wake, toMin(t.fixed_time));
    const e = Math.min(sleep, s + Math.max(blockLen, Math.round((t.estimated_hours || 1) * 60)));
    fixedBlocks.push({
      kind: t.type ?? "personal",
      title: t.title,
      start: s,
      end: e,
      task_id: t.id,
    });
  }
  
  if (ctx.failureZones) {
    for (const fz of ctx.failureZones) {
      fixedBlocks.push({
        kind: "failure_zone",
        title: "Biological Slump (Avoided)",
        start: toMin(fz),
        end: toMin(fz) + 60,
        task_id: null,
      });
    }
  }

  fixedBlocks.sort((a, b) => a.start - b.start);

  // 2. Free slots between wake..sleep minus fixed blocks
  const free = [];
  let cursor = wake;
  for (const fb of fixedBlocks) {
    if (fb.start > cursor) free.push([cursor, fb.start]);
    cursor = Math.max(cursor, fb.end);
  }
  if (cursor < sleep) free.push([cursor, sleep]);

  // 3. Greedy fill with non-fixed tasks sorted by (deadline asc, priority desc)
  const flexTasks = tasks.filter((t) => !t.is_fixed).map((t) => ({
    ...t,
    remaining_minutes: Math.max(blockLen, Math.round((t.estimated_hours || blockLen / 60) * 60))
  }));

  const priorityRank = { high: 0, medium: 1, low: 2 };
  flexTasks.sort((a, b) => {
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    if (da !== db) return da - db;
    return (priorityRank[a.priority] ?? 1) - (priorityRank[b.priority] ?? 1);
  });

  const planned = [];
  let totalUsed = 0;
  
  for (const slot of free) {
    let pos = slot[0];
    for (const t of flexTasks) {
      if (t.remaining_minutes <= 0) continue;
      if (totalUsed >= cap) break;
      
      const len = Math.min(t.remaining_minutes, slot[1] - pos, cap - totalUsed);
      
      // If available time < minimum block length, AND this isn't the final chunk of the task,
      // skip this task and try to backfill with a smaller lower-priority task.
      if (len < blockLen && len < t.remaining_minutes) continue; 
      
      if (len <= 0) break; // Slot exhausted

      planned.push({
        id: randomUUID(),
        start_time: toHHMM(pos),
        end_time: toHHMM(pos + len),
        title: t.remaining_minutes > len ? `${t.title} (Part)` : t.title,
        type: t.type ?? "deep_work",
        priority: t.priority ?? "medium",
        rationale: "Scheduled by deterministic planner — chunked to fit available time.",
        task_id: t.id,
        is_fixed: false,
        status: "pending",
      });
      
      pos += len;
      totalUsed += len;
      t.remaining_minutes -= len;
      
      // Move to next slot if this one is practically exhausted (<15m remaining)
      if (slot[1] - pos < 15) break;
    }
  }

  // 4. Merge fixed blocks + flex into chronological order
  const fixedConverted = fixedBlocks.map((fb) => ({
    id: randomUUID(),
    start_time: toHHMM(fb.start),
    end_time: toHHMM(fb.end),
    title: fb.title,
    type: fb.kind,
    priority: "none",
    rationale: "Fixed event — protected from rescheduling.",
    task_id: fb.task_id,
    is_fixed: true,
    status: "pending",
  }));

  const allBlocks = [...fixedConverted, ...planned].sort(
    (a, b) => toMin(a.start_time) - toMin(b.start_time)
  );

  const deferred = flexTasks.filter((t) => t.remaining_minutes > 0).map((t) => t.id);

  return {
    date,
    daily_insight: ctx.velocity !== undefined && ctx.velocity <= 0.4 
      ? "You've been moving slower recently. I've automatically reduced your workload to protect you from burnout."
      : "AI-assisted planning is off or unavailable — here is a safe deterministic schedule.",
    estimated_focus_hours: +(totalUsed / 60).toFixed(2),
    time_blocks: allBlocks,
    deferred_tasks: deferred,
    tips: [
      "Tackle the earliest-deadline task first.",
      "Take a short break between deep-work blocks.",
    ],
    provider_used: "deterministic",
  };
}
