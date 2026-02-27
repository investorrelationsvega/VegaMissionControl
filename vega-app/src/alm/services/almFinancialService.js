// ═══════════════════════════════════════════════
// ALM — Financial Data Service (Multi-Period)
// Reads report card data from the ALM_Financial
// tab in the Vega Google Sheet.
// Falls back to static seed data if the sheet
// tab doesn't exist or the user isn't signed in.
//
// Returns: { revenueLabels, expenseLabels, periods[], lastSynced, source }
// ═══════════════════════════════════════════════

import { readRange } from '../../services/sheetsService';
import useGoogleStore from '../../stores/googleStore';
import STATIC_DATA from '../data/reportCardData';

const TAB = 'ALM_Financial';

/**
 * Fetch all report card periods.
 *
 * Returns the multi-period shape:
 *   { revenueLabels, expenseLabels, periods[], lastSynced, source }
 *
 * Sheet layout (written by the Google Apps Script):
 *   A1: "last_synced"    B1: "data_json"
 *   A2: ISO timestamp    B2: full JSON string
 *
 * The JSON in B2 may be:
 *   - Multi-period: { periods: [...] }
 *   - Single-period (legacy): { month, year, homes[] }
 *
 * Single-period sheet data is merged into the static periods
 * so historical seed data is always available.
 *
 * source: 'live' | 'static' — tells the UI which data is showing
 * lastSynced: ISO timestamp of last Apps Script sync (null for static)
 */
export async function fetchReportCardData() {
  const token = useGoogleStore.getState().accessToken;
  if (!token) return { ...STATIC_DATA, lastSynced: null, source: 'static' };

  try {
    const rows = await readRange(`${TAB}!A1:B2`);

    if (!rows || rows.length < 2 || !rows[1]?.[1]) {
      return { ...STATIC_DATA, lastSynced: null, source: 'static' };
    }

    const lastSynced = rows[1]?.[0] ? String(rows[1][0]) : null;
    const raw = typeof rows[1][1] === 'string' ? rows[1][1] : String(rows[1][1]);
    const sheetData = JSON.parse(raw);

    // ── Multi-period format from sheet ──
    if (sheetData.periods && Array.isArray(sheetData.periods) && sheetData.periods.length > 0) {
      if (!sheetData.revenueLabels) sheetData.revenueLabels = STATIC_DATA.revenueLabels;
      if (!sheetData.expenseLabels) sheetData.expenseLabels = STATIC_DATA.expenseLabels;
      return { ...sheetData, lastSynced, source: 'live' };
    }

    // ── Single-period (legacy) format from sheet ──
    // Merge the live month into the static historical periods
    if (sheetData.homes && Array.isArray(sheetData.homes) && sheetData.homes.length > 0 && sheetData.month) {
      const merged = {
        revenueLabels: STATIC_DATA.revenueLabels,
        expenseLabels: STATIC_DATA.expenseLabels,
        periods: STATIC_DATA.periods.map((p) => ({ ...p })),
      };
      const liveEntry = { month: sheetData.month, year: sheetData.year, homes: sheetData.homes };
      const idx = merged.periods.findIndex((p) => p.month === sheetData.month && p.year === sheetData.year);
      if (idx >= 0) {
        merged.periods[idx] = liveEntry;
      } else {
        merged.periods.push(liveEntry);
      }
      return { ...merged, lastSynced, source: 'live' };
    }

    console.warn('[ALM Financial] Sheet data has unexpected shape, using static data');
    return { ...STATIC_DATA, lastSynced: null, source: 'static' };
  } catch (err) {
    console.warn('[ALM Financial] Sheet read failed, using static data:', err.message);
    return { ...STATIC_DATA, lastSynced: null, source: 'static' };
  }
}
