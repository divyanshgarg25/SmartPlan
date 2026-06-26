// services/behaviorLog.js — §3.9 consent-gated. NEVER writes when
// profile.ai_data_consent === false.
import { supabase } from "./supabase.js";

let _consent = null;
async function getConsent() {
  if (_consent !== null) return _consent;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase.from("profiles").select("ai_data_consent").eq("id", user.id).single();
  _consent = !!data?.ai_data_consent;
  return _consent;
}

export function invalidateConsentCache() { _consent = null; }

export async function logBehavior(eventType, payload = {}) {
  const consent = await getConsent();
  if (!consent) return; // §9 hard rule
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("behavior_logs").insert({
    user_id: user.id, event_type: eventType, payload,
  });
}
