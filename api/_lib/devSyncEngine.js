// api/_lib/devSyncEngine.js — §4.6
// Fetches public stats from GitHub, LeetCode, Codeforces for a user's
// configured handles. No auth tokens required (all public REST/GraphQL).
// Writes into analytics_snapshots.external_stats for the current week.

function isoMondayThisWeek() {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

async function fetchGithub(username) {
  if (!username) return null;
  try {
    const r = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=100`, {
      headers: { Accept: "application/vnd.github+json", "User-Agent": "smartplan-app" },
    });
    if (!r.ok) return { error: r.status };
    const events = await r.json();
    const since = Date.now() - 7 * 86400000;
    const recent = events.filter((e) => new Date(e.created_at).getTime() >= since);
    let commits = 0, prs = 0, issues = 0, repos = new Set();
    for (const ev of recent) {
      repos.add(ev.repo?.name);
      if (ev.type === "PushEvent") commits += ev.payload?.commits?.length ?? 0;
      if (ev.type === "PullRequestEvent") prs++;
      if (ev.type === "IssuesEvent") issues++;
    }
    return { commits, prs, issues, active_repos: repos.size, total_events_7d: recent.length };
  } catch (e) { return { error: e.message }; }
}

async function fetchLeetcode(username) {
  if (!username) return null;
  const query = `query userStats($u: String!) {
    matchedUser(username: $u) {
      submitStats { acSubmissionNum { difficulty count } }
      profile { ranking reputation }
    }
  }`;
  try {
    const r = await fetch("https://leetcode.com/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": "smartplan-app" },
      body: JSON.stringify({ query, variables: { u: username } }),
    });
    if (!r.ok) return { error: r.status };
    const j = await r.json();
    const stats = j.data?.matchedUser?.submitStats?.acSubmissionNum ?? [];
    const totals = Object.fromEntries(stats.map((s) => [s.difficulty, s.count]));
    return {
      total_solved: totals.All ?? 0,
      easy: totals.Easy ?? 0, medium: totals.Medium ?? 0, hard: totals.Hard ?? 0,
      ranking: j.data?.matchedUser?.profile?.ranking ?? null,
    };
  } catch (e) { return { error: e.message }; }
}

async function fetchCodeforces(handle) {
  if (!handle) return null;
  try {
    const r = await fetch(`https://codeforces.com/api/user.info?handles=${encodeURIComponent(handle)}`);
    if (!r.ok) return { error: r.status };
    const j = await r.json();
    const u = j.result?.[0];
    if (!u) return { error: "no user" };
    return { rating: u.rating, max_rating: u.maxRating, rank: u.rank, max_rank: u.maxRank };
  } catch (e) { return { error: e.message }; }
}

export async function runDevSync(admin, userId) {
  const { data: integ } = await admin.from("integrations").select("*").eq("user_id", userId).maybeSingle();
  if (!integ) return { skipped: true };

  const [github, leetcode, codeforces] = await Promise.all([
    fetchGithub(integ.github_username),
    fetchLeetcode(integ.leetcode_username),
    fetchCodeforces(integ.codeforces_handle),
  ]);
  const stats = { github, leetcode, codeforces, fetched_at: new Date().toISOString() };
  const week = isoMondayThisWeek();

  await admin.from("analytics_snapshots").upsert({
    user_id: userId, week_start: week, external_stats: stats,
  }, { onConflict: "user_id,week_start" });

  return stats;
}
