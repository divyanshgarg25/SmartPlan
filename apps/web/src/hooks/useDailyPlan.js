// hooks/useDailyPlan.js — orchestrates SSE generation + persisted plan read.
import { useState, useCallback, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../services/supabase.js";
import { streamDailyPlan } from "../services/api.js";
import { logBehavior } from "../services/behaviorLog.js";

function todayISO() { return new Date().toISOString().slice(0, 10); }

export function usePersistedPlan() {
  return useQuery({
    queryKey: ["day_plan", todayISO()],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: plan } = await supabase.from("day_plans")
        .select("*, time_blocks(*)")
        .eq("user_id", user.id).eq("date", todayISO()).maybeSingle();
      if (plan?.time_blocks) plan.time_blocks.sort((a, b) => a.sort_index - b.sort_index);
      return plan;
    },
  });
}

export function useVelocity() {
  return useQuery({
    queryKey: ["user_velocity"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const today = new Date().toISOString().slice(0, 10);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600_000).toISOString().slice(0, 10);
      const { data } = await supabase.from("day_plans")
        .select("time_blocks(status)")
        .eq("user_id", user.id)
        .gte("date", sevenDaysAgo).lt("date", today);
        
      let total = 0, completed = 0;
      for (const dp of data ?? []) {
        for (const b of dp.time_blocks ?? []) {
          total++;
          if (b.status === "completed") completed++;
        }
      }
      return total > 0 ? Math.round((completed / total) * 100) : 100;
    }
  });
}

/**
 * Generates today's plan via SSE. Returns:
 *   { state: "idle"|"thinking"|"streaming"|"done"|"error"|"need_check_in",
 *     blocks: [], providerUsed, error, generate() }
 */
export function useDailyPlanGenerator() {
  const [state, setState] = useState("idle");
  const [blocks, setBlocks] = useState([]);
  const [providerUsed, setProviderUsed] = useState(null);
  const [error, setError] = useState(null);
  const abortCtrl = useRef(null);

  const generate = useCallback(async (forceDeterministic = false) => {
    if (abortCtrl.current) abortCtrl.current.abort();
    // eslint-disable-next-line no-undef
    const ctrl = new AbortController();
    abortCtrl.current = ctrl;

    setState("thinking"); setBlocks([]); setProviderUsed(null); setError(null);
    try {
      await streamDailyPlan(({ event, data }) => {
        switch (event) {
          case "clear":          setBlocks([]); setState("streaming"); break;
          case "thinking":       setState("thinking"); break;
          case "block":          setBlocks((prev) => [...prev, data]); break;
          case "done":           setProviderUsed(data.provider_used); setState("done"); break;
          case "error":          setError(data.message ?? "Unknown error"); setState("error"); break;
          case "need_check_in":  setState("need_check_in"); break;
          default: break;
        }
      }, { forceDeterministic, signal: ctrl.signal });
    } catch (e) {
      if (e.name !== "AbortError") {
        setError(e.message);
        setState("error");
      }
    }
  }, []);

  useEffect(() => {
    if (state === "done") logBehavior("plan_viewed", { provider: providerUsed });
  }, [state, providerUsed]);

  return { state, blocks, providerUsed, error, generate };
}
