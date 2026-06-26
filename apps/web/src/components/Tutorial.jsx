import { useEffect, useState, useCallback } from "react";

export const TUTORIAL_KEY = "smartplan.tutorial.completed.v1";

/* --------------------------------------------------------------------------
 * Inline icon set for tutorial visuals
 * ------------------------------------------------------------------------ */
function TutorialIcon({ name }) {
  const common = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", className: "w-10 h-10 text-white drop-shadow-md" };
  switch (name) {
    case "spark": return <svg {...common}><path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" /></svg>;
    case "today": return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "bolt": return <svg {...common}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" /></svg>;
    case "tasks": return <svg {...common}><path d="M4 6h11M4 12h11M4 18h7" /><path d="M18 5l2 2 3-3M18 11l2 2 3-3" /></svg>;
    case "insights": return <svg {...common}><path d="M3 3v18h18" /><path d="M7 15l4-4 3 3 5-6" /></svg>;
    case "sun": return <svg {...common}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" /></svg>;
    default: return null;
  }
}

const STEPS = [
  {
    icon: "spark",
    title: "Welcome to SmartPlan",
    body: "SmartPlan is a premium command center designed to protect your focus and automate your schedule. Let's walk through exactly how to use it.",
  },
  {
    icon: "today",
    title: "1. The Daily Check-in",
    body: "Click the 'Today' tab (clock icon) in the sidebar. Every morning, type your single most important priority into the top Check-in box. This is your daily hub where you will see your time blocks and schedule.",
  },
  {
    icon: "tasks",
    title: "2. Adding Tasks",
    body: "Click the 'Tasks' tab (checklist icon). This is your master backlog. Whenever you get an assignment, type it in here and tag its effort level. Our AI will automatically slot these tasks into your free time blocks.",
  },
  {
    icon: "today",
    title: "3. Week Planning",
    body: "Click the 'Week' tab (calendar icon). Here you get a bird's-eye view of your entire workload. You can manually drag and drop blocks or let the AI balance your week to prevent burnout.",
  },
  {
    icon: "bolt",
    title: "4. Focus Mode",
    body: "When you're ready to do deep work, go back to the Today page and click the prominent 'Start Focus' button at the top. This launches a distraction-free timer that tracks your deep-work minutes and builds your streak.",
  },
  {
    icon: "insights",
    title: "5. Weekly Insights",
    body: "At the end of the week, click the 'Insights' tab (chart icon). Here you can track your focus trends, task completion rates, and see the tangible ROI of your time.",
  },
  {
    icon: "sun",
    title: "You're Ready to Build",
    body: "That's the core loop: Check-in, Add Tasks, Focus, and Review. Pro tip: Click the Moon/Sun icon in the top right corner to perfectly sync the app with your system's light or dark mode.",
  },
];

/**
 * Tutorial — skippable onboarding modal.
 *
 * Controlled mode: pass `open` and `onClose` (used by Settings "Replay").
 * Uncontrolled mode: auto-shows once per user, persisted in localStorage.
 */
export default function Tutorial({ open: openProp, onClose }) {
  const isControlled = typeof openProp === "boolean";
  const [autoOpen, setAutoOpen] = useState(false);
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (isControlled) return;
    try {
      if (!localStorage.getItem(TUTORIAL_KEY)) setAutoOpen(true);
    } catch { /* ignore */ }
  }, [isControlled]);

  const open = isControlled ? openProp : autoOpen;

  useEffect(() => { if (open) setStep(0); }, [open]);

  const close = useCallback(() => {
    try { localStorage.setItem(TUTORIAL_KEY, "1"); } catch { /* ignore */ }
    if (isControlled) onClose?.();
    else setAutoOpen(false);
  }, [isControlled, onClose]);

  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight" || e.key === "Enter") {
        setStep((s) => Math.min(s + 1, STEPS.length - 1));
      } else if (e.key === "ArrowLeft") {
        setStep((s) => Math.max(s - 1, 0));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  if (!open) return null;

  const s = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="tutorial-title"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in"
      onClick={close}
    >
      <div
        className="relative w-full max-w-lg bg-[rgb(var(--bg-card))] border border-[rgb(var(--border))] rounded-[24px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Premium Header Visual */}
        <div className="relative h-48 w-full bg-bg-subtle flex items-center justify-center overflow-hidden border-b border-border/50">
          <div className="absolute inset-0 opacity-20 dark:opacity-40 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] mix-blend-overlay"></div>
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-bg-card"></div>
          
          <div className="relative z-10 w-24 h-24 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(55,130,255,0.4)]"
               style={{ background: "linear-gradient(135deg, rgb(var(--brand)), rgb(var(--accent)))" }}>
            <TutorialIcon name={s.icon} />
          </div>
        </div>

        <button
          onClick={close}
          aria-label="Skip tutorial"
          className="absolute top-4 right-4 z-20 text-xs font-medium text-[rgb(var(--ink-muted))] hover:text-[rgb(var(--ink))] px-3 py-1.5 rounded-full bg-[rgb(var(--bg-card))] hover:bg-[rgb(var(--bg-subtle))] border border-[rgb(var(--border))] transition-colors shadow-sm"
        >
          Skip
        </button>

        <div className="p-8">
          <h2 id="tutorial-title" className="font-display text-3xl font-bold mb-4 tracking-tight">
            {s.title}
          </h2>
          <p className="text-ink-muted leading-relaxed text-base mb-8">{s.body}</p>

          <div className="flex items-center gap-2 mb-8" aria-hidden="true">
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-8 bg-brand shadow-[0_0_10px_rgba(55,130,255,0.5)]" : "w-2 bg-border"
                }`}
              />
            ))}
          </div>

          <div className="flex items-center justify-between gap-2">
            <button
              onClick={() => setStep((p) => Math.max(p - 1, 0))}
              disabled={step === 0}
              className="px-4 py-2 rounded-xl text-sm font-medium text-ink-muted hover:text-ink hover:bg-bg-subtle disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
            >
              Back
            </button>
            <div className="text-xs font-semibold text-ink-subtle tracking-widest uppercase">{step + 1} / {STEPS.length}</div>
            {isLast ? (
              <button
                onClick={close}
                className="px-6 py-2 rounded-xl bg-brand text-brand-fg text-sm font-bold shadow-[0_8px_20px_-6px_rgba(55,130,255,0.6)] hover:brightness-110 hover:-translate-y-0.5 transition-all"
              >
                Get started
              </button>
            ) : (
              <button
                onClick={() => setStep((p) => Math.min(p + 1, STEPS.length - 1))}
                className="px-6 py-2 rounded-xl bg-brand text-brand-fg text-sm font-bold shadow-[0_8px_20px_-6px_rgba(55,130,255,0.6)] hover:brightness-110 hover:-translate-y-0.5 transition-all"
              >
                Next &rarr;
              </button>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes fade-in { from { opacity: 0; backdrop-filter: blur(0px); } to { opacity: 1; backdrop-filter: blur(12px); } }
        .animate-fade-in { animation: fade-in 300ms ease-out forwards; }
      `}</style>
    </div>
  );
}
