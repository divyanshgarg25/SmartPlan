// hooks/useSession.js — auth + profile loader. Components consume this; they
// never touch the supabase client directly.
import { useEffect, useState } from "react";
import { supabase } from "../services/supabase.js";
import { DEMO_ENABLED, getDemoSession, makeFakeProfile } from "../services/devAuth.js";

export function useSession() {
  // Synchronously seed demo state so Protected routes don't bounce to /login
  // on the first render before the effect runs.
  const initialDemoSession = DEMO_ENABLED ? getDemoSession() : null;
  const [session, setSession] = useState(initialDemoSession);
  const [profile, setProfile] = useState(
    DEMO_ENABLED && initialDemoSession ? makeFakeProfile() : null
  );
  const [loading, setLoading] = useState(!DEMO_ENABLED);

  useEffect(() => {
    let mounted = true;

    // ----- DEMO MODE: skip Supabase entirely -----
    if (DEMO_ENABLED) {
      const apply = () => {
        const s = getDemoSession();
        setSession(s);
        setProfile(s ? makeFakeProfile() : null);
        setLoading(false);
      };
      apply();
      const onIn = () => apply();
      const onOut = () => { setSession(null); setProfile(null); };
      window.addEventListener("smartplan:demo-signin", onIn);
      window.addEventListener("smartplan:demo-signout", onOut);
      return () => {
        window.removeEventListener("smartplan:demo-signin", onIn);
        window.removeEventListener("smartplan:demo-signout", onOut);
      };
    }

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session) await loadProfile(data.session.user.id, setProfile);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s) await loadProfile(s.user.id, setProfile);
      else setProfile(null);
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  return { session, profile, loading, refresh: () => session && !DEMO_ENABLED && loadProfile(session.user.id, setProfile) };
}

async function loadProfile(userId, setProfile) {
  const { data } = await supabase.from("profiles").select("*").eq("id", userId).single();
  setProfile(data ?? null);
}
