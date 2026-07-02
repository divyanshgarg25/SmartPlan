import { useState, useRef, useEffect } from "react";
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from "../hooks/useTasks.js";
import { useProfile } from "../hooks/useProfile.js";
import { ShimmerCard, ErrorState, EmptyState } from "../components/States.jsx";
import QuickAddBar from "../components/QuickAddBar.jsx";
import { addToast } from "../hooks/useToast.js";
import { motion, AnimatePresence } from "framer-motion";
import { Calendar, Clock, Flag, Tag, Hourglass, Zap } from "lucide-react";
import { DateTimePickerButton, TimePickerButton } from "../components/DialogPickers.jsx";

const DEFAULTS = {
  title: "", description: "", subject: "",
  estimated_hours: 1, deadline: "",
  priority: "medium", type: "deep_work",
  is_fixed: false, fixed_time: "",
};

function CustomSelect({ value, onChange, options, icon: Icon, tooltip }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedOption = options.find(o => o.value === value) || options[0];

  return (
    <div className="relative group flex items-center h-[42px]" ref={ref}>
      {Icon && <Icon size={16} className="absolute left-3 text-brand opacity-80 pointer-events-none transition-transform group-focus-within:scale-110 z-10" />}
      
      <button type="button" onClick={() => setOpen(!open)}
              className="w-full h-full pl-9 pr-3 rounded-xl bg-bg-subtle/50 border border-transparent focus:border-brand/40 outline-none transition-all text-sm hover:bg-bg-subtle text-left flex items-center justify-between shadow-sm">
        <span className="truncate capitalize">{selectedOption.label}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`opacity-50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}><polyline points="6 9 12 15 18 9"></polyline></svg>
      </button>

      {tooltip && !open && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-ink text-bg text-xs font-semibold rounded-md opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 pointer-events-none whitespace-nowrap shadow-xl z-50">
          {tooltip}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></div>
        </div>
      )}

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute top-[calc(100%+8px)] left-0 right-0 bg-bg-card/95 border border-border/60 rounded-xl shadow-2xl z-[100] overflow-hidden backdrop-blur-xl"
          >
            <div className="max-h-60 overflow-y-auto p-1.5 flex flex-col gap-0.5">
              {options.map(opt => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => { onChange(opt.value); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm capitalize transition-colors ${value === opt.value ? 'bg-brand text-brand-fg font-medium' : 'hover:bg-bg-subtle text-ink'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function TasksPage() {
  const { data: tasks, isLoading, error, refetch } = useTasks();
  const { data: profile } = useProfile();
  const create = useCreateTask();
  const update = useUpdateTask();
  const del = useDeleteTask();
  const [form, setForm] = useState(DEFAULTS);

  async function submit(e) {
    e.preventDefault();
    const payload = {
      ...form,
      estimated_hours: Number(form.estimated_hours),
      deadline: form.deadline ? new Date(form.deadline).toISOString() : null,
      fixed_time: form.is_fixed ? form.fixed_time : null,
    };
    await create.mutateAsync(payload);
    setForm(DEFAULTS);
    addToast("Task created successfully", "success");
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-4">Tasks</h1>

      <QuickAddBar consent={!!profile?.ai_data_consent} onCreate={(payload) => create.mutate(payload)} />

      <div className="flex items-center justify-center gap-4 my-6 opacity-60">
        <div className="h-px bg-border flex-1" />
        <span className="text-xs font-bold text-ink-muted uppercase tracking-widest">Or create manually</span>
        <div className="h-px bg-border flex-1" />
      </div>

      <form onSubmit={submit} className="relative p-5 mb-8 space-y-4 shadow-xl rounded-[24px]">
        {/* Background layer (keeps overflow-hidden for the top glow line) */}
        <div className="absolute inset-0 bg-bg-card/70 backdrop-blur-xl border border-border/60 rounded-[24px] overflow-hidden pointer-events-none -z-10">
          <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent" />
        </div>

        <input
          required value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="What needs to be done?"
          className="w-full px-4 py-3 rounded-[16px] bg-bg-subtle/50 border border-transparent focus:border-brand/40 focus:bg-bg-subtle outline-none transition-all placeholder:text-ink-muted/60 text-lg font-medium"
        />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          
          <CustomSelect
            value={form.priority}
            onChange={(val) => setForm({ ...form, priority: val })}
            icon={Flag}
            tooltip="Task Priority"
            options={[
              { value: "high", label: "High Priority" },
              { value: "medium", label: "Medium Priority" },
              { value: "low", label: "Low Priority" }
            ]}
          />

          <CustomSelect
            value={form.type}
            onChange={(val) => setForm({ ...form, type: val })}
            icon={Tag}
            tooltip="Task Category"
            options={[
              { value: "deep_work", label: "🧠 Deep Work" },
              { value: "light_work", label: "📝 Light Work" },
              { value: "admin", label: "📁 Admin" },
              { value: "social", label: "💬 Social" },
              { value: "health", label: "🏃‍♂️ Health" },
              { value: "personal", label: "🏠 Personal" }
            ]}
          />

          <div className="relative group flex items-center h-[42px]">
            <Hourglass size={16} className="absolute left-3 text-brand opacity-80 pointer-events-none transition-transform group-focus-within:scale-110" />
            <input type="number" step="0.5" min="0.5" value={form.estimated_hours}
                   onChange={(e) => setForm({ ...form, estimated_hours: e.target.value })}
                   className="w-full h-full pl-9 pr-3 rounded-xl bg-bg-subtle/50 border border-transparent focus:border-brand/40 outline-none transition-all text-sm hover:bg-bg-subtle shadow-sm" placeholder="Est. hours" />
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 bg-ink text-bg text-xs font-semibold rounded-md opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 pointer-events-none whitespace-nowrap shadow-xl z-50">
              Estimated Hours
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-ink"></div>
            </div>
          </div>
          <div className="w-full">
            <DateTimePickerButton
              value={form.deadline}
              onChange={(val) => setForm({ ...form, deadline: val })}
              icon={Calendar}
              placeholder="Deadline..."
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4 mt-2 pt-4 border-t border-border/40">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-ink-muted cursor-pointer hover:text-ink transition-colors">
              <input type="checkbox" checked={form.is_fixed}
                     onChange={(e) => setForm({ ...form, is_fixed: e.target.checked })}
                     className="accent-brand w-4 h-4 rounded border-border" />
              Fixed-time event
            </label>
            {form.is_fixed && (
              <div className="w-36 ml-2">
                <TimePickerButton
                  value={form.fixed_time}
                  onChange={(val) => setForm({ ...form, fixed_time: val })}
                  icon={Clock}
                  placeholder="Time"
                />
              </div>
            )}
          </div>
          <button disabled={create.isPending}
                  className="group relative ml-auto px-6 py-2.5 rounded-xl bg-brand text-brand-fg font-bold disabled:opacity-60 shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-0.5 transition-all overflow-hidden flex items-center gap-2">
            <Zap size={16} className="text-brand-fg opacity-90 fill-brand-fg" />
            {create.isPending ? "Adding…" : "Add task"}
          </button>
        </div>
      </form>

      {isLoading ? (
        <><ShimmerCard /><ShimmerCard /></>
      ) : error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : !tasks?.length ? (
        <EmptyState title="No tasks yet" body="Capture everything you need to do." />
      ) : (
        <ul className="space-y-3 relative">
          <AnimatePresence>
            {tasks.map((t, i) => (
              <motion.li
                key={t.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: Math.min(i * 0.05, 0.3) }}
                className="glass bg-bg-card/60 border border-border/60 shadow-sm rounded-xl2 p-4 flex items-center gap-4"
              >
                <input type="checkbox" checked={t.status === "completed"}
                       onChange={(e) => {
                         const completed = e.target.checked;
                         update.mutate({ id: t.id, patch: { status: completed ? "completed" : "inbox" } });
                         if (completed) addToast("Task completed!", "success");
                       }}
                       className="w-5 h-5 accent-brand flex-shrink-0 cursor-pointer" />
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${t.status === "completed" ? "line-through text-ink-muted" : "text-ink"}`}>{t.title}</p>
                  <p className="text-xs text-ink-muted mt-0.5 truncate">
                    <span className="uppercase tracking-wider opacity-80">{t.type.replace('_',' ')}</span> · <span className="capitalize opacity-80">{t.priority}</span>
                    {t.deadline ? ` · Due ${new Date(t.deadline).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <button onClick={() => {
                  del.mutate(t.id);
                  addToast("Task deleted", "info");
                }} className="text-danger/80 hover:text-danger text-xs font-medium px-2 py-1 rounded hover:bg-danger/10 transition-colors">Delete</button>
              </motion.li>
            ))}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}
