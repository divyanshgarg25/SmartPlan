// EditPlanSheet — small bottom-sheet that posts an NL instruction to
// /api/plan/daily/edit then refetches.
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { apiFetch } from "../services/api.js";

export default function EditPlanSheet({ open, onClose, date, onApplied }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit() {
    if (!text.trim()) return;
    setBusy(true); setError(null);
    try {
      const r = await apiFetch("/api/plan/daily/edit", {
        method: "POST", body: JSON.stringify({ date, instruction: text.trim() }),
      });
      if (!r.ok) { setError(`Edit failed (${r.status})`); return; }
      setText(""); onApplied?.(); onClose();
    } finally { setBusy(false); }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />
          <motion.div initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-50 bg-bg-card border-t border-border rounded-t-2xl p-5"
            role="dialog" aria-label="Edit plan with AI">
            <h2 className="font-display text-lg mb-2">Edit today's plan</h2>
            <p className="text-xs text-ink-muted mb-3">Describe a change in natural language. Fixed events won't move.</p>
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3}
              placeholder='e.g. "move my workout to 6pm" or "swap the 4pm block for a break"'
              className="w-full px-4 py-3 rounded-xl bg-bg-card border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm text-sm" />
            {error && <p className="text-xs text-danger mt-2">{error}</p>}
            <div className="flex justify-end gap-3 mt-4">
              <button onClick={onClose} className="px-5 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-bg-subtle transition-colors">Cancel</button>
              <button onClick={submit} disabled={busy || !text.trim()}
                className="px-5 py-2.5 rounded-xl bg-brand text-brand-fg text-sm font-bold shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-0.5 transition-all disabled:opacity-50">
                {busy ? "Applying…" : "Apply edit"}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
