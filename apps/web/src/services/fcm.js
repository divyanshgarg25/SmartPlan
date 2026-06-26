// services/fcm.js — Firebase Cloud Messaging subscription (Phase 3).
// All keys provided at runtime via Vite env vars (placeholders in .env.example).
//
// On subscribePush(): asks for notification permission, retrieves the FCM
// token, and persists it on the user's profile (profiles.fcm_token).
//
// The actual push *dispatch* happens server-side (api/_lib/fcmDispatch.js
// uses the Firebase Admin SDK with a service account JSON).

import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { supabase } from "./supabase.js";

const cfg = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const VAPID = import.meta.env.VITE_FIREBASE_VAPID_KEY;

function appReady() {
  if (!cfg.apiKey) return null;
  if (!getApps().length) initializeApp(cfg);
  return getMessaging();
}

export async function subscribePush() {
  const m = appReady();
  if (!m) { alert("Push not configured"); return; }
  const perm = await Notification.requestPermission();
  if (perm !== "granted") { alert("Permission denied"); return; }
  try {
    const reg = await navigator.serviceWorker.ready;
    const token = await getToken(m, { vapidKey: VAPID, serviceWorkerRegistration: reg });
    if (!token) { alert("No FCM token"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("profiles").update({ fcm_token: token }).eq("id", user.id);
    onMessage(m, (payload) => {
      // foreground messages: show a toast (delegated elsewhere)
      window.dispatchEvent(new CustomEvent("smartplan:push", { detail: payload }));
    });
    alert("Push enabled");
  } catch (e) {
    console.error(e);
    alert("FCM registration failed");
  }
}
