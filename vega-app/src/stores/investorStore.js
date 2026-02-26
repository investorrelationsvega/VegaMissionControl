// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Investor Store
// Builds investor records from positions, manages
// notes and audit log
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { positions as seedPositions, activityFeed as seedActivityFeed } from '../data/seedData';
import { updateInvestorField, updatePositionField, appendAuditLog, updateSubscriptionField } from '../services/sheetsService';
import useBlueskyStore from './blueskyStore';
import useUiStore from './uiStore';

// Pipeline stage order — route-aware (direct/advisor vs custodian)
export const DIRECT_STAGES = [
  'New', 'Pending', 'Webform Sent', 'Webform Done',
  'Out for Signatures', 'Signed by LP', 'Signed by GP/Vega',
  'Funded', 'Reviewed by Attorney', 'Blue Sky Filing', 'Fully Accepted',
];

export const CUSTODIAN_STAGES = [
  'New', 'Pending', 'Webform Sent', 'Docs to Custodian',
  'Delivered to Vega', 'Signed by GP/Vega',
  'Funded', 'Reviewed by Attorney', 'Blue Sky Filing', 'Fully Accepted',
];

// Backward-compat alias (default = direct flow)
export const PIPELINE_STAGES = DIRECT_STAGES;

export function getPipelineStages(docRouting) {
  return docRouting === 'custodian' ? CUSTODIAN_STAGES : DIRECT_STAGES;
}

export const PIPELINE_STAGE_LABELS = {
  'New': 'New',
  'Pending': 'Pending',
  'Webform Sent': 'Webform Sent',
  'Webform Done': 'Webform Done',
  'Out for Signatures': 'Out for Sigs',
  'Signed by LP': 'Signed LP',
  'Signed by GP/Vega': 'GP Signed',
  'Docs to Custodian': 'To Custodian',
  'Delivered to Vega': 'Delivered',
  'Funded': 'Funded',
  'Reviewed by Attorney': 'Atty Review',
  'Blue Sky Filing': 'Blue Sky',
  'Fully Accepted': 'Accepted',
  'Declined': 'Declined',
};

// Map stage → date key for that stage
export const STAGE_DATE_KEYS = {
  'Pending': 'pendingDate',
  'Webform Sent': 'webformSentDate',
  'Webform Done': 'webformDoneDate',
  'Out for Signatures': 'outForSignaturesDate',
  'Signed by LP': 'signedByLpDate',
  'Signed by GP/Vega': 'signedByGpDate',
  'Docs to Custodian': 'docsToCustodianDate',
  'Delivered to Vega': 'deliveredToVegaDate',
  'Funded': 'fundedDate',
  'Reviewed by Attorney': 'reviewedByAttorneyDate',
  'Blue Sky Filing': 'blueSkyFilingDate',
  'Fully Accepted': 'acceptedDate',
};

// ── Migration helpers (old stage names → new) ─────────────────────────────
export function migrateStage(stage, docRouting) {
  const mapping = {
    'Webform Complete': docRouting === 'custodian' ? 'Docs to Custodian' : 'Webform Done',
    'DocuSign Out': docRouting === 'custodian' ? 'Docs to Custodian' : 'Out for Signatures',
    'Fully Executed': docRouting === 'custodian' ? 'Delivered to Vega' : 'Signed by LP',
    'GP Countersign': 'Signed by GP/Vega',
    'Accepted': 'Fully Accepted',
  };
  return mapping[stage] || stage;
}

export function migratePipeline(pipeline, docRouting) {
  if (!pipeline) return pipeline;
  const m = { ...pipeline };
  // Migrate stage name
  if (m.stage) m.stage = migrateStage(m.stage, docRouting);
  // Migrate date keys
  if (docRouting === 'custodian') {
    if (m.webformCompleteDate && !m.docsToCustodianDate) m.docsToCustodianDate = m.webformCompleteDate;
    if (m.fullyExecutedDate && !m.deliveredToVegaDate) m.deliveredToVegaDate = m.fullyExecutedDate;
  } else {
    if (m.webformCompleteDate && !m.webformDoneDate) m.webformDoneDate = m.webformCompleteDate;
    if (m.docusignSentDate && !m.outForSignaturesDate) m.outForSignaturesDate = m.docusignSentDate;
    if (m.fullyExecutedDate && !m.signedByLpDate) m.signedByLpDate = m.fullyExecutedDate;
  }
  if (m.gpCountersignDate && !m.signedByGpDate) m.signedByGpDate = m.gpCountersignDate;
  return m;
}

function migratePosition(pos) {
  if (!pos.pipeline) return pos;
  const migrated = migratePipeline(pos.pipeline, pos.docRouting || 'direct');
  return migrated !== pos.pipeline ? { ...pos, pipeline: migrated } : pos;
}

