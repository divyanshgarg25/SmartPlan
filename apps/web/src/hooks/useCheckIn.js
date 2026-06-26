// hooks/useCheckIn.js
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../services/supabase.js";

function todayISO() { return new Date().toISOString().slice(0, 10); }

export function useTodayCheckIn() {
  return useQuery({
    queryKey: ["check_in", todayISO()],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data } = await supabase
        .from("check_ins").select("*")
        .eq("user_id", user.id).eq("date", todayISO()).maybeSingle();
      return data;
    },
  });
}

export function useSaveCheckIn() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ top_priority, blocker }) => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.from("check_ins")
        .upsert({ user_id: user.id, date: todayISO(), top_priority, blocker },
                { onConflict: "user_id,date" })
        .select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["check_in"] }),
  });
}
