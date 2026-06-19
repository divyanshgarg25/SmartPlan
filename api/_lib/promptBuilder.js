// api/_lib/promptBuilder.js
//
// Pure function. Builds the system + user prompt for daily plan generation.
// Spec §3.6 — context injected into every prompt. HARD CAP at 30 tasks.
// Pre-multiply estimated_hours by profile.time_multiplier BEFORE injection.

/**
 * @param {Object} ctx
 * @param {Object} ctx.profile      — profiles row
 * @param {Object} ctx.checkIn      — today's check_ins row (or null)
 * @param {Array}  ctx.tasks        — up to 30, sorted by urgency
 * @param {Array}  ctx.fixedEvents  — recurring weekly events for today's DOW
 * @param {Array}  ctx.carryOvers   — yesterday's incomplete blocks
 * @param {Object} [ctx.patterns]   — user_insights.insights (only if consent)
 * @param {number} ctx.velocity     — 7 day task completion rate
 * @param {Array}  ctx.failureZones — array of "HH:00" strings (low productivity)
 * @param {Array}  ctx.flowZones    — array of "HH:00" strings (high productivity)
 * @returns {{ system: string, user: string }}
 */
export function buildDailyPlanPrompt(ctx) {
  const {
    profile,
    checkIn,
    tasks,
    fixedEvents = [],
    carryOvers = [],
    patterns = null,
    velocity = 1.0,
    failureZones = [],
    flowZones = [],
  } = ctx;

  if (tasks.length > 30) {
    throw new Error("PromptBuilder: tasks must be capped at 30 BEFORE calling.");
  }

  const mult = Number(profile.time_multiplier ?? 1.3);
  const adjustedTasks = tasks.map((t) => ({
    id: t.id,
    title: t.title,
    subject: t.subject ?? null,
    type: t.type,
    priority: t.priority,
    deadline: t.deadline ?? null,
    is_fixed: t.is_fixed,
    fixed_time: t.fixed_time ?? null,
    // Spec §9: never use raw user estimates — pre-multiply.
    estimated_hours: t.estimated_hours == null ? null : +(t.estimated_hours * mult).toFixed(2),
  }));

  const system = [
    "You are SmartPlan, an AI productivity planner for students.",
    "Produce a single JSON object matching the DayPlan schema. No prose, no markdown.",
    "Schema: { date, daily_insight, estimated_focus_hours,",
    '  time_blocks: [{ id, start_time "HH:MM", end_time "HH:MM", title, type,',
    "    priority, rationale (required), task_id, is_fixed, status:\"pending\" }],",
    "  deferred_tasks: [task_id], tips: [2-3 strings], provider_used }",
    "Rules:",
    "- All time_blocks within wake_time..sleep_time.",
    "- No overlaps. Sorted chronologically.",
    "- Respect every is_fixed task and fixed_event as immovable.",
    "- High-priority tasks with deadline < 24h MUST be scheduled, not deferred.",
    "- Every block needs a one-sentence rationale.",
    velocity < 0.4 ? "- The user's recent velocity is low (<40%). Schedule 30% fewer tasks to prevent burnout." : "",
    failureZones.length ? `- Absolutely avoid scheduling non-fixed tasks during Failure Zones: [${failureZones.join(", ")}].` : "",
    flowZones.length ? `- Prioritize deep_work tasks during Flow Zones: [${flowZones.join(", ")}].` : "",
    "- Output ends with closing } of the DayPlan object.",
  ].join("\n");

  const user = JSON.stringify(
    {
      today: new Date().toISOString().slice(0, 10),
      profile: {
        wake_time: profile.wake_time,
        sleep_time: profile.sleep_time,
        timezone: profile.timezone,
        major: profile.major,
        year: profile.year,
        peak_hours: [profile.peak_hours_start, profile.peak_hours_end],
        block_duration_mins: profile.block_duration_mins,
        daily_hour_cap: profile.daily_hour_cap,
      },
      check_in: checkIn
        ? {
            top_priority: checkIn.top_priority,
            blocker: checkIn.blocker,
          }
        : null,
      tasks: adjustedTasks, // already capped + time-adjusted
      fixed_events: fixedEvents.map((e) => ({
        title: e.title,
        start_time: e.start_time,
        end_time: e.end_time,
      })),
      carry_overs: carryOvers,
      patterns,
    },
    null,
    0
  );

  return { system, user };
}
