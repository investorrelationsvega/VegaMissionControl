// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Investor Store
// Builds investor records from positions, manages
// notes and audit log
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { positions as seedPositions, activityFeed as seedActivityFeed } from '../data/seedData';
import { updateInvestorField, updatePositionField, appendAuditLog } from '../services/sheetsService';
import useBlueskyStore from './blueskyStore';
import useUiStore from './uiStore';

// Pipeline stage order for display and validation
export const PIPELINE_STAGES = [
  'New',
  'Pending',
  'Webform Sent',
  'Webform Complete',
  'DocuSign Out',
  'Fully Executed',
  'GP Countersign',
  'Funded',
  'Accepted',
];

export const PIPELINE_STAGE_LABELS = {
  'New': 'New',
  'Pending': 'Pending',
  'Webform Sent': 'Webform Sent',
  'Webform Complete': 'Webform Done',
  'DocuSign Out': 'DocuSign Out',
  'Fully Executed': 'Executed',
  'GP Countersign': 'GP Sign',
  'Funded': 'Funded',
  'Accepted': 'Accepted',
  'Declined': 'Declined',
};

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
      if (!inv.pipeline || PIPELINE_STAGES.indexOf(p.pipeline.stage) < PIPELINE_STAGES.indexOf(inv.pipeline.stage)) {
        inv.pipeline = p.pipeline;
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

  return map;
}

const initialInvestors = buildInvestors(seedPositions);

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
const useInvestorStore = create(
  persist(
    (set, get) => ({
  // State
  investors: initialInvestors,
  positions: seedPositions,
  activityFeed: seedActivityFeed || [],
  sheetsLoaded: false, // Track if we've loaded from Google Sheets
  notes: {},       // { [invId]: [ { id, text, author, date } ] }
  auditLog: [],    // [ { id, invId, action, detail, user, timestamp } ]
  contactOverrides: {}, // { [invId]: { phone, email, advisor, custodian, state } } — survives rehydration

  // ── Google Sheets Sync ────────────────────────────────────────────────
  loadFromSheets: (sheetPositions, investorLookup) => {
    set((state) => {
      const investors = buildInvestors(sheetPositions);
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
        positions: sheetPositions,
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

    const oldStage = pos.pipeline?.stage || 'New';
    const now = new Date().toISOString();
    const dateKey = {
      'Pending': 'pendingDate',
      'Webform Sent': 'webformSentDate',
      'Webform Complete': 'webformCompleteDate',
      'DocuSign Out': 'docusignSentDate',
      'Fully Executed': 'fullyExecutedDate',
      'GP Countersign': 'gpCountersignDate',
      'Funded': 'fundedDate',
      'Accepted': 'acceptedDate',
    }[newStage];

    const updatedPipeline = {
      ...(pos.pipeline || {}),
      stage: newStage,
      ...(dateKey ? { [dateKey]: now } : {}),
    };

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
      message: `${pos.name} moved from ${oldStage} to ${newStage}`,
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
          detail: `${pos.fund} ${pos.entity || pos.name}: ${oldStage} → ${newStage}`,
          user,
          timestamp: now,
        },
      ],
    });

    // Bluesky filing trigger: out-of-state investor reaches Webform Complete
    if (newStage === 'Webform Complete' && pos.state && pos.state !== 'UT') {
      const bluesky = useBlueskyStore.getState();
      if (!bluesky.hasFiling(pos.invId)) {
        const updatedPos = { ...pos, pipeline: updatedPipeline };
        const filing = bluesky.addFiling(updatedPos);
        if (filing) {
          useUiStore.getState().addNotification({
            type: 'bluesky',
            title: `Blue Sky Filing Required`,
            detail: `${pos.name} (${pos.state}) — ${pos.fund}. File within 30 days.`,
            link: '/pe/compliance',
            filingId: filing.id,
          });
        }
      }
    }
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
      (inv) => inv.pipeline && !['Accepted', 'Declined'].includes(inv.pipeline.stage) && inv.pipeline.stage !== 'New',
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

      // Auto-add investor as primary signer in contacts if not already present
      const existingContacts = newInvestors[invId]?.contacts || overrides[invId]?.contacts || [];
      const hasPrimarySigner = existingContacts.some(
        (c) => c.name === investor.name || c.role === 'Primary Signer',
      );

      if (!hasPrimarySigner && investor.name?.trim()) {
        const updatedContacts = [
          { name: investor.name, role: 'Primary Signer', phone: investor.phone || '', email: investor.email || '' },
          ...existingContacts,
        ];
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
      version: 2, // Bumped for Google Sheets integration
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
