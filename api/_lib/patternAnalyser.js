// api/_lib/patternAnalyser.js — §3.11
// Examines last 30 days of behavior_logs + check_ins for a user and writes
// plain-English findings into user_insights. ZERO-token (no AI) — purely
// statistical. Called by cron-poller `analyseUsers` loop.

const KIND_TASK_COMPLETED = "task_completed";

function hourOf(iso) { return new Date(iso).getUTCHours(); }
function topN(map, n) {
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

export async function analyseUser(admin, userId) {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();

  const [{ data: logs }, { data: checkins }] = await Promise.all([
    admin.from("behavior_logs").select("kind, payload, created_at")
      .eq("user_id", userId).gte("created_at", since).limit(5000),
    admin.from("check_ins").select("mood, energy, blocker, created_at")
      .eq("user_id", userId).gte("created_at", since).limit(200),
  ]);

  const insights = [];

  // 1) Peak completion hour
  const hourBuckets = new Map();
  for (const l of logs ?? []) {
    if (l.kind !== KIND_TASK_COMPLETED) continue;
    const h = hourOf(l.created_at);
    hourBuckets.set(h, (hourBuckets.get(h) ?? 0) + 1);
  }
  if (hourBuckets.size) {
    const [[peakHour, count]] = topN(hourBuckets, 1);
    insights.push({
      kind: "peak_hour", peak_hour: peakHour,
      text: `You finish the most tasks around ${peakHour}:00 (${count} in last 30 days). Plan deep work then.`,
    });
  }

  // 2) Average mood + energy
  if (checkins?.length) {
    const avgMood = +(checkins.reduce((s, c) => s + (c.mood ?? 0), 0) / checkins.length).toFixed(2);
    const avgEnergy = +(checkins.reduce((s, c) => s + (c.energy ?? 0), 0) / checkins.length).toFixed(2);
    insights.push({
      kind: "wellbeing", avg_mood: avgMood, avg_energy: avgEnergy,
      text: `Average mood ${avgMood}/5 and energy ${avgEnergy}/5 over the last 30 days.`,
    });
  }

  // 3) Top blockers
  const blockerCounts = new Map();
  for (const c of checkins ?? []) {
    if (!c.blocker) continue;
    const k = c.blocker.toLowerCase().slice(0, 40);
    blockerCounts.set(k, (blockerCounts.get(k) ?? 0) + 1);
  }
  if (blockerCounts.size) {
    const top = topN(blockerCounts, 3).map(([w, n]) => `${w} (${n}×)`).join(", ");
    insights.push({ kind: "blockers", text: `Recurring blockers: ${top}.` });
  }

  // 4) Skip rate
  const skipped = (logs ?? []).filter((l) => l.kind === "block_skipped").length;
  const completed = (logs ?? []).filter((l) => l.kind === KIND_TASK_COMPLETED).length;
  const total = skipped + completed;
  if (total >= 10) {
    const rate = +(skipped / total).toFixed(2);
    insights.push({
      kind: "skip_rate", rate,
      text: rate > 0.3
        ? `Skip rate is ${(rate * 100).toFixed(0)}% — consider shorter blocks or lower daily cap.`
        : `Skip rate is healthy at ${(rate * 100).toFixed(0)}%.`,
    });
  }

  // Persist (overwrite latest)
  await admin.from("user_insights").upsert({
    user_id: userId,
    generated_at: new Date().toISOString(),
    insights,
  }, { onConflict: "user_id" });

  return insights;
}
