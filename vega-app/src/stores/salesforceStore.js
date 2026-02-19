// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Salesforce Store
// Auth state + cached activity data from SF API
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useSalesforceStore = create(
  persist(
    (set, get) => ({
      // ── Auth State ────────────────────────────────────────────────────────
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      instanceUrl: null,
      tokenExpiresAt: null,
      isLoading: false,
      error: null,

      // ── Cached SF Data ────────────────────────────────────────────────────
      tasks: [],        // Calls, emails, follow-ups from SF
      events: [],       // Meetings, webinars from SF
      opportunities: [], // Pipeline / conversion data from SF
      users: [],        // SF user records (Alex, Ken mappings)
      lastFetchedAt: null,

      // ── Auth Actions ──────────────────────────────────────────────────────
      setTokens: ({ access_token, refresh_token, instance_url, expires_at }) =>
        set({
          isAuthenticated: true,
          accessToken: access_token,
          refreshToken: refresh_token || get().refreshToken, // refresh_token not returned on refresh
          instanceUrl: instance_url,
          tokenExpiresAt: expires_at,
          isLoading: false,
          error: null,
        }),

      clearAuth: () =>
        set({
          isAuthenticated: false,
          accessToken: null,
          refreshToken: null,
          instanceUrl: null,
          tokenExpiresAt: null,
          error: null,
          tasks: [],
          events: [],
          opportunities: [],
          users: [],
          lastFetchedAt: null,
        }),

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error, isLoading: false }),

      // ── Data Actions ──────────────────────────────────────────────────────
      setTasks: (tasks) => set({ tasks }),
      setEvents: (events) => set({ events }),
      setOpportunities: (opportunities) => set({ opportunities }),
      setUsers: (users) => set({ users }),
      setLastFetchedAt: () => set({ lastFetchedAt: Date.now() }),

      // ── Getters ───────────────────────────────────────────────────────────
      getTasksByOwner: (ownerId) =>
        get().tasks.filter((t) => t.OwnerId === ownerId),

      getTasksByDateRange: (startDate, endDate) =>
        get().tasks.filter((t) => {
          const d = t.ActivityDate || t.CreatedDate?.split('T')[0];
          return d >= startDate && d <= endDate;
        }),

      getEventsByOwner: (ownerId) =>
        get().events.filter((e) => e.OwnerId === ownerId),

      getEventsByDateRange: (startDate, endDate) =>
        get().events.filter((e) => {
          const d = e.ActivityDate || e.StartDateTime?.split('T')[0];
          return d >= startDate && d <= endDate;
        }),

      getCallTasks: () =>
        get().tasks.filter((t) =>
          t.TaskSubtype === 'Call' || t.Type === 'Call' || t.Subject?.toLowerCase().includes('call')),

      getEmailTasks: () =>
        get().tasks.filter((t) =>
          t.TaskSubtype === 'Email' || t.Type === 'Email' || t.Subject?.toLowerCase().includes('email')),

      // Map SF user IDs to names
      getUserName: (userId) => {
        const user = get().users.find((u) => u.Id === userId);
        return user?.Name || user?.FirstName || userId;
      },
    }),
    {
      name: 'vega-salesforce-store',
      // Only persist auth tokens + instance URL (not cached data)
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        instanceUrl: state.instanceUrl,
      }),
    },
  ),
);

export default useSalesforceStore;
