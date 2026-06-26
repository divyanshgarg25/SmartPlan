export default function SplashScreen({ embedded = false }) {
  const letters = [
    { ch: "F", keep: true,  final: "F", from: "left",  dx: "-7.2rem" },
    { ch: "O", keep: true,  final: "O", from: "left",  dx: "-5.35rem" },
    { ch: "C", keep: false, from: "left" },
    { ch: "U", keep: false, from: "left" },
    { ch: "S", keep: false, from: "left" },
    { ch: " ", keep: false, from: "gap" },
    { ch: "M", keep: false, from: "right" },
    { ch: "E", keep: false, from: "right" },
    { ch: "R", keep: true,  final: "R", from: "right", dx: "1.55rem" },
    { ch: "G", keep: true,  final: "G", from: "right", dx: "3.35rem" },
    { ch: "E", keep: true,  final: "E", from: "right", dx: "5.15rem" },
  ];

  const rootClass = embedded
    ? "splash-root splash-root-embedded text-ink"
    : "splash-root fixed inset-0 grid place-items-center bg-bg text-ink overflow-hidden";

  return (
    <div className={rootClass}>
      <div className="relative grid place-items-center h-24 sm:h-28 w-[min(92vw,34rem)] font-display text-5xl sm:text-6xl font-extrabold tracking-tight">
        <div className="splash-origin absolute inset-0 flex items-center justify-center">
          {letters.map((letter, i) => (
            <span
              key={`${letter.ch}-${i}`}
              className={`inline-block ${letter.keep ? "splash-keep" : "splash-away"} ${letter.from === "left" ? "splash-from-left" : ""} ${letter.from === "right" ? "splash-from-right" : ""}`}
              style={letter.keep
                ? { "--final-x": letter.dx, animationDelay: `${1100 + i * 28}ms` }
                : { "--dx": `${(i - 5) * 7}px`, "--dy": `${-18 - (i % 4) * 5}px`, animationDelay: `${1180 + i * 26}ms` }}
            >
              {letter.ch === " " ? "\u00a0" : letter.ch}
            </span>
          ))}
        </div>
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
