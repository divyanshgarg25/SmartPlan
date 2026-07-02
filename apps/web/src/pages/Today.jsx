import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useState } from "react";
import { usePersistedPlan, useDailyPlanGenerator, useVelocity } from "../hooks/useDailyPlan.js";
import { useTodayCheckIn } from "../hooks/useCheckIn.js";
import TimeBlockCard from "../components/TimeBlockCard.jsx";
import EditPlanSheet from "../components/EditPlanSheet.jsx";
import { ShimmerCard, ErrorState, EmptyState } from "../components/States.jsx";
import { supabase } from "../services/supabase.js";
import { logBehavior } from "../services/behaviorLog.js";
import { Wand2, Sparkles, Play } from "lucide-react";

export default function TodayPage() {
  const persisted = usePersistedPlan();
  const { state, blocks, providerUsed, error, generate } = useDailyPlanGenerator();
  const checkIn = useTodayCheckIn();
  const velocity = useVelocity();
  const [editOpen, setEditOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  // Show streaming blocks if generation is in progress, else show persisted.
  const showStream = ["streaming", "thinking", "done"].includes(state);
  const visibleBlocks = showStream && blocks.length ? blocks : (persisted.data?.time_blocks ?? []);
  const provider = providerUsed ?? persisted.data?.provider_used;

  async function complete(blockId) {
    await supabase.from("time_blocks").update({ status: "completed" }).eq("id", blockId);
    await logBehavior("task_completed", { block_id: blockId });
    persisted.refetch();
  }

  // Auto-prompt check-in before 10am if missing
  useEffect(() => {
    if (!checkIn.isLoading && !checkIn.data && new Date().getHours() < 10) {
      // soft nudge only — the page renders a CTA below
    }
  }, [checkIn.data, checkIn.isLoading]);

  return (
    <div>
      <header className="flex items-baseline justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-3xl font-bold">Today</h1>
          {!velocity.isLoading && (
            <span className={`px-2.5 py-1 text-xs font-semibold rounded-full border ${
              velocity.data >= 80 ? "bg-success/10 text-success border-success/30" : 
              velocity.data >= 40 ? "bg-brand/10 text-brand border-brand/30" : 
              "bg-warning/10 text-warning border-warning/30"
            }`}>
              Velocity: {velocity.data}%
            </span>
          )}
        </div>
        <div className="flex gap-3">
          <Link
            to="/focus"
            className="group px-4 py-2.5 rounded-xl bg-accent text-accent-fg text-sm font-bold flex items-center gap-2 hover:brightness-110 shadow-[0_4px_14px_0_rgba(16,185,129,0.39)] hover:shadow-[0_6px_20px_rgba(16,185,129,0.23)] hover:-translate-y-0.5 transition-all"
          >
            <Play size={16} className="fill-accent-fg group-hover:scale-110 transition-transform" />
            Start Focus
          </Link>
          <div className="relative group flex items-center">
            <button
              onClick={() => setEditOpen(true)}
              disabled={!persisted.data}
              className="px-4 py-2.5 rounded-xl border border-border/60 bg-bg-card shadow-sm text-sm font-bold hover:bg-bg-subtle transition-all flex items-center gap-2 text-ink disabled:opacity-40"
              aria-label="Edit plan with AI"
            >
              <Wand2 size={16} className="text-brand group-hover:-rotate-12 transition-transform duration-300" />
              Edit
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-ink text-bg text-xs font-semibold rounded-md opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 pointer-events-none whitespace-nowrap shadow-xl z-50">
              Chat with AI to reorganize your day
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-ink"></div>
            </div>
          </div>
          <button
            onClick={() => generate(false)}
            disabled={state === "thinking" || state === "streaming"}
            className="group px-5 py-2.5 rounded-xl bg-brand text-brand-fg text-sm font-bold disabled:opacity-60 shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-0.5 transition-all flex items-center gap-2"
          >
            <Sparkles size={16} className="text-brand-fg opacity-90 fill-brand-fg group-hover:animate-pulse" />
            {state === "thinking" ? "Refining…" : state === "streaming" ? "Streaming…" : "Generate plan"}
          </button>
        </div>
      </header>

      {!checkIn.isLoading && !checkIn.data && (
        <Link to="/check-in" className="block mb-4 p-4 rounded-xl2 border border-warning/30 bg-warning/10 text-warning">
          Morning check-in pending — tap to log your priority & blockers.
        </Link>
      )}

      {persisted.data?.daily_insight && (
        <div className="mb-4 p-4 rounded-xl2 bg-brand/10 border border-brand/30">
          <p className="text-sm leading-relaxed">{persisted.data.daily_insight}</p>
        </div>
      )}

      {provider === "deterministic" && (
        <div className="mb-3 p-2 rounded-lg bg-warning/10 border border-warning/30 text-xs text-warning text-center">
          AI-assisted planning is off or unavailable — showing a deterministic schedule.
        </div>
      )}

      {state === "need_check_in" && (
        <ErrorState message="A check-in is required before generating today's plan." onRetry={() => window.location.assign("/check-in")} />
      )}

      {state === "error" && <ErrorState message={error} onRetry={() => generate(false)} />}

      {(state === "thinking" || state === "streaming") && (
        <div className="mb-4 flex flex-col items-center p-4 rounded-xl2 border border-brand/20 bg-brand/5 gap-3">
          <p className="text-sm text-brand/80 text-center animate-pulse">
            {state === "thinking" ? "AI is computing your perfect schedule..." : "AI is streaming your schedule..."}
          </p>
          <button 
            onClick={() => generate(true)}
            className="px-5 py-2.5 rounded-lg border border-warning/50 bg-warning/10 text-warning text-sm font-semibold shadow-sm hover:bg-warning/20 hover:shadow-md transition-all"
          >
            Taking too long? Generate instantly (Math Mode)
          </button>
        </div>
      )}

      {persisted.isLoading && state === "idle" ? (
        <>
          <ShimmerCard /><ShimmerCard /><ShimmerCard />
        </>
      ) : visibleBlocks.length === 0 ? (
        <EmptyState
          title="No plan yet"
          body="Tap Generate to create today's plan."
          action={null}
        />
      ) : (
        <div className="relative pl-6 before:absolute before:inset-y-3 before:left-[9px] before:w-[2px] before:bg-gradient-to-b before:from-brand/60 before:via-border/60 before:to-border/10">
          <ul className="space-y-4 relative">
            {visibleBlocks.map((b, i) => (
              <TimeBlockCard key={b.id} block={b} index={i} onComplete={complete} />
            ))}
          </ul>
        </div>
      )}

      <EditPlanSheet open={editOpen} onClose={() => setEditOpen(false)}
                     date={today} onApplied={() => persisted.refetch()} />
    </div>
  );
}
