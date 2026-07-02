import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase.js";
import { ShimmerCard, EmptyState } from "../components/States.jsx";
import { CalendarDays, CheckCircle2, FastForward, Sparkles } from "lucide-react";

function mondayISO(d = new Date()) {
  const x = new Date(d);
  x.setUTCDate(x.getUTCDate() - ((x.getUTCDay() + 6) % 7));
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

export default function ReviewPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["weekly-review"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("analytics_snapshots")
        .select("*").eq("user_id", user.id).eq("week_start", mondayISO()).maybeSingle();
      return data;
    },
  });

  if (isLoading) return <ShimmerCard />;
  if (!data?.ai_review_text) return <EmptyState title="No weekly review yet" body="Reviews are generated automatically every Sunday night." />;

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-2 flex items-center gap-3">
        <Sparkles size={28} className="text-brand" />
        This week
      </h1>
      <p className="text-xs font-semibold text-ink-muted mb-6 uppercase tracking-wider">Week of {data.week_start}</p>
      <article className="prose prose-invert max-w-none bg-bg-card border border-border/60 shadow-sm rounded-xl2 p-6">
        <p className="leading-relaxed whitespace-pre-line">{data.ai_review_text}</p>
      </article>
      {data.summary_stats && (
        <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div className="group p-5 rounded-xl2 bg-bg-card border border-border/60 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
            <p className="text-xs font-bold text-ink flex items-center gap-1.5 mb-3 uppercase tracking-wider"><CalendarDays size={14} className="text-brand group-hover:scale-110 transition-transform" /> Active days</p>
            <p className="text-3xl font-display">{data.summary_stats.activeDays}</p>
          </div>
          <div className="group p-5 rounded-xl2 bg-bg-card border border-border/60 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
            <p className="text-xs font-bold text-ink flex items-center gap-1.5 mb-3 uppercase tracking-wider"><CheckCircle2 size={14} className="text-brand group-hover:scale-110 transition-transform" /> Completed</p>
            <p className="text-3xl font-display">{data.summary_stats.completedTasks}</p>
          </div>
          <div className="group p-5 rounded-xl2 bg-bg-card border border-border/60 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all">
            <p className="text-xs font-bold text-ink flex items-center gap-1.5 mb-3 uppercase tracking-wider"><FastForward size={14} className="text-brand group-hover:scale-110 transition-transform" /> Skip rate</p>
            <p className="text-3xl font-display">{(data.summary_stats.skipRate * 100).toFixed(0)}%</p>
          </div>
        </div>
      )}
    </div>
  );
}
