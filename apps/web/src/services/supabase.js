// services/supabase.js — frontend Supabase client (anon key, RLS-enforced).
// HARD RULE §3.10/§9: only hooks/services may import this. Lint blocks
// importing it from components/**.
import { createClient } from "@supabase/supabase-js";
import { DEMO_ENABLED, getDemoSession, makeFakeProfile } from "./devAuth.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ---------------------------------------------------------------------------
// Demo mode: return a fully-mocked client so pages render with empty data
// instead of throwing "Failed to fetch" against a placeholder Supabase URL.
// ---------------------------------------------------------------------------
function makeMockClient() {
  function singleRowFor(table) {
    if (table === "profiles") return makeFakeProfile();
    if (table === "integrations") {
      const s = getDemoSession();
      return {
        user_id: s?.user?.id ?? null,
        github_username: "",
        leetcode_username: "",
        codeforces_handle: "",
      };
    }
    return null;
  }
  function makeQueryBuilder(table) {
    let singleMode = false;
    const handler = {
      get(_t, prop) {
        if (prop === "then") {
          // Make the chain awaitable
          return (resolve) =>
            resolve({
              data: singleMode ? singleRowFor(table) : [],
              error: null,
              count: 0,
            });
        }
        if (prop === "single" || prop === "maybeSingle") {
          return () => { singleMode = true; return proxy; };
        }
        // Every other chainable method returns the proxy itself
        return () => proxy;
      },
    };
    const proxy = new Proxy(function () {}, handler);
    return proxy;
  }

  const demoUser = () => {
    const s = getDemoSession();
    return s?.user ?? null;
  };

  return {
    from: (table) => makeQueryBuilder(table),
    rpc: async () => ({ data: null, error: null }),
    auth: {
      getUser: async () => ({ data: { user: demoUser() }, error: null }),
      getSession: async () => ({ data: { session: getDemoSession() }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      signInWithPassword: async () => ({ data: null, error: { message: "Demo mode" } }),
      signUp: async () => ({ data: null, error: { message: "Demo mode" } }),
      signInWithOAuth: async () => ({ data: null, error: { message: "Demo mode" } }),
      signOut: async () => ({ error: null }),
    },
    channel: () => ({
      on: function () { return this; },
      subscribe: () => ({ unsubscribe: () => {} }),
    }),
    removeChannel: () => {},
    // Expose helpers so devtools can introspect
    __demo: { profile: makeFakeProfile },
  };
}

if (!DEMO_ENABLED && (!url || !anon)) {
  console.error(
    "[SmartPlan] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — fill .env.local from docs/SETUP.md"
  );
}

export const supabase = DEMO_ENABLED
  ? makeMockClient()
  : createClient(url ?? "https://placeholder.supabase.co", anon ?? "anon", {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });

if (DEMO_ENABLED) {
  console.info("[SmartPlan] Demo mode active — Supabase calls are mocked.");
}
