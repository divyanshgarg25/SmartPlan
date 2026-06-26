import { motion } from "framer-motion";

const TYPE_COLOR = {
  deep_work:   "bg-brand/15 text-brand border-brand/30",
  light_work:  "bg-accent/15 text-accent border-accent/30",
  admin:       "bg-warning/15 text-warning border-warning/30",
  break:       "bg-ink-muted/10 text-ink-muted border-border",
  fixed_event: "bg-success/15 text-success border-success/30",
  social:      "bg-pink-500/15 text-pink-300 border-pink-500/30",
  health:      "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  personal:    "bg-purple-500/15 text-purple-300 border-purple-500/30",
};

/**
 * Pure visual TimeBlock card. Receives data via props — no fetch, no supabase.
 * @param {{ block: Object, index: number, onComplete?: (id) => void }} props
 */
export default function TimeBlockCard({ block, index, onComplete }) {
  // Extract the solid color from the text class (e.g. text-brand -> bg-brand)
  const dotColor = TYPE_COLOR[block.type]?.split(' ').find(c => c.startsWith('text-'))?.replace('text-', 'bg-') || 'bg-border';

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 260, damping: 24 }}
      className="relative group"
    >
      {/* Timeline Dot (now bright and perfectly aligned) */}
      <div className={`absolute top-[22px] -left-[20px] w-3 h-3 rounded-full ${dotColor} shadow-[0_0_10px_currentColor] ring-[3px] ring-bg z-10 transition-transform group-hover:scale-125`} />

      <div className={`rounded-[18px] border ${TYPE_COLOR[block.type] ?? "border-border"} bg-bg-card/70 backdrop-blur-xl p-4 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-mono text-xs text-ink-muted">
          {block.start_time} – {block.end_time}
        </div>
        <div className="text-[10px] uppercase tracking-wider opacity-80">{block.type.replace("_", " ")}</div>
      </div>
      <h3 className="mt-1 font-display text-lg font-semibold text-ink">{block.title}</h3>
      <p className="mt-2 text-sm text-ink-muted leading-relaxed">{block.rationale}</p>
      {onComplete && block.status === "pending" && !block.is_fixed && (
        <button
          onClick={() => onComplete(block.id)}
          className="mt-3 inline-flex items-center text-xs font-medium text-brand hover:underline"
        >
          Mark complete
        </button>
      )}
      </div>
    </motion.li>
  );
}
