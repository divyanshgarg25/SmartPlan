// firebase-messaging-sw.js — Service worker dedicated to FCM background
// messages. Placed in /public so it's served from the site root (required by
// the FCM SDK).
//
// Vite-PWA's generated SW handles caching; this one ONLY handles push.

/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.5/firebase-messaging-compat.js");

// Config is injected at build time via a query string, OR you can hard-code
// the public values here (they are not secrets).
firebase.initializeApp({
  apiKey: "__PLACEHOLDER_VITE_FIREBASE_API_KEY__",
  authDomain: "__PLACEHOLDER_VITE_FIREBASE_AUTH_DOMAIN__",
  projectId: "__PLACEHOLDER_VITE_FIREBASE_PROJECT_ID__",
  messagingSenderId: "__PLACEHOLDER_VITE_FIREBASE_MESSAGING_SENDER_ID__",
  appId: "__PLACEHOLDER_VITE_FIREBASE_APP_ID__",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const { title, body } = payload.notification ?? {};
  self.registration.showNotification(title ?? "SmartPlan", {
    body: body ?? "",
    icon: "/icon-192.png",
    badge: "/icon-192.png",
    data: payload.data ?? {},
  });
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const link = e.notification.data?.link ?? "/today";
  e.waitUntil(clients.openWindow(link));
});
