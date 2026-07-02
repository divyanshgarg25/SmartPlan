import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase.js";
import { ShimmerCard, EmptyState } from "../components/States.jsx";
import { Github, Code2, Terminal, Activity, Flame } from "lucide-react";

function mondayISO(d = new Date()) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

function HeatCell({ value }) {
  const v = Math.min(1, value / 5);
  return <div className="aspect-square rounded-[3px] shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)] transition-colors duration-500" style={{ background: `rgba(14,165,233,${0.15 + v * 0.75})` }} title={`${value}`} />;
}

export default function InsightsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["insights"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const since = new Date(Date.now() - 30 * 86400000).toISOString();
      const [{ data: insights }, { data: logs }, { data: snap }] = await Promise.all([
        supabase.from("user_insights").select("*").eq("user_id", user.id).maybeSingle(),
        supabase.from("behavior_logs").select("kind, created_at").eq("user_id", user.id).gte("created_at", since),
        supabase.from("analytics_snapshots").select("*").eq("user_id", user.id).eq("week_start", mondayISO()).maybeSingle(),
      ]);
      return { insights, logs: logs ?? [], snap };
    },
  });

  if (isLoading) return <><ShimmerCard /><ShimmerCard /></>;
  const { insights, logs, snap } = data ?? {};

  // 7×24 heatmap (rows = day-of-week 0..6, cols = hour 0..23)
  const grid = Array.from({ length: 7 }, () => Array(24).fill(0));
  for (const l of logs) {
    if (l.kind !== "task_completed") continue;
    const d = new Date(l.created_at);
    grid[(d.getUTCDay() + 6) % 7][d.getUTCHours()]++;
  }

  const ext = snap?.external_stats;
  const hasAnyIntegration = ext && (
    (ext.github && !ext.github.error) ||
    (ext.leetcode && !ext.leetcode.error) ||
    (ext.codeforces && !ext.codeforces.error)
  );

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-6 flex items-center gap-3">
        <Activity className="text-brand" size={28} />
        Insights
      </h1>

      {!insights?.insights?.length ? (
        <EmptyState title="No insights yet" body="Use SmartPlan for a few days — insights appear once enough data is collected." />
      ) : (
        <ul className="space-y-2 mb-6">
          {insights.insights.map((i, idx) => (
            <li key={idx} className="p-3 rounded-xl2 bg-bg-card border border-border text-sm">
              {i.text}
            </li>
          ))}
        </ul>
      )}

      <h2 className="font-display text-lg mb-3 flex items-center gap-2">
        <Flame size={18} className="text-brand" />
        Completion heatmap <span className="text-xs font-normal text-ink-muted">(last 30 days)</span>
      </h2>
      <div className="bg-bg-card/40 border border-border/60 shadow-sm rounded-xl2 p-4 mb-8 overflow-x-auto">
        <div className="grid grid-cols-[auto_repeat(24,1fr)] gap-1 min-w-[600px] text-[10px]">
          <div></div>
          {Array.from({ length: 24 }, (_, h) => <div key={h} className="text-ink-muted text-center">{h}</div>)}
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((dn, di) => (
            <>
              <div key={dn} className="text-ink-muted pr-1">{dn}</div>
              {grid[di].map((v, hi) => <HeatCell key={`${di}-${hi}`} value={v} />)}
            </>
          ))}
        </div>
      </div>

      {hasAnyIntegration && (
        <>
          <h2 className="font-display text-lg mb-3">Dev-Sync <span className="text-xs font-normal text-ink-muted">(this week)</span></h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {ext.github && !ext.github.error && (
              <div className="group p-5 rounded-xl2 bg-bg-card border border-border/60 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
                <p className="text-xs font-bold text-ink flex items-center gap-1.5 mb-3 uppercase tracking-wider"><Github size={14} className="text-brand group-hover:scale-110 transition-transform" /> GitHub</p>
                <p className="text-3xl font-display">{ext.github.commits} <span className="text-sm font-normal text-ink-muted tracking-normal">commits</span></p>
                <p className="text-xs text-ink-muted mt-2 font-medium">{ext.github.prs} PRs · {ext.github.active_repos} repos</p>
              </div>
            )}
            {ext.leetcode && !ext.leetcode.error && (
              <div className="group p-5 rounded-xl2 bg-bg-card border border-border/60 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
                <p className="text-xs font-bold text-ink flex items-center gap-1.5 mb-3 uppercase tracking-wider"><Code2 size={14} className="text-brand group-hover:scale-110 transition-transform" /> LeetCode</p>
                <p className="text-3xl font-display">{ext.leetcode.total_solved}</p>
                <p className="text-xs text-ink-muted mt-2 font-medium">{ext.leetcode.easy} Easy / {ext.leetcode.medium} Med / {ext.leetcode.hard} Hard</p>
              </div>
            )}
            {ext.codeforces && !ext.codeforces.error && (
              <div className="group p-5 rounded-xl2 bg-bg-card border border-border/60 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
                <p className="text-xs font-bold text-ink flex items-center gap-1.5 mb-3 uppercase tracking-wider"><Terminal size={14} className="text-brand group-hover:scale-110 transition-transform" /> Codeforces</p>
                <p className="text-3xl font-display">{ext.codeforces.rating}</p>
                <p className="text-xs text-ink-muted mt-2 font-medium">Rank {ext.codeforces.rank} · Max {ext.codeforces.max_rating}</p>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
