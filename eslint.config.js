import js from "@eslint/js";
import reactPlugin from "eslint-plugin-react";
import reactHooksPlugin from "eslint-plugin-react-hooks";

export default [
  { ignores: ["dist/**", ".vite/**", "node_modules/**"] },
  js.configs.recommended,
  {
    files: ["**/*.{js,jsx}"],
    plugins: {
      react: reactPlugin,
      "react-hooks": reactHooksPlugin,
    },
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        window: true,
        document: true,
        localStorage: true,
        sessionStorage: true,
        Intl: true,
        console: true,
        Promise: true,
        setTimeout: true,
        clearTimeout: true,
        setInterval: true,
        clearInterval: true,
        fetch: true,
        navigator: true,
        URL: true,
        Date: true,
        Math: true,
        __dirname: true,
        process: true,
        require: true,
        module: true,
        alert: true,
        location: true,
        Buffer: true,
        URLSearchParams: true,
        btoa: true,
        TextEncoder: true,
        ReadableStream: true,
        Response: true,
        Headers: true,
        TextDecoder: true,
        CustomEvent: true,
        Notification: true
      }
    },
    settings: { react: { version: "detect" } },
    rules: {
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react/prop-types": "off",
      "react/no-unescaped-entities": "off",
      "no-unused-vars": "off",
      "no-empty": "off"
    }
  },
  {
    files: ["apps/web/src/components/**/*.{js,jsx}"],
    rules: {
      "no-restricted-imports": ["error", {
        "paths": [
          { "name": "@supabase/supabase-js", "message": "Components must use hooks/services, never the Supabase SDK directly." }
        ],
        "patterns": [
          { "group": ["**/services/supabase*"], "message": "Components must consume hooks/services, not the supabase client directly." }
        ]
      }],
      "no-restricted-globals": ["error", { "name": "fetch", "message": "Components must use React Query + service-layer functions; no raw fetch in components." }]
    }
  },
  {
    files: ["apps/web/src/**/*.{js,jsx}"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          "name": "process",
          "message": "process.env is not available in the browser (Vite uses import.meta.env). Backend secrets like GEMINI_API_KEY must never be accessed in the frontend."
        }
      ]
    }
  }
];
