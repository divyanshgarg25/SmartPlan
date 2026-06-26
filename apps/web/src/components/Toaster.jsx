import { AnimatePresence, motion } from "framer-motion";
import { useToastStore } from "../hooks/useToast.js";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

const ICONS = {
  success: <CheckCircle2 className="w-5 h-5 text-brand" />,
  error:   <AlertCircle className="w-5 h-5 text-danger" />,
  info:    <Info className="w-5 h-5 text-accent" />
};

export default function Toaster() {
  const toasts = useToastStore((s) => s.toasts);

  return (
    <div className="fixed bottom-20 md:bottom-10 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-3 pointer-events-none w-full max-w-sm px-4">
      <AnimatePresence>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 25 }}
            className="pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl glass border border-border/50 shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-bg-card/80 backdrop-blur-md"
          >
            {ICONS[t.type] || ICONS.info}
            <p className="text-sm font-medium text-ink flex-1 leading-tight">{t.message}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
