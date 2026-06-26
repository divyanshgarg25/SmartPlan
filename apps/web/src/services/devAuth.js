// services/devAuth.js — DEV-ONLY auth shim.
// Activated by `VITE_DEMO_MODE=true` in .env.local. Lets you log in with a
// hardcoded demo credential without hitting Supabase, so you can browse every
// page locally. Data-fetching hooks will still return empty results (no DB),
// but every UI screen renders.
const STORAGE_KEY = "smartplan.demoSession";

export const DEMO_ENABLED = import.meta.env.VITE_DEMO_MODE === "true";
export const DEMO_EMAIL = import.meta.env.VITE_DEMO_EMAIL || "demo@smartplan.local";
export const DEMO_PASSWORD = import.meta.env.VITE_DEMO_PASSWORD || "smartplan-demo";

const DEMO_USER_ID = "00000000-0000-0000-0000-000000000001";

function makeFakeSession() {
  return {
    access_token: "demo-token",
    refresh_token: "demo-refresh",
    expires_at: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    token_type: "bearer",
    user: {
      id: DEMO_USER_ID,
      aud: "authenticated",
      role: "authenticated",
      email: DEMO_EMAIL,
      created_at: new Date().toISOString(),
    },
  };
}

export function makeFakeProfile() {
  return {
    id: DEMO_USER_ID,
    email: DEMO_EMAIL,
    display_name: "Demo User",
    onboarding_done: true,
    theme: "dark",
    wake_time: "07:00",
    sleep_time: "23:00",
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    ai_consent: true,
    plan_count: 0,
    fcm_token: null,
    created_at: new Date().toISOString(),
  };
}

export function getDemoSession() {
  if (!DEMO_ENABLED) return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function signInDemo(email, password) {
  if (!DEMO_ENABLED) return { error: { message: "Demo mode disabled" } };
  if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    return { error: { message: `Use ${DEMO_EMAIL} / ${DEMO_PASSWORD}` } };
  }
  const session = makeFakeSession();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  window.dispatchEvent(new CustomEvent("smartplan:demo-signin", { detail: session }));
  return { session, error: null };
}

export function signOutDemo() {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new CustomEvent("smartplan:demo-signout"));
}
