// api/_lib/insertionPlanner.js — deterministic mid-week slot finder.
// Pure function. Given an existing per-day perDay map and a new flex task,
// inserts it into the first day with sufficient remaining capacity before
// the task deadline. If no slot fits, returns it as overflow.

export function insertTask(perDay, task, dailyHourCap = 8) {
  const days = Object.keys(perDay).sort();
  const deadlineDay = task.deadline ? task.deadline.slice(0, 10) : null;
  for (const day of days) {
    if (deadlineDay && day > deadlineDay) break;
    const used = (perDay[day] ?? []).reduce((s, x) => s + x.hours, 0);
    if (used + (task.estimated_hours ?? 0) <= dailyHourCap) {
      perDay[day] = [...(perDay[day] ?? []), {
        task_id: task.id, title: task.title, hours: task.estimated_hours ?? 1,
        priority: task.priority ?? "medium",
      }];
      return { day, overflowed: false };
    }
  }
  return { day: null, overflowed: true };
}
