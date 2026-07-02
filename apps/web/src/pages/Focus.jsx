// pages/Focus.jsx — Fullscreen Focus Mode (§4.5)
// • Countdown timer for the active TimeBlock
// • Logs actual_minutes to behavior_logs on exit (consent-gated via service)
// • Calls recalculate_job_times() on exit
import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../services/supabase.js";
import { logBehavior } from "../services/behaviorLog.js";

function diffMin(s, e) {
  const [sh, sm] = s.split(":").map(Number);
  const [eh, em] = e.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

export default function FocusPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const blockId = params.get("block");
  const [block, setBlock] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("time_blocks").select("*").eq("id", blockId).single();
      if (!data) { navigate("/today"); return; }
      setBlock(data);
      setRemaining(diffMin(data.start_time, data.end_time) * 60);
    })();
  }, [blockId, navigate]);

  useEffect(() => {
    if (!block) return;
    const t = setInterval(() => setRemaining((r) => Math.max(0, r - 1)), 1000);
    return () => clearInterval(t);
  }, [block]);

  async function exit(completed) {
    const actualMin = Math.round((Date.now() - startedAt.current) / 60000);
    if (block) {
      await supabase.from("time_blocks").update({ status: completed ? "completed" : "skipped" }).eq("id", block.id);
      if (block.task_id) {
        await supabase.from("tasks").update({
          status: completed ? "completed" : "inbox",
          actual_hours: +(actualMin / 60).toFixed(2),
        }).eq("id", block.task_id);
      }
      await logBehavior(completed ? "task_completed" : "block_skipped", {
        block_id: block.id, actual_minutes: actualMin,
      });
      // §9 hard rule: re-schedule next job after plan-affecting activity
      const { data: { user } } = await supabase.auth.getUser();
      if (user) await supabase.rpc("recalculate_job_times", { p_user_id: user.id });
    }
    navigate("/today");
  }

  if (!block) {
    return <div className="fixed inset-0 grid place-items-center bg-bg text-ink">Loading focus session…</div>;
  }

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");
  const totalSec = diffMin(block.start_time, block.end_time) * 60;
  const pct = totalSec > 0 ? remaining / totalSec : 0;

  return (
    <motion.div layoutId={`block-${block.id}`}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-bg text-ink px-6">
      <p className="text-xs uppercase tracking-[0.2em] text-ink-muted mb-4">Focus mode</p>
      <h1 className="font-display text-4xl text-center max-w-md">{block.title}</h1>
      <p className="mt-2 text-sm text-ink-muted text-center max-w-sm">{block.rationale}</p>

      <div className="relative my-10">
        <svg width="240" height="240" viewBox="0 0 240 240" aria-hidden="true">
          <circle cx="120" cy="120" r="100" stroke="currentColor" strokeOpacity="0.15" strokeWidth="10" fill="none" />
          <circle cx="120" cy="120" r="100" stroke="currentColor" strokeWidth="10" fill="none"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 100}
                  strokeDashoffset={(1 - pct) * 2 * Math.PI * 100}
                  className="text-brand transition-[stroke-dashoffset] duration-1000 ease-linear"
                  transform="rotate(-90 120 120)" />
        </svg>
        <div className="absolute inset-0 grid place-items-center">
          <div className="font-mono text-5xl tabular-nums" aria-live="polite">{mm}:{ss}</div>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={() => exit(false)} className="px-5 py-2 rounded-lg border border-border text-ink-muted">
          Exit
        </button>
        <button onClick={() => exit(true)} className="px-5 py-2 rounded-lg bg-brand text-brand-fg font-semibold">
          Mark complete
        </button>
      </div>
    </motion.div>
  );
}
