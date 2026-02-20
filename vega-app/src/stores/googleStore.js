// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Google Store
// Auth state + Drive folder mappings
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useGoogleStore = create(
  persist(
    (set, get) => ({
      // ── Auth State (NOT persisted) ────────────────────────────────────────
      isAuthenticated: false,
      accessToken: null,
      tokenExpiresAt: null,
      userEmail: null,
      isLoading: false,
      error: null,

      // ── Drive Folder Mappings (persisted) ─────────────────────────────────
      // { [fundId]: { _root: { folderId, folderName }, 'Marketing Materials': { folderId, folderName }, ... } }
      folderMappings: {},

      // ── File Cache (NOT persisted) ────────────────────────────────────────
      // { [folderId]: { files: [...], fetchedAt: timestamp } }
      fileCache: {},

      // ── Auth Actions ──────────────────────────────────────────────────────
      setToken: (tokenResponse) =>
        set({
          isAuthenticated: true,
          accessToken: tokenResponse.access_token,
          tokenExpiresAt: tokenResponse.expires_at,
          isLoading: false,
          error: null,
        }),

      setUserEmail: (email) => set({ userEmail: email }),

      clearAuth: () =>
        set({
          isAuthenticated: false,
          accessToken: null,
          tokenExpiresAt: null,
          userEmail: null,
          error: null,
          fileCache: {},
        }),

      setLoading: (loading) => set({ isLoading: loading }),
      setError: (error) => set({ error, isLoading: false }),

      // ── Folder Mapping Actions ────────────────────────────────────────────
      setFolderMapping: (fundId, category, mapping) =>
        set((state) => ({
          folderMappings: {
            ...state.folderMappings,
            [fundId]: {
              ...(state.folderMappings[fundId] || {}),
              [category]: mapping,
            },
          },
        })),

      removeFolderMapping: (fundId, category) =>
        set((state) => {
          const fundMappings = { ...(state.folderMappings[fundId] || {}) };
          delete fundMappings[category];
          return {
            folderMappings: {
              ...state.folderMappings,
              [fundId]: fundMappings,
            },
          };
        }),

      getFolderMapping: (fundId, category) =>
        (get().folderMappings[fundId] || {})[category] || null,

      getAllMappingsForFund: (fundId) =>
        get().folderMappings[fundId] || {},

      // ── File Cache Actions ────────────────────────────────────────────────
      setCachedFiles: (folderId, files) =>
        set((state) => ({
          fileCache: {
            ...state.fileCache,
            [folderId]: { files, fetchedAt: Date.now() },
          },
        })),

      getCachedFiles: (folderId) => {
        const cache = get().fileCache[folderId];
        if (!cache) return null;
        // 5-minute cache TTL
        if (Date.now() - cache.fetchedAt > 5 * 60 * 1000) return null;
        return cache.files;
      },

      clearFileCache: () => set({ fileCache: {} }),
    }),
    {
      name: 'vega-google-store',
      // Persist folder mappings + verified email for auth gate
      partialize: (state) => ({
        folderMappings: state.folderMappings,
        userEmail: state.userEmail,
      }),
    },
  ),
);

export default useGoogleStore;
