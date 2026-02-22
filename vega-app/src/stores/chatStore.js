// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Chat Store
// Panel state, spaces, messages, unread tracking
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useChatStore = create(
  persist(
    (set, get) => ({
      // ── Panel State (NOT persisted) ─────────────────────────────────────
      panelOpen: false,

      // ── Spaces (NOT persisted — fetched live) ──────────────────────────
      spaces: [],
      spacesLoading: false,
      spacesFetchedAt: null,

      // ── Selected Space (persisted) ─────────────────────────────────────
      selectedSpaceId: null,

      // ── Messages for Selected Space (NOT persisted) ────────────────────
      messages: [],
      messagesLoading: false,
      nextPageToken: null,

      // ── Compose State (NOT persisted) ──────────────────────────────────
      composeText: '',
      sending: false,

      // ── Directory / Team Contacts (NOT persisted — fetched live) ──────
      directoryPeople: [],         // [{ name, email, photoUrl }]
      directoryLoading: false,
      directoryFetchedAt: null,

      // ── Unread Tracking (persisted) ────────────────────────────────────
      // { [spaceId]: lastReadTimestamp (ms) }
      lastReadTimestamps: {},

      // ── Panel Actions ──────────────────────────────────────────────────
      togglePanel: () => set((s) => ({ panelOpen: !s.panelOpen })),
      openPanel: () => set({ panelOpen: true }),
      closePanel: () => set({ panelOpen: false }),

      // ── Space Actions ──────────────────────────────────────────────────
      setSpaces: (spaces) =>
        set({ spaces, spacesLoading: false, spacesFetchedAt: Date.now() }),
      setSpacesLoading: (loading) => set({ spacesLoading: loading }),

      // ── Directory Actions ────────────────────────────────────────────
      setDirectoryPeople: (people) =>
        set({ directoryPeople: people, directoryLoading: false, directoryFetchedAt: Date.now() }),
      setDirectoryLoading: (loading) => set({ directoryLoading: loading }),

      selectSpace: (spaceId) =>
        set({
          selectedSpaceId: spaceId,
          messages: [],
          nextPageToken: null,
          composeText: '',
        }),

      // ── Message Actions ────────────────────────────────────────────────
      setMessages: (messages, nextPageToken) =>
        set({ messages, nextPageToken, messagesLoading: false }),

      prependMessages: (olderMessages, nextPageToken) =>
        set((s) => ({
          messages: [...olderMessages, ...s.messages],
          nextPageToken,
          messagesLoading: false,
        })),

      appendMessage: (msg) =>
        set((s) => ({ messages: [...s.messages, msg] })),

      setMessagesLoading: (loading) => set({ messagesLoading: loading }),

      // ── Compose Actions ────────────────────────────────────────────────
      setComposeText: (text) => set({ composeText: text }),
      setSending: (sending) => set({ sending }),

      // ── Unread Tracking ────────────────────────────────────────────────
      markSpaceRead: (spaceId) =>
        set((s) => ({
          lastReadTimestamps: {
            ...s.lastReadTimestamps,
            [spaceId]: Date.now(),
          },
        })),

      getUnreadCount: () => {
        const { spaces, lastReadTimestamps } = get();
        return spaces.filter((space) => {
          const lastRead = lastReadTimestamps[space.id] || 0;
          const lastMsg = space.lastMessageTime
            ? new Date(space.lastMessageTime).getTime()
            : 0;
          return lastMsg > lastRead;
        }).length;
      },

      isSpaceUnread: (spaceId) => {
        const { spaces, lastReadTimestamps } = get();
        const space = spaces.find((s) => s.id === spaceId);
        if (!space) return false;
        const lastRead = lastReadTimestamps[spaceId] || 0;
        const lastMsg = space.lastMessageTime
          ? new Date(space.lastMessageTime).getTime()
          : 0;
        return lastMsg > lastRead;
      },

      // ── Reset ──────────────────────────────────────────────────────────
      reset: () =>
        set({
          panelOpen: false,
          spaces: [],
          spacesLoading: false,
          spacesFetchedAt: null,
          selectedSpaceId: null,
          messages: [],
          messagesLoading: false,
          nextPageToken: null,
          composeText: '',
          sending: false,
          directoryPeople: [],
          directoryLoading: false,
          directoryFetchedAt: null,
        }),
    }),
    {
      name: 'vega-chat-store',
      partialize: (state) => ({
        selectedSpaceId: state.selectedSpaceId,
        lastReadTimestamps: state.lastReadTimestamps,
      }),
    },
  ),
);

export default useChatStore;
