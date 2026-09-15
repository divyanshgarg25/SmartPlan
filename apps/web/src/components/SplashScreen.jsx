export default function SplashScreen({ embedded = false }) {
  const rootClass = embedded
    ? "splash-root splash-root-embedded text-ink"
    : "splash-root fixed inset-0 grid place-items-center bg-bg text-ink overflow-hidden";

  return (
    <div className={rootClass}>
      <div className="relative grid place-items-center h-24 sm:h-28 w-[min(92vw,34rem)] font-display text-5xl sm:text-6xl font-extrabold tracking-tight">
        <div className="splash-stage-2 absolute inset-0 flex items-center justify-center gap-3 sm:gap-4">
          <span className="splash-logo inline-flex shrink-0">
            <SmartPlanMark />
          </span>
          <span className="splash-final-word text-gradient-brand">SmartPlan</span>
        </div>
      </div>
    </div>
  );
}

function SmartPlanMark() {
  return (
    <span className="splash-smartplan-mark" aria-hidden="true">
      <svg viewBox="0 0 24 24" className="splash-bolt" fill="currentColor">
        <path d="M13 2 4 14h6l-1 8 11-14h-7l1-6Z" />
      </svg>
    </span>
  );
}
