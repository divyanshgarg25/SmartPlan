import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { useUI } from "../store/ui.js";
// eslint-disable-next-line no-restricted-imports
import { supabase } from "../services/supabase.js";
import { DEMO_ENABLED } from "../services/devAuth.js";
import Tutorial from "./Tutorial.jsx";
import PageTransition from "./PageTransition.jsx";
import Toaster from "./Toaster.jsx";

/* --------------------------------------------------------------------------
 * Inline icon set (stroke-based, currentColor) — no extra deps.
 * ------------------------------------------------------------------------ */
function Icon({ name, className = "w-5 h-5" }) {
  const common = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    className,
  };
  switch (name) {
    case "today":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case "week":
      return (
        <svg {...common}>
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 9h18M8 3v4M16 3v4" />
        </svg>
      );
    case "tasks":
      return (
        <svg {...common}>
          <path d="M4 6h11M4 12h11M4 18h7" />
          <path d="M18 5l2 2 3-3M18 11l2 2 3-3" />
        </svg>
      );
    case "insights":
      return (
        <svg {...common}>
          <path d="M3 3v18h18" />
          <path d="M7 15l4-4 3 3 5-6" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1.04 1.56V21a2 2 0 0 1-4 0v-.08a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06A2 2 0 1 1 4.13 16.94l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.56-1.04H3a2 2 0 0 1 0-4h.08A1.7 1.7 0 0 0 4.63 8.86a1.7 1.7 0 0 0-.34-1.87l-.06-.06A2 2 0 1 1 7.06 4.1l.06.06a1.7 1.7 0 0 0 1.87.34H9a1.7 1.7 0 0 0 1.04-1.56V3a2 2 0 0 1 4 0v.08a1.7 1.7 0 0 0 1.04 1.56 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87V9a1.7 1.7 0 0 0 1.56 1.04H21a2 2 0 0 1 0 4h-.08a1.7 1.7 0 0 0-1.56 1.04z" />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      );
    case "spark":
      return (
        <svg {...common}>
          <path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2 2-6z" />
        </svg>
      );
    case "flame":
      return (
        <svg {...common}>
          <path d="M12 2s4 4 4 8a4 4 0 0 1-8 0c0-1.5.5-2.5 1.5-3.5C10.5 5.5 12 2 12 2z" />
          <path d="M7 14a5 5 0 0 0 10 0c0-2-1-3.5-2-4.5 0 3-1.5 4-3 4s-2-1-2-2c-1 .5-3 1.5-3 2.5z" />
        </svg>
      );
    case "bolt":
      return (
        <svg {...common}>
          <path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z" />
        </svg>
      );
    case "chevron-right":
      return (
        <svg {...common}>
          <path d="M9 6l6 6-6 6" />
        </svg>
      );
    case "chevron-left":
      return (
        <svg {...common}>
          <path d="M15 6l-6 6 6 6" />
        </svg>
      );
    default:
      return null;
  }
}

