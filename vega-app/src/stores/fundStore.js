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
