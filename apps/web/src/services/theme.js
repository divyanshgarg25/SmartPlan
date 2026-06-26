// services/theme.js — persist + apply theme attribute.
const KEY = "smartplan.theme";

export function loadTheme() {
  const v = localStorage.getItem(KEY);
  return v === "light" || v === "dark" ? v : "dark";
}

export function applyTheme(t) {
  if (document.startViewTransition) {
    document.startViewTransition(() => {
      document.documentElement.setAttribute("data-theme", t);
    });
  } else {
    document.documentElement.setAttribute("data-theme", t);
  }
  localStorage.setItem(KEY, t);
}
