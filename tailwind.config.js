/** @type {import("tailwindcss").Config} */
// Theme tokens read from CSS variables (see apps/web/src/styles/index.css).
// Switching themes = toggling `data-theme="light"` on <html>. 200ms crossfade per §6.3.
export default {
  content: [
    "./apps/web/index.html",
    "./apps/web/src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          DEFAULT: "rgb(var(--bg) / <alpha-value>)",
          subtle:  "rgb(var(--bg-subtle) / <alpha-value>)",
          card:    "rgb(var(--bg-card) / <alpha-value>)"
        },
        ink: {
          DEFAULT: "rgb(var(--ink) / <alpha-value>)",
          muted:   "rgb(var(--ink-muted) / <alpha-value>)",
          subtle:  "rgb(var(--ink-subtle) / <alpha-value>)"
        },
        brand: {
          DEFAULT: "rgb(var(--brand) / <alpha-value>)",
          fg:      "rgb(var(--brand-fg) / <alpha-value>)",
          subtle:  "rgb(var(--brand-subtle) / <alpha-value>)"
        },
        accent: {
          DEFAULT: "rgb(var(--accent) / <alpha-value>)",
          fg:      "rgb(var(--accent-fg) / <alpha-value>)"
        },
        success: "rgb(var(--success) / <alpha-value>)",
        warning: "rgb(var(--warning) / <alpha-value>)",
        danger:  "rgb(var(--danger) / <alpha-value>)",
        border:  "rgb(var(--border) / <alpha-value>)"
      },
      fontFamily: {
        display: ["Outfit", "ui-sans-serif", "system-ui", "sans-serif"],
        sans:    ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
        mono:    ["JetBrains Mono", "ui-monospace", "SFMono-Regular", "monospace"]
      },
      borderRadius: { xl2: "1.25rem" },
      boxShadow: { card: "0 1px 2px rgba(0,0,0,.4), 0 8px 24px rgba(0,0,0,.25)" }
    }
  },
  plugins: []
};