const tabs = [
  { to: "/today",    label: "Today",    icon: "today"    },
  { to: "/week",     label: "Week",     icon: "week"     },
  { to: "/tasks",    label: "Tasks",    icon: "tasks"    },
  { to: "/insights", label: "Insights", icon: "insights" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

/* Curated quotes from notable thinkers, leaders, athletes, and writers.
 * One is shown per calendar day (deterministic by day-of-year). */
const QUOTES = [
  { text: "The secret of getting ahead is getting started.", author: "Mark Twain" },
  { text: "It always seems impossible until it's done.", author: "Nelson Mandela" },
  { text: "We are what we repeatedly do. Excellence, then, is not an act, but a habit.", author: "Will Durant" },
  { text: "The journey of a thousand miles begins with a single step.", author: "Lao Tzu" },
  { text: "Discipline is the bridge between goals and accomplishment.", author: "Jim Rohn" },
  { text: "You miss 100% of the shots you don't take.", author: "Wayne Gretzky" },
  { text: "Whether you think you can or you think you can't — you're right.", author: "Henry Ford" },
  { text: "The best way to predict the future is to invent it.", author: "Alan Kay" },
  { text: "Simplicity is the ultimate sophistication.", author: "Leonardo da Vinci" },
  { text: "What we think, we become.", author: "Buddha" },
  { text: "Stay hungry, stay foolish.", author: "Steve Jobs" },
  { text: "The only way to do great work is to love what you do.", author: "Steve Jobs" },
  { text: "In the middle of difficulty lies opportunity.", author: "Albert Einstein" },
  { text: "Try not to become a man of success, but rather try to become a man of value.", author: "Albert Einstein" },
  { text: "Quality is not an act, it is a habit.", author: "Aristotle" },
  { text: "Knowing yourself is the beginning of all wisdom.", author: "Aristotle" },
  { text: "The mind is everything. What you think you become.", author: "Buddha" },
  { text: "He who has a why to live can bear almost any how.", author: "Friedrich Nietzsche" },
  { text: "Do what you can, with what you have, where you are.", author: "Theodore Roosevelt" },
  { text: "Believe you can and you're halfway there.", author: "Theodore Roosevelt" },
  { text: "It is never too late to be what you might have been.", author: "George Eliot" },
  { text: "The future depends on what you do today.", author: "Mahatma Gandhi" },
  { text: "Be the change that you wish to see in the world.", author: "Mahatma Gandhi" },
  { text: "You cannot cross the sea merely by standing and staring at the water.", author: "Rabindranath Tagore" },
  { text: "I have not failed. I've just found 10,000 ways that won't work.", author: "Thomas Edison" },
  { text: "Genius is one percent inspiration and ninety-nine percent perspiration.", author: "Thomas Edison" },
  { text: "Action is the foundational key to all success.", author: "Pablo Picasso" },
  { text: "Our greatest weakness lies in giving up. The most certain way to succeed is to try just one more time.", author: "Thomas A. Edison" },
  { text: "Success is not final, failure is not fatal: it is the courage to continue that counts.", author: "Winston Churchill" },
  { text: "If you're going through hell, keep going.", author: "Winston Churchill" },
  { text: "The only limit to our realization of tomorrow is our doubts of today.", author: "Franklin D. Roosevelt" },
  { text: "Don't watch the clock; do what it does. Keep going.", author: "Sam Levenson" },
  { text: "Hard work beats talent when talent doesn't work hard.", author: "Tim Notke" },
  { text: "I've missed more than 9,000 shots in my career. I've failed over and over and over again — and that is why I succeed.", author: "Michael Jordan" },
  { text: "Energy and persistence conquer all things.", author: "Benjamin Franklin" },
  { text: "By failing to prepare, you are preparing to fail.", author: "Benjamin Franklin" },
  { text: "An investment in knowledge pays the best interest.", author: "Benjamin Franklin" },
  { text: "The best time to plant a tree was 20 years ago. The second best time is now.", author: "Chinese Proverb" },
  { text: "You don't have to be great to start, but you have to start to be great.", author: "Zig Ziglar" },
  { text: "What gets measured gets managed.", author: "Peter Drucker" },
  { text: "The best way out is always through.", author: "Robert Frost" },
  { text: "You become what you think about all day long.", author: "Ralph Waldo Emerson" },
  { text: "Do the thing you fear, and the death of fear is certain.", author: "Ralph Waldo Emerson" },
  { text: "Knowing is not enough; we must apply. Willing is not enough; we must do.", author: "Johann Wolfgang von Goethe" },
  { text: "Whatever you can do, or dream you can, begin it. Boldness has genius, power and magic in it.", author: "Johann Wolfgang von Goethe" },
  { text: "Strive not to be a success, but rather to be of value.", author: "Albert Einstein" },
  { text: "The two most important days in your life are the day you are born and the day you find out why.", author: "Mark Twain" },
  { text: "Either you run the day, or the day runs you.", author: "Jim Rohn" },
  { text: "What you do every day matters more than what you do once in a while.", author: "Gretchen Rubin" },
  { text: "Make each day your masterpiece.", author: "John Wooden" },
  { text: "Concentrate all your thoughts upon the work in hand. The sun's rays do not burn until brought to a focus.", author: "Alexander Graham Bell" },
  { text: "Done is better than perfect.", author: "Sheryl Sandberg" },
  { text: "The expert in anything was once a beginner.", author: "Helen Hayes" },
  { text: "Setting goals is the first step in turning the invisible into the visible.", author: "Tony Robbins" },
];

function quoteOfTheDay() {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const day = Math.floor((Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) - start) / 86400000);
  return QUOTES[day % QUOTES.length];
}

function Brand() {
  return (
    <span className="font-display font-extrabold tracking-tight text-xl">
      <span className="text-gradient-brand">SmartPlan</span>
    </span>
  );
}

function ThemeToggle() {
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  
  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
      className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-border text-ink-muted hover:text-ink hover:border-brand/60 transition"
    >
      <Icon name={theme === "dark" ? "sun" : "moon"} className="w-[18px] h-[18px]" />
    </button>
  );
}

function DatePill() {
  const today = new Date();
  const fmt = today.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  return (
    <span className="hidden sm:inline-flex items-center gap-2 px-3 h-10 rounded-full border border-border text-xs font-medium text-ink-muted bg-bg-card/60">
      <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
      {fmt}
    </span>
  );
}

