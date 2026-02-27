// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — RingCentral Store
// Auth state, call log, SMS history
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useRingCentralStore = create(
  persist(
    (set, get) => ({
      // ── Auth State ────────────────────────────────────────────────────────
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      tokenExpiresAt: null,
      userName: null,
      userPhoneNumber: null, // User's RC phone for RingOut "from"
      isLoading: false,
      error: null,

      // ── Call Log ──────────────────────────────────────────────────────────
      callLog: [],
      callLogFetchedAt: null,

      // ── Active Call ───────────────────────────────────────────────────────
      activeCall: null, // { id, status, to, toName, from }

      // ── SMS History ───────────────────────────────────────────────────────
      // { [phoneNumber]: [{ id, text, direction, timestamp }] }
      smsHistory: {},

      // ── Auth Actions ──────────────────────────────────────────────────────
      setTokens: ({ access_token, refresh_token, expires_in, expires_at }) =>
        set({
          isAuthenticated: true,
          accessToken: access_token,
          refreshToken: refresh_token,
          tokenExpiresAt: expires_at || Date.now() + (expires_in || 3600) * 1000,
          isLoading: false,
          error: null,
        }),

      setUserInfo: ({ name, phoneNumber }) =>
        set({ userName: name, userPhoneNumber: phoneNumber }),

      clearAuth: () =>
        set({
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          tokenExpiresAt: null,
          userName: null,
          userPhoneNumber: null,
          error: null,
          callLog: [],
          callLogFetchedAt: null,
          activeCall: null,
        }),

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error, isLoading: false }),

      // ── Call Log Actions ──────────────────────────────────────────────────
      setCallLog: (entries) =>
        set({ callLog: entries, callLogFetchedAt: Date.now() }),

      getCallsForNumber: (phoneNumber) => {
        if (!phoneNumber) return [];
        const clean = phoneNumber.replace(/\D/g, '');
        return get().callLog.filter((call) => {
          const to = (call.to?.phoneNumber || '').replace(/\D/g, '');
          const from = (call.from?.phoneNumber || '').replace(/\D/g, '');
          return to.includes(clean) || clean.includes(to) ||
                 from.includes(clean) || clean.includes(from);
        });
      },

      // ── Active Call Actions ───────────────────────────────────────────────
      setActiveCall: (call) => set({ activeCall: call }),
      clearActiveCall: () => set({ activeCall: null }),

      // ── SMS Actions ──────────────────────────────────────────────────────
      addSmsToHistory: (phoneNumber, message) =>
        set((state) => {
          const existing = state.smsHistory[phoneNumber] || [];
          return {
            smsHistory: {
              ...state.smsHistory,
              [phoneNumber]: [...existing, message],
            },
          };
        }),

      getSmsForNumber: (phoneNumber) =>
        get().smsHistory[phoneNumber] || [],
    }),
    {
      name: 'vega-rc-store',
      // Persist auth state so user stays logged in across reloads/deploys
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        tokenExpiresAt: state.tokenExpiresAt,
      }),
    },
  ),
);

export default useRingCentralStore;
