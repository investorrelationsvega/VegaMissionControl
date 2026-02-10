// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — UI Store
// Toast messages, upcoming dates, notifications,
// global UI state
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import {
  attentionItems,
  upcomingDates,
  quickLinks,
} from '../data/seedData';

const useUiStore = create((set, get) => ({
  // State
  toast: { visible: false, message: '' },
  attentionItems,
  upcomingDates,
  quickLinks,
  sidebarOpen: true,

  // ── Notifications ─────────────────────────────────────────────────────────
  notifications: [
    {
      id: 'N01',
      type: 'assignment',
      title: 'Assigned: Feb Distribution',
      detail: 'You are primary on Feb Distribution prep',
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      read: false,
      link: '/',
    },
    {
      id: 'N02',
      type: 'urgent',
      title: 'GP Signature Required',
      detail: 'Cory Waddoups needs to sign Fund II LP Agreement',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      read: false,
      link: '/compliance',
    },
    {
      id: 'N03',
      type: 'tag',
      title: 'Tagged in note',
      detail: 'Jim Cook compliance — "Need Melanie to co-sign"',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
      read: false,
      link: '/directory',
    },
    {
      id: 'N04',
      type: 'assignment',
      title: 'Assigned: Schwab DTCC Report',
      detail: 'You are secondary on Q4 DTCC position/NAV report',
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      read: true,
      link: '/',
    },
  ],

  // ── Toast ───────────────────────────────────────────────────────────────
  showToast: (message) =>
    set({ toast: { visible: true, message } }),

  hideToast: () =>
    set({ toast: { visible: false, message: '' } }),

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

  getUnreadCount: () =>
    get().notifications.filter((n) => !n.read).length,

  // ── Sidebar ─────────────────────────────────────────────────────────────
  toggleSidebar: () =>
    set((state) => ({ sidebarOpen: !state.sidebarOpen })),
}));

export default useUiStore;
