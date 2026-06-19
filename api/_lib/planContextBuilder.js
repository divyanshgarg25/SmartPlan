// api/_lib/planContextBuilder.js
// Assembles the prompt context. Spec §3.5 step 5, §3.6 rules.
// HARD CAP: top 30 tasks sorted by urgency.
// Respects ai_data_consent — patterns omitted if false.

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

export async function buildPlanContext(supabase, userId) {
  const today = new Date().toISOString().slice(0, 10);

  const [
    { data: profile, error: pErr },
    { data: checkInRows },
    { data: tasks },
    { data: fixedEvents },
    { data: yesterdayPlan },
    { data: insights },
    { data: last7Days },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).single(),
    supabase.from("check_ins").select("*").eq("user_id", userId).eq("date", today).limit(1),
    supabase.from("tasks").select("*").eq("user_id", userId).in("status", ["inbox", "scheduled"]),
    supabase.from("fixed_events").select("*").eq("user_id", userId).eq("day_of_week", new Date().getDay()),
    supabase.from("day_plans").select("id, time_blocks(*)").eq("user_id", userId).lt("date", today).order("date", { ascending: false }).limit(1).single(),
    supabase.from("user_insights").select("insights").eq("user_id", userId).maybeSingle(),
    supabase.from("day_plans").select("id, date, time_blocks(start_time, status)").eq("user_id", userId).gte("date", new Date(Date.now() - 7 * 24 * 3600_000).toISOString().slice(0, 10)).lt("date", today),
  ]);

  if (pErr || !profile) throw new Error("Profile not found");

  // Sort by urgency: deadline asc, then priority
  const sorted = (tasks ?? []).sort((a, b) => {
    const da = a.deadline ? new Date(a.deadline).getTime() : Infinity;
    const db = b.deadline ? new Date(b.deadline).getTime() : Infinity;
    if (da !== db) return da - db;
    return (PRIORITY_RANK[a.priority] ?? 1) - (PRIORITY_RANK[b.priority] ?? 1);
  }).slice(0, 30); // HARD CAP §3.6

  const carryOvers = (yesterdayPlan?.time_blocks ?? [])
    .filter((b) => b.status === "pending")
    .map((b) => ({ title: b.title, task_id: b.task_id }));

  const now = Date.now();
  const highPriorityDueSoon = sorted
    .filter((t) => t.priority === "high" && t.deadline && new Date(t.deadline).getTime() - now < 24 * 3600_000)
    .map((t) => t.id);

  let totalBlocks = 0;
  let completedBlocks = 0;
  const hourStats = {}; 

  for (const dp of last7Days ?? []) {
    for (const b of dp.time_blocks ?? []) {
      totalBlocks++;
      if (b.status === "completed") completedBlocks++;
      
      const hour = parseInt(b.start_time.split(":")[0], 10);
      if (!hourStats[hour]) hourStats[hour] = { total: 0, completed: 0 };
      hourStats[hour].total++;
      if (b.status === "completed") hourStats[hour].completed++;
    }
  }

  const velocity = totalBlocks > 0 ? +(completedBlocks / totalBlocks).toFixed(2) : 1.0;
  
  const failureZones = [];
  const flowZones = [];
  for (const [hourStr, stats] of Object.entries(hourStats)) {
    const hr = parseInt(hourStr, 10);
    if (stats.total >= 3) { 
      const rate = stats.completed / stats.total;
      if (rate <= 0.4) failureZones.push(`${hr.toString().padStart(2, "0")}:00`);
      if (rate >= 0.8) flowZones.push(`${hr.toString().padStart(2, "0")}:00`);
    }
  }

  return {
    profile,
    checkIn: checkInRows?.[0] ?? null,
    tasks: sorted,
    fixedEvents: fixedEvents ?? [],
    carryOvers,
    patterns: profile.ai_data_consent ? insights?.insights ?? null : null,
    highPriorityDueSoon,
    velocity,
    failureZones,
    flowZones,
  };
}
