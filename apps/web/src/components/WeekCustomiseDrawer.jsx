// components/WeekCustomiseDrawer.jsx — visual only, calls hooks.
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWeekTemplates, useSaveWeekTemplate, useApplyTemplate } from "../hooks/useWeekTemplates.js";
import { useProfileSchedule } from "../hooks/useProfile.js";

const DOW = [["Mon", 1], ["Tue", 2], ["Wed", 3], ["Thu", 4], ["Fri", 5], ["Sat", 6], ["Sun", 0]];

export default function WeekCustomiseDrawer({ open, onClose }) {
  const { profile, updateSchedule } = useProfileSchedule();
  const { data: templates } = useWeekTemplates();
  const save = useSaveWeekTemplate();
  const apply = useApplyTemplate();

  const [cap, setCap] = useState(profile?.daily_hour_cap ?? 8);
  const [restDays, setRestDays] = useState([]);
  const [name, setName] = useState("");

  useEffect(() => { if (profile) setCap(profile.daily_hour_cap); }, [profile]);

  function toggleRest(d) {
    setRestDays((cur) => cur.includes(d) ? cur.filter((x) => x !== d) : [...cur, d]);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />
          <motion.aside
            initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 280, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 md:left-auto md:top-0 md:bottom-0 md:w-96 z-50 bg-bg-card border-t md:border-l border-border rounded-t-2xl md:rounded-none p-5 max-h-[85vh] overflow-y-auto"
            role="dialog" aria-label="Customise week"
          >
            <h2 className="font-display text-xl mb-4">Customise week</h2>

            <label className="block text-xs text-ink-muted">Daily hour cap</label>
            <input type="range" min="2" max="10" value={cap} onChange={(e) => setCap(Number(e.target.value))}
                   className="w-full accent-brand" />
            <div className="text-sm mb-4">{cap}h / day</div>

            <p className="text-xs text-ink-muted mb-2">Rest days (no deep work scheduled)</p>
            <div className="flex flex-wrap gap-2 mb-4">
              {DOW.map(([l, v]) => (
                <button key={v} onClick={() => toggleRest(v)}
                        className={`px-3 py-1.5 rounded-full text-xs border ${restDays.includes(v) ? "bg-brand text-brand-fg border-brand" : "border-border text-ink-muted"}`}>
                  {l}
                </button>
              ))}
            </div>

            <button onClick={async () => { await updateSchedule({ daily_hour_cap: cap }); onClose(); }}
                    className="w-full py-3 rounded-xl bg-brand text-brand-fg font-bold shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-0.5 transition-all mb-6">
              Save schedule
            </button>

            <div className="border-t border-border pt-4">
              <p className="text-xs text-ink-muted mb-2">Week templates</p>
              <ul className="space-y-1 mb-3">
                {(templates ?? []).map((t) => (
                  <li key={t.id} className="flex items-center justify-between text-sm">
                    <span>{t.name}</span>
                    <button onClick={() => apply.mutate(t.id)} className="text-brand text-xs font-bold hover:underline">Apply</button>
                  </li>
                ))}
                {!templates?.length && <li className="text-xs text-ink-muted">No templates yet.</li>}
              </ul>
              <div className="flex gap-2 mt-4">
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name"
                       className="flex-1 px-4 py-2.5 rounded-xl bg-bg-card border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm text-sm" />
                <button
                  onClick={async () => {
                    if (!name.trim()) return;
                    await save.mutateAsync({ name, template: { daily_hour_cap: cap, rest_days: restDays } });
                    setName("");
                  }}
                  className="px-4 py-2.5 rounded-xl bg-brand/15 text-brand text-sm font-bold hover:bg-brand/25 transition-colors">
                  Save current
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
