// api/_lib/deadlinePlanner.js
//
// Pure JS. Distributes flexible tasks across the days remaining until each
// deadline, respecting daily_hour_cap. Spec §3.11 — backward planning from
// deadline. Used by weekly skeleton generation (Phase 2) and as input to
// DeterministicPlanner.

/**
 * @param {Array}  tasks            — flexible tasks (is_fixed=false) with deadline + estimated_hours
 * @param {number} dailyHourCap     — profiles.daily_hour_cap
 * @param {Date}   [today]
 * @returns {Object} { perDay: { 'YYYY-MM-DD': [{task_id, hours}] }, overflowTaskIds: string[] }
 */
export function planByDeadlines(tasks, dailyHourCap, today = new Date()) {
  const perDay = {};
  const overflowTaskIds = [];
  const dayHours = {}; // running per-day hours allocated

  const startOfToday = new Date(today);
  startOfToday.setHours(0, 0, 0, 0);

  const sorted = [...tasks]
    .filter((t) => t.deadline && t.estimated_hours > 0)
    .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

  for (const t of sorted) {
    const dueDay = new Date(t.deadline);
    dueDay.setHours(0, 0, 0, 0);
    const daysAvail = Math.max(1, Math.round((dueDay - startOfToday) / 86_400_000));
    const perDayShare = t.estimated_hours / daysAvail;

    let allocated = 0;
    for (let d = 0; d < daysAvail && allocated < t.estimated_hours; d++) {
      const dayDate = new Date(startOfToday.getTime() + d * 86_400_000);
      const key = dayDate.toISOString().slice(0, 10);
      const used = dayHours[key] ?? 0;
      const free = Math.max(0, dailyHourCap - used);
      const give = Math.min(free, perDayShare, t.estimated_hours - allocated);
      if (give <= 0) continue;
      (perDay[key] ??= []).push({ task_id: t.id, hours: +give.toFixed(2) });
      dayHours[key] = used + give;
      allocated += give;
    }
    if (allocated + 1e-6 < t.estimated_hours) overflowTaskIds.push(t.id);
  }

  return { perDay, overflowTaskIds };
}
