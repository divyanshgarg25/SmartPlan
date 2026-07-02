import { useEffect, useState } from "react";
import { useProfile, useUpdateProfile, useProfileSchedule } from "../hooks/useProfile.js";
import { useUI } from "../store/ui.js";
import { supabase } from "../services/supabase.js";
import { apiFetch } from "../services/api.js";
import { subscribePush } from "../services/fcm.js";
import Tutorial, { TUTORIAL_KEY } from "../components/Tutorial.jsx";
import { Clock, Save, RefreshCw, Download, Trash2, PlayCircle, BellRing } from "lucide-react";
import { TimePickerButton } from "../components/DialogPickers.jsx";

function Section({ title, children }) {
  return (
    <section className="bg-bg-card border border-border rounded-xl2 p-4 mb-4">
      <h2 className="font-display text-lg mb-3">{title}</h2>
      {children}
    </section>
  );
}

export default function SettingsPage() {
  const { data: profile } = useProfile();
  const update = useUpdateProfile();
  const { updateSchedule } = useProfileSchedule();
  const theme = useUI((s) => s.theme);
  const setTheme = useUI((s) => s.setTheme);
  const [github, setGithub] = useState("");
  const [leetcode, setLeetcode] = useState("");
  const [codeforces, setCodeforces] = useState("");
  const [schedule, setSchedule] = useState({ wake_time: "", sleep_time: "" });
  const [confirmText, setConfirmText] = useState("");
  const [tourOpen, setTourOpen] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (profile) {
      setSchedule({ wake_time: profile.wake_time, sleep_time: profile.sleep_time });
      // hydrate integrations
      (async () => {
        const { data } = await supabase.from("integrations").select("*").eq("user_id", profile.id).maybeSingle();
        if (data) {
          setGithub(data.github_username ?? "");
          setLeetcode(data.leetcode_username ?? "");
          setCodeforces(data.codeforces_handle ?? "");
        }
      })();
    }
  }, [profile]);

  if (!profile) return <p className="text-ink-muted">Loading…</p>;

  async function saveIntegrations() {
    await supabase.from("integrations").upsert({
      user_id: profile.id,
      github_username: github || null,
      leetcode_username: leetcode || null,
      codeforces_handle: codeforces || null,
    }, { onConflict: "user_id" });
  }

  async function manualSync() {
    setIsSyncing(true);
    await saveIntegrations();
    try {
      const r = await apiFetch("/api/user/sync-dev", { method: "POST" });
      if (r.ok) alert("Dev stats synced! Check the Insights tab.");
      else alert("Failed to sync. Make sure your usernames are correct.");
    } catch (e) {
      alert("Error syncing dev stats.");
    }
    setIsSyncing(false);
  }

  async function exportData() {
    const r = await apiFetch("/api/user/export");
    if (!r.ok) { alert("Export failed"); return; }
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `smartplan-export-${profile.id}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  async function deleteAccount() {
    if (confirmText !== "SmartPlan") return;
    const r = await apiFetch("/api/user/account", { method: "DELETE" });
    if (r.ok) { await supabase.auth.signOut(); location.href = "/login"; }
    else alert("Delete failed");
  }

  return (
    <div>
      <h1 className="font-display text-3xl font-bold mb-4">Settings</h1>

      <Section title="Profile">
        <label className="block text-xs text-ink-muted">Name</label>
        <input defaultValue={profile.name ?? ""}
               onBlur={(e) => e.target.value !== profile.name && update.mutate({ name: e.target.value })}
               className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm mb-2" />
        <label className="block text-xs text-ink-muted">Timezone</label>
        <input value={profile.timezone ?? ""} disabled
               className="w-full px-3 py-2 rounded-lg bg-bg-subtle border border-border text-ink-muted" />
      </Section>

      <Section title="Schedule">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs text-ink-muted mb-1">Wake time</label>
            <TimePickerButton
              value={schedule.wake_time}
              onChange={(val) => {
                setSchedule({ ...schedule, wake_time: val });
                const currentWake = profile.wake_time ? profile.wake_time.slice(0, 5) : "";
                if (val !== currentWake) updateSchedule({ wake_time: val });
              }}
              icon={Clock}
              placeholder="Wake time"
            />
          </div>
          <div>
            <label className="block text-xs text-ink-muted mb-1">Sleep time</label>
            <TimePickerButton
              value={schedule.sleep_time}
              onChange={(val) => {
                setSchedule({ ...schedule, sleep_time: val });
                const currentSleep = profile.sleep_time ? profile.sleep_time.slice(0, 5) : "";
                if (val !== currentSleep) updateSchedule({ sleep_time: val });
              }}
              icon={Clock}
              placeholder="Sleep time"
            />
          </div>
        </div>
        <p className="text-xs text-ink-muted mt-2">Changing these reschedules nightly jobs automatically.</p>
      </Section>

      <Section title="Appearance">
        <div className="flex gap-2">
          {["dark", "light"].map((t) => (
            <button key={t} onClick={() => setTheme(t)}
                    aria-pressed={theme === t}
                    className={`flex-1 py-2 rounded-lg border text-sm capitalize ${theme === t ? "bg-brand text-brand-fg border-brand" : "border-border text-ink-muted"}`}>
              {t}
            </button>
          ))}
        </div>
      </Section>

      <Section title="Tutorial">
        <p className="text-xs text-ink-muted mb-3">
          Replay the quick product tour at any time.
        </p>
        <button
          onClick={() => { try { localStorage.removeItem(TUTORIAL_KEY); } catch {} setTourOpen(true); }}
          className="group px-4 py-2 rounded-xl bg-bg-subtle border border-border text-sm font-semibold hover:bg-bg-card transition-all flex items-center gap-2"
        >
          <PlayCircle size={16} className="text-ink-muted group-hover:text-ink transition-colors" />
          Replay tutorial
        </button>
      </Section>

      <Section title="AI & Privacy">
        <div className="flex items-center gap-3">
          <button 
            type="button" role="switch" aria-checked={profile.ai_data_consent}
            onClick={() => update.mutate({ ai_data_consent: !profile.ai_data_consent })}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors ${profile.ai_data_consent ? 'bg-brand' : 'bg-bg-subtle border border-border'}`}
          >
            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${profile.ai_data_consent ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-sm">Allow AI to use my data for planning &amp; insights</span>
        </div>
        <p className="text-xs text-ink-muted mt-2">
          When off, SmartPlan uses the on-device DeterministicPlanner only.
        </p>
      </Section>

      <Section title="Dev-Sync integrations">
        <label className="block text-xs text-ink-muted">GitHub username</label>
        <input value={github} onChange={(e) => setGithub(e.target.value)}
               className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm mb-2" />
        <label className="block text-xs text-ink-muted">LeetCode username</label>
        <input value={leetcode} onChange={(e) => setLeetcode(e.target.value)}
               className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm mb-2" />
        <label className="block text-xs text-ink-muted">Codeforces handle</label>
        <input value={codeforces} onChange={(e) => setCodeforces(e.target.value)}
               className="w-full px-3 py-2 rounded-lg bg-bg-card border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm mb-2" />
        <div className="flex gap-3 mt-2">
          <button onClick={saveIntegrations}
                  className="px-4 py-2 rounded-xl bg-bg-card border border-border text-sm font-semibold hover:bg-bg-subtle transition-all flex items-center gap-2 shadow-sm">
            <Save size={16} className="text-ink-muted" />
            Save handles
          </button>
          <button onClick={manualSync} disabled={isSyncing}
                  className="group px-4 py-2 rounded-xl bg-brand text-brand-fg text-sm font-bold hover:brightness-110 disabled:opacity-50 transition-all flex items-center gap-2 shadow-[0_4px_14px_0_rgba(14,165,233,0.39)] hover:shadow-[0_6px_20px_rgba(14,165,233,0.23)]">
            <RefreshCw size={16} className={isSyncing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
            {isSyncing ? "Syncing..." : "Sync Now"}
          </button>
        </div>
      </Section>

      <Section title="Notifications">
        <button onClick={subscribePush}
                className="group px-4 py-2 rounded-xl bg-brand/15 text-brand text-sm font-semibold hover:bg-brand/25 transition-all flex items-center gap-2">
          <BellRing size={16} className="group-hover:animate-bounce" />
          Enable push notifications
        </button>
        <p className="text-xs text-ink-muted mt-2">Block reminders, deadline warnings, weekly review.</p>
      </Section>

      <Section title="Your data (GDPR)">
        <button onClick={exportData}
                className="group px-4 py-2 rounded-xl bg-bg-subtle border border-border text-sm font-semibold hover:bg-bg-card transition-all flex items-center gap-2 mb-4 shadow-sm">
          <Download size={16} className="text-ink-muted group-hover:text-ink transition-colors" />
          Export everything (JSON)
        </button>
        <div className="p-4 border border-danger/40 rounded-xl2 bg-danger/5">
          <p className="text-sm text-danger font-bold flex items-center gap-2">
            <Trash2 size={16} /> Delete account
          </p>
          <p className="text-xs text-ink-muted mt-1">Type <span className="font-mono font-bold">SmartPlan</span> to confirm.</p>
          <input value={confirmText} onChange={(e) => setConfirmText(e.target.value)}
                 className="mt-3 w-full px-3 py-2 rounded-lg bg-bg-card border border-danger/30 focus:border-danger focus:ring-1 focus:ring-danger text-ink transition shadow-sm" />
          <button disabled={confirmText !== "SmartPlan"} onClick={deleteAccount}
                  className="mt-3 px-5 py-2.5 rounded-xl bg-danger text-white text-sm font-bold disabled:opacity-40 shadow-[0_4px_14px_0_rgba(239,68,68,0.39)] hover:shadow-[0_6px_20px_rgba(239,68,68,0.23)] transition-all">
            Delete account permanently
          </button>
        </div>
      </Section>

      <Tutorial open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
