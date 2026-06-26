// components/QuickAddBar.jsx — NLP quick add (§3.6)
// Calls /api/tasks/categorise (consent-gated server-side). On no-consent or empty
// preview falls back to plain title.
import { useState } from "react";
import { apiFetch } from "../services/api.js";
import { Wand2, Plus } from "lucide-react";

export default function QuickAddBar({ onCreate, consent }) {
  const [text, setText] = useState("");
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);

  async function analyse() {
    if (!text.trim()) return;
    if (!consent) { onCreate({ title: text.trim() }); setText(""); return; }
    setBusy(true);
    try {
      const r = await apiFetch("/api/tasks/categorise", {
        method: "POST", body: JSON.stringify({ text }),
      });
      if (r.ok) setPreview(await r.json());
      else onCreate({ title: text.trim() });
    } finally { setBusy(false); }
  }

  function accept() {
    if (!preview) return;
    onCreate({
      title: preview.title ?? text.trim(),
      type: preview.type ?? "deep_work",
      priority: preview.priority ?? "medium",
      estimated_hours: preview.estimated_hours ?? 1,
      deadline: preview.deadline ?? null,
      is_fixed: !!preview.fixed_time,
      fixed_time: preview.fixed_time ?? null,
      subject: preview.subject ?? null,
    });
    setPreview(null); setText("");
  }

  return (
    <div className="mb-4">
      <div className="flex gap-2">
        <input
          value={text} onChange={(e) => setText(e.target.value)}
          placeholder={consent ? 'e.g. "Math homework due Friday 5pm, 2h"' : 'Type a task name...'}
          className="flex-1 px-4 py-2.5 rounded-xl bg-bg-card border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm text-sm"
          onKeyDown={(e) => e.key === "Enter" && analyse()}
        />
        <button onClick={analyse} disabled={busy} className="px-5 py-2.5 rounded-xl bg-brand text-brand-fg text-sm font-bold shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-0.5 transition-all flex items-center gap-2">
          {busy ? "…" : consent ? <><Wand2 size={16} /> AI parse</> : <><Plus size={16} /> Add</>}
        </button>
      </div>
      {!consent && (
        <p className="text-[11px] text-ink-muted mt-2 px-1 flex items-center gap-1.5 opacity-80">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
          Enable AI in Settings for automatic task parsing (duration, deadlines, category)
        </p>
      )}
      {preview && (
        <div className="mt-2 p-3 rounded-lg border border-brand/30 bg-brand/10 text-sm">
          <p className="font-medium">Detected:</p>
          <p className="text-ink-muted text-xs mt-1">
            {preview.type ?? "deep_work"} · {preview.priority ?? "medium"} · {preview.estimated_hours ?? 1}h
            {preview.deadline ? ` · due ${new Date(preview.deadline).toLocaleString()}` : ""}
            {preview.fixed_time ? ` · fixed at ${preview.fixed_time}` : ""}
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={accept} className="px-4 py-2 rounded-lg bg-brand text-brand-fg text-xs font-bold shadow-sm hover:shadow-md transition-all">Add task</button>
            <button onClick={() => setPreview(null)} className="px-4 py-2 rounded-lg border border-border/80 bg-bg-card text-xs font-medium hover:bg-bg-subtle transition-colors">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}
