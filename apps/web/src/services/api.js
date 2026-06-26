// services/api.js — wraps fetch with the auth token. All non-Supabase API
// calls (the /api/* Vercel functions) MUST go through here.
import { supabase } from "./supabase.js";

async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token;
}

export async function apiFetch(path, init = {}) {
  const token = await getToken();
  const headers = new Headers(init.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  return fetch(path, { ...init, headers });
}

export async function streamDailyPlan(onEvent, options = {}) {
  const { forceDeterministic = false, signal } = options;
  const res = await apiFetch("/api/plan/daily/generate", { 
    method: "POST", 
    signal,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force_deterministic: forceDeterministic })
  });
  if (res.status === 409) {
    onEvent({ event: "need_check_in", data: {} });
    return;
  }
  if (!res.ok || !res.body) {
    onEvent({ event: "error", data: { message: `HTTP ${res.status}` } });
    return;
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      const event = /^event:\s*(.+)$/m.exec(frame)?.[1]?.trim() ?? "message";
      const dataLine = /^data:\s*(.+)$/m.exec(frame)?.[1] ?? "{}";
      let data;
      try { data = JSON.parse(dataLine); } catch { data = {}; }
      onEvent({ event, data });
    }
  }
}
