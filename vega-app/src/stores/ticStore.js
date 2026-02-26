// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — TIC Property Store
// Manages TIC (Tenant-in-Common) property ownership
// structures, distribution tracking, and Fund II
// property-level income
// ═══════════════════════════════════════════════

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { updateTicField, appendAuditLog } from '../services/sheetsService';
import { reliableWrite } from '../services/sheetsWriteQueue';

// ---------------------------------------------------------------------------
// Seed Data — TIC ownership records from Company Dashboard CSV
// Each record = one entity's ownership stake in one property
// ---------------------------------------------------------------------------

const seedTicProperties = [
  // ── Cedar ───────────────────────────────────────────────────────────────
  { id: 'TI01', entity: 'Phillip Chipping', property: 'Cedar', ownership: 8.88, ticFunds: 186078, isFundII: false, distributions: { 'Dec 2025': 709.57 } },
  { id: 'TI02', entity: 'Heritage Storage', property: 'Cedar', ownership: 15.01, ticFunds: 296167, isFundII: false, distributions: { 'Dec 2025': 1199.40 } },
  { id: 'TI03', entity: 'Summit Home Solutions', property: 'Cedar', ownership: 5.24, ticFunds: 65000, isFundII: false, distributions: { 'Dec 2025': 418.71 } },
  { id: 'TI04', entity: 'Utah Bankruptcy Inc.', property: 'Cedar', ownership: 5.24, ticFunds: 65000, isFundII: false, distributions: { 'Dec 2025': 418.71 } },
  { id: 'TI05', entity: 'Fund II', property: 'Cedar', ownership: 65.63, ticFunds: 0, isFundII: true, distributions: { 'Dec 2025': 5244.28 } },

  // ── Riverton ────────────────────────────────────────────────────────────
  { id: 'TI06', entity: 'Fund II', property: 'Riverton', ownership: 86.50, ticFunds: 0, isFundII: true, distributions: { 'Dec 2025': 4284.89 } },
  { id: 'TI07', entity: 'Summit Home Solutions', property: 'Riverton', ownership: 6.75, ticFunds: 104000, isFundII: false, distributions: { 'Dec 2025': 334.37 } },
  { id: 'TI08', entity: 'Utah Bankruptcy Inc.', property: 'Riverton', ownership: 6.75, ticFunds: 104000, isFundII: false, distributions: { 'Dec 2025': 334.37 } },

  // ── Elk Ridge ───────────────────────────────────────────────────────────
  { id: 'TI09', entity: 'Vega Elk Ridge AL LLC (Fund II)', property: 'Elk Ridge', ownership: 79.85, ticFunds: 0, isFundII: true, distributions: { 'Jan 2026': 9839.18 } },
  { id: 'TI10', entity: 'Heritage Storage LLC', property: 'Elk Ridge', ownership: 13.72, ticFunds: 225503, isFundII: false, distributions: { 'Jan 2026': 1690.59 } },
  { id: 'TI11', entity: 'Elk Ridge Personal Holdings LLC', property: 'Elk Ridge', ownership: 3.65, ticFunds: 60004, isFundII: false, distributions: { 'Jan 2026': 449.76 } },
  { id: 'TI12', entity: 'Phillip Chipping', property: 'Elk Ridge', ownership: 2.78, ticFunds: 45652, isFundII: false, distributions: { 'Jan 2026': 342.55 } },

  // ── Hearthstone ─────────────────────────────────────────────────────────
  { id: 'TI13', entity: 'Vega Hearthstone AL LLC (Fund II)', property: 'Hearthstone', ownership: 79.60, ticFunds: 0, isFundII: true, distributions: { 'Jan 2026': 14869.55 } },
  { id: 'TI14', entity: 'Phillip Chipping', property: 'Hearthstone', ownership: 16.73, ticFunds: 425225, isFundII: false, distributions: { 'Jan 2026': 3125.22 } },
  { id: 'TI15', entity: 'Hearthstone Personal Holdings LLC', property: 'Hearthstone', ownership: 3.67, ticFunds: 92791, isFundII: false, distributions: { 'Jan 2026': 685.57 } },

  // ── Sandy ───────────────────────────────────────────────────────────────
  { id: 'TI16', entity: 'Fund II', property: 'Sandy', ownership: 0, ticFunds: 0, isFundII: true, distributions: {} },
  { id: 'TI17', entity: 'Summit Home Solutions', property: 'Sandy', ownership: 0, ticFunds: 52000, isFundII: false, distributions: {} },
  { id: 'TI18', entity: 'Utah Bankruptcy Inc.', property: 'Sandy', ownership: 0, ticFunds: 52000, isFundII: false, distributions: {} },
  { id: 'TI19', entity: 'Cory', property: 'Sandy', ownership: 0, ticFunds: 54846, isFundII: false, distributions: {} },

  // ── Gilbert ────────────────────────────────────────────────────────────
  { id: 'TI20', entity: 'Vega Property Holdings LLC', property: 'Gilbert', ownership: 0, ticFunds: 111000, isFundII: false, distributions: {} },
  { id: 'TI21', entity: 'Vega Property Holdings LLC', property: 'Gilbert', ownership: 0, ticFunds: 115500, isFundII: false, distributions: {} },
  { id: 'TI22', entity: 'Fund II', property: 'Gilbert', ownership: 0, ticFunds: 0, isFundII: true, distributions: {} },

  // ── Riverton — VPH New Entry ──────────────────────────────────────────
  { id: 'TI23', entity: 'Vega Property Holdings LLC', property: 'Riverton', ownership: 0, ticFunds: 99000, isFundII: false, distributions: {} },
];

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const useTicStore = create(
  persist(
    (set, get) => ({
      // ── State ───────────────────────────────────────────────────────────────
      ticProperties: seedTicProperties,
      sheetsLoaded: false,

      // ── Google Sheets Sync ──────────────────────────────────────────────────
      loadFromSheets: (sheetRecords) => {
        if (!sheetRecords || sheetRecords.length === 0) return;
        set({ ticProperties: sheetRecords, sheetsLoaded: true });
      },

      // ── Getters ─────────────────────────────────────────────────────────────
      getAll: () => get().ticProperties,

      getById: (id) => get().ticProperties.find((t) => t.id === id) || null,

      getByProperty: (property) =>
        get().ticProperties.filter((t) => t.property === property),

      /** Get unique property list with computed summary data */
      getProperties: () => {
        const map = {};
        get().ticProperties.forEach((t) => {
          if (!map[t.property]) {
            map[t.property] = {
              name: t.property,
              owners: [],
              fundIIOwnership: 0,
              totalTicFunds: 0,
            };
          }
          map[t.property].owners.push(t);
          if (t.isFundII) {
            map[t.property].fundIIOwnership = t.ownership;
          } else {
            map[t.property].totalTicFunds += t.ticFunds;
          }
        });
        return Object.values(map);
      },

      /** Get only Fund II's TIC ownership positions */
      getFundIIPositions: () =>
        get().ticProperties.filter((t) => t.isFundII),

      /** Sum of Fund II distributions for a given period across all properties */
      getFundIITotalDistributions: (period) =>
        get()
          .ticProperties.filter((t) => t.isFundII)
          .reduce((sum, t) => sum + (t.distributions[period] || 0), 0),

      /** Get all unique distribution periods across all TIC records */
      getPeriods: () => {
        const periods = new Set();
        get().ticProperties.forEach((t) => {
          Object.keys(t.distributions || {}).forEach((p) => periods.add(p));
        });
        return [...periods].sort((a, b) => {
          // Sort chronologically: "Dec 2025" before "Jan 2026"
          const parse = (s) => {
            const [mon, yr] = s.split(' ');
            const months = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
            return new Date(Number(yr), months[mon] || 0);
          };
          return parse(a) - parse(b);
        });
      },

      // ── Mutations ───────────────────────────────────────────────────────────

      /** Update a monthly distribution amount for a TIC record */
      updateDistribution: (id, period, amount, user = 'j@vegarei.com') =>
        set((state) => {
          const updated = state.ticProperties.map((t) => {
            if (t.id !== id) return t;
            const newDist = { ...t.distributions, [period]: Number(amount) || 0 };
            return { ...t, distributions: newDist };
          });

          // Write back to sheet (with retry)
          const record = updated.find((t) => t.id === id);
          if (record) {
            reliableWrite(`TIC distribution ${record.entity} / ${record.property}`, () =>
              updateTicField(id, 'distributions_json', JSON.stringify(record.distributions)));

            reliableWrite(`Audit: TIC distribution updated`, () =>
              appendAuditLog({
                id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                recordType: 'TIC',
                recordId: id,
                action: 'Distribution Updated',
                notes: `${record.entity} / ${record.property}: ${period} = $${Number(amount).toLocaleString()}`,
                user,
                timestamp: new Date().toISOString(),
              }));
          }

          return { ticProperties: updated };
        }),

      /** Add a new TIC ownership record */
      addRecord: (record, user = 'j@vegarei.com') =>
        set((state) => {
          const newRecord = {
            ...record,
            id: `TI${String(state.ticProperties.length + 1).padStart(2, '0')}`,
            distributions: record.distributions || {},
          };

          reliableWrite(`Audit: TIC record created`, () =>
            appendAuditLog({
              id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              recordType: 'TIC',
              recordId: newRecord.id,
              action: 'Created',
              notes: `TIC record created: ${newRecord.entity} / ${newRecord.property} (${newRecord.ownership}%)`,
              user,
              timestamp: new Date().toISOString(),
            }));

          return { ticProperties: [...state.ticProperties, newRecord] };
        }),

      /** Update a TIC record's ownership/entity/funds fields */
      updateRecord: (id, updates, user = 'j@vegarei.com') =>
        set((state) => {
          // Write back changed fields to sheet
          const fieldMap = {
            entity: 'entity',
            property: 'property',
            ownership: 'ownership_pct',
            ticFunds: 'tic_funds',
            isFundII: 'is_fund_ii',
          };
          Object.entries(updates).forEach(([k, v]) => {
            const sheetField = fieldMap[k];
            if (sheetField) {
              reliableWrite(`TIC ${id} ${k}`, () =>
                updateTicField(id, sheetField, v));
            }
          });

          const updated = state.ticProperties.map((t) => {
            if (t.id !== id) return t;
            const changes = Object.entries(updates)
              .filter(([k, v]) => t[k] !== v)
              .map(([k, v]) => `${k}: ${t[k] || '(empty)'} → ${v}`)
              .join('; ');

            reliableWrite(`Audit: TIC ${id} updated`, () =>
              appendAuditLog({
                id: `AUD-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                recordType: 'TIC',
                recordId: id,
                action: 'Updated',
                notes: changes || 'TIC record updated',
                user,
                timestamp: new Date().toISOString(),
              }));

            return { ...t, ...updates };
          });

          return { ticProperties: updated };
        }),

      /** Remove a TIC ownership record */
      removeRecord: (id) =>
        set((state) => ({
          ticProperties: state.ticProperties.filter((t) => t.id !== id),
        })),
    }),
    {
      name: 'vega-tic-store',
      version: 2,
    },
  ),
);

export default useTicStore;
