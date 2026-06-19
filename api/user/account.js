// api/user/account.js — DELETE: GDPR full account deletion.
import { createClient } from "@supabase/supabase-js";

async function authUser(req) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("Unauthorized");
  const admin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) throw new Error("Unauthorized");
  return { user: data.user, admin };
}

export default async function handler(req, res) {
  if (req.method !== "DELETE") return res.status(405).end("Method Not Allowed");
  try {
    const { user, admin } = await authUser(req);
    // All FK CASCADE from auth.users → profiles → child tables takes care of data.
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error) throw error;
    res.status(204).end();
  } catch (e) {
    res.status(401).end(e.message);
  }
}
