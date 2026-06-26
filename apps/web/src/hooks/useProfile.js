import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase.js";

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (error) throw error;
      return data;
    },
  });
}

export function useProfileSchedule() {
  const { data: profile } = useProfile();
  const qc = useQueryClient();
  const updateSchedule = async (patch) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("profiles").update(patch).eq("id", user.id);
    // §9 hard rule: any schedule change triggers RPC.
    await supabase.rpc("recalculate_job_times", { p_user_id: user.id });
    qc.invalidateQueries({ queryKey: ["profile"] });
  };
  return { profile, updateSchedule };
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").update(patch).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}