const SIDE_PANEL_KEY = "smartplan.sidePanel.open";

/* ---------- Side panel live stats (real DB; demo fallback values) ---------- */
const DEMO_STATS = {
  streakDays: 7,
  focusMinutes: 160, // 2h 40m
};

function useSideStats() {
  return useQuery({
    queryKey: ["side-stats", DEMO_ENABLED],
    staleTime: 60_000,
    queryFn: async () => {
      if (DEMO_ENABLED) return DEMO_STATS;

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { streakDays: 0, focusMinutes: 0, energyTrend: [] };

      const todayISO = new Date().toISOString().slice(0, 10);
      const since30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const sinceTs = new Date(Date.now() - 7 * 86400000).toISOString();
      const startOfDayTs = new Date(); startOfDayTs.setHours(0, 0, 0, 0);

      const [checkRes, blocksRes, logsRes] = await Promise.all([
        supabase
          .from("check_ins")
          .select("date")
          .eq("user_id", user.id)
          .gte("date", since30)
          .order("date", { ascending: false }),
        supabase
          .from("time_blocks")
          .select("planned_minutes, status, date")
          .eq("user_id", user.id)
          .eq("date", todayISO),
        supabase
          .from("behavior_logs")
          .select("event_type, payload, created_at")
          .eq("user_id", user.id)
          .gte("created_at", sinceTs),
      ]);

      const checkIns = checkRes.data ?? [];
      const blocks   = blocksRes.data ?? [];
      const logs     = logsRes.data ?? [];

      // Streak: consecutive days back from today with a check-in.
      const dateSet = new Set(checkIns.map((c) => c.date));
      let streakDays = 0;
      const cursor = new Date();
      // Allow today missing but yesterday counting; require today OR yesterday to start.
      for (let i = 0; i < 60; i++) {
        const iso = cursor.toISOString().slice(0, 10);
        if (dateSet.has(iso)) streakDays++;
        else if (i > 0) break;
        cursor.setDate(cursor.getDate() - 1);
      }

      // Focus today: sum minutes from focus_session_end payloads OR completed blocks.
      const focusFromLogs = logs
        .filter((l) => l.event_type === "focus_session_end"
          && new Date(l.created_at) >= startOfDayTs)
        .reduce((sum, l) => sum + Number(l.payload?.actual_minutes ?? 0), 0);
      const focusFromBlocks = blocks
        .filter((b) => b.status === "completed")
        .reduce((sum, b) => sum + Number(b.planned_minutes ?? 0), 0);
      const focusMinutes = focusFromLogs > 0 ? focusFromLogs : focusFromBlocks;

      return { streakDays, focusMinutes };
    },
  });
}

function formatFocus(mins) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = Math.round(mins % 60);
  return h ? `${h}h ${m}m` : `${m}m`;
}


function SidePanel({ open, onToggle }) {
  const quote = quoteOfTheDay();
  const { data: stats, isLoading } = useSideStats();
  const streakText = isLoading ? "…" : `${stats?.streakDays ?? 0}d`;
  const focusText  = isLoading ? "…" : formatFocus(stats?.focusMinutes ?? 0);
  return (
    <aside
      className={`hidden xl:flex flex-col gap-4 shrink-0 sticky top-24 self-start transition-[width] duration-300 ease-out ${
        open ? "w-72" : "w-12"
      }`}
    >
      <button
        onClick={onToggle}
        aria-label={open ? "Collapse side panel" : "Expand side panel"}
        aria-expanded={open}
        className="self-end inline-flex items-center justify-center w-9 h-9 rounded-full border border-border text-ink-muted hover:text-ink hover:border-brand/60 bg-bg-card/70 transition"
      >
        <Icon name={open ? "chevron-right" : "chevron-left"} className="w-4 h-4" />
      </button>

      {!open ? null : (
      <>
      {/* Decorative gradient orb card */}
      <div className="relative overflow-hidden rounded-xl2 border border-border bg-bg-card p-5">
        <div
          className="absolute -top-12 -right-12 w-40 h-40 rounded-full blur-3xl opacity-60 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgb(var(--brand)) 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-10 -left-10 w-32 h-32 rounded-full blur-3xl opacity-40 pointer-events-none"
          style={{ background: "radial-gradient(circle, rgb(var(--accent)) 0%, transparent 70%)" }}
        />
        <div className="relative">
          <div className="inline-flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
            <Icon name="spark" className="w-4 h-4 text-brand" />
            Quote of the day
          </div>
          <blockquote className="mt-3 font-display text-lg leading-snug text-ink">
            “{quote.text}”
          </blockquote>
          <p className="mt-2 text-xs text-ink-muted">— {quote.author}</p>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl2 border border-border bg-bg-card p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
            <Icon name="flame" className="w-4 h-4 text-warning" />
            Streak
          </div>
          <p className="mt-2 font-display text-2xl font-bold">{streakText}</p>
        </div>
        <div className="rounded-xl2 border border-border bg-bg-card p-4">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-ink-muted">
            <Icon name="bolt" className="w-4 h-4 text-accent" />
            Focus
          </div>
          <p className="mt-2 font-display text-2xl font-bold">{focusText}</p>
        </div>
      </div>
      </>
      )}
    </aside>
  );
}

