import { create } from "zustand";

let idCounter = 0;

export const useToastStore = create((set) => ({
  toasts: [],
  addToast: (message, type = "success", duration = 3000) => {
    const id = ++idCounter;
    set((state) => ({ toasts: [...state.toasts, { id, message, type }] }));
    
    if (duration > 0) {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, duration);
    }
  },
  removeToast: (id) => {
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
  }
}));

export const addToast = useToastStore.getState().addToast;
