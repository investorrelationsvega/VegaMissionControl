// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — KPI Store
// Manual entry KPI tracking across all sections:
// Directory, Distributions, Compliance, Sales Ops
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ── Constants ─────────────────────────────────────────────────────────────────

export const COMMUNICATION_TYPES = ['Quarterly Update', 'Annual Report'];
export const CUSTODIANS = ['Schwab', 'Inspira'];
export const OPINION_TYPES = ['Clean', 'Qualified', 'Adverse', 'Disclaimer'];
export const FILING_TYPES = ['Form D Amendment', 'Form D Annual', 'State Filing', 'Other'];
export const DTCC_REPORT_TYPES = ['NAV', 'Fund Data'];
export const MATERIAL_CREATE_TYPES = ['Newsletter', 'Tear Sheet', 'One-Pager', 'Pitch Deck', 'Fund Report', 'PPM', 'Other'];
export const RECIPIENT_TYPES = ['Advisor', 'Prospect', 'Existing LP', 'Other'];
export const REQUESTERS = ['Ken', 'Alex', 'J', 'Other'];
export const TEAM_MEMBERS = ['J', 'Cory', 'Ken', 'Alex'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function genId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function daysBetween(dateA, dateB) {
  if (!dateA || !dateB) return null;
  const a = new Date(dateA + 'T00:00:00');
  const b = new Date(dateB + 'T00:00:00');
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function hoursBetween(dateA, dateB) {
  if (!dateA || !dateB) return null;
  return Math.round((new Date(dateB) - new Date(dateA)) / (1000 * 60 * 60) * 10) / 10;
}

function inRange(dateStr, start, end) {
  if (!dateStr) return false;
  return dateStr >= start && dateStr <= end;
}

// ── Store ─────────────────────────────────────────────────────────────────────

const useKpiStore = create(
  persist(
    (set, get) => ({

  // ═══════════════════════════════════════════════
  // STATE — DIRECTORY KPIs
  // ═══════════════════════════════════════════════

  inquiryResponses: [],
  onboardingSegments: [],
  communicationDeliverables: [],

  // ═══════════════════════════════════════════════
  // STATE — DISTRIBUTION KPIs
  // ═══════════════════════════════════════════════

  distributionProcessing: [],
  custodianReporting: [],
  k1Deliveries: [],

  // ═══════════════════════════════════════════════
  // STATE — COMPLIANCE KPIs
  // ═══════════════════════════════════════════════

  subAgreementProcessing: [],
  blueSkyFilingKpi: [],
  formDAmendments: [],
  dtccReporting: [],
  auditDeliverables: [],
  auditOpinions: [],
  custodianReconciliation: [],

  // ═══════════════════════════════════════════════
  // STATE — SALES OPS KPIs
  // ═══════════════════════════════════════════════

  materialsSpend: [],
  marketingMaterials: [],
  materialsSent: [],
  kitsAssembled: [],
  adHocRequests: [],

  // ═══════════════════════════════════════════════
  // SHARED
  // ═══════════════════════════════════════════════

  auditLog: [],

  // ═══════════════════════════════════════════════
  // DIRECTORY — INQUIRY RESPONSES
  // ═══════════════════════════════════════════════

  addInquiryResponse: (entry, user = 'System') =>
    set((state) => {
      const id = genId('IRQ');
      const now = new Date().toISOString();
      const responseHours = hoursBetween(entry.dateReceived, entry.dateResponded);
      return {
        inquiryResponses: [...state.inquiryResponses, {
          ...entry, id, responseHours, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'directory', action: 'Inquiry Response Logged',
          detail: `${entry.investorName} — ${responseHours}h`, user, timestamp: now,
        }],
      };
    }),

  updateInquiryResponse: (id, updates, user = 'System') =>
    set((state) => ({
      inquiryResponses: state.inquiryResponses.map((e) =>
        e.id === id ? { ...e, ...updates,
          responseHours: hoursBetween(updates.dateReceived || e.dateReceived, updates.dateResponded || e.dateResponded),
        } : e),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'directory', action: 'Inquiry Response Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteInquiryResponse: (id, user = 'System') =>
    set((state) => ({
      inquiryResponses: state.inquiryResponses.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'directory', action: 'Inquiry Response Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // DIRECTORY — ONBOARDING SEGMENTS
  // ═══════════════════════════════════════════════

  addOnboardingSegment: (entry, user = 'System') =>
    set((state) => {
      const id = genId('ONB');
      const now = new Date().toISOString();
      return {
        onboardingSegments: [...state.onboardingSegments, {
          ...entry, id,
          daysToSend: daysBetween(entry.commitmentDate, entry.agreementSentDate),
          daysToExecute: daysBetween(entry.agreementSentDate, entry.executedDate),
          daysToFund: daysBetween(entry.executedDate, entry.fundedDate),
          daysTotal: daysBetween(entry.commitmentDate, entry.fundedDate),
          createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'directory', action: 'Onboarding Segment Logged',
          detail: `${entry.investorName} — ${daysBetween(entry.commitmentDate, entry.fundedDate) || '?'}d total`,
          user, timestamp: now,
        }],
      };
    }),

  updateOnboardingSegment: (id, updates, user = 'System') =>
    set((state) => ({
      onboardingSegments: state.onboardingSegments.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...updates };
        return {
          ...merged,
          daysToSend: daysBetween(merged.commitmentDate, merged.agreementSentDate),
          daysToExecute: daysBetween(merged.agreementSentDate, merged.executedDate),
          daysToFund: daysBetween(merged.executedDate, merged.fundedDate),
          daysTotal: daysBetween(merged.commitmentDate, merged.fundedDate),
        };
      }),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'directory', action: 'Onboarding Segment Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteOnboardingSegment: (id, user = 'System') =>
    set((state) => ({
      onboardingSegments: state.onboardingSegments.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'directory', action: 'Onboarding Segment Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // DIRECTORY — COMMUNICATION DELIVERABLES
  // ═══════════════════════════════════════════════

  addCommunicationDeliverable: (entry, user = 'System') =>
    set((state) => {
      const id = genId('CMD');
      const now = new Date().toISOString();
      const status = !entry.deliveredDate ? 'pending'
        : entry.deliveredDate <= entry.dueDate ? 'on_time' : 'late';
      return {
        communicationDeliverables: [...state.communicationDeliverables, {
          ...entry, id, status, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'directory', action: 'Communication Deliverable Logged',
          detail: `${entry.type} — ${entry.period} — ${status}`,
          user, timestamp: now,
        }],
      };
    }),

  updateCommunicationDeliverable: (id, updates, user = 'System') =>
    set((state) => ({
      communicationDeliverables: state.communicationDeliverables.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...updates };
        const status = !merged.deliveredDate ? 'pending'
          : merged.deliveredDate <= merged.dueDate ? 'on_time' : 'late';
        return { ...merged, status };
      }),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'directory', action: 'Communication Deliverable Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteCommunicationDeliverable: (id, user = 'System') =>
    set((state) => ({
      communicationDeliverables: state.communicationDeliverables.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'directory', action: 'Communication Deliverable Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // DISTRIBUTION — PROCESSING
  // ═══════════════════════════════════════════════

  addDistributionProcessing: (entry, user = 'System') =>
    set((state) => {
      const id = genId('DPR');
      const now = new Date().toISOString();
      const onTime = entry.processedDate <= entry.dueDate;
      return {
        distributionProcessing: [...state.distributionProcessing, {
          ...entry, id, onTime, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'distribution', action: 'Distribution Processing Logged',
          detail: `${entry.period} — ${onTime ? 'on time' : 'late'}${entry.accurate === false ? ', errors' : ''}`,
          user, timestamp: now,
        }],
      };
    }),

  updateDistributionProcessing: (id, updates, user = 'System') =>
    set((state) => ({
      distributionProcessing: state.distributionProcessing.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...updates };
        return { ...merged, onTime: merged.processedDate <= merged.dueDate };
      }),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'distribution', action: 'Distribution Processing Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteDistributionProcessing: (id, user = 'System') =>
    set((state) => ({
      distributionProcessing: state.distributionProcessing.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'distribution', action: 'Distribution Processing Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // DISTRIBUTION — CUSTODIAN REPORTING
  // ═══════════════════════════════════════════════

  addCustodianReporting: (entry, user = 'System') =>
    set((state) => {
      const id = genId('CRR');
      const now = new Date().toISOString();
      const status = !entry.reportedDate ? 'pending'
        : entry.reportedDate <= entry.dueDate ? 'on_time' : 'late';
      return {
        custodianReporting: [...state.custodianReporting, {
          ...entry, id, status, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'distribution', action: 'Custodian Reporting Logged',
          detail: `${entry.custodian} — ${entry.period} — ${status}`,
          user, timestamp: now,
        }],
      };
    }),

  updateCustodianReporting: (id, updates, user = 'System') =>
    set((state) => ({
      custodianReporting: state.custodianReporting.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...updates };
        const status = !merged.reportedDate ? 'pending'
          : merged.reportedDate <= merged.dueDate ? 'on_time' : 'late';
        return { ...merged, status };
      }),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'distribution', action: 'Custodian Reporting Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteCustodianReporting: (id, user = 'System') =>
    set((state) => ({
      custodianReporting: state.custodianReporting.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'distribution', action: 'Custodian Reporting Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // DISTRIBUTION — K-1 DELIVERIES
  // ═══════════════════════════════════════════════

  addK1Delivery: (entry, user = 'System') =>
    set((state) => {
      const id = genId('K1D');
      const now = new Date().toISOString();
      const status = !entry.deliveredDate ? 'pending'
        : entry.deliveredDate <= entry.dueDate ? 'on_time' : 'late';
      return {
        k1Deliveries: [...state.k1Deliveries, {
          ...entry, id, status, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'distribution', action: 'K-1 Delivery Logged',
          detail: `TY${entry.taxYear} — ${entry.investorName} — ${status}`,
          user, timestamp: now,
        }],
      };
    }),

  updateK1Delivery: (id, updates, user = 'System') =>
    set((state) => ({
      k1Deliveries: state.k1Deliveries.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...updates };
        const status = !merged.deliveredDate ? 'pending'
          : merged.deliveredDate <= merged.dueDate ? 'on_time' : 'late';
        return { ...merged, status };
      }),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'distribution', action: 'K-1 Delivery Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteK1Delivery: (id, user = 'System') =>
    set((state) => ({
      k1Deliveries: state.k1Deliveries.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'distribution', action: 'K-1 Delivery Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // COMPLIANCE — SUBSCRIPTION AGREEMENT PROCESSING
  // ═══════════════════════════════════════════════

  addSubAgreementProcessing: (entry, user = 'System') =>
    set((state) => {
      const id = genId('SAP');
      const now = new Date().toISOString();
      return {
        subAgreementProcessing: [...state.subAgreementProcessing, {
          ...entry, id, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'compliance', action: 'Sub Agreement Processing Logged',
          detail: `${entry.investorName}${entry.hasErrors ? ' — HAS ERRORS' : ''}`,
          user, timestamp: now,
        }],
      };
    }),

  updateSubAgreementProcessing: (id, updates, user = 'System') =>
    set((state) => ({
      subAgreementProcessing: state.subAgreementProcessing.map((e) =>
        e.id === id ? { ...e, ...updates } : e),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'Sub Agreement Processing Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteSubAgreementProcessing: (id, user = 'System') =>
    set((state) => ({
      subAgreementProcessing: state.subAgreementProcessing.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'Sub Agreement Processing Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // COMPLIANCE — BLUE SKY FILING KPI
  // ═══════════════════════════════════════════════

  addBlueSkyFilingKpi: (entry, user = 'System') =>
    set((state) => {
      const id = genId('BSK');
      const now = new Date().toISOString();
      const actualDays = daysBetween(entry.triggerDate, entry.filedDate);
      return {
        blueSkyFilingKpi: [...state.blueSkyFilingKpi, {
          ...entry, id, actualDays, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'compliance', action: 'Blue Sky Filing KPI Logged',
          detail: `${entry.state} — ${entry.investorName} — ${actualDays}d`,
          user, timestamp: now,
        }],
      };
    }),

  updateBlueSkyFilingKpi: (id, updates, user = 'System') =>
    set((state) => ({
      blueSkyFilingKpi: state.blueSkyFilingKpi.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...updates };
        return { ...merged, actualDays: daysBetween(merged.triggerDate, merged.filedDate) };
      }),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'Blue Sky Filing KPI Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteBlueSkyFilingKpi: (id, user = 'System') =>
    set((state) => ({
      blueSkyFilingKpi: state.blueSkyFilingKpi.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'Blue Sky Filing KPI Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // COMPLIANCE — FORM D AMENDMENTS
  // ═══════════════════════════════════════════════

  addFormDAmendment: (entry, user = 'System') =>
    set((state) => {
      const id = genId('FDA');
      const now = new Date().toISOString();
      const status = !entry.filedDate ? 'pending'
        : entry.filedDate <= entry.dueDate ? 'on_time' : 'late';
      return {
        formDAmendments: [...state.formDAmendments, {
          ...entry, id, status, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'compliance', action: 'Form D Amendment Logged',
          detail: `${entry.filingType} — ${status}`, user, timestamp: now,
        }],
      };
    }),

  updateFormDAmendment: (id, updates, user = 'System') =>
    set((state) => ({
      formDAmendments: state.formDAmendments.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...updates };
        const status = !merged.filedDate ? 'pending'
          : merged.filedDate <= merged.dueDate ? 'on_time' : 'late';
        return { ...merged, status };
      }),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'Form D Amendment Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteFormDAmendment: (id, user = 'System') =>
    set((state) => ({
      formDAmendments: state.formDAmendments.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'Form D Amendment Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // COMPLIANCE — DTCC REPORTING
  // ═══════════════════════════════════════════════

  addDtccReporting: (entry, user = 'System') =>
    set((state) => {
      const id = genId('DTC');
      const now = new Date().toISOString();
      const status = !entry.sentDate ? 'pending'
        : entry.sentDate <= entry.dueDate ? 'on_time' : 'late';
      return {
        dtccReporting: [...state.dtccReporting, {
          ...entry, id, status, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'compliance', action: 'DTCC Reporting Logged',
          detail: `${entry.reportType} Q${entry.quarter} ${entry.year} — ${status}`,
          user, timestamp: now,
        }],
      };
    }),

  updateDtccReporting: (id, updates, user = 'System') =>
    set((state) => ({
      dtccReporting: state.dtccReporting.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...updates };
        const status = !merged.sentDate ? 'pending'
          : merged.sentDate <= merged.dueDate ? 'on_time' : 'late';
        return { ...merged, status };
      }),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'DTCC Reporting Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteDtccReporting: (id, user = 'System') =>
    set((state) => ({
      dtccReporting: state.dtccReporting.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'DTCC Reporting Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // COMPLIANCE — AUDIT DELIVERABLES (TANNER)
  // ═══════════════════════════════════════════════

  addAuditDeliverable: (entry, user = 'System') =>
    set((state) => {
      const id = genId('ADL');
      const now = new Date().toISOString();
      const status = !entry.deliveredDate ? 'pending'
        : entry.deliveredDate <= entry.dueDate ? 'on_time' : 'late';
      const turnaroundDays = daysBetween(entry.dueDate, entry.deliveredDate);
      return {
        auditDeliverables: [...state.auditDeliverables, {
          ...entry, id, status, turnaroundDays, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'compliance', action: 'Audit Deliverable Logged',
          detail: `${entry.deliverableType} — ${status}`, user, timestamp: now,
        }],
      };
    }),

  updateAuditDeliverable: (id, updates, user = 'System') =>
    set((state) => ({
      auditDeliverables: state.auditDeliverables.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...updates };
        const status = !merged.deliveredDate ? 'pending'
          : merged.deliveredDate <= merged.dueDate ? 'on_time' : 'late';
        return { ...merged, status, turnaroundDays: daysBetween(merged.dueDate, merged.deliveredDate) };
      }),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'Audit Deliverable Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteAuditDeliverable: (id, user = 'System') =>
    set((state) => ({
      auditDeliverables: state.auditDeliverables.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'Audit Deliverable Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // COMPLIANCE — AUDIT OPINIONS
  // ═══════════════════════════════════════════════

  addAuditOpinion: (entry, user = 'System') =>
    set((state) => {
      const id = genId('AOP');
      const now = new Date().toISOString();
      return {
        auditOpinions: [...state.auditOpinions, {
          ...entry, id, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'compliance', action: 'Audit Opinion Logged',
          detail: `${entry.year} — ${entry.opinionType}`, user, timestamp: now,
        }],
      };
    }),

  updateAuditOpinion: (id, updates, user = 'System') =>
    set((state) => ({
      auditOpinions: state.auditOpinions.map((e) =>
        e.id === id ? { ...e, ...updates } : e),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'Audit Opinion Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteAuditOpinion: (id, user = 'System') =>
    set((state) => ({
      auditOpinions: state.auditOpinions.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'Audit Opinion Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // COMPLIANCE — CUSTODIAN RECONCILIATION
  // ═══════════════════════════════════════════════

  addCustodianReconciliation: (entry, user = 'System') =>
    set((state) => {
      const id = genId('CRC');
      const now = new Date().toISOString();
      return {
        custodianReconciliation: [...state.custodianReconciliation, {
          ...entry, id, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'compliance', action: 'Custodian Reconciliation Logged',
          detail: `${entry.custodian} — ${entry.month}/${entry.year} — ${entry.status}`,
          user, timestamp: now,
        }],
      };
    }),

  updateCustodianReconciliation: (id, updates, user = 'System') =>
    set((state) => ({
      custodianReconciliation: state.custodianReconciliation.map((e) =>
        e.id === id ? { ...e, ...updates } : e),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'Custodian Reconciliation Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteCustodianReconciliation: (id, user = 'System') =>
    set((state) => ({
      custodianReconciliation: state.custodianReconciliation.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'compliance', action: 'Custodian Reconciliation Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // SALES OPS — MATERIALS SPEND
  // ═══════════════════════════════════════════════

  addMaterialsSpend: (entry, user = 'System') =>
    set((state) => {
      const id = genId('MSP');
      const now = new Date().toISOString();
      return {
        materialsSpend: [...state.materialsSpend, {
          ...entry, id, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'salesops', action: 'Materials Spend Logged',
          detail: `${entry.category} — $${entry.amount} — ${entry.month}/${entry.year}`,
          user, timestamp: now,
        }],
      };
    }),

  updateMaterialsSpend: (id, updates, user = 'System') =>
    set((state) => ({
      materialsSpend: state.materialsSpend.map((e) =>
        e.id === id ? { ...e, ...updates } : e),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'salesops', action: 'Materials Spend Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteMaterialsSpend: (id, user = 'System') =>
    set((state) => ({
      materialsSpend: state.materialsSpend.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'salesops', action: 'Materials Spend Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // SALES OPS — MARKETING MATERIALS CREATED
  // ═══════════════════════════════════════════════

  addMarketingMaterial: (entry, user = 'System') =>
    set((state) => {
      const id = genId('MKM');
      const now = new Date().toISOString();
      return {
        marketingMaterials: [...state.marketingMaterials, {
          ...entry, id, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'salesops', action: 'Marketing Material Created',
          detail: `${entry.materialType} — ${entry.title || 'Untitled'}`,
          user, timestamp: now,
        }],
      };
    }),

  updateMarketingMaterial: (id, updates, user = 'System') =>
    set((state) => ({
      marketingMaterials: state.marketingMaterials.map((e) =>
        e.id === id ? { ...e, ...updates } : e),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'salesops', action: 'Marketing Material Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteMarketingMaterial: (id, user = 'System') =>
    set((state) => ({
      marketingMaterials: state.marketingMaterials.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'salesops', action: 'Marketing Material Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // SALES OPS — MATERIALS SENT
  // ═══════════════════════════════════════════════

  addMaterialsSent: (entry, user = 'System') =>
    set((state) => {
      const id = genId('MSN');
      const now = new Date().toISOString();
      return {
        materialsSent: [...state.materialsSent, {
          ...entry, id, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'salesops', action: 'Materials Sent Logged',
          detail: `${entry.quantity}x ${entry.materialType} to ${entry.recipientName}`,
          user, timestamp: now,
        }],
      };
    }),

  updateMaterialsSent: (id, updates, user = 'System') =>
    set((state) => ({
      materialsSent: state.materialsSent.map((e) =>
        e.id === id ? { ...e, ...updates } : e),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'salesops', action: 'Materials Sent Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteMaterialsSent: (id, user = 'System') =>
    set((state) => ({
      materialsSent: state.materialsSent.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'salesops', action: 'Materials Sent Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // SALES OPS — KITS ASSEMBLED
  // ═══════════════════════════════════════════════

  addKitAssembled: (entry, user = 'System') =>
    set((state) => {
      const id = genId('KAS');
      const now = new Date().toISOString();
      const turnaroundDays = daysBetween(entry.date, entry.shippedDate);
      return {
        kitsAssembled: [...state.kitsAssembled, {
          ...entry, id, turnaroundDays, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'salesops', action: 'Kits Assembled Logged',
          detail: `${entry.quantity} kits — ${turnaroundDays != null ? turnaroundDays + 'd turnaround' : 'not shipped yet'}`,
          user, timestamp: now,
        }],
      };
    }),

  updateKitAssembled: (id, updates, user = 'System') =>
    set((state) => ({
      kitsAssembled: state.kitsAssembled.map((e) => {
        if (e.id !== id) return e;
        const merged = { ...e, ...updates };
        return { ...merged, turnaroundDays: daysBetween(merged.date, merged.shippedDate) };
      }),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'salesops', action: 'Kits Assembled Updated',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteKitAssembled: (id, user = 'System') =>
    set((state) => ({
      kitsAssembled: state.kitsAssembled.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'salesops', action: 'Kits Assembled Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // SALES OPS — AD HOC REQUESTS
  // ═══════════════════════════════════════════════

  addAdHocRequest: (entry, user = 'System') =>
    set((state) => {
      const id = genId('AHR');
      const now = new Date().toISOString();
      return {
        adHocRequests: [...state.adHocRequests, {
          status: 'open', priority: 'normal', assignee: '',
          ...entry, id, createdAt: now, createdBy: user,
        }],
        auditLog: [...state.auditLog, {
          id: genId('KPA'), section: 'salesops', action: 'Ad Hoc Request Logged',
          detail: `${entry.requester} — ${entry.assignee ? 'assigned to ' + entry.assignee + ' — ' : ''}${entry.description?.slice(0, 50)}`,
          user, timestamp: now,
        }],
      };
    }),

  updateAdHocRequest: (id, updates, user = 'System') =>
    set((state) => ({
      adHocRequests: state.adHocRequests.map((e) =>
        e.id === id ? { ...e, ...updates } : e),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'salesops', action: 'Ad Hoc Request Updated',
        detail: `Entry ${id}${updates.status === 'completed' ? ' — COMPLETED' : ''}`,
        user, timestamp: new Date().toISOString(),
      }],
    })),

  deleteAdHocRequest: (id, user = 'System') =>
    set((state) => ({
      adHocRequests: state.adHocRequests.filter((e) => e.id !== id),
      auditLog: [...state.auditLog, {
        id: genId('KPA'), section: 'salesops', action: 'Ad Hoc Request Deleted',
        detail: `Entry ${id}`, user, timestamp: new Date().toISOString(),
      }],
    })),

  // ═══════════════════════════════════════════════
  // SECTION SUMMARIES (computed)
  // ═══════════════════════════════════════════════

  getDirectorySummary: (startDate, endDate) => {
    const state = get();
    const responses = state.inquiryResponses.filter((e) => inRange(e.dateReceived, startDate, endDate));
    const avgResponseTime = responses.length > 0
      ? responses.reduce((s, e) => s + (e.responseHours || 0), 0) / responses.length : null;
    const withinTarget = responses.filter((e) => e.responseHours != null && e.responseHours <= 48).length;

    const onboardings = state.onboardingSegments.filter((e) => inRange(e.commitmentDate, startDate, endDate));
    const avgDaysTotal = onboardings.length > 0
      ? onboardings.reduce((s, e) => s + (e.daysTotal || 0), 0) / onboardings.length : null;
    const avgDaysToSend = onboardings.length > 0
      ? onboardings.reduce((s, e) => s + (e.daysToSend || 0), 0) / onboardings.length : null;
    const avgDaysToExecute = onboardings.length > 0
      ? onboardings.reduce((s, e) => s + (e.daysToExecute || 0), 0) / onboardings.length : null;
    const avgDaysToFund = onboardings.length > 0
      ? onboardings.reduce((s, e) => s + (e.daysToFund || 0), 0) / onboardings.length : null;

    const comms = state.communicationDeliverables.filter((e) => inRange(e.dueDate, startDate, endDate));
    const commsOnTime = comms.filter((e) => e.status === 'on_time').length;
    const commsLate = comms.filter((e) => e.status === 'late').length;
    const commsPending = comms.filter((e) => e.status === 'pending').length;

    return {
      avgResponseTime, responseCount: responses.length, withinTarget,
      responseStatus: avgResponseTime === null ? 'green'
        : avgResponseTime <= 24 ? 'green' : avgResponseTime <= 48 ? 'yellow' : 'red',
      avgDaysTotal, avgDaysToSend, avgDaysToExecute, avgDaysToFund,
      onboardingCount: onboardings.length,
      commsOnTime, commsLate, commsPending, commsTotal: comms.length,
      commsStatus: comms.length === 0 ? 'green'
        : commsLate > 0 ? 'red' : commsPending > 0 ? 'yellow' : 'green',
    };
  },

  getDistributionSummary: (startDate, endDate) => {
    const state = get();
    const processing = state.distributionProcessing.filter((e) => inRange(e.processedDate || e.dueDate, startDate, endDate));
    const onTime = processing.filter((e) => e.onTime).length;
    const accurate = processing.filter((e) => e.accurate !== false).length;
    const withErrors = processing.filter((e) => e.accurate === false).length;

    // Clean streak: consecutive on-time + accurate from most recent
    let cleanStreak = 0;
    const sorted = [...processing].sort((a, b) => (b.processedDate || '').localeCompare(a.processedDate || ''));
    for (const p of sorted) {
      if (p.onTime && p.accurate !== false) cleanStreak++;
      else break;
    }

    const custodian = state.custodianReporting.filter((e) => inRange(e.dueDate, startDate, endDate));
    const custOnTime = custodian.filter((e) => e.status === 'on_time').length;

    const k1s = state.k1Deliveries.filter((e) => inRange(e.dueDate, startDate, endDate));
    const k1Delivered = k1s.filter((e) => e.status !== 'pending').length;
    const k1OnTime = k1s.filter((e) => e.status === 'on_time').length;

    return {
      processingTotal: processing.length, onTime, accurate, withErrors, cleanStreak,
      processingStatus: processing.length === 0 ? 'green'
        : (onTime / processing.length) >= 1 && withErrors === 0 ? 'green'
        : (onTime / processing.length) >= 0.9 ? 'yellow' : 'red',
      custodianTotal: custodian.length, custOnTime,
      custodianStatus: custodian.length === 0 ? 'green'
        : custOnTime === custodian.length ? 'green'
        : custOnTime / custodian.length >= 0.9 ? 'yellow' : 'red',
      k1Total: k1s.length, k1Delivered, k1OnTime,
      k1Status: k1s.length === 0 ? 'green'
        : k1OnTime === k1s.length ? 'green'
        : k1Delivered < k1s.length ? 'yellow' : 'red',
    };
  },

  getComplianceSummary: (startDate, endDate) => {
    const state = get();
    const subs = state.subAgreementProcessing.filter((e) => inRange(e.processedDate, startDate, endDate));
    const subErrors = subs.filter((e) => e.hasErrors).length;
    const errorRate = subs.length > 0 ? (subErrors / subs.length * 100) : 0;

    const bs = state.blueSkyFilingKpi.filter((e) => inRange(e.filedDate || e.triggerDate, startDate, endDate));
    const bsWithin30 = bs.filter((e) => e.actualDays != null && e.actualDays <= 30).length;
    const avgDaysToFile = bs.length > 0
      ? bs.reduce((s, e) => s + (e.actualDays || 0), 0) / bs.length : null;

    const formD = state.formDAmendments.filter((e) => inRange(e.dueDate, startDate, endDate));
    const formDOnTime = formD.filter((e) => e.status === 'on_time').length;

    const dtcc = state.dtccReporting.filter((e) => inRange(e.dueDate, startDate, endDate));
    const dtccOnTime = dtcc.filter((e) => e.status === 'on_time').length;

    const audDel = state.auditDeliverables.filter((e) => inRange(e.dueDate, startDate, endDate));
    const audDelOnTime = audDel.filter((e) => e.status === 'on_time').length;
    const avgTurnaround = audDel.length > 0
      ? audDel.reduce((s, e) => s + Math.abs(e.turnaroundDays || 0), 0) / audDel.length : null;

    const opinions = state.auditOpinions;
    const latestOpinion = opinions.length > 0
      ? opinions.reduce((a, b) => a.year > b.year ? a : b) : null;

    const recon = state.custodianReconciliation.filter((e) => inRange(e.reconciledDate || `${e.year}-${String(e.month).padStart(2, '0')}-01`, startDate, endDate));
    const reconOk = recon.filter((e) => e.status === 'reconciled').length;
    const reconDisc = recon.filter((e) => e.status === 'discrepancy').length;

    return {
      subTotal: subs.length, subErrors, errorRate,
      subStatus: subs.length === 0 ? 'green' : errorRate < 2 ? 'green' : errorRate < 5 ? 'yellow' : 'red',
      bsTotal: bs.length, bsWithin30, avgDaysToFile,
      bsStatus: bs.length === 0 ? 'green' : bsWithin30 === bs.length ? 'green' : bsWithin30 / bs.length >= 0.9 ? 'yellow' : 'red',
      formDTotal: formD.length, formDOnTime,
      formDStatus: formD.length === 0 ? 'green' : formDOnTime === formD.length ? 'green' : 'red',
      dtccTotal: dtcc.length, dtccOnTime,
      dtccStatus: dtcc.length === 0 ? 'green' : dtccOnTime === dtcc.length ? 'green' : 'red',
      audDelTotal: audDel.length, audDelOnTime, avgTurnaround,
      audDelStatus: audDel.length === 0 ? 'green' : audDelOnTime === audDel.length ? 'green' : 'red',
      latestOpinion,
      opinionStatus: !latestOpinion ? 'green' : latestOpinion.opinionType === 'Clean' ? 'green' : 'red',
      reconTotal: recon.length, reconOk, reconDisc,
      reconStatus: recon.length === 0 ? 'green' : reconDisc > 0 ? 'red' : reconOk === recon.length ? 'green' : 'yellow',
    };
  },

  getSalesOpsSummary: (startDate, endDate) => {
    const state = get();
    const spend = state.materialsSpend.filter((e) => {
      const d = `${e.year}-${String(e.month).padStart(2, '0')}-01`;
      return d >= startDate && d <= endDate;
    });
    const totalMaterialsSpend = spend.filter((e) => e.category === 'materials').reduce((s, e) => s + (e.amount || 0), 0);
    const totalShippingSpend = spend.filter((e) => e.category === 'shipping' || e.category === 'fedex').reduce((s, e) => s + (e.amount || 0), 0);

    const kits = state.kitsAssembled.filter((e) => inRange(e.date, startDate, endDate));
    const totalKits = kits.reduce((s, e) => s + (e.quantity || 0), 0);
    const costPerKit = totalKits > 0 ? totalMaterialsSpend / totalKits : null;
    const avgTurnaround = kits.filter((e) => e.turnaroundDays != null).length > 0
      ? kits.filter((e) => e.turnaroundDays != null).reduce((s, e) => s + e.turnaroundDays, 0) / kits.filter((e) => e.turnaroundDays != null).length
      : null;

    const materials = state.marketingMaterials.filter((e) => inRange(e.date, startDate, endDate));
    const totalCreated = materials.reduce((s, e) => s + (e.quantity || 1), 0);

    const sent = state.materialsSent.filter((e) => inRange(e.date, startDate, endDate));
    const totalSent = sent.reduce((s, e) => s + (e.quantity || 0), 0);

    const requests = state.adHocRequests.filter((e) => inRange(e.requestDate, startDate, endDate));
    const openRequests = requests.filter((e) => e.status === 'open').length;
    const completedRequests = requests.filter((e) => e.status === 'completed').length;
    const avgRequestTurnaround = requests.filter((e) => e.completedDate).length > 0
      ? requests.filter((e) => e.completedDate)
          .reduce((s, e) => s + (daysBetween(e.requestDate, e.completedDate) || 0), 0)
        / requests.filter((e) => e.completedDate).length
      : null;

    return {
      totalMaterialsSpend, totalShippingSpend, costPerKit,
      totalKits, avgTurnaround,
      totalCreated, materialsByType: materials.reduce((acc, e) => {
        acc[e.materialType] = (acc[e.materialType] || 0) + (e.quantity || 1);
        return acc;
      }, {}),
      totalSent, sentByRecipientType: sent.reduce((acc, e) => {
        acc[e.recipientType] = (acc[e.recipientType] || 0) + (e.quantity || 0);
        return acc;
      }, {}),
      inProgressRequests: requests.filter((e) => e.status === 'in_progress').length,
      totalRequests: requests.length, openRequests, completedRequests, avgRequestTurnaround,
      requestsByRequester: requests.reduce((acc, e) => {
        acc[e.requester] = (acc[e.requester] || 0) + 1;
        return acc;
      }, {}),
      requestsByAssignee: requests.filter((e) => e.assignee).reduce((acc, e) => {
        acc[e.assignee] = (acc[e.assignee] || 0) + 1;
        return acc;
      }, {}),
    };
  },

  // ═══════════════════════════════════════════════
  // AUDIT LOG
  // ═══════════════════════════════════════════════

  getAuditLog: (section) => {
    const log = get().auditLog;
    return section ? log.filter((e) => e.section === section) : log;
  },

    }),
    {
      name: 'vega-kpi-store',
      version: 1,
      partialize: (state) => ({
        inquiryResponses: state.inquiryResponses,
        onboardingSegments: state.onboardingSegments,
        communicationDeliverables: state.communicationDeliverables,
        distributionProcessing: state.distributionProcessing,
        custodianReporting: state.custodianReporting,
        k1Deliveries: state.k1Deliveries,
        subAgreementProcessing: state.subAgreementProcessing,
        blueSkyFilingKpi: state.blueSkyFilingKpi,
        formDAmendments: state.formDAmendments,
        dtccReporting: state.dtccReporting,
        auditDeliverables: state.auditDeliverables,
        auditOpinions: state.auditOpinions,
        custodianReconciliation: state.custodianReconciliation,
        materialsSpend: state.materialsSpend,
        marketingMaterials: state.marketingMaterials,
        materialsSent: state.materialsSent,
        kitsAssembled: state.kitsAssembled,
        adHocRequests: state.adHocRequests,
        auditLog: state.auditLog,
      }),
    },
  ),
);

export default useKpiStore;
