// api/_lib/fcmDispatch.js — server-side FCM HTTP v1 dispatch (no Firebase Admin
// SDK to keep cold-starts fast). Uses the OAuth2 service-account JWT flow.
//
// ENV:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY        (PEM, \n escaped)
//
// Supported notification kinds (§4.10):
//   block_starting, deadline_warning, plan_ready, weekly_plan,
//   weekly_review, overload_warning, late_night_guard

import crypto from "node:crypto";

let cachedToken = null;

async function getAccessToken() {
  if (cachedToken && cachedToken.exp > Date.now() / 1000 + 60) return cachedToken.token;
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: process.env.FIREBASE_CLIENT_EMAIL,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now, exp: now + 3600,
  };
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${enc(header)}.${enc(claim)}`;
  const key = (process.env.FIREBASE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  const signer = crypto.createSign("RSA-SHA256"); signer.update(unsigned); signer.end();
  const sig = signer.sign(key).toString("base64url");
  const jwt = `${unsigned}.${sig}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!r.ok) throw new Error(`FCM oauth ${r.status}`);
  const j = await r.json();
  cachedToken = { token: j.access_token, exp: now + j.expires_in };
  return j.access_token;
}

export async function sendPush(token, { title, body, data = {} }) {
  if (!token) return { skipped: true };
  const access = await getAccessToken();
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const r = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      message: {
        token,
        notification: { title, body },
        data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
        webpush: { fcmOptions: { link: data.link ?? "/today" } },
      },
    }),
  });
  if (!r.ok) return { error: r.status, body: await r.text() };
  return { ok: true };
}

export const NOTIFY = {
  block_starting:  (title) => ({ title: `Starting now: ${title}`, body: "Tap to enter focus mode." }),
  deadline_warning: (task, hrs) => ({ title: `${task} is due soon`, body: `~${hrs}h remaining and not started.` }),
  plan_ready:      () => ({ title: "Tomorrow's plan is ready", body: "Tap to review." }),
  weekly_plan:     () => ({ title: "Your week is planned", body: "Open Week view to customise." }),
  weekly_review:   () => ({ title: "Weekly review available", body: "Tap to read your wins and frictions." }),
  overload_warning: () => ({ title: "Heads up — heavy week ahead", body: "Consider deferring lower-priority work." }),
  late_night_guard: () => ({ title: "Wind-down time", body: "You'll thank yourself tomorrow." }),
};
