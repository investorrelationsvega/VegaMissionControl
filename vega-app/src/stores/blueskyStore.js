// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Bluesky Filing Store
// Tracks Blue Sky regulatory filings for
// out-of-state investors
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useBlueskyStore = create(
  persist(
    (set, get) => ({
      // State
      filings: [],

      // ── Add Filing ─────────────────────────────────────────────────────────────
      // Creates a new Bluesky filing with 30-day deadline from webformDoneDate
      addFiling: (position) => {
        if (get().hasFiling(position.invId)) return; // one per investor

        const triggerDate = position.pipeline?.webformDoneDate
          ? new Date(position.pipeline.webformDoneDate)
          : new Date();

        const deadlineDate = new Date(triggerDate);
        deadlineDate.setDate(deadlineDate.getDate() + 30);

        const filing = {
          id: `BF-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          invId: position.invId,
          name: position.name,
          state: position.state,
          fund: position.fund,
          triggerDate: triggerDate.toISOString(),
          deadlineDate: deadlineDate.toISOString(),
          status: 'Pending',
          filedBy: null,
          filedDate: null,
          notes: '',
          attachedEmails: [],
          auditLog: [
            {
              id: `BA-${Date.now()}`,
              action: 'Filing Created',
              user: 'System',
              timestamp: new Date().toISOString(),
              detail: `Blue Sky filing required for ${position.name} (${position.state}) — ${position.fund}`,
              notes: '',
            },
          ],
        };

        set((state) => ({ filings: [...state.filings, filing] }));
        return filing;
      },

      // ── Resolve Filing ─────────────────────────────────────────────────────────
      resolveFiling: (id, email, notes, attachedEmails = []) =>
        set((state) => ({
          filings: state.filings.map((f) =>
            f.id === id
              ? {
                  ...f,
                  status: 'Filed',
                  filedBy: email,
                  filedDate: new Date().toISOString(),
                  notes,
                  attachedEmails,
                  auditLog: [
                    ...f.auditLog,
                    {
                      id: `BA-${Date.now()}`,
                      action: 'Filing Resolved',
                      user: email,
                      timestamp: new Date().toISOString(),
                      detail: `Marked as filed${attachedEmails.length > 0 ? ` with ${attachedEmails.length} email${attachedEmails.length > 1 ? 's' : ''} attached` : ''}`,
                      notes,
                    },
                  ],
                }
              : f,
          ),
        })),

      // ── Duplicate Prevention ───────────────────────────────────────────────────
      hasFiling: (invId) => get().filings.some((f) => f.invId === invId),

      // ── Filtered Getters ───────────────────────────────────────────────────────
      getPending: () => get().filings.filter((f) => f.status === 'Pending'),
      getFiled: () => get().filings.filter((f) => f.status === 'Filed'),

      // ── Get Filing by ID ──────────────────────────────────────────────────────
      getFiling: (id) => get().filings.find((f) => f.id === id) || null,

      // ── Get Filing by Investor ─────────────────────────────────────────────────
      getFilingByInvestor: (invId) => get().filings.find((f) => f.invId === invId) || null,
    }),
    {
      name: 'vega-bluesky-store',
      version: 1,
    },
  ),
);

export default useBlueskyStore;
