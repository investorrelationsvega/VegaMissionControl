// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Fund Store
// Manages fund data, documents, advisors,
// custodians, committed pipeline with audit trail
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { getCurrentUserEmail } from '../utils/currentUser';
import {
  funds as seedFunds,
  advisors as seedAdvisors,
  custodians as seedCustodians,
  fundDocuments,
} from '../data/seedData';

const useFundStore = create(
  persist(
    (set, get) => ({
  // State
  funds: seedFunds,
  advisors: seedAdvisors,
  custodians: seedCustodians,
  fundDocuments,
  commitmentAuditLog: [], // Tracks commitment status changes (committed → invested, close out)
  advisorAuditLog: [],    // Tracks advisor field changes
  custodianAuditLog: [],  // Tracks custodian field changes
  deletionLog: [],        // Tracks all deletions (advisors, custodians, investors) with who/when/what
  sheetsLoaded: false,

  // ── Google Sheets Sync ────────────────────────────────────────────────
  loadFromSheets: (sheetFunds, sheetAdvisors, sheetCustodians, positions) => {
    // Compute fund metrics from positions
    const fundMetrics = {};
    (positions || []).forEach((p) => {
      const key = p.fund;
      if (!fundMetrics[key]) fundMetrics[key] = { committed: 0, funded: 0, count: 0 };
      fundMetrics[key].committed += p.amt || 0;
      if (p.funded) fundMetrics[key].funded += p.amt || 0;
      fundMetrics[key].count += 1;
    });

    const enrichedFunds = sheetFunds.map((f) => {
      const metrics = fundMetrics[f.shortName] || {};
      return {
        ...f,
        committed: metrics.committed || f.committed || 0,
        funded: metrics.funded || f.funded || 0,
        positionCount: metrics.count || f.positionCount || 0,
      };
    });

    set({
      funds: enrichedFunds,
      advisors: sheetAdvisors.length > 0 ? sheetAdvisors : get().advisors,
      custodians: sheetCustodians.length > 0 ? sheetCustodians : get().custodians,
      sheetsLoaded: true,
    });
  },

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

  removeAdvisor: (id, user = getCurrentUserEmail()) =>
    set((state) => {
      const advisor = state.advisors.find((a) => a.id === id);
      if (!advisor) return state;
      return {
        advisors: state.advisors.filter((a) => a.id !== id),
        deletionLog: [...state.deletionLog, {
          id: `DEL-${Date.now()}`,
          type: 'Advisor',
          entityId: id,
          entityName: advisor.name,
          detail: `${advisor.name}${advisor.firm ? ` (${advisor.firm})` : ''}`,
          action: 'Deleted',
          user,
          timestamp: new Date().toISOString(),
        }],
      };
    }),

  restoreAdvisor: (advisor, user = getCurrentUserEmail()) =>
    set((state) => ({
      advisors: [...state.advisors, advisor],
      deletionLog: [...state.deletionLog, {
        id: `DEL-${Date.now()}-r`,
        type: 'Advisor',
        entityId: advisor.id,
        entityName: advisor.name,
        action: 'Restored',
        detail: `${advisor.name} restored via undo`,
        user,
        timestamp: new Date().toISOString(),
      }],
    })),

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

  removeCustodian: (id, user = getCurrentUserEmail()) =>
    set((state) => {
      const custodian = state.custodians.find((c) => c.id === id);
      if (!custodian) return state;
      return {
        custodians: state.custodians.filter((c) => c.id !== id),
        deletionLog: [...state.deletionLog, {
          id: `DEL-${Date.now()}`,
          type: 'Custodian',
          entityId: id,
          entityName: custodian.name,
          detail: custodian.name,
          action: 'Deleted',
          user,
          timestamp: new Date().toISOString(),
        }],
      };
    }),

  restoreCustodian: (custodian, user = getCurrentUserEmail()) =>
    set((state) => ({
      custodians: [...state.custodians, custodian],
      deletionLog: [...state.deletionLog, {
        id: `DEL-${Date.now()}-r`,
        type: 'Custodian',
        entityId: custodian.id,
        entityName: custodian.name,
        action: 'Restored',
        detail: `${custodian.name} restored via undo`,
        user,
        timestamp: new Date().toISOString(),
      }],
    })),

  // ── Deletion Log ────────────────────────────────────────────────────────
  getDeletionLog: () => get().deletionLog,

  logDeletion: (type, entityId, entityName, detail, user = getCurrentUserEmail()) =>
    set((state) => ({
      deletionLog: [...state.deletionLog, {
        id: `DEL-${Date.now()}`,
        type,
        entityId,
        entityName,
        detail,
        action: 'Deleted',
        user,
        timestamp: new Date().toISOString(),
      }],
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
      version: 4, // Bumped for deletion log
    },
  ),
);

export default useFundStore;
