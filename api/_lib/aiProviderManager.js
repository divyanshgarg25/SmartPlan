// api/_lib/aiProviderManager.js
//
// §3.1 Tiered provider chain: Gemini → Groq → OpenRouter → DeterministicPlanner
// §3.1 Circuit breaker: 2 failures in 5 min → skip provider for 10 min.
//      Gemini at daily 1,000 req → skip until UTC midnight.
//      Groq at 480K tokens → skip until UTC midnight.
// §3.2 Server-side buffer the FULL response (no client streaming). The caller
//      validates with PlanValidator and then re-streams block-by-block.

const FAILURE_WINDOW_MS = 5 * 60_000;
const SKIP_MS = 10 * 60_000;

// In-process state. Edge instances are ephemeral; this is best-effort.
// (Cross-instance circuit state intentionally not persisted; the spec accepts
// this — daily caps are tracked separately by us when relevant.)
const state = {
  gemini:     { failures: [], skipUntil: 0, dailyOver: 0 },
  groq:       { failures: [], skipUntil: 0, dailyOver: 0 },
};

function midnightUtcMs() {
  const d = new Date();
  d.setUTCHours(24, 0, 0, 0);
  return d.getTime();
}

function recordFailure(name) {
  const s = state[name];
  const now = Date.now();
  s.failures = s.failures.filter((t) => now - t < FAILURE_WINDOW_MS);
  s.failures.push(now);
  if (s.failures.length >= 2) s.skipUntil = now + SKIP_MS;
}

function isOpen(name) {
  const s = state[name];
  return Date.now() < Math.max(s.skipUntil, s.dailyOver);
}

function markDailyExhausted(name) {
  state[name].dailyOver = midnightUtcMs();
}

// ----------------------------------------------------------------------------
// Multi-key rotation (§3.13). Each provider may have GEMINI_API_KEYS /
// GROQ_API_KEYS / OPENROUTER_API_KEYS as comma-separated lists. Per-process
// round-robin counter. Singular GEMINI_API_KEY still respected as fallback.
// ----------------------------------------------------------------------------
const rotationIdx = { gemini: 0, groq: 0 };

function keysFor(name) {
  const plural = process.env[`${name.toUpperCase()}_API_KEYS`];
  if (plural) return plural.split(",").map((k) => k.trim()).filter(Boolean);
  const single = process.env[`${name.toUpperCase()}_API_KEY`];
  return single ? [single] : [];
}

function nextKey(name) {
  const keys = keysFor(name);
  if (!keys.length) return null;
  const k = keys[rotationIdx[name] % keys.length];
  rotationIdx[name]++;
  return k;
}

// ----------------------------------------------------------------------------
// Provider call functions — each returns the FULL string response (buffered).
// Throws on error / non-2xx so the caller can rotate.
// ----------------------------------------------------------------------------

async function callGemini({ system, user }) {
  const key = nextKey("gemini");
  if (!key) throw new Error("GEMINI_API_KEY missing");
  // §3.1 model id
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite-preview:generateContent?key=${key}`;
  const body = {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) { markDailyExhausted("gemini"); throw new Error("Gemini daily limit"); }
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = await res.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini empty response");
  return text;
}

async function callGroq({ system, user }) {
  const key = nextKey("groq");
  if (!key) throw new Error("GROQ_API_KEY missing");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "llama-3.1-8b-instant",
      response_format: { type: "json_object" },
      temperature: 0.7,
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
  });
  if (res.status === 429) { markDailyExhausted("groq"); throw new Error("Groq daily limit"); }
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const json = await res.json();
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("Groq empty response");
  return text;
}



const CHAIN = [
  { name: "gemini",     call: callGemini },
  { name: "groq",       call: callGroq },
];

/**
 * Calls providers in order, buffering the full response. Returns
 * { providerUsed, text } or { providerUsed: null } when all open/failed.
 */
export async function generateBuffered(prompt) {
  for (const provider of CHAIN) {
    if (isOpen(provider.name)) continue;
    try {
      const text = await provider.call(prompt);
      return { providerUsed: provider.name, text };
    } catch (e) {
      console.warn(`[AI] ${provider.name} failed: ${e.message}`);
      recordFailure(provider.name);
    }
  }
  return { providerUsed: null, text: null };
}

export function getProviderHealth() {
  const now = Date.now();
  return Object.fromEntries(Object.entries(state).map(([k, v]) => [k, {
    failures5min: v.failures.filter((t) => now - t < FAILURE_WINDOW_MS).length,
    skipForMs: Math.max(0, v.skipUntil - now),
    dailyExhaustedForMs: Math.max(0, v.dailyOver - now),
  }]));
}
