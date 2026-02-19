// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Sales Store
// KPI tracking, materials, expenses, call notes,
// prospect pipeline for Fund II capital raise
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Constants ─────────────────────────────────────────────────────────────────

export const FUNNEL_STAGES = [
  'Cold Lead',
  'Contacted',
  'Engaged',
  'Qualified',
  'Agreement Sent',
  'Closed Won',
  'Closed Lost',
];

export const EXPENSE_CATEGORIES = ['travel', 'marketing', 'materials', 'event', 'other'];

export const MATERIAL_TYPES = [
  'Fund II Pitch Deck',
  'Tear Sheet',
  'Fund Report',
  'PPM',
  'Subscription Docs',
  'Other',
];

export const ACTIVITY_TYPES = ['call', 'meeting', 'webinar', 'email', 'other'];

export const OUTCOMES = ['Interested', 'Follow-up', 'Not Interested', 'No Answer', 'Left VM', 'Scheduled Meeting', 'Materials Requested'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function getPeriodKey(dateStr, periodType) {
  const d = new Date(dateStr);
  const year = d.getFullYear();
  if (periodType === 'monthly') {
    return `${year}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  }
  if (periodType === 'quarterly') {
    const q = Math.ceil((d.getMonth() + 1) / 3);
    return `${year}-Q${q}`;
  }
  // weekly — ISO week
  const jan1 = new Date(year, 0, 1);
  const days = Math.floor((d - jan1) / 86400000);
  const weekNum = Math.ceil((days + jan1.getDay() + 1) / 7);
  return `${year}-W${String(weekNum).padStart(2, '0')}`;
}

export function getCurrentPeriodKey(periodType) {
  return getPeriodKey(new Date().toISOString(), periodType);
}

// ── Store ─────────────────────────────────────────────────────────────────────

const useSalesStore = create(
  persist(
    (set, get) => ({
  // ═══════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════
  kpiEntries: [],
  shipments: [],
  expenses: [],
  callNotes: [],
  prospects: [],
  auditLog: [],

  // ═══════════════════════════════════════════════
  // KPI ENTRIES
  // ═══════════════════════════════════════════════

  addKpiEntry: (entry, user = 'System') =>
    set((state) => {
      const id = genId('KPI');
      const now = new Date().toISOString();
      const periodKey = getPeriodKey(entry.date, 'weekly');
      const monthKey = getPeriodKey(entry.date, 'monthly');
      const quarterKey = getPeriodKey(entry.date, 'quarterly');
      return {
        kpiEntries: [...state.kpiEntries, {
          outboundCallsLogged: 0, advisorConversations: 0, emailsSent: 0,
          materialsSent: 0, appointmentsSetForKen: 0, newFirmsVisited: 0,
          inPersonMeetingsTaken: 0, scheduledMeetings: 0,
          webinarsHosted: 0, webinarAttendees: 0, meetingsAdvancing: 0,
          materialsRequested: 0, factRightViewed: 0,
          factRightFollowUpHrs: null, postMeetingFollowUpHrs: null,
          subAgreementsSent: 0, subAgreementsCompleted: 0, capitalFunded: 0,
          notes: '', rep: 'Alex',
          ...entry,
          id, periodKey, monthKey, quarterKey,
          createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('SAL'), action: 'KPI Entry Added',
          detail: `${entry.rep || 'Alex'} — ${entry.date}`,
          user, timestamp: now,
        }],
      };
    }),

  updateKpiEntry: (id, updates, user = 'System') =>
    set((state) => ({
      kpiEntries: state.kpiEntries.map((e) =>
        e.id === id ? { ...e, ...updates } : e),
      auditLog: [...state.auditLog, {
        id: genId('SAL'), action: 'KPI Entry Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteKpiEntry: (id, user = 'System') =>
    set((state) => ({
      kpiEntries: state.kpiEntries.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('SAL'), action: 'KPI Entry Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  getKpiEntries: () => get().kpiEntries,

  getKpiByPeriod: (periodKey) =>
    get().kpiEntries.filter((e) =>
      e.periodKey === periodKey || e.monthKey === periodKey || e.quarterKey === periodKey),

  getKpiByDateRange: (startDate, endDate) =>
    get().kpiEntries.filter((e) => e.date >= startDate && e.date <= endDate),

  getKpiByRep: (rep) =>
    get().kpiEntries.filter((e) => e.rep === rep),

  getKpiSummary: (periodKey, repFilter) => {
    let entries = get().getKpiByPeriod(periodKey);
    if (repFilter && repFilter !== 'All') {
      entries = entries.filter((e) => e.rep === repFilter);
    }
    if (entries.length === 0) return null;

    const sum = (field) => entries.reduce((acc, e) => acc + (e[field] || 0), 0);
    const avg = (field) => {
      const vals = entries.map((e) => e[field]).filter((v) => v !== null && v !== undefined);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
    };

    const totalCalls = sum('outboundCallsLogged');
    const totalConversations = sum('advisorConversations');
    const totalScheduled = sum('scheduledMeetings');
    const totalMeetings = sum('inPersonMeetingsTaken');
    const totalCompleted = sum('subAgreementsCompleted');
    const totalCapital = sum('capitalFunded');

    return {
      outboundCallsLogged: totalCalls,
      advisorConversations: totalConversations,
      callEffectivenessRate: totalCalls > 0 ? (totalConversations / totalCalls * 100) : 0,
      emailsSent: sum('emailsSent'),
      materialsSent: sum('materialsSent'),
      appointmentsSetForKen: sum('appointmentsSetForKen'),
      newFirmsVisited: sum('newFirmsVisited'),
      inPersonMeetingsTaken: totalMeetings,
      advisorShowRate: totalScheduled > 0 ? (totalMeetings / totalScheduled * 100) : 0,
      webinarsHosted: sum('webinarsHosted'),
      webinarAttendees: sum('webinarAttendees'),
      meetingsAdvancing: sum('meetingsAdvancing'),
      materialsRequested: sum('materialsRequested'),
      factRightViewed: sum('factRightViewed'),
      factRightFollowUpHrs: avg('factRightFollowUpHrs'),
      postMeetingFollowUpHrs: avg('postMeetingFollowUpHrs'),
      subAgreementsSent: sum('subAgreementsSent'),
      subAgreementsCompleted: totalCompleted,
      capitalFunded: totalCapital,
      averageCommitmentSize: totalCompleted > 0 ? totalCapital / totalCompleted : 0,
      entryCount: entries.length,
    };
  },

  // ═══════════════════════════════════════════════
  // SHIPMENTS
  // ═══════════════════════════════════════════════

  addShipment: (shipment, user = 'System') =>
    set((state) => {
      const id = genId('SHP');
      const now = new Date().toISOString();
      return {
        shipments: [...state.shipments, {
          quantity: 1, carrier: '', trackingNumber: '',
          cost: 0, notes: '', sentBy: 'J',
          ...shipment, id, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('SAL'), action: 'Shipment Added',
          detail: `${shipment.materialType} to ${shipment.recipient}`,
          user, timestamp: now,
        }],
      };
    }),

  updateShipment: (id, updates, user = 'System') =>
    set((state) => ({
      shipments: state.shipments.map((s) =>
        s.id === id ? { ...s, ...updates } : s),
      auditLog: [...state.auditLog, {
        id: genId('SAL'), action: 'Shipment Updated',
        detail: `Shipment ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteShipment: (id, user = 'System') =>
    set((state) => ({
      shipments: state.shipments.filter((s) => s.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('SAL'), action: 'Shipment Deleted',
        detail: `Shipment ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  getShipments: () => get().shipments,

  getShipmentsByDateRange: (startDate, endDate) =>
    get().shipments.filter((s) => s.date >= startDate && s.date <= endDate),

  getTotalShipmentCost: (startDate, endDate) => {
    let filtered = get().shipments;
    if (startDate && endDate) {
      filtered = filtered.filter((s) => s.date >= startDate && s.date <= endDate);
    }
    return filtered.reduce((sum, s) => sum + (s.cost || 0), 0);
  },

  // ═══════════════════════════════════════════════
  // EXPENSES
  // ═══════════════════════════════════════════════

  addExpense: (expense, user = 'System') =>
    set((state) => {
      const id = genId('EXP');
      const now = new Date().toISOString();
      return {
        expenses: [...state.expenses, {
          category: 'other', amount: 0, notes: '',
          ...expense, id, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('SAL'), action: 'Expense Added',
          detail: `${expense.category}: $${expense.amount} — ${expense.description}`,
          user, timestamp: now,
        }],
      };
    }),

  updateExpense: (id, updates, user = 'System') =>
    set((state) => ({
      expenses: state.expenses.map((e) =>
        e.id === id ? { ...e, ...updates } : e),
      auditLog: [...state.auditLog, {
        id: genId('SAL'), action: 'Expense Updated',
        detail: `Expense ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteExpense: (id, user = 'System') =>
    set((state) => ({
      expenses: state.expenses.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('SAL'), action: 'Expense Deleted',
        detail: `Expense ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  getExpenses: () => get().expenses,

  getExpensesByDateRange: (startDate, endDate) =>
    get().expenses.filter((e) => e.date >= startDate && e.date <= endDate),

  getExpensesByCategory: (category) =>
    get().expenses.filter((e) => e.category === category),

  getTotalExpenses: (startDate, endDate, category) => {
    let filtered = get().expenses;
    if (startDate && endDate) {
      filtered = filtered.filter((e) => e.date >= startDate && e.date <= endDate);
    }
    if (category) filtered = filtered.filter((e) => e.category === category);
    return filtered.reduce((sum, e) => sum + (e.amount || 0), 0);
  },

  // ═══════════════════════════════════════════════
  // CALL NOTES / ACTIVITY
  // ═══════════════════════════════════════════════

  addCallNote: (note, user = 'System') =>
    set((state) => {
      const id = genId('CN');
      const now = new Date().toISOString();
      return {
        callNotes: [...state.callNotes, {
          type: 'call', duration: null, outcome: '',
          nextStep: '', notes: '',
          ...note, id, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('SAL'), action: 'Activity Added',
          detail: `${note.type || 'call'} with ${note.contactName}`,
          user, timestamp: now,
        }],
      };
    }),

  updateCallNote: (id, updates, user = 'System') =>
    set((state) => ({
      callNotes: state.callNotes.map((n) =>
        n.id === id ? { ...n, ...updates } : n),
      auditLog: [...state.auditLog, {
        id: genId('SAL'), action: 'Activity Updated',
        detail: `Note ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteCallNote: (id, user = 'System') =>
    set((state) => ({
      callNotes: state.callNotes.filter((n) => n.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('SAL'), action: 'Activity Deleted',
        detail: `Note ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  getCallNotes: () => get().callNotes,

  getCallNotesByDateRange: (startDate, endDate) =>
    get().callNotes.filter((n) => n.date >= startDate && n.date <= endDate),

  getCallNotesByRep: (rep) =>
    get().callNotes.filter((n) => n.rep === rep),

  // ═══════════════════════════════════════════════
  // PROSPECTS / PIPELINE
  // ═══════════════════════════════════════════════

  addProspect: (prospect, user = 'System') =>
    set((state) => {
      const id = genId('PROS');
      const now = new Date().toISOString();
      const stage = prospect.funnelStage || 'Cold Lead';
      return {
        prospects: [...state.prospects, {
          funnelStage: stage, source: '', notes: '',
          totalTouchpoints: 0,
          stageHistory: [{ stage, enteredAt: now, exitedAt: null }],
          ...prospect, id,
          enteredStageAt: now, enteredPipelineAt: now,
          createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('SAL'), action: 'Prospect Added',
          detail: `${prospect.name} (${prospect.firm || 'N/A'}) — ${stage}`,
          user, timestamp: now,
        }],
      };
    }),

  advanceProspectStage: (id, newStage, user = 'System') =>
    set((state) => {
      const now = new Date().toISOString();
      const prospect = state.prospects.find((p) => p.id === id);
      const oldStage = prospect?.funnelStage || '';
      return {
        prospects: state.prospects.map((p) => {
          if (p.id !== id) return p;
          const updatedHistory = p.stageHistory.map((h) =>
            h.exitedAt === null ? { ...h, exitedAt: now } : h);
          updatedHistory.push({ stage: newStage, enteredAt: now, exitedAt: null });
          return {
            ...p, funnelStage: newStage,
            enteredStageAt: now, stageHistory: updatedHistory,
          };
        }),
        auditLog: [...state.auditLog, {
          id: genId('SAL'), action: 'Prospect Stage Changed',
          detail: `${prospect?.name}: ${oldStage} → ${newStage}`,
          user, timestamp: now,
        }],
      };
    }),

  updateProspect: (id, updates, user = 'System') =>
    set((state) => ({
      prospects: state.prospects.map((p) =>
        p.id === id ? { ...p, ...updates } : p),
      auditLog: [...state.auditLog, {
        id: genId('SAL'), action: 'Prospect Updated',
        detail: `Prospect ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  incrementTouchpoints: (id) =>
    set((state) => ({
      prospects: state.prospects.map((p) =>
        p.id === id ? { ...p, totalTouchpoints: p.totalTouchpoints + 1 } : p),
    })),

  getProspects: () => get().prospects,

  getProspectsByStage: (stage) =>
    get().prospects.filter((p) => p.funnelStage === stage),

  getProspectsByRep: (rep) =>
    get().prospects.filter((p) => p.assignedTo === rep),

  // ═══════════════════════════════════════════════
  // PIPELINE HEALTH (computed)
  // ═══════════════════════════════════════════════

  getPipelineHealth: () => {
    const prospects = get().prospects;
    const now = new Date();

    const prospectsByStage = {};
    FUNNEL_STAGES.forEach((stage) => {
      prospectsByStage[stage] = prospects.filter((p) => p.funnelStage === stage).length;
    });

    const avgDaysInStage = {};
    FUNNEL_STAGES.forEach((stage) => {
      const inStage = prospects.filter((p) => p.funnelStage === stage);
      if (inStage.length === 0) { avgDaysInStage[stage] = 0; return; }
      const totalDays = inStage.reduce((sum, p) =>
        sum + (now - new Date(p.enteredStageAt)) / (1000 * 60 * 60 * 24), 0);
      avgDaysInStage[stage] = Math.round(totalDays / inStage.length);
    });

    const stageConversions = {};
    for (let i = 0; i < FUNNEL_STAGES.length - 1; i++) {
      const from = FUNNEL_STAGES[i];
      const to = FUNNEL_STAGES[i + 1];
      const enteredFrom = prospects.filter((p) =>
        p.stageHistory.some((h) => h.stage === from)).length;
      const reachedTo = prospects.filter((p) =>
        p.stageHistory.some((h) => h.stage === to)).length;
      stageConversions[`${from} → ${to}`] = enteredFrom > 0
        ? Math.round(reachedTo / enteredFrom * 100) : 0;
    }

    const closedWon = prospects.filter((p) => p.funnelStage === 'Closed Won');
    const avgTouchpointsToClose = closedWon.length > 0
      ? Math.round(closedWon.reduce((s, p) => s + p.totalTouchpoints, 0) / closedWon.length)
      : 0;

    return {
      prospectsByStage,
      avgDaysInStage,
      stageConversions,
      totalProspects: prospects.length,
      activeProspects: prospects.filter((p) => p.funnelStage !== 'Closed Won' && p.funnelStage !== 'Closed Lost').length,
      avgTouchpointsToClose,
    };
  },

  // ═══════════════════════════════════════════════
  // AUDIT LOG
  // ═══════════════════════════════════════════════

  getAuditLog: () => get().auditLog,
    }),
    {
      name: 'vega-sales-store',
      version: 1,
    },
  ),
);

export default useSalesStore;
