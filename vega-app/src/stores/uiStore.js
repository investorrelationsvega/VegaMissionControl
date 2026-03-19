// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — UI Store
// Toast messages, upcoming dates, notifications,
// global UI state
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  attentionItems,
  upcomingDates,
  quickLinks,
} from '../data/seedData';
import useGoogleStore from './googleStore';

/** Helper: get the currently authenticated user's email */
const getCurrentUserEmail = () =>
  useGoogleStore.getState().userEmail || 'unknown';

const useUiStore = create(
  persist(
    (set, get) => ({
  // State
  toast: { visible: false, message: '' },
  attentionItems,
  upcomingDates,
  quickLinks,
  sidebarOpen: true,

  // ── Theme ──────────────────────────────────────────────────────────────────
  theme: 'dark', // 'dark' | 'light'
  setTheme: (theme) => set({ theme }),
  toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: [
    // ── j@vegarei.com notifications ──
    {
      id: 'N01',
      type: 'assignment',
      title: 'Assigned: Feb Distribution',
      detail: 'You are primary on Feb Distribution prep',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      read: false,
      link: '/pe',
      unit: 'pe',
      assignee: 'j@vegarei.com',
    },
    {
      id: 'N02',
      type: 'urgent',
      title: 'GP Signature Required',
      detail: 'Cory Waddoups needs to sign Fund II LP Agreement',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      read: false,
      link: '/pe/compliance',
      unit: 'pe',
      assignee: 'j@vegarei.com',
    },
    {
      id: 'N03',
      type: 'tag',
      title: 'Tagged in note',
      detail: 'Jim Cook compliance — "Need Melanie to co-sign"',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      read: false,
      link: '/pe/directory',
      unit: 'pe',
      assignee: 'j@vegarei.com',
    },
    {
      id: 'N04',
      type: 'assignment',
      title: 'Assigned: Schwab DTCC Report',
      detail: 'You are secondary on Q4 DTCC position/NAV report',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      read: true,
      link: '/pe',
      unit: 'pe',
      assignee: 'j@vegarei.com',
    },
    // ── dan@vegarei.com notifications ──
    {
      id: 'N05',
      type: 'assignment',
      title: 'Assigned: Q1 Capital Call',
      detail: 'You are primary on Q1 capital call processing',
      timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
      read: false,
      link: '/pe',
      unit: 'pe',
      assignee: 'dan@vegarei.com',
    },
    {
      id: 'N06',
      type: 'tag',
      title: 'Tagged in compliance review',
      detail: 'J. Jones — "Dan, please review Fund III docs"',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3).toISOString(),
      read: false,
      link: '/pe/compliance',
      unit: 'pe',
      assignee: 'dan@vegarei.com',
    },
  ],

  // ── Toast ───────────────────────────────────────────────────────────────
  showToast: (message, options = {}) =>
    set({ toast: { visible: true, message, onUndo: options.onUndo || null } }),

  hideToast: () =>
    set({ toast: { visible: false, message: '', onUndo: null } }),

  // ── Upcoming Dates ──────────────────────────────────────────────────────
  updateUpcoming: (dates) =>
    set({ upcomingDates: dates }),

  addUpcomingDate: (dateItem) =>
    set((state) => ({
      upcomingDates: [
        ...state.upcomingDates,
        { ...dateItem, id: `U${String(state.upcomingDates.length + 1).padStart(2, '0')}` },
      ],
    })),

  removeUpcomingDate: (id) =>
    set((state) => ({
      upcomingDates: state.upcomingDates.filter((d) => d.id !== id),
    })),

  // ── Upcoming Item Mutations + Audit Log ────────────────────────────────
  upcomingAuditLog: [],

  updateUpcomingItem: (id, changes) =>
    set((state) => {
      const prev = state.upcomingDates.find((d) => d.id === id);
      const updated = state.upcomingDates.map((d) =>
        d.id === id ? { ...d, ...changes } : d
      );
      const entries = [];
      Object.keys(changes).forEach((key) => {
        if (prev && prev[key] !== changes[key] && key !== 'notes' && key !== 'documents') {
          entries.push({
            id: `UA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemId: id,
            action: 'edit',
            detail: `Changed ${key}: "${prev[key] || '(empty)'}" → "${changes[key]}"`,
            user: getCurrentUserEmail(),
            timestamp: new Date().toISOString(),
          });
        }
      });
      return {
        upcomingDates: updated,
        upcomingAuditLog: [...entries, ...state.upcomingAuditLog],
      };
    }),

  addUpcomingNote: (itemId, text) =>
    set((state) => {
      const note = {
        id: `UN-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        text,
        user: getCurrentUserEmail(),
        timestamp: new Date().toISOString(),
      };
      const auditEntry = {
        id: `UA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId,
        action: 'note',
        detail: `Added note: "${text.slice(0, 60)}${text.length > 60 ? '...' : ''}"`,
        user: getCurrentUserEmail(),
        timestamp: new Date().toISOString(),
      };
      return {
        upcomingDates: state.upcomingDates.map((d) =>
          d.id === itemId ? { ...d, notes: [...(d.notes || []), note] } : d
        ),
        upcomingAuditLog: [auditEntry, ...state.upcomingAuditLog],
      };
    }),

  addUpcomingDocument: (itemId, docMeta) =>
    set((state) => {
      const doc = {
        ...docMeta,
        id: `UD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        uploadedBy: getCurrentUserEmail(),
        uploadedAt: new Date().toISOString(),
      };
      const auditEntry = {
        id: `UA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId,
        action: 'upload',
        detail: `Uploaded document: "${docMeta.name}"`,
        user: getCurrentUserEmail(),
        timestamp: new Date().toISOString(),
      };
      return {
        upcomingDates: state.upcomingDates.map((d) =>
          d.id === itemId ? { ...d, documents: [...(d.documents || []), doc] } : d
        ),
        upcomingAuditLog: [auditEntry, ...state.upcomingAuditLog],
      };
    }),

  removeUpcomingDocument: (itemId, docId) =>
    set((state) => {
      const existingDoc = state.upcomingDates
        .find((d) => d.id === itemId)?.documents?.find((d) => d.id === docId);
      const auditEntry = {
        id: `UA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        itemId,
        action: 'remove_doc',
        detail: `Removed document: "${existingDoc?.name || docId}"`,
        user: getCurrentUserEmail(),
        timestamp: new Date().toISOString(),
      };
      return {
        upcomingDates: state.upcomingDates.map((d) =>
          d.id === itemId
            ? { ...d, documents: (d.documents || []).filter((doc) => doc.id !== docId) }
            : d
        ),
        upcomingAuditLog: [auditEntry, ...state.upcomingAuditLog],
      };
    }),

  getAuditLogForItem: (itemId) =>
    get().upcomingAuditLog.filter((e) => e.itemId === itemId),

  // ── Calendar Sync ─────────────────────────────────────────────────────
  calendarEvents: [],
  calendarSyncStatus: 'idle', // 'idle' | 'syncing' | 'synced' | 'error'
  calendarLastSyncAt: null,

  setCalendarEvents: (events) =>
    set({
      calendarEvents: events,
      calendarSyncStatus: 'synced',
      calendarLastSyncAt: Date.now(),
    }),

  setCalendarSyncStatus: (status) =>
    set({ calendarSyncStatus: status }),

  clearCalendarEvents: () =>
    set({
      calendarEvents: [],
      calendarSyncStatus: 'idle',
      calendarLastSyncAt: null,
    }),

  getMergedUpcoming: () => {
    const { calendarEvents, calendarSyncStatus, upcomingDates } = get();
    if (calendarSyncStatus === 'synced' && calendarEvents.length > 0) {
      return calendarEvents;
    }
    return upcomingDates;
  },

  // ── Attention Items ─────────────────────────────────────────────────────
  getAttentionItems: () => get().attentionItems,

  dismissAttentionItem: (id) =>
    set((state) => ({
      attentionItems: state.attentionItems.filter((a) => a.id !== id),
    })),

  // ── Notification Actions ──────────────────────────────────────────────────
  addNotification: (notification) =>
    set((state) => ({
      notifications: [
        {
          unit: 'pe',
          assignee: getCurrentUserEmail(),
          ...notification,
          id: `N-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
          read: false,
        },
        ...state.notifications,
      ],
    })),

  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n,
      ),
    })),

  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
    })),

  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),

  getUnreadCount: (filter) => {
    let list = get().notifications;
    if (filter?.unit) list = list.filter((n) => n.unit === filter.unit);
    if (filter?.assignee) list = list.filter((n) => n.assignee === filter.assignee);
    return list.filter((n) => !n.read).length;
  },

  getNotificationsForUser: (email) =>
    get().notifications.filter((n) => n.assignee === email),

  getNotificationsForUnit: (unit) =>
    get().notifications.filter((n) => n.unit === unit),

  // ── Sidebar ─────────────────────────────────────────────────────────────
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
    }),
    {
      name: 'vega-ui-store',
      version: 3,
      partialize: (state) => ({
        attentionItems: state.attentionItems,
        upcomingDates: state.upcomingDates,
        upcomingAuditLog: state.upcomingAuditLog,
        quickLinks: state.quickLinks,
        notifications: state.notifications,
        sidebarOpen: state.sidebarOpen,
        theme: state.theme,
        // Excluded: toast (ephemeral), calendarEvents/calendarSyncStatus/calendarLastSyncAt (fetched live)
      }),
    },
  ),
);

export default useUiStore;
