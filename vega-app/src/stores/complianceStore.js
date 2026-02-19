// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Compliance Store
// Manages compliance / subscription-doc items
// with full audit trail
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { complianceItems } from '../data/seedData';

const useComplianceStore = create(
  persist(
    (set, get) => ({
      // State
      items: complianceItems,
      auditLog: [], // Global audit log for all compliance actions

      // ── Getters ─────────────────────────────────────────────────────────────
      getAll: () => get().items,

      getById: (id) => get().items.find((i) => i.id === id) || null,

      getByInvestor: (invId) => get().items.filter((i) => i.invId === invId),

      getByFund: (fund) => get().items.filter((i) => i.fund === fund),

      getByStatus: (status) => get().items.filter((i) => i.status === status),

      getOpen: () => get().items.filter((i) => i.status === 'Open'),

      getResolved: () => get().items.filter((i) => i.status === 'Resolved'),

      getBlocking: () =>
        get().items.filter(
          (i) => i.priority === 'blocking' && i.status === 'Open',
        ),

      getAuditLog: (id) => {
        if (id) return get().auditLog.filter((e) => e.itemId === id);
        return get().auditLog;
      },

      getAuditLogByInvestor: (invId) =>
        get().auditLog.filter((e) => e.invId === invId),

      // ── Mutations ───────────────────────────────────────────────────────────
      resolve: (id, email, notes = '') =>
        set((state) => {
          const item = state.items.find((i) => i.id === id);
          const logEntry = {
            id: `CL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemId: id,
            invId: item?.invId || '',
            action: 'Resolved',
            detail: `Marked "${item?.doc}: ${item?.issue}" as resolved${notes ? ` — ${notes}` : ''}`,
            user: email,
            timestamp: new Date().toISOString(),
            notes,
          };
          return {
            items: state.items.map((i) =>
              i.id === id
                ? {
                    ...i,
                    status: 'Resolved',
                    resolvedBy: email,
                    resolvedDate: new Date().toISOString(),
                    notes: notes || i.notes,
                  }
                : i,
            ),
            auditLog: [...state.auditLog, logEntry],
          };
        }),

      reopen: (id, email = 'System', notes = '') =>
        set((state) => {
          const item = state.items.find((i) => i.id === id);
          const logEntry = {
            id: `CL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemId: id,
            invId: item?.invId || '',
            action: 'Reopened',
            detail: `Reopened "${item?.doc}: ${item?.issue}"${notes ? ` — ${notes}` : ''}`,
            user: email,
            timestamp: new Date().toISOString(),
            notes,
          };
          return {
            items: state.items.map((i) =>
              i.id === id
                ? { ...i, status: 'Open', resolvedBy: '', resolvedDate: '' }
                : i,
            ),
            auditLog: [...state.auditLog, logEntry],
          };
        }),

      bulkResolve: (invId, email, notes = '') =>
        set((state) => {
          const openItems = state.items.filter(
            (i) => i.invId === invId && i.status === 'Open',
          );
          const newLogs = openItems.map((item) => ({
            id: `CL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemId: item.id,
            invId,
            action: 'Resolved (Bulk)',
            detail: `Bulk resolved "${item.doc}: ${item.issue}"${notes ? ` — ${notes}` : ''}`,
            user: email,
            timestamp: new Date().toISOString(),
            notes,
          }));
          return {
            items: state.items.map((item) =>
              item.invId === invId && item.status === 'Open'
                ? {
                    ...item,
                    status: 'Resolved',
                    resolvedBy: email,
                    resolvedDate: new Date().toISOString(),
                  }
                : item,
            ),
            auditLog: [...state.auditLog, ...newLogs],
          };
        }),

      togglePriority: (id, email = 'System') =>
        set((state) => {
          const item = state.items.find((i) => i.id === id);
          const newPriority =
            item?.priority === 'blocking' ? 'standard' : 'blocking';
          const logEntry = {
            id: `CL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemId: id,
            invId: item?.invId || '',
            action: 'Priority Changed',
            detail: `Changed priority to ${newPriority}`,
            user: email,
            timestamp: new Date().toISOString(),
            notes: '',
          };
          return {
            items: state.items.map((i) =>
              i.id === id ? { ...i, priority: newPriority } : i,
            ),
            auditLog: [...state.auditLog, logEntry],
          };
        }),

      updateNotes: (id, notes, email = 'System') =>
        set((state) => {
          const item = state.items.find((i) => i.id === id);
          const logEntry = {
            id: `CL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            itemId: id,
            invId: item?.invId || '',
            action: 'Notes Updated',
            detail: notes,
            user: email,
            timestamp: new Date().toISOString(),
            notes,
          };
          return {
            items: state.items.map((i) =>
              i.id === id ? { ...i, notes } : i,
            ),
            auditLog: [...state.auditLog, logEntry],
          };
        }),
    }),
    {
      name: 'vega-compliance-store',
      version: 1,
    },
  ),
);

export default useComplianceStore;