// ---------------------------------------------------------------------------
// Build investor map from positions
// Each investor aggregates all their positions across funds
// ---------------------------------------------------------------------------
function buildInvestors(positionList) {
  const map = {};

  positionList.forEach((p) => {
    if (!map[p.invId]) {
      map[p.invId] = {
        id: p.invId,
        name: p.name,
        funds: [],
        types: [],
        entities: [],
        positions: [],
        totalCommitted: 0,
        status: p.status,
        advisor: p.advisor || '',
        custodian: p.custodian || '',
        phone: '',
        email: '',
        state: '',
        contacts: [],
        pipeline: null,
        pipelinePositionId: null,
        signers: null,
        docRouting: null,
        declinedReason: null,
      };
    }

    const inv = map[p.invId];

    // Aggregate funds (unique)
    if (!inv.funds.includes(p.fund)) {
      inv.funds.push(p.fund);
    }

    // Aggregate investor types (unique)
    if (!inv.types.includes(p.type)) {
      inv.types.push(p.type);
    }

    // Build entity list (unique, non-empty)
    if (p.entity && !inv.entities.includes(p.entity)) {
      inv.entities.push(p.entity);
    }

    // Track advisor / custodian if provided (last-write wins for non-empty)
    if (p.advisor) inv.advisor = p.advisor;
    if (p.custodian) inv.custodian = p.custodian;
    if (p.phone) inv.phone = p.phone;
    if (p.email) inv.email = p.email;
    if (p.state) inv.state = p.state;

    // Carry forward status — if any position is Pending, mark investor Pending
    if (p.status === 'Pending') inv.status = 'Pending';

    // Carry forward pipeline (use most recent / least advanced stage)
    if (p.pipeline) {
      const stages = getPipelineStages(p.docRouting);
      if (!inv.pipeline || stages.indexOf(p.pipeline.stage) < stages.indexOf(inv.pipeline.stage)) {
        inv.pipeline = p.pipeline;
        inv.pipelinePositionId = p.id;
      }
    }

    // Carry forward signers
    if (p.signers && p.signers.length > 0) {
      if (!inv.signers) inv.signers = [];
      p.signers.forEach((s) => {
        if (!inv.signers.find((es) => es.name === s.name && es.role === s.role)) {
          inv.signers.push(s);
        }
      });
    }

    // Carry forward doc routing
    if (p.docRouting) inv.docRouting = p.docRouting;
    if (p.declinedReason) inv.declinedReason = p.declinedReason;

    // Sum committed capital
    inv.totalCommitted += p.amt;

    // Store position reference
    inv.positions.push(p);
  });

  // Auto-populate contacts for Joint types from signers if contacts are empty
  Object.values(map).forEach((inv) => {
    const isJoint = inv.types.some((t) => t === 'Joint' || t === 'Individual or Joint Individuals');
    if (isJoint && inv.signers && inv.signers.length >= 2 && inv.contacts.length === 0) {
      inv.contacts = inv.signers.map((s, i) => ({
        name: s.name,
        role: i === 0 ? 'Primary Signer' : 'Co-Signer',
        phone: i === 0 ? (inv.phone || '') : '',
        email: i === 0 ? (inv.email || '') : '',
      }));
    }
  });

  return map;
}

