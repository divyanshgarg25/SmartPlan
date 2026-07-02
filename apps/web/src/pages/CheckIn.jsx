import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTodayCheckIn, useSaveCheckIn } from "../hooks/useCheckIn.js";
import { CheckCircle2 } from "lucide-react";

export default function CheckInPage() {
  const navigate = useNavigate();
  const { data: existing } = useTodayCheckIn();
  const save = useSaveCheckIn();

  const [topPriority, setTopPriority] = useState(existing?.top_priority ?? "");
  const [blocker, setBlocker] = useState(existing?.blocker ?? "");

  async function submit(e) {
    e.preventDefault();
    await save.mutateAsync({ top_priority: topPriority || null, blocker: blocker || null });
    navigate("/today");
  }

  return (
    <div className="max-w-md mx-auto">
      <h1 className="font-display text-3xl font-bold mb-4">Morning check-in</h1>
      <p className="text-sm text-ink-muted mb-6">Under 30 seconds — this shapes today's plan.</p>

      <form onSubmit={submit} className="space-y-6 bg-bg-card border border-border rounded-xl2 p-5 shadow-card">


        <label className="block">
          <span className="text-xs text-ink-muted">Top priority today</span>
          <input value={topPriority} onChange={(e) => setTopPriority(e.target.value)}
                 placeholder="e.g. Finish ML assignment"
                 className="mt-1 w-full px-4 py-3 rounded-xl bg-bg-card border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm" />
        </label>

        <label className="block">
          <span className="text-xs text-ink-muted">Anything blocking you? (optional)</span>
          <input value={blocker} onChange={(e) => setBlocker(e.target.value)}
                 placeholder="e.g. Tired, sick, no internet"
                 className="mt-1 w-full px-4 py-3 rounded-xl bg-bg-card border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm" />
        </label>

        <button disabled={save.isPending}
                className="group w-full py-3 rounded-xl bg-brand text-brand-fg font-bold disabled:opacity-60 shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-0.5 transition-all flex items-center justify-center gap-2">
          <CheckCircle2 size={18} className="text-brand-fg opacity-90 group-hover:scale-110 transition-transform" />
          {save.isPending ? "Saving…" : "Save check-in"}
        </button>
      </form>
    </div>
  );
}
