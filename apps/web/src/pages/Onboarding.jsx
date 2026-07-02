import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../services/supabase.js";
import PageTransition from "../components/PageTransition.jsx";
import { TimePickerButton } from "../components/DialogPickers.jsx";
import { Clock } from "lucide-react";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }
};

// §4.1 — 6 steps. Auto-detect timezone via Intl. On schedule save we call
// the recalculate_job_times RPC (§9 hard rule).

const STEPS = ["Welcome", "Goals", "Schedule", "Classes", "Privacy"];

export default function OnboardingPage() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  const [form, setForm] = useState({
    display_name: "", university: "", major: "", year: 1,
    goals: [], goalDraft: "",
    timezone: tz, wake_time: "07:30", sleep_time: "23:00",
    block_duration_mins: 45, daily_hour_cap: 8,
    classes: [], classDraft: { title: "", day_of_week: 1, start_time: "09:00", end_time: "10:00" },
    ai_data_consent: true,
  });

  function patch(p) { setForm((f) => ({ ...f, ...p })); }

  async function finish() {
    setBusy(true); setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not signed in");

      const { error: pErr } = await supabase.from("profiles").update({
        display_name: form.display_name,
        university: form.university,
        major: form.major,
        year: Number(form.year),
        timezone: form.timezone,
        wake_time: form.wake_time,
        sleep_time: form.sleep_time,
        block_duration_mins: Number(form.block_duration_mins),
        daily_hour_cap: Number(form.daily_hour_cap),
        goals: form.goals,
        ai_data_consent: form.ai_data_consent,
        onboarding_done: true,
      }).eq("id", user.id);
      if (pErr) throw pErr;

      if (form.classes.length) {
        const rows = form.classes.map((c) => ({ user_id: user.id, ...c }));
        await supabase.from("fixed_events").insert(rows);
      }

      // §9 HARD RULE: call recalculate_job_times after sleep_time set.
      await supabase.rpc("recalculate_job_times", { p_user_id: user.id });

      navigate("/today");
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col justify-center px-4 py-8 relative overflow-hidden">
        {/* Glossy Ambient Orbs */}
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-brand/15 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-accent/15 rounded-full blur-[120px] pointer-events-none mix-blend-screen" />

        <div className="max-w-lg w-full mx-auto relative z-10">
          <div className="flex items-center justify-between text-xs text-ink-muted mb-6 px-2">
            {STEPS.map((s, i) => (
              <span key={s} className={i === step ? "text-brand font-semibold" : "opacity-50"}>{i + 1}. {s}</span>
            ))}
          </div>

          <motion.div 
            className="glass rounded-2xl border border-border/80 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.12)] space-y-4"
            variants={containerVariants}
            initial="hidden"
            animate="show"
            key={step}
          >
            {step === 0 && (
              <>
                <motion.h2 variants={itemVariants} className="font-display text-2xl font-bold">Welcome to SmartPlan</motion.h2>
                <motion.div variants={itemVariants}><Input label="Display name" value={form.display_name} onChange={(v) => patch({ display_name: v })} /></motion.div>
                <motion.div variants={itemVariants}><Input label="University" value={form.university} onChange={(v) => patch({ university: v })} /></motion.div>
                <motion.div variants={itemVariants}><Input label="Major" value={form.major} onChange={(v) => patch({ major: v })} /></motion.div>
                <motion.div variants={itemVariants}><Input label="Year (1–5)" type="number" min={1} max={5} value={form.year} onChange={(v) => patch({ year: v })} /></motion.div>
              </>
            )}

        {step === 1 && (
          <>
            <h2 className="font-display text-2xl">Your goals</h2>
            <p className="text-sm text-ink-muted">Add 3–5 goals to anchor your planning.</p>
            <div className="flex gap-2">
              <input
                value={form.goalDraft}
                onChange={(e) => patch({ goalDraft: e.target.value })}
                placeholder="e.g. Ship side project"
                className="flex-1 px-3 py-2 rounded-lg bg-bg-subtle border border-border"
              />
              <button
                onClick={() => form.goalDraft.trim() && patch({ goals: [...form.goals, form.goalDraft.trim()], goalDraft: "" })}
                className="px-4 rounded-lg bg-brand text-brand-fg"
              >Add</button>
            </div>
            <ul className="flex flex-wrap gap-2">
              {form.goals.map((g, i) => (
                <li key={i} className="px-3 py-1 rounded-full bg-brand/15 text-brand text-xs">
                  {g} <button onClick={() => patch({ goals: form.goals.filter((_, j) => j !== i) })} className="ml-1">×</button>
                </li>
              ))}
            </ul>
          </>
        )}

        {step === 2 && (
          <>
            <h2 className="font-display text-2xl">Your daily rhythm</h2>
            <p className="text-sm text-ink-muted mb-4">Detected timezone: <span className="font-mono">{form.timezone}</span></p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs text-ink-muted mb-1.5">Wake time</label>
                <TimePickerButton value={form.wake_time} onChange={(v) => patch({ wake_time: v })} icon={Clock} placeholder="Wake time" />
              </div>
              <div>
                <label className="block text-xs text-ink-muted mb-1.5">Sleep time</label>
                <TimePickerButton value={form.sleep_time} onChange={(v) => patch({ sleep_time: v })} icon={Clock} placeholder="Sleep time" />
              </div>
            </div>
            <Select label="Block duration (min)" value={form.block_duration_mins} onChange={(v) => patch({ block_duration_mins: v })}
              options={[[25, "25"], [45, "45"], [90, "90"], [120, "120"]]} />
            <div className="mt-4">
              <Input label="Daily hour cap" type="number" min={2} max={10}
                     value={form.daily_hour_cap} onChange={(v) => patch({ daily_hour_cap: v })} />
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h2 className="font-display text-2xl">Recurring classes</h2>
            <p className="text-sm text-ink-muted mb-4">Add weekly classes (optional, skip if none).</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Input label="Title" value={form.classDraft.title}
                onChange={(v) => patch({ classDraft: { ...form.classDraft, title: v } })} />
              <Select label="Day" value={form.classDraft.day_of_week}
                onChange={(v) => patch({ classDraft: { ...form.classDraft, day_of_week: Number(v) } })}
                options={[[1, "Mon"], [2, "Tue"], [3, "Wed"], [4, "Thu"], [5, "Fri"], [6, "Sat"], [0, "Sun"]]} />
              <div>
                <label className="block text-xs text-ink-muted mb-1.5">Start</label>
                <TimePickerButton value={form.classDraft.start_time} onChange={(v) => patch({ classDraft: { ...form.classDraft, start_time: v } })} icon={Clock} placeholder="Start" />
              </div>
              <div>
                <label className="block text-xs text-ink-muted mb-1.5">End</label>
                <TimePickerButton value={form.classDraft.end_time} onChange={(v) => patch({ classDraft: { ...form.classDraft, end_time: v } })} icon={Clock} placeholder="End" />
              </div>
            </div>
            <button onClick={() => {
              if (!form.classDraft.title) return;
              patch({ classes: [...form.classes, form.classDraft], classDraft: { ...form.classDraft, title: "" } });
            }} className="px-5 py-2.5 rounded-xl bg-brand text-brand-fg text-sm font-bold shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">Add class</button>
            <ul className="text-sm text-ink-muted mt-4 space-y-1">
              {form.classes.map((c, i) => (<li key={i}>• {c.title} ({c.start_time}–{c.end_time})</li>))}
            </ul>
          </>
        )}

        {step === 4 && (
          <>
            <h2 className="font-display text-2xl">AI privacy</h2>
            <p className="text-sm text-ink-muted">
              SmartPlan can learn how you work (focus patterns, completion rates) to make your plans smarter.
              You can turn this off any time — your data stays in your Supabase project and is never sent to an external AI.
            </p>
            <div className="flex items-center gap-3 mt-6">
              <button 
                type="button" role="switch" aria-checked={form.ai_data_consent}
                onClick={() => patch({ ai_data_consent: !form.ai_data_consent })}
                className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${form.ai_data_consent ? 'bg-brand' : 'bg-bg-subtle border border-border'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${form.ai_data_consent ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="font-semibold text-ink">Allow AI to learn from my behavior (recommended)</span>
            </div>
            {!form.ai_data_consent && (
              <p className="text-sm text-warning mt-3">
                With this off, SmartPlan will use the deterministic (zero-token) planner instead of AI.
              </p>
            )}
          </>
        )}
        </motion.div>

        {error && <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-danger text-sm mt-4 text-center">{error}</motion.p>}

          <motion.div 
            className="flex justify-between mt-6 px-2"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <button
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              disabled={step === 0}
              className="px-6 py-2.5 text-ink-muted hover:text-ink disabled:opacity-30 transition font-medium"
            >Back</button>
            {step < STEPS.length - 1 ? (
              <button onClick={() => setStep((s) => s + 1)} className="px-8 py-3 rounded-xl bg-brand text-brand-fg font-bold shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-0.5 transition-all">Next</button>
            ) : (
              <button onClick={finish} disabled={busy} className="px-8 py-3 rounded-xl bg-brand text-brand-fg font-bold shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-0.5 transition-all disabled:opacity-60">
                {busy ? "Saving…" : "Finish"}
              </button>
            )}
          </motion.div>
        </div>
      </div>
    </PageTransition>
  );
}

function Input({ label, value, onChange, type = "text", ...rest }) {
  return (
    <label className="block">
      <span className="text-xs text-ink-muted">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)} {...rest}
        className="mt-1.5 w-full px-4 py-3 rounded-xl bg-bg-card border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm"
      />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="text-xs text-ink-muted">{label}</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full px-4 py-3 rounded-xl bg-bg-card border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm appearance-none"
      >
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </label>
  );
}
