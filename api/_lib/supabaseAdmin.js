// api/_lib/supabaseAdmin.js
// Server-only Supabase client using the service-role key. NEVER import from
// frontend code. Lazy singleton so Edge Runtime cold-start cost is paid once.

import { createClient } from "@supabase/supabase-js";

let _client = null;

export function supabaseAdmin() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.");
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

/**
 * Validates a Supabase JWT from an Authorization: Bearer <token> header.
 * Returns { user } or throws.
 */
export async function authenticate(req) {
  const auth = req.headers.get("authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) throw Object.assign(new Error("Missing bearer token"), { status: 401 });
  const { data, error } = await supabaseAdmin().auth.getUser(token);
  if (error || !data?.user) throw Object.assign(new Error("Invalid token"), { status: 401 });
  return { user: data.user, token };
}