const migratedSeedPositions = seedPositions.map(migratePosition);
const initialInvestors = buildInvestors(migratedSeedPositions);

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
const useInvestorStore = create(
  persist(
    (set, get) => ({
  // State
  investors: initialInvestors,
  positions: migratedSeedPositions,
  activityFeed: seedActivityFeed || [],
  sheetsLoaded: false, // Track if we've loaded from Google Sheets
  notes: {},       // { [invId]: [ { id, text, author, date } ] }
  auditLog: [],    // [ { id, invId, action, detail, user, timestamp } ]
  contactOverrides: {}, // { [invId]: { phone, email, advisor, custodian, state } } — survives rehydration

  // ── Google Sheets Sync ────────────────────────────────────────────────
  loadFromSheets: (sheetPositions, investorLookup) => {
    set((state) => {
      const migratedPositions = sheetPositions.map(migratePosition);

      // Preserve locally-edited signed/funded dates that may not have
      // been written back to Sheets yet (fire-and-forget write-back race).
      const localPosMap = {};
      state.positions.forEach((p) => { localPosMap[p.id] = p; });
      const mergedPositions = migratedPositions.map((sheetPos) => {
        const local = localPosMap[sheetPos.id];
        if (!local) return sheetPos;
        const merged = { ...sheetPos };
        // If local has a signed/funded value that differs from sheet, keep local
        if (local.signed && local.signed !== sheetPos.signed) {
          merged.signed = local.signed;
          if (merged.pipeline) merged.pipeline = { ...merged.pipeline, signedByLpDate: local.signed };
        }
        if (local.funded && local.funded !== sheetPos.funded) {
          merged.funded = local.funded;
          if (merged.pipeline) merged.pipeline = { ...merged.pipeline, fundedDate: local.funded };
        }
        return merged;
      });

      const investors = buildInvestors(mergedPositions);
      // Re-apply contact overrides so local edits survive
      const overrides = state.contactOverrides || {};
      Object.entries(overrides).forEach(([invId, fields]) => {
        if (investors[invId]) {
          Object.assign(investors[invId], fields);
        }
      });
      // Merge in investor-level data from the Investors tab (email, phone, advisor, contacts, etc.)
      if (investorLookup) {
        Object.entries(investorLookup).forEach(([invId, data]) => {
          if (investors[invId]) {
            if (data.email && !investors[invId].email) investors[invId].email = data.email;
            if (data.phone && !investors[invId].phone) investors[invId].phone = data.phone;
            if (data.advisor && !investors[invId].advisor) investors[invId].advisor = data.advisor;
            if (data.custodian && !investors[invId].custodian) investors[invId].custodian = data.custodian;
            if (data.contacts && data.contacts.length > 0) investors[invId].contacts = data.contacts;
          }
        });
      }
      return {
        positions: mergedPositions,
        investors,
        sheetsLoaded: true,
      };
    });
  },

  // ── Investor Getters ────────────────────────────────────────────────────
  getInvestor: (invId) => get().investors[invId] || null,

  getAll: () => Object.values(get().investors),

  getByFund: (fundShortName) =>
    Object.values(get().investors).filter((inv) =>
      inv.funds.includes(fundShortName),
    ),

  getByStatus: (status) =>
    Object.values(get().investors).filter((inv) => inv.status === status),

  // ── Notes ───────────────────────────────────────────────────────────────
  addNote: (invId, text, author = 'System') =>
    set((state) => {
      const existing = state.notes[invId] || [];
      const note = {
        id: `N-${Date.now()}`,
        text,
        author,
        date: new Date().toISOString(),
      };
      return {
        notes: { ...state.notes, [invId]: [...existing, note] },
      };
    }),

  getNotes: (invId) => get().notes[invId] || [],

  deleteNote: (invId, noteId) =>
    set((state) => {
      const existing = state.notes[invId] || [];
      return {
        notes: {
          ...state.notes,
          [invId]: existing.filter((n) => n.id !== noteId),
        },
      };
    }),

  // ── Status Management ──────────────────────────────────────────────────
  updatePositionStatus: (positionId, newStatus, user = 'System') =>
    set((state) => {
      const pos = state.positions.find((p) => p.id === positionId);
      if (!pos) return state;

      const updatedPositions = state.positions.map((p) =>
        p.id === positionId ? { ...p, status: newStatus } : p,
      );

      // Rebuild investor map from updated positions
      const newInvestors = {};
      updatedPositions.forEach((p) => {
        if (!newInvestors[p.invId]) {
          newInvestors[p.invId] = {
            id: p.invId,
            name: p.name,
            funds: [],
            types: [],
            entities: [],
            positions: [],
            totalCommitted: 0,
            status: p.status,
            advisor: p.advisor || '',
            custodian: p.custodian || '',
            phone: '',
            email: '',
            state: '',
          };
        }
        const inv = newInvestors[p.invId];
        if (!inv.funds.includes(p.fund)) inv.funds.push(p.fund);
        if (!inv.types.includes(p.type)) inv.types.push(p.type);
        if (p.entity && !inv.entities.includes(p.entity)) inv.entities.push(p.entity);
        if (p.advisor) inv.advisor = p.advisor;
        if (p.custodian) inv.custodian = p.custodian;
        if (p.phone) inv.phone = p.phone;
        if (p.email) inv.email = p.email;
        if (p.state) inv.state = p.state;
        if (p.status === 'Pending') inv.status = 'Pending';
        inv.totalCommitted += p.amt;
        inv.positions.push(p);
      });

      return {
        positions: updatedPositions,
        investors: newInvestors,
        auditLog: [
          ...state.auditLog,
          {
            id: `AL-${Date.now()}`,
            invId: pos.invId,
            action: 'Status Changed',
            detail: `Position ${pos.fund} ${pos.entity || pos.name}: ${pos.status} → ${newStatus}`,
            user,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }),

  // ── Subscription Doc Pipeline ─────────────────────────────────────────
  // subDocStatus tracks each investor's subscription document pipeline
  // { [invId]: { webformStatus, docusignStatus, gpSigned, completed, history[] } }
  subDocPipeline: {},

  getSubDocStatus: (invId) => get().subDocPipeline[invId] || null,

  updateSubDocStatus: (invId, updates, user = 'System') =>
    set((state) => {
      const existing = state.subDocPipeline[invId] || {
        webformStatus: 'Not Started',
        docusignStatus: 'Not Sent',
        gpSigned: false,
        completed: false,
        history: [],
      };

      const entry = {
        id: `SD-${Date.now()}`,
        timestamp: new Date().toISOString(),
        user,
        changes: updates,
        detail: Object.entries(updates).map(([k, v]) => `${k}: ${v}`).join(', '),
      };

      return {
        subDocPipeline: {
          ...state.subDocPipeline,
          [invId]: {
            ...existing,
            ...updates,
            history: [...existing.history, entry],
          },
        },
      };
    }),

  // ── Audit Log ───────────────────────────────────────────────────────────
  logAction: (invId, action, detail = '', user = 'System') =>
    set((state) => ({
      auditLog: [
        ...state.auditLog,
        {
          id: `AL-${Date.now()}`,
          invId,
          action,
          detail,
          user,
          timestamp: new Date().toISOString(),
        },
      ],
    })),

  getAuditLog: (invId) =>
    invId
      ? get().auditLog.filter((entry) => entry.invId === invId)
      : get().auditLog,

  // ── Position Amount ─────────────────────────────────────────────────────
  updatePositionAmount: (positionId, newAmount, user = 'System') =>
    set((state) => {
      const pos = state.positions.find((p) => p.id === positionId);
      if (!pos) return state;

      const oldAmt = pos.amt;
      const updatedPositions = state.positions.map((p) =>
        p.id === positionId ? { ...p, amt: newAmount } : p,
      );

      // Rebuild investor map from updated positions
      const newInvestors = buildInvestors(updatedPositions);

      return {
        positions: updatedPositions,
        investors: newInvestors,
        auditLog: [
          ...state.auditLog,
          {
            id: `AL-${Date.now()}`,
            invId: pos.invId,
            action: 'Amount Changed',
            detail: `Position ${pos.fund} ${pos.entity || pos.name}: $${oldAmt.toLocaleString()} → $${newAmount.toLocaleString()}`,
            user,
            timestamp: new Date().toISOString(),
          },
        ],
      };
    }),

  // ── Pipeline Management ─────────────────────────────────────────────────
  advancePipelineStage: (positionId, newStage, user = 'System') => {
    const state = get();
    const pos = state.positions.find((p) => p.id === positionId);
    if (!pos) return;

    // Utah residents skip Blue Sky Filing — advance straight to Fully Accepted
    let effectiveStage = newStage;
    if (newStage === 'Blue Sky Filing' && pos.state === 'UT') {
      effectiveStage = 'Fully Accepted';
    }

    const oldStage = pos.pipeline?.stage || 'New';
    const now = new Date().toISOString();
    const dateKey = STAGE_DATE_KEYS[effectiveStage];
    // Use locale date string for pipeline dates to avoid UTC-vs-local display bugs
    const localDateStr = new Date().toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
    });

    const updatedPipeline = {
      ...(pos.pipeline || {}),
      stage: effectiveStage,
      ...(dateKey ? { [dateKey]: localDateStr } : {}),
    };

    // For Blue Sky Filing, calculate deadline (30 days from reviewedByAttorneyDate)
    if (effectiveStage === 'Blue Sky Filing') {
      const attyDate = updatedPipeline.reviewedByAttorneyDate || now;
      const deadline = new Date(attyDate);
      deadline.setDate(deadline.getDate() + 30);
      updatedPipeline.blueSkyDeadline = deadline.toISOString().split('T')[0];
    }

    const updatedPositions = state.positions.map((p) =>
      p.id === positionId ? { ...p, pipeline: updatedPipeline } : p,
    );
    const newInvestors = buildInvestors(updatedPositions);

    // Add activity feed entry
    const newActivity = {
      id: `AF-${Date.now()}`,
      type: 'status_change',
      invId: pos.invId,
      fund: pos.fund,
      message: `${pos.name} moved from ${oldStage} to ${effectiveStage}`,
      date: now,
      read: false,
    };

    set({
      positions: updatedPositions,
      investors: newInvestors,
      activityFeed: [newActivity, ...state.activityFeed],
      auditLog: [
        ...state.auditLog,
        {
          id: `AL-${Date.now()}`,
          invId: pos.invId,
          action: 'Pipeline Stage Changed',
          detail: `${pos.fund} ${pos.entity || pos.name}: ${oldStage} → ${effectiveStage}`,
          user,
          timestamp: now,
        },
      ],
    });

    // Write pipeline change to Subscriptions sheet (fire-and-forget)
    if (pos.subscriptionId) {
      updateSubscriptionField(pos.subscriptionId, 'stage', effectiveStage)
        .catch((err) => console.error('Subscription stage write-back failed:', err));
      updateSubscriptionField(pos.subscriptionId, 'dates_json', JSON.stringify(updatedPipeline))
        .catch((err) => console.error('Subscription dates write-back failed:', err));
      updateSubscriptionField(pos.subscriptionId, 'updated_at', now)
        .catch((err) => console.error('Subscription updated_at write-back failed:', err));
    }

    // Write audit log to sheet (fire-and-forget)
    appendAuditLog({
      id: `AUD-${Date.now()}`,
      recordType: 'subscription',
      recordId: pos.subscriptionId || positionId,
      action: 'Pipeline Stage Changed',
      notes: `${pos.fund} ${pos.entity || pos.name}: ${oldStage} → ${effectiveStage}`,
      user,
      timestamp: now,
    }).catch((err) => console.error('Audit log write-back failed:', err));

    // Blue Sky filing trigger: when entering Blue Sky Filing stage, create filing in bluesky store
    if (effectiveStage === 'Blue Sky Filing' && pos.state && pos.state !== 'UT') {
      const bluesky = useBlueskyStore.getState();
      if (!bluesky.hasFiling(pos.invId)) {
        const updatedPos = { ...pos, pipeline: updatedPipeline };
        const filing = bluesky.addFiling(updatedPos);
        if (filing) {
          const deadline = updatedPipeline.blueSkyDeadline || '30 days';
          useUiStore.getState().addNotification({
            type: 'bluesky',
            title: `Blue Sky Filing Required`,
            detail: `${pos.name} (${pos.state}) — ${pos.fund}. Deadline: ${deadline}.`,
            link: '/pe/compliance',
            filingId: filing.id,
          });
        }
      }
    }
  },

  // ── Pipeline Date Editing ─────────────────────────────────────────────────
  updatePipelineDate: (positionId, dateKey, newDate, user = 'System') => {
    const state = get();
    const pos = state.positions.find((p) => p.id === positionId);
    if (!pos || !pos.pipeline) return;

    const oldDate = pos.pipeline[dateKey] || '';
    const now = new Date().toISOString();

    const updatedPipeline = { ...pos.pipeline, [dateKey]: newDate };
    const updatedPositions = state.positions.map((p) =>
      p.id === positionId ? { ...p, pipeline: updatedPipeline } : p,
    );
    const newInvestors = buildInvestors(updatedPositions);

    set({
      positions: updatedPositions,
      investors: newInvestors,
      auditLog: [
        ...state.auditLog,
        {
          id: `AL-${Date.now()}`,
          invId: pos.invId,
          action: 'Pipeline Date Updated',
          detail: `${pos.fund} ${pos.entity || pos.name}: ${dateKey} "${oldDate || '(empty)'}" → "${newDate}"`,
          user,
          timestamp: now,
        },
      ],
    });

    // Write to Sheets (fire-and-forget)
    if (pos.subscriptionId) {
      updateSubscriptionField(pos.subscriptionId, 'dates_json', JSON.stringify(updatedPipeline))
        .catch((err) => console.error('Subscription dates write-back failed:', err));
      updateSubscriptionField(pos.subscriptionId, 'updated_at', now)
        .catch((err) => console.error('Subscription updated_at write-back failed:', err));
    }
    appendAuditLog({
      id: `AUD-${Date.now()}`,
      recordType: 'subscription',
      recordId: pos.subscriptionId || positionId,
      action: 'Pipeline Date Updated',
      notes: `${pos.fund} ${pos.entity || pos.name}: ${dateKey} changed`,
      user,
      timestamp: now,
    }).catch((err) => console.error('Audit log write-back failed:', err));
  },

  declineInvestor: (positionId, reason, user = 'System') =>
    set((state) => {
      const pos = state.positions.find((p) => p.id === positionId);
      if (!pos) return state;

      const now = new Date().toISOString();
      const updatedPositions = state.positions.map((p) =>
        p.id === positionId
          ? {
              ...p,
              pipeline: { ...(p.pipeline || {}), stage: 'Declined', declinedDate: now },
              declinedReason: reason,
              status: 'Declined',
            }
          : p,
      );
      const newInvestors = buildInvestors(updatedPositions);

      const newActivity = {
        id: `AF-${Date.now()}`,
        type: 'declined',
        invId: pos.invId,
        fund: pos.fund,
        message: `${pos.name} declined — ${reason}`,
        date: now,
        read: false,
      };

      // Write decline to Subscriptions sheet (fire-and-forget)
      if (pos.subscriptionId) {
        updateSubscriptionField(pos.subscriptionId, 'stage', 'Declined')
          .catch((err) => console.error('Subscription decline write-back failed:', err));
        updateSubscriptionField(pos.subscriptionId, 'declined_reason', reason)
          .catch((err) => console.error('Subscription decline reason write-back failed:', err));
        updateSubscriptionField(pos.subscriptionId, 'dates_json',
          JSON.stringify({ ...(pos.pipeline || {}), stage: 'Declined', declinedDate: now }))
          .catch((err) => console.error('Subscription dates write-back failed:', err));
        updateSubscriptionField(pos.subscriptionId, 'updated_at', now)
          .catch((err) => console.error('Subscription updated_at write-back failed:', err));
      }

      appendAuditLog({
        id: `AUD-${Date.now()}`,
        recordType: 'subscription',
        recordId: pos.subscriptionId || positionId,
        action: 'Declined',
        notes: `${pos.fund} ${pos.entity || pos.name}: ${reason}`,
        user,
        timestamp: now,
      }).catch((err) => console.error('Audit log write-back failed:', err));

      return {
        positions: updatedPositions,
        investors: newInvestors,
        activityFeed: [newActivity, ...state.activityFeed],
        auditLog: [
          ...state.auditLog,
          {
            id: `AL-${Date.now()}`,
            invId: pos.invId,
            action: 'Declined',
            detail: `${pos.fund} ${pos.entity || pos.name}: ${reason}`,
            user,
            timestamp: now,
          },
        ],
      };
    }),

  // ── Activity Feed ──────────────────────────────────────────────────────
  addActivity: (activity) =>
    set((state) => ({
      activityFeed: [
        { ...activity, id: `AF-${Date.now()}`, date: new Date().toISOString(), read: false },
        ...state.activityFeed,
      ],
    })),

  markActivityRead: (activityId) =>
    set((state) => ({
      activityFeed: state.activityFeed.map((a) =>
        a.id === activityId ? { ...a, read: true } : a,
      ),
    })),

  getActivityByFund: (fundShortName) =>
    get().activityFeed.filter((a) => a.fund === fundShortName),

  // ── Pipeline Getters ──────────────────────────────────────────────────
  getNewInvestors: () =>
    Object.values(get().investors).filter(
      (inv) => inv.pipeline?.stage === 'New',
    ),

  getPendingInvestors: () =>
    Object.values(get().investors).filter(
      (inv) => inv.pipeline && !['Fully Accepted', 'Accepted', 'Declined'].includes(inv.pipeline.stage) && inv.pipeline.stage !== 'New',
    ),

  getDeclinedInvestors: () =>
    Object.values(get().investors).filter(
      (inv) => inv.pipeline?.stage === 'Declined',
    ),

  // ── Investor Contact ────────────────────────────────────────────────────
  updateInvestorContact: (invId, updates, user = 'System') =>
    set((state) => {
      const investor = state.investors[invId];
      if (!investor) return state;

      const now = new Date().toISOString();
      const newAuditEntries = [];
      const FIELD_LABELS = { phone: 'Phone', email: 'Email', advisor: 'Advisor', custodian: 'Custodian', state: 'State' };

      Object.entries(updates).forEach(([field, newValue]) => {
        const oldValue = investor[field] || '';
        if (oldValue !== newValue) {
          newAuditEntries.push({
            id: `AL-${Date.now()}-${field}`,
            invId,
            action: 'Field Updated',
            detail: `${FIELD_LABELS[field] || field}: "${oldValue || '(empty)'}" → "${newValue || '(empty)'}"`,
            user,
            timestamp: now,
          });
        }
      });

      // Merge into contactOverrides so edits survive position-based rehydration
      const existingOverrides = state.contactOverrides[invId] || {};

      // Write back to Google Sheet (fire-and-forget)
      Object.entries(updates).forEach(([field, newValue]) => {
        updateInvestorField(invId, field, newValue).catch((err) =>
          console.error(`Sheet write-back failed for ${field}:`, err)
        );
      });

      // Append to sheet audit log
      newAuditEntries.forEach((entry) => {
        appendAuditLog({
          id: entry.id,
          recordType: 'investor',
          recordId: invId,
          action: entry.action,
          notes: entry.detail,
          user: entry.user || user,
          timestamp: entry.timestamp,
        }).catch((err) => console.error('Audit log write-back failed:', err));
      });

      return {
        investors: {
          ...state.investors,
          [invId]: { ...investor, ...updates },
        },
        contactOverrides: {
          ...state.contactOverrides,
          [invId]: { ...existingOverrides, ...updates },
        },
        auditLog: [...state.auditLog, ...newAuditEntries],
      };
    }),

  // ── Profile Type ─────────────────────────────────────────────────────
  updateProfileType: (invId, newType, user = 'j@vegarei.com') =>
    set((state) => {
      const investor = state.investors[invId];
      if (!investor) return state;

      const oldType = investor.types[0] || '(empty)';
      const now = new Date().toISOString();

      // Update all positions for this investor
      const updatedPositions = state.positions.map((p) =>
        p.invId === invId ? { ...p, type: newType } : p,
      );

      // Rebuild investors from updated positions
      const newInvestors = buildInvestors(updatedPositions);

      // Re-apply contact overrides
      const overrides = state.contactOverrides || {};
      Object.entries(overrides).forEach(([id, fields]) => {
        if (newInvestors[id]) Object.assign(newInvestors[id], fields);
      });

      // Write back to Investors sheet (profile_type column C)
      updateInvestorField(invId, 'profile_type', newType).catch((err) =>
        console.error('Profile type sheet write-back failed:', err),
      );

      // Write back to each Position sheet row (profile_type column F)
      investor.positions.forEach((p) => {
        updatePositionField(p.id, 'profile_type', newType).catch((err) =>
          console.error(`Position profile_type write-back failed for ${p.id}:`, err),
        );
      });

      const auditEntry = {
        id: `AL-${Date.now()}-profileType`,
        invId,
        action: 'Profile Type Changed',
        detail: `Profile Type: "${oldType}" → "${newType}"`,
        user,
        timestamp: now,
      };

      appendAuditLog({
        id: auditEntry.id,
        recordType: 'investor',
        recordId: invId,
        action: auditEntry.action,
        notes: auditEntry.detail,
        user,
        timestamp: now,
      }).catch((err) => console.error('Audit log write-back failed:', err));

      // Auto-add contacts if not already present
      const existingContacts = newInvestors[invId]?.contacts || overrides[invId]?.contacts || [];
      const hasPrimarySigner = existingContacts.some(
        (c) => c.name === investor.name || c.role === 'Primary Signer',
      );

      if (!hasPrimarySigner && investor.name?.trim()) {
        // Joint types: create separate contacts from signers array
        const isJoint = newType === 'Joint' || newType === 'Individual or Joint Individuals';
        const signers = newInvestors[invId]?.signers || investor.positions?.[0]?.signers || [];
        let newContacts;
        if (isJoint && signers.length >= 2) {
          newContacts = signers.map((s, i) => ({
            name: s.name,
            role: i === 0 ? 'Primary Signer' : 'Co-Signer',
            phone: i === 0 ? (investor.phone || '') : '',
            email: i === 0 ? (investor.email || '') : '',
          }));
        } else {
          newContacts = [
            { name: investor.name, role: 'Primary Signer', phone: investor.phone || '', email: investor.email || '' },
          ];
        }
        const updatedContacts = [...newContacts, ...existingContacts];
        newInvestors[invId].contacts = updatedContacts;

        const updatedOverrides = {
          ...overrides,
          [invId]: { ...(overrides[invId] || {}), contacts: updatedContacts },
        };

        updateInvestorField(invId, 'contacts_json', JSON.stringify(updatedContacts)).catch((err) =>
          console.error('Contacts sheet write-back failed:', err),
        );

        return {
          positions: updatedPositions,
          investors: newInvestors,
          contactOverrides: updatedOverrides,
          auditLog: [...state.auditLog, auditEntry],
        };
      }

      return {
        positions: updatedPositions,
        investors: newInvestors,
        auditLog: [...state.auditLog, auditEntry],
      };
    }),

  // ── Investor Name ──────────────────────────────────────────────────
  updateInvestorName: (invId, newName, user = 'j@vegarei.com') =>
    set((state) => {
      const investor = state.investors[invId];
      if (!investor) return state;

      const oldName = investor.name;
      const now = new Date().toISOString();

      // Update all positions for this investor
      const updatedPositions = state.positions.map((p) =>
        p.invId === invId ? { ...p, name: newName } : p,
      );

      // Rebuild investors from updated positions
      const newInvestors = buildInvestors(updatedPositions);

      // Re-apply contact overrides
      const overrides = state.contactOverrides || {};
      Object.entries(overrides).forEach(([id, fields]) => {
        if (newInvestors[id]) Object.assign(newInvestors[id], fields);
      });

      // Write back to Investors sheet (name column B)
      updateInvestorField(invId, 'name', newName).catch((err) =>
        console.error('Name sheet write-back failed:', err),
      );

      // Write back to each Position sheet row (name column B)
      investor.positions.forEach((p) => {
        updatePositionField(p.id, 'name', newName).catch((err) =>
          console.error(`Position name write-back failed for ${p.id}:`, err),
        );
      });

      // Auto-add as primary signer in contacts if not already present
      const existingContacts = newInvestors[invId]?.contacts || overrides[invId]?.contacts || [];
      const alreadyHasSigner = existingContacts.some(
        (c) => c.name === newName || c.role === 'Primary Signer',
      );

      let updatedContacts = existingContacts;
      if (!alreadyHasSigner && newName.trim()) {
        updatedContacts = [
          { name: newName, role: 'Primary Signer', phone: investor.phone || '', email: investor.email || '' },
          ...existingContacts,
        ];
        newInvestors[invId].contacts = updatedContacts;

        // Persist contacts override
        const updatedOverrides = {
          ...overrides,
          [invId]: { ...(overrides[invId] || {}), contacts: updatedContacts },
        };

        updateInvestorField(invId, 'contacts_json', JSON.stringify(updatedContacts)).catch((err) =>
          console.error('Contacts sheet write-back failed:', err),
        );

        const auditEntry = {
          id: `AL-${Date.now()}-name`,
          invId,
          action: 'Name Changed',
          detail: `Name: "${oldName}" → "${newName}" — added as Primary Signer`,
          user,
          timestamp: now,
        };

        appendAuditLog({
          id: auditEntry.id,
          recordType: 'investor',
          recordId: invId,
          action: auditEntry.action,
          notes: auditEntry.detail,
          user,
          timestamp: now,
        }).catch((err) => console.error('Audit log write-back failed:', err));

        return {
          positions: updatedPositions,
          investors: newInvestors,
          contactOverrides: updatedOverrides,
          auditLog: [...state.auditLog, auditEntry],
        };
      }

      const auditEntry = {
        id: `AL-${Date.now()}-name`,
        invId,
        action: 'Name Changed',
        detail: `Name: "${oldName}" → "${newName}"`,
        user,
        timestamp: now,
      };

      appendAuditLog({
        id: auditEntry.id,
        recordType: 'investor',
        recordId: invId,
        action: auditEntry.action,
        notes: auditEntry.detail,
        user,
        timestamp: now,
      }).catch((err) => console.error('Audit log write-back failed:', err));

      return {
        positions: updatedPositions,
        investors: newInvestors,
        auditLog: [...state.auditLog, auditEntry],
      };
    }),

  // ── Position Signed / Funded Dates ─────────────────────────────────
  updatePositionDates: (positionId, updates, user = 'System') => {
    const state = get();
    const pos = state.positions.find((p) => p.id === positionId);
    if (!pos) return;

    const now = new Date().toISOString();
    const auditEntries = [];

    // Build updated position
    const posUpdates = {};
    const pipelineUpdates = {};

    if ('signed' in updates) {
      const oldVal = pos.signed || '';
      posUpdates.signed = updates.signed;
      pipelineUpdates.signedByLpDate = updates.signed;
      if (oldVal !== updates.signed) {
        auditEntries.push({
          id: `AL-${Date.now()}-signed`,
          invId: pos.invId,
          action: 'Signed Date Updated',
          detail: `${pos.fund} ${pos.entity || pos.name}: signed "${oldVal || '(empty)'}" → "${updates.signed || '(empty)'}"`,
          user,
          timestamp: now,
        });
      }
    }

    if ('funded' in updates) {
      const oldVal = pos.funded || '';
      posUpdates.funded = updates.funded;
      pipelineUpdates.fundedDate = updates.funded;
      if (oldVal !== updates.funded) {
        auditEntries.push({
          id: `AL-${Date.now()}-funded`,
          invId: pos.invId,
          action: 'Funded Date Updated',
          detail: `${pos.fund} ${pos.entity || pos.name}: funded "${oldVal || '(empty)'}" → "${updates.funded || '(empty)'}"`,
          user,
          timestamp: now,
        });
      }
    }

    const updatedPipeline = { ...(pos.pipeline || {}), ...pipelineUpdates };
    const updatedPositions = state.positions.map((p) =>
      p.id === positionId ? { ...p, ...posUpdates, pipeline: updatedPipeline } : p,
    );
    const newInvestors = buildInvestors(updatedPositions);

    // Re-apply contact overrides
    const overrides = state.contactOverrides || {};
    Object.entries(overrides).forEach(([id, fields]) => {
      if (newInvestors[id]) Object.assign(newInvestors[id], fields);
    });

    set({
      positions: updatedPositions,
      investors: newInvestors,
      auditLog: [...state.auditLog, ...auditEntries],
    });

    // Write to Positions sheet (signed_date / funded_date columns)
    if ('signed' in updates) {
      updatePositionField(positionId, 'signed_date', updates.signed)
        .catch((err) => console.error('Position signed_date write-back failed:', err));
    }
    if ('funded' in updates) {
      updatePositionField(positionId, 'funded_date', updates.funded)
        .catch((err) => console.error('Position funded_date write-back failed:', err));
    }

    // Write to Subscriptions sheet (dates_json)
    if (pos.subscriptionId) {
      updateSubscriptionField(pos.subscriptionId, 'dates_json', JSON.stringify(updatedPipeline))
        .catch((err) => console.error('Subscription dates write-back failed:', err));
      updateSubscriptionField(pos.subscriptionId, 'updated_at', now)
        .catch((err) => console.error('Subscription updated_at write-back failed:', err));
    }
    auditEntries.forEach((entry) => {
      appendAuditLog({
        id: entry.id,
        recordType: 'subscription',
        recordId: pos.subscriptionId || positionId,
        action: entry.action,
        notes: entry.detail,
        user,
        timestamp: now,
      }).catch((err) => console.error('Audit log write-back failed:', err));
    });
  },

  // ── Investor Contacts / Owners ──────────────────────────────────────
  updateInvestorContacts: (invId, contacts, user = 'j@vegarei.com') =>
    set((state) => {
      const investor = state.investors[invId];
      if (!investor) return state;

      const now = new Date().toISOString();

      // Write JSON to Investors sheet column K
      updateInvestorField(invId, 'contacts_json', JSON.stringify(contacts)).catch((err) =>
        console.error('Contacts sheet write-back failed:', err),
      );

      // Persist in contactOverrides so contacts survive rehydration
      const existingOverrides = state.contactOverrides[invId] || {};

      const auditEntry = {
        id: `AL-${Date.now()}-contacts`,
        invId,
        action: 'Contacts Updated',
        detail: `Contacts updated (${contacts.length} contact${contacts.length !== 1 ? 's' : ''})`,
        user,
        timestamp: now,
      };

      appendAuditLog({
        id: auditEntry.id,
        recordType: 'investor',
        recordId: invId,
        action: auditEntry.action,
        notes: auditEntry.detail,
        user,
        timestamp: now,
      }).catch((err) => console.error('Audit log write-back failed:', err));

      return {
        investors: {
          ...state.investors,
          [invId]: { ...investor, contacts },
        },
        contactOverrides: {
          ...state.contactOverrides,
          [invId]: { ...existingOverrides, contacts },
        },
        auditLog: [...state.auditLog, auditEntry],
      };
    }),
    }),
    {
      name: 'vega-investor-store',
      version: 3, // Bumped for route-aware pipeline stages
      partialize: (state) => ({
        positions: state.positions,
        notes: state.notes,
        auditLog: state.auditLog,
        activityFeed: state.activityFeed,
        subDocPipeline: state.subDocPipeline,
        contactOverrides: state.contactOverrides,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Migrate persisted positions to new stage names
          state.positions = state.positions.map(migratePosition);
          const investors = buildInvestors(state.positions);
          // Re-apply contact overrides so edits survive rehydration
          const overrides = state.contactOverrides || {};
          Object.entries(overrides).forEach(([invId, fields]) => {
            if (investors[invId]) {
              Object.assign(investors[invId], fields);
            }
          });
          state.investors = investors;
        }
      },
    },
  ),
);

export default useInvestorStore;
