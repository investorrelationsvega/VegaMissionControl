// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Fund Store
// Manages fund data, documents, advisors,
// custodians, committed pipeline with audit trail
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  funds,
  advisors,
  custodians,
  fundDocuments,
} from '../data/seedData';

const useFundStore = create(
  persist(
    (set, get) => ({
  // State
  funds,
  advisors,
  custodians,
  fundDocuments,
  commitmentAuditLog: [], // Tracks commitment status changes (committed → invested, close out)
  advisorAuditLog: [],    // Tracks advisor field changes
  custodianAuditLog: [],  // Tracks custodian field changes

  // ── Fund Getters ────────────────────────────────────────────────────────
  getAllFunds: () => get().funds,

  getFundById: (id) => get().funds.find((f) => f.id === id) || null,

  getFundByShortName: (shortName) =>
    get().funds.find((f) => f.shortName === shortName) || null,

  getActiveFunds: () =>
    get().funds.filter((f) => f.status === 'Open' || f.status === 'Closed'),

  // ── Document Getters ────────────────────────────────────────────────────
  getDocuments: (fundId) => get().fundDocuments[fundId] || {},

  getDocumentsByCategory: (fundId, category) =>
    (get().fundDocuments[fundId] || {})[category] || [],

  // ── Advisor Getters ─────────────────────────────────────────────────────
  getAllAdvisors: () => get().advisors,

  getAdvisorById: (id) => get().advisors.find((a) => a.id === id) || null,

  getAdvisorByName: (name) =>
    get().advisors.find((a) => a.name === name) || null,

  // ── Custodian Getters ───────────────────────────────────────────────────
  getAllCustodians: () => get().custodians,

  getCustodianById: (id) =>
    get().custodians.find((c) => c.id === id) || null,

  getCustodianByName: (name) =>
    get().custodians.find((c) => c.name === name) || null,

  // ── Commitment Audit Log ──────────────────────────────────────────────
  getCommitmentAuditLog: (fundId) => {
    if (fundId) return get().commitmentAuditLog.filter((e) => e.fundId === fundId);
    return get().commitmentAuditLog;
  },

  logCommitmentAction: (entry) =>
    set((state) => ({
      commitmentAuditLog: [
        ...state.commitmentAuditLog,
        {
          ...entry,
          id: `CA-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          timestamp: new Date().toISOString(),
        },
      ],
    })),

  // ── Advisor Mutations ──────────────────────────────────────────────────
  updateAdvisor: (id, updates, user = 'System') =>
    set((state) => {
      const advisor = state.advisors.find((a) => a.id === id);
      if (!advisor) return state;

      const now = new Date().toISOString();
      const LABELS = { name: 'Name', firm: 'Firm', phone: 'Phone', email: 'Email', territory: 'Territory', crd: 'CRD', status: 'Status' };
      const newEntries = [];

      Object.entries(updates).forEach(([field, newValue]) => {
        const oldValue = advisor[field] || '';
        if (oldValue !== newValue) {
          newEntries.push({
            id: `AAL-${Date.now()}-${field}`,
            entityId: id,
            entityName: advisor.name,
            field: LABELS[field] || field,
            oldValue: oldValue || '(empty)',
            newValue: newValue || '(empty)',
            user,
            timestamp: now,
          });
        }
      });

      return {
        advisors: state.advisors.map((a) =>
          a.id === id ? { ...a, ...updates } : a,
        ),
        advisorAuditLog: [...state.advisorAuditLog, ...newEntries],
      };
    }),

  getAdvisorAuditLog: (id) =>
    id
      ? get().advisorAuditLog.filter((e) => e.entityId === id)
      : get().advisorAuditLog,

  // ── Custodian Mutations ───────────────────────────────────────────────
  updateCustodian: (id, updates, user = 'System') =>
    set((state) => {
      const custodian = state.custodians.find((c) => c.id === id);
      if (!custodian) return state;

      const now = new Date().toISOString();
      const LABELS = { name: 'Name', address: 'Address', phone: 'Phone', email: 'Email', reportingFrequency: 'Reporting Frequency', nextReportingDate: 'Next Reporting Date' };
      const newEntries = [];

      Object.entries(updates).forEach(([field, newValue]) => {
        const oldValue = custodian[field] || '';
        if (oldValue !== newValue) {
          newEntries.push({
            id: `CAL-${Date.now()}-${field}`,
            entityId: id,
            entityName: custodian.name,
            field: LABELS[field] || field,
            oldValue: oldValue || '(empty)',
            newValue: newValue || '(empty)',
            user,
            timestamp: now,
          });
        }
      });

      return {
        custodians: state.custodians.map((c) =>
          c.id === id ? { ...c, ...updates } : c,
        ),
        custodianAuditLog: [...state.custodianAuditLog, ...newEntries],
      };
    }),

  getCustodianAuditLog: (id) =>
    id
      ? get().custodianAuditLog.filter((e) => e.entityId === id)
      : get().custodianAuditLog,

  // ── Fund Mutations ──────────────────────────────────────────────────────
  updateFund: (id, updates) =>
    set((state) => ({
      funds: state.funds.map((f) =>
        f.id === id ? { ...f, ...updates } : f,
      ),
    })),
    }),
    {
      name: 'vega-fund-store',
      version: 1,
    },
  ),
);

export default useFundStore;
