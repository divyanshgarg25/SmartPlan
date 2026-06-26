// services/installPrompt.js — show A2HS prompt after 3 sessions (sessionStorage gated).
let deferredPrompt = null;

export function initInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const visits = Number(localStorage.getItem("smartplan.visits") ?? "0") + 1;
    localStorage.setItem("smartplan.visits", String(visits));
    if (visits >= 3 && !sessionStorage.getItem("smartplan.installShown")) {
      sessionStorage.setItem("smartplan.installShown", "1");
      window.dispatchEvent(new CustomEvent("smartplan:install-available"));
    }
  });
}

export async function triggerInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === "accepted";
}
