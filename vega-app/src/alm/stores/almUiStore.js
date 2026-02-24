// ═══════════════════════════════════════════════
// ALM — UI Store (self-contained)
// Theme, toast, and UI state for the ALM module
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useAlmUiStore = create(
  persist(
    (set, get) => ({
      // Theme
      theme: 'dark',
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

      // Toast
      toastMsg: null,
      toastVisible: false,
      showToast: (msg) => {
        set({ toastMsg: msg, toastVisible: true });
        setTimeout(() => set({ toastVisible: false }), 2500);
      },
    }),
    {
      name: 'alm-ui-store',
      version: 1,
      partialize: (s) => ({ theme: s.theme }),
    }
  )
);

export default useAlmUiStore;
