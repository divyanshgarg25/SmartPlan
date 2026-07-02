import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "../services/supabase.js";
import { useRefineDay } from "../hooks/useWeekPlan.js";
import TimeBlockCard from "../components/TimeBlockCard.jsx";
import { ShimmerCard, EmptyState } from "../components/States.jsx";
import { addToast } from "../hooks/useToast.js";
import { motion } from "framer-motion";

export default function WeekDayPage() {
  const { date } = useParams();
  const refine = useRefineDay();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    const { data } = await supabase.from("day_plans")
      .select("*, time_blocks(*)")
      .eq("user_id", user.id).eq("date", date).maybeSingle();
    if (data?.time_blocks) data.time_blocks.sort((a, b) => a.sort_index - b.sort_index);
    setPlan(data); setLoading(false);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load(); }, [date]);

  async function doRefine() {
    await refine.mutateAsync(date);
    addToast("Day successfully refined", "success");
    load();
  }

  async function completeBlock(id) {
    const { error } = await supabase.from("time_blocks").update({ status: "completed" }).eq("id", id);
    if (!error) {
       addToast("Block completed! Great focus.", "success");
       load();
    } else {
       addToast("Failed to update block", "error");
    }
  }

  const totalBlocks = plan?.time_blocks?.length || 0;
  const completedBlocks = plan?.time_blocks?.filter(b => b.status === "completed")?.length || 0;
  const progress = totalBlocks > 0 ? completedBlocks / totalBlocks : 0;
  const radius = 24;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - progress * circumference;

  return (
    <div className="glass p-6 sm:p-8 rounded-2xl relative overflow-hidden border border-border shadow-2xl">
      {/* Decorative ambient orb */}
      <div className="absolute -top-32 -right-32 w-80 h-80 rounded-full blur-[100px] opacity-20 pointer-events-none bg-brand" />
      
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 relative">
        <div className="flex items-center gap-6">
          <div>
            <Link to="/week" className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand/80 transition-colors uppercase tracking-wider">
              ← back to week
            </Link>
            <h1 className="font-display text-3xl sm:text-4xl font-bold mt-2 text-ink tracking-tight">{date}</h1>
          </div>
          
          {totalBlocks > 0 && (
            <div className="relative w-16 h-16 flex-shrink-0 self-end mb-1">
              <svg className="w-full h-full transform -rotate-90" viewBox="0 0 60 60">
                <circle cx="30" cy="30" r={radius} className="stroke-border/40" strokeWidth="4" fill="none" />
                <motion.circle
                  cx="30" cy="30" r={radius}
                  className="stroke-brand drop-shadow-[0_0_8px_rgb(var(--brand)/0.6)]"
                  strokeWidth="4" fill="none" strokeLinecap="round"
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset: offset }}
                  transition={{ duration: 1, type: "spring", bounce: 0.3 }}
                  style={{ strokeDasharray: circumference }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-bold text-ink leading-none">{Math.round(progress * 100)}%</span>
              </div>
            </div>
          )}
        </div>
        {!plan && (
          <button onClick={doRefine} disabled={refine.isPending}
                  className="px-6 py-2.5 rounded-xl bg-brand text-brand-fg text-sm font-semibold shadow-[0_4px_14px_0_rgb(var(--brand)/0.3)] hover:shadow-[0_6px_20px_rgb(var(--brand)/0.4)] disabled:opacity-60 transition-all active:scale-95">
            {refine.isPending ? "Refining…" : "Refine this day"}
          </button>
        )}
      </div>
      
      <div className="relative">
        {loading ? <ShimmerCard /> :
          !plan ? <EmptyState title="No plan for this day" body="Tap Refine to generate one." /> :
          <ul className="space-y-4">{plan.time_blocks.map((b, i) => <TimeBlockCard key={b.id} block={b} index={i} onComplete={completeBlock} />)}</ul>}
      </div>
    </div>
  );
}
