import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase.js";

export function useWeekTemplates() {
  return useQuery({
    queryKey: ["week_templates"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("week_templates").select("*").eq("user_id", user.id);
      if (error) throw error;
      return data;
    },
  });
}

export function useSaveWeekTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, template }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("week_templates").insert({
        user_id: user.id, name, template,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["week_templates"] }),
  });
}

export function useApplyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (templateId) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: t } = await supabase.from("week_templates").select("template").eq("id", templateId).single();
      if (!t?.template) return;
      const updates = {};
      if (typeof t.template.daily_hour_cap === "number") updates.daily_hour_cap = t.template.daily_hour_cap;
      if (Object.keys(updates).length) {
        await supabase.from("profiles").update(updates).eq("id", user.id);
        await supabase.rpc("recalculate_job_times", { p_user_id: user.id });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}