export default function AppShell({ children }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(() => {
    const v = typeof localStorage !== "undefined" ? localStorage.getItem(SIDE_PANEL_KEY) : null;
    return v === null ? true : v === "1";
  });
  function togglePanel() {
    setPanelOpen((p) => {
      const next = !p;
      try { localStorage.setItem(SIDE_PANEL_KEY, next ? "1" : "0"); } catch { /* ignore */ }
      return next;
    });
  }

  // §6.4 keyboard nav between bottom-nav tabs (arrow keys).
  useEffect(() => {
    function onKey(e) {
      if (e.target.matches("input, textarea, select, [contenteditable]")) return;
      const idx = tabs.findIndex((t) => t.to === loc.pathname);
      if (idx < 0) return;
      if (e.key === "ArrowRight" && idx < tabs.length - 1) navigate(tabs[idx + 1].to);
      if (e.key === "ArrowLeft"  && idx > 0)               navigate(tabs[idx - 1].to);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [loc.pathname, navigate]);

  return (
    <div className="min-h-screen flex flex-col relative">
      {/* Sticky top bar */}
      <header className="sticky top-0 z-30 glass border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="w-9 h-9 rounded-xl grid place-items-center shadow-[0_6px_18px_-6px_rgb(var(--glow)/0.7)]"
              style={{
                background:
                  "linear-gradient(135deg, rgb(var(--brand)) 0%, rgb(var(--accent)) 100%)",
              }}
            >
              <Icon name="bolt" className="w-5 h-5 text-white" />
            </span>
            <Brand />
          </div>
          <div className="flex-1" />
          <DatePill />
          <ThemeToggle />
        </div>
      </header>

      {/* Body: sidebar + content + side panel */}
      <div className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 pt-6 pb-24 md:pb-10 flex gap-6">
        {/* Desktop left rail (Floating Dock) */}
        <aside className="hidden md:flex flex-col gap-1 w-[220px] shrink-0 sticky top-24 self-start bg-bg-card/80 backdrop-blur-xl border border-border/80 rounded-[20px] p-3 shadow-2xl">
          <div className="px-3 pb-2 pt-1 mb-1">
            <h3 className="text-[10px] font-bold uppercase tracking-[0.2em] text-ink-muted/70">Navigation</h3>
          </div>
          {tabs.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 h-10 rounded-xl text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? "bg-brand text-brand-fg shadow-[0_8px_20px_-6px_rgb(var(--brand))]"
                    : "text-ink-muted hover:text-ink hover:bg-bg-subtle hover:translate-x-1"
                }`
              }
            >
              <Icon name={t.icon} className="w-[18px] h-[18px]" />
              <span>{t.label}</span>
            </NavLink>
          ))}
        </aside>

        {/* Main content */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <PageTransition key={loc.pathname}>
              {children}
            </PageTransition>
          </AnimatePresence>
        </main>

        {/* Right side panel (collapsible on xl+) */}
        <SidePanel open={panelOpen} onToggle={togglePanel} />
      </div>

      {/* Mobile bottom nav */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 glass border-t border-border safe-area-bottom z-30"
        aria-label="Primary"
      >
        <ul className="flex justify-around max-w-3xl mx-auto">
          {tabs.map((t) => (
            <li key={t.to}>
              <NavLink
                to={t.to}
                aria-label={t.label}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center px-3 py-2 text-[11px] font-medium min-w-[56px] min-h-[56px] ${
                    isActive ? "text-brand" : "text-ink-muted"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      aria-hidden="true"
                      className={`grid place-items-center w-9 h-9 rounded-xl transition ${
                        isActive ? "bg-brand/15" : ""
                      }`}
                    >
                      <Icon name={t.icon} className="w-[18px] h-[18px]" />
                    </span>
                    <span className="mt-0.5">{t.label}</span>
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* First-run onboarding tour (auto-opens once, skippable) */}
      <Tutorial />

      {/* Global Toast Notifications */}
      <Toaster />
    </div>
  );
}
