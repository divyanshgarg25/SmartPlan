// hooks/useWeekPlan.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase.js";
import { apiFetch } from "../services/api.js";

function mondayISO(d = new Date()) {
  const x = new Date(d); const day = x.getUTCDay();
  x.setUTCDate(x.getUTCDate() - ((day + 6) % 7));
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

export function useWeekPlan() {
  return useQuery({
    queryKey: ["week_plan", mondayISO()],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase.from("week_plans").select("*")
        .eq("user_id", user.id).eq("week_start", mondayISO()).maybeSingle();
      return data;
    },
  });
}

export function useGenerateWeek() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const r = await apiFetch("/api/plan/weekly/generate", { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["week_plan"] }),
  });
}

export function useRefineDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (date) => {
      const r = await apiFetch(`/api/plan/weekly/refine/${date}`, { method: "POST" });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.json();
    },
    onSuccess: (_d, date) => qc.invalidateQueries({ queryKey: ["day_plan", date] }),
  });
}
