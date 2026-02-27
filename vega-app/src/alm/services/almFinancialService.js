// ═══════════════════════════════════════════════
// ALM — Financial Data Service
// Reads monthly report card data from the
// ALM_Financial tab in the Vega Google Sheet.
// Falls back to static seed data if the sheet
// tab doesn't exist or the user isn't signed in.
// ═══════════════════════════════════════════════

import { readRange } from '../../services/sheetsService';
import useGoogleStore from '../../stores/googleStore';
import STATIC_DATA from '../data/reportCardData';

const TAB = 'ALM_Financial';

/**
 * Fetch the latest report card data.
 *
 * Sheet layout (written by the Google Apps Script):
 *   A1: "last_synced"    B1: "data_json"
 *   A2: ISO timestamp    B2: full JSON string (same shape as REPORT_CARD_DATA)
 *
 * Returns the same shape as reportCardData.js:
 *   { month, year, revenueLabels, expenseLabels, homes[] }
 */
export async function fetchReportCardData() {
  const token = useGoogleStore.getState().accessToken;
  if (!token) return STATIC_DATA;

  try {
    const rows = await readRange(`${TAB}!A1:B2`);

    // Check we got a data row with a JSON value
    if (!rows || rows.length < 2 || !rows[1]?.[1]) {
      return STATIC_DATA;
    }

    const raw = typeof rows[1][1] === 'string' ? rows[1][1] : String(rows[1][1]);
    const data = JSON.parse(raw);

    // Basic shape validation
    if (!data.homes || !Array.isArray(data.homes) || data.homes.length === 0) {
      console.warn('[ALM Financial] Sheet data missing homes array, using static data');
      return STATIC_DATA;
    }

    // Ensure labels exist (fall back to static defaults)
    if (!data.revenueLabels) data.revenueLabels = STATIC_DATA.revenueLabels;
    if (!data.expenseLabels) data.expenseLabels = STATIC_DATA.expenseLabels;

    return data;
  } catch (err) {
    // Common case: tab doesn't exist yet → not an error
    console.warn('[ALM Financial] Sheet read failed, using static data:', err.message);
    return STATIC_DATA;
  }
}
