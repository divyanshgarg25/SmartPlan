import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "../services/supabase.js";
import { DEMO_ENABLED, DEMO_EMAIL, DEMO_PASSWORD, signInDemo } from "../services/devAuth.js";
import SplashScreen from "../components/SplashScreen.jsx";
import PageTransition from "../components/PageTransition.jsx";

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 10, filter: "blur(4px)" },
  show: { opacity: 1, y: 0, filter: "blur(0px)", transition: { duration: 0.4, ease: [0.4, 0, 0.2, 1] } }
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState(DEMO_ENABLED ? DEMO_EMAIL : "");
  const [password, setPassword] = useState(DEMO_ENABLED ? DEMO_PASSWORD : "");
  const [mode, setMode] = useState("signin"); // signin | signup
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setError(null);
    if (DEMO_ENABLED) {
      const { error } = signInDemo(email, password);
      setBusy(false);
      if (error) setError(error.message);
      else navigate("/today");
      return;
    }
    try {
      const fn = mode === "signin" ? supabase.auth.signInWithPassword : supabase.auth.signUp;
      const { error } = await fn.call(supabase.auth, { email, password });
      if (error) throw error;
      navigate("/today");
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    } finally {
      setBusy(false);
    }
  }

  function oneClickDemo() {
    const { error } = signInDemo(DEMO_EMAIL, DEMO_PASSWORD);
    if (error) setError(error.message);
    else navigate("/today");
  }

  async function google() {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/today" },
      });
      if (error) throw error;
    } catch (err) {
      setError(err.message || "An unexpected error occurred.");
    }
  }

  return (
    <PageTransition>
      <div className="min-h-screen flex flex-col items-center justify-center gap-6 px-4 py-10 relative overflow-hidden">
        
        {/* Glossy Ambient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-brand/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[100px] pointer-events-none mix-blend-screen" />

        <SplashScreen embedded />
        
        <motion.div 
          className="w-full max-w-sm glass rounded-2xl border border-border/80 p-8 shadow-[0_8px_32px_rgba(0,0,0,0.12)] relative z-10"
          variants={containerVariants}
          initial="hidden"
          animate="show"
        >
          <motion.div variants={itemVariants} className="text-center">
            <h1 className="font-display text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-br from-ink to-ink-muted">
              Welcome back
            </h1>
            <p className="text-ink-muted text-sm mt-2">Focus. SmartPlan. Achieve.</p>
          </motion.div>

          <motion.form variants={itemVariants} onSubmit={submit} className="mt-8 space-y-4">
            <div>
              <input
                type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className="w-full px-4 py-3 rounded-xl bg-bg-card/50 border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm"
              />
            </div>
            <div>
              <input
                type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3 rounded-xl bg-bg-card/50 border border-border focus:border-brand focus:ring-1 focus:ring-brand text-ink transition shadow-sm"
              />
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            <button
              type="submit" disabled={busy}
              className="w-full py-3 rounded-xl bg-brand text-brand-fg font-semibold disabled:opacity-60 shadow-[0_4px_14px_0_rgb(var(--glow)/0.4)] hover:shadow-[0_6px_20px_rgb(var(--glow)/0.6)] hover:-translate-y-0.5 transition-all"
            >
              {busy ? "Authenticating…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
          </motion.form>

          <motion.div variants={itemVariants} className="mt-4 text-center text-sm text-ink-muted">
            <button onClick={() => setMode(mode === "signin" ? "signup" : "signin")} className="hover:text-ink transition-colors">
              {mode === "signin" ? "Need an account? Sign up" : "Already have an account? Sign in"}
            </button>
          </motion.div>

          <motion.div variants={itemVariants} className="mt-6 border-t border-border/50 pt-6">
            <button onClick={google} className="w-full py-3 rounded-xl border border-border bg-bg-card/30 hover:bg-bg-card/60 text-ink transition shadow-sm">
              Continue with Google
            </button>
          </motion.div>

          {DEMO_ENABLED && (
            <motion.div variants={itemVariants} className="mt-6 border-t border-border/50 pt-6 space-y-3">
              <button
                onClick={oneClickDemo}
                className="w-full py-3 rounded-xl bg-accent/90 hover:bg-accent text-white font-semibold transition shadow-sm"
              >
                Enter Demo Mode
              </button>
              <p className="text-xs text-ink-muted text-center leading-relaxed">
                Demo credentials prefilled.<br/>No Supabase backend required.
              </p>
            </motion.div>
          )}
        </motion.div>
      </div>
    </PageTransition>
  );
}
