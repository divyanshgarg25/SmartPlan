import { useState } from "react";
import { Link } from "react-router-dom";
import { useWeekPlan, useGenerateWeek } from "../hooks/useWeekPlan.js";
import { ShimmerCard, ErrorState, EmptyState } from "../components/States.jsx";
import WeekCustomiseDrawer from "../components/WeekCustomiseDrawer.jsx";
import { Settings2, Sparkles, CalendarDays } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function dayDates(weekStart) {
  const start = new Date(weekStart + "T00:00:00Z");
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start); d.setUTCDate(start.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export default function WeekPage() {
  const { data: week, isLoading, error, refetch } = useWeekPlan();
  const generate = useGenerateWeek();
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div>
      <header className="flex items-center justify-between mb-6">
        <h1 className="font-display text-3xl font-bold flex items-center gap-3">
          <CalendarDays className="text-brand" size={28} />
          Week
        </h1>
        <div className="flex gap-3">
          <div className="relative group flex items-center">
            <button onClick={() => setDrawerOpen(true)} className="px-4 py-2.5 rounded-xl border border-border/60 bg-bg-card shadow-sm text-sm font-bold hover:bg-bg-subtle transition-all flex items-center gap-2 text-ink">
              <Settings2 size={16} className="text-ink-muted group-hover:rotate-45 transition-transform duration-300" />
              Customise
            </button>
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1.5 bg-ink text-bg text-xs font-semibold rounded-md opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100 pointer-events-none whitespace-nowrap shadow-xl z-50">
              Set hour caps & rest days
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-ink"></div>
            </div>
          </div>
          <button onClick={() => generate.mutate()} disabled={generate.isPending}
                  className="group px-5 py-2.5 rounded-xl bg-brand text-brand-fg text-sm font-bold disabled:opacity-60 shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)] hover:-translate-y-0.5 transition-all flex items-center gap-2">
            <Sparkles size={16} className="text-brand-fg opacity-90 fill-brand-fg group-hover:animate-pulse" />
            {generate.isPending ? "Generating..." : "Generate week"}
          </button>
        </div>
      </header>

      {week?.insight && (
        <div className="mb-4 p-4 rounded-xl2 bg-brand/10 border border-brand/30">
          <p className="text-sm leading-relaxed">{week.insight}</p>
          {week.load_score != null && (
            <p className="text-xs text-ink-muted mt-2">
              Load score: {(week.load_score * 100).toFixed(0)}%
              {week.load_score > 0.9 && <span className="ml-2 text-warning">⚠ overload risk</span>}
            </p>
          )}
        </div>
      )}

      {isLoading ? (
        <><ShimmerCard /><ShimmerCard /></>
      ) : error ? (
        <ErrorState message={error.message} onRetry={refetch} />
      ) : !week ? (
        <EmptyState title="No week plan yet" body="Generate a skeleton to distribute work across days." />
      ) : (
        <ul className="grid grid-cols-2 md:grid-cols-7 gap-2">
          {dayDates(week.week_start).map((date, i) => {
            const dayLoad = week.skeleton?.perDay?.[date] ?? [];
            const hours = dayLoad.reduce((s, x) => s + x.hours, 0);
            return (
              <li key={date}>
                <Link to={`/week/${date}`}
                      className="block p-3 rounded-xl2 border border-border bg-bg-card hover:bg-bg-subtle transition">
                  <div className="text-[10px] uppercase tracking-wider text-ink-muted">{DAYS[i]}</div>
                  <div className="font-mono text-xs">{date.slice(5)}</div>
                  <div className="mt-2 text-sm font-semibold">{hours.toFixed(1)}h</div>
                  <div className="text-[10px] text-ink-muted">{dayLoad.length} task{dayLoad.length === 1 ? "" : "s"}</div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      <WeekCustomiseDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
