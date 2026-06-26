export function ShimmerCard() {
  return <div className="shimmer h-24 rounded-xl2 mb-3" />;
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="rounded-xl2 border border-danger/30 bg-danger/10 p-4 text-center">
      <p className="text-danger font-medium">Something went wrong</p>
      <p className="text-sm text-ink-muted mt-1">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-3 px-4 py-2 rounded-lg bg-danger/20 text-danger text-sm font-medium">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, body, action }) {
  return (
    <div className="relative overflow-hidden rounded-xl2 border border-dashed border-border bg-bg-card/50 p-10 text-center">
      <div
        className="absolute inset-x-0 -top-16 h-40 blur-3xl opacity-40 pointer-events-none"
        style={{ background: "radial-gradient(60% 100% at 50% 0%, rgb(var(--brand)) 0%, transparent 70%)" }}
      />
      <svg
        viewBox="0 0 96 96"
        className="relative mx-auto mb-4 w-20 h-20 text-brand"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="12" y="20" width="72" height="60" rx="8" className="opacity-30" />
        <path d="M22 36h52M22 50h36M22 62h28" className="opacity-60" />
        <circle cx="72" cy="62" r="10" />
        <path d="M68 62l3 3 6-6" />
      </svg>
      <h3 className="relative font-display text-lg text-ink">{title}</h3>
      {body && <p className="relative mt-1 text-sm text-ink-muted max-w-sm mx-auto">{body}</p>}
      {action && <div className="relative mt-4">{action}</div>}
    </div>
  );
}
