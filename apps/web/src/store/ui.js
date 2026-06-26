import { create } from "zustand";
import { loadTheme, applyTheme } from "../services/theme.js";

export const useUI = create((set) => ({
  bottomSheet: null, // 'task' | 'edit' | null
  openSheet: (kind) => set({ bottomSheet: kind }),
  closeSheet: () => set({ bottomSheet: null }),
  theme: loadTheme(),
  setTheme: (t) => {
    applyTheme(t);
    set({ theme: t });
  },
}));
