// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Distribution Store
// Manages distributions with period filtering,
// notes, and audit trail
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { distributions as seedDistributions } from '../data/seedData';
import { updateDistributionField, appendAuditLog } from '../services/sheetsService';

const useDistributionStore = create(
  persist(
    (set, get) => ({
      // State
      distributions: seedDistributions,
      newInvestorFlags: [], // Track newly-added investors flagged for distribution review
      sheetsLoaded: false,

      // ── Google Sheets Sync ──────────────────────────────────────────────────
      loadFromSheets: (sheetDistributions) => {
        set({ distributions: sheetDistributions, sheetsLoaded: true });
      },

      // ── Getters ─────────────────────────────────────────────────────────────
      getAll: () => get().distributions,

      getById: (id) => get().distributions.find((d) => d.id === id) || null,

      getByInvestor: (invId) =>
        get().distributions.filter((d) => d.invId === invId),

      getByFund: (fund) => get().distributions.filter((d) => d.fund === fund),

      getByPeriod: (period) =>
        get().distributions.filter((d) => d.period === period),

      getPeriods: () => [
        ...new Set(get().distributions.map((d) => d.period)),
      ],

      getByStatus: (status) =>
        get().distributions.filter((d) => d.status === status),

      getTotalForPeriod: (period) =>
        get()
          .distributions.filter((d) => d.period === period)
          .reduce((sum, d) => sum + d.amt, 0),

      getNewInvestorFlags: () => get().newInvestorFlags,

      // ── Mutations ───────────────────────────────────────────────────────────
      addPayment: (payment) =>
        set((state) => {
          const newPayment = {
            ...payment,
            id: `D${String(state.distributions.length + 1).padStart(2, '0')}`,
            notes: payment.notes || '',
            auditLog: payment.auditLog || [{
              id: `DL-${Date.now()}`,
              action: 'Created',
              detail: 'Payment record created',
              user: 'j@vegarei.com',
              timestamp: new Date().toISOString(),
            }],
          };
          return { distributions: [...state.distributions, newPayment] };
        }),

      updatePayment: (id, updates, user = 'j@vegarei.com') =>
        set((state) => {
          // Write back changed fields to Google Sheet
          const fieldMap = { amt: 'amount', method: 'method', status: 'status', date: 'sent_date', notes: 'notes' };
          Object.entries(updates).forEach(([k, v]) => {
            const sheetField = fieldMap[k];
            if (sheetField) {
              updateDistributionField(id, sheetField, v).catch((err) =>
                console.error(`Distribution sheet write-back failed for ${k}:`, err)
              );
            }
          });

          return {
            distributions: state.distributions.map((d) => {
              if (d.id !== id) return d;
              const changes = Object.entries(updates)
                .filter(([k, v]) => d[k] !== v && k !== 'auditLog' && k !== 'notes')
                .map(([k, v]) => `${k}: ${d[k] || '(empty)'} → ${v}`)
                .join('; ');
              const logEntry = {
                id: `DL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                action: 'Updated',
                detail: changes || 'Notes updated',
                user,
                timestamp: new Date().toISOString(),
                notes: updates.notes !== undefined ? updates.notes : '',
              };
              return {
                ...d,
                ...updates,
                auditLog: [...(d.auditLog || []), logEntry],
              };
            }),
          };
        }),

      removePayment: (id) =>
        set((state) => ({
          distributions: state.distributions.filter((d) => d.id !== id),
        })),

      // ── New Investor Distribution Flags ─────────────────────────────────────
      flagNewInvestor: (invId, invName, fundName) =>
        set((state) => ({
          newInvestorFlags: [
            ...state.newInvestorFlags,
            {
              id: `NIF-${Date.now()}`,
              invId,
              invName,
              fundName,
              flaggedAt: new Date().toISOString(),
              status: 'Pending Review',
              notes: '',
            },
          ],
        })),

      resolveFlag: (flagId, decision, notes = '') =>
        set((state) => ({
          newInvestorFlags: state.newInvestorFlags.map((f) =>
            f.id === flagId
              ? { ...f, status: decision, notes, resolvedAt: new Date().toISOString() }
              : f,
          ),
        })),

      dismissFlag: (flagId) =>
        set((state) => ({
          newInvestorFlags: state.newInvestorFlags.filter((f) => f.id !== flagId),
        })),
    }),
    {
      name: 'vega-distribution-store',
      version: 3, // Bumped for real distribution data (Dec 2025, Jan 2026, Feb 2026)
    },
  ),
);

export default useDistributionStore;
