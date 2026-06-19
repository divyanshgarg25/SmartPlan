// api/_lib/weeklyReview.js — §4.7
// Aggregates the past week (day_plans, behavior_logs, dev-sync stats) and
// asks AI for a 200-word narrative. Falls back to a deterministic summary if
// no AI consent or all providers down. Writes to analytics_snapshots.ai_review_text.

import { generateBuffered } from "./aiProviderManager.js";

function isoMondayThisWeek() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function deterministicReview(stats) {
  const lines = [`This week you completed ${stats.completedTasks} tasks across ${stats.activeDays} active days.`];
  if (stats.skipRate > 0.3) lines.push(`Skip rate was ${(stats.skipRate * 100).toFixed(0)}% — consider lighter blocks.`);
  else lines.push(`Skip rate stayed healthy at ${(stats.skipRate * 100).toFixed(0)}%.`);
  if (stats.devSync?.github?.commits) lines.push(`GitHub: ${stats.devSync.github.commits} commits.`);
  if (stats.devSync?.leetcode?.total_solved != null) lines.push(`LeetCode total solved: ${stats.devSync.leetcode.total_solved}.`);
  return lines.join(" ");
}

const SYS = `Write a warm, concrete weekly review for a student (140-220 words).
Use second person ("you"). Praise wins, name 1 specific friction, suggest
ONE focused experiment for next week. Plain prose only (no headings, no bullets).`;

export async function runWeeklyReview(admin, userId, weekStart = isoMondayThisWeek()) {
  const since = weekStart + "T00:00:00Z";

  const [{ data: plans }, { data: logs }, { data: snap }, { data: profile }] = await Promise.all([
    admin.from("day_plans").select("date, energy_score, estimated_focus_hours")
      .eq("user_id", userId).gte("date", weekStart),
    admin.from("behavior_logs").select("kind, created_at").eq("user_id", userId).gte("created_at", since),
    admin.from("analytics_snapshots").select("external_stats").eq("user_id", userId).eq("week_start", weekStart).maybeSingle(),
    admin.from("profiles").select("ai_data_consent").eq("id", userId).single(),
  ]);

  const completed = (logs ?? []).filter((l) => l.kind === "task_completed").length;
  const skipped = (logs ?? []).filter((l) => l.kind === "block_skipped").length;
  const skipRate = (completed + skipped) > 0 ? skipped / (completed + skipped) : 0;
  const stats = {
    activeDays: plans?.length ?? 0,
    completedTasks: completed,
    skipRate,
    avgEnergy: plans?.length ? +(plans.reduce((s, p) => s + (p.energy_score ?? 0), 0) / plans.length).toFixed(1) : null,
    devSync: snap?.external_stats ?? null,
  };

  let text;
  if (profile?.ai_data_consent) {
    const { text: aiText } = await generateBuffered({
      system: SYS,
      user: JSON.stringify({ stats }),
    });
    text = (aiText ?? "").trim() || deterministicReview(stats);
  } else {
    text = deterministicReview(stats);
  }

  await admin.from("analytics_snapshots").upsert({
    user_id: userId, week_start: weekStart,
    ai_review_text: text,
    summary_stats: stats,
  }, { onConflict: "user_id,week_start" });

  return { text, stats };
}
