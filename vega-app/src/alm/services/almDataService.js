// ═══════════════════════════════════════════════
// ALM — Data Service
// Reads the Daily Log sheet via Google's gviz JSON
// endpoint. No OAuth required while the sheet is
// shared as view-only-by-link.
//
// Parser looks up fields by column header NAME
// (not position), so the dashboard tolerates column
// reordering, renaming-that-keeps-the-header, or
// additions. If the Apps Script drops a column,
// the corresponding field becomes null/0 without
// crashing. If it adds a column we don't know
// about, it's ignored until we surface it.
// ═══════════════════════════════════════════════

import { canonicalizeFacility } from '../config/facilities';

const SHEET_ID = '18GTugnLQOoHlWnj61M9hLNOJQfnlQxRppZeyQ6JVQYc';
const SHEET_NAME = 'Daily Log';

const GVIZ_URL =
  `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq` +
  `?tqx=out:json&sheet=${encodeURIComponent(SHEET_NAME)}`;

// gviz wraps JSON in `google.visualization.Query.setResponse(...)`.
// Strip the wrapper and parse.
function parseGvizPayload(text) {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('Unexpected gviz response');
  return JSON.parse(text.slice(start, end + 1));
}

// gviz encodes dates as "Date(y, m, d, h, m, s)" with month zero-indexed.
function parseGvizDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  const match = /Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+),(\d+))?\)/.exec(String(raw));
  if (!match) return null;
  const [, y, m, d, h = 0, mi = 0, s = 0] = match;
  return new Date(+y, +m, +d, +h, +mi, +s);
}

const toYesNo = (v) => {
  if (v == null) return null;
  const s = String(v).trim().toLowerCase();
  if (s === 'yes' || s === 'true' || s === 'y') return true;
  if (s === 'no' || s === 'false' || s === 'n') return false;
  return null;
};

const toNumber = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

const toText = (v) => (v == null ? '' : String(v).trim());

// Build a Map<headerName, columnIndex> from gviz `table.cols`.
// gviz populates col.label from the sheet's first row.
function buildHeaderIndex(cols) {
  const idx = new Map();
  (cols || []).forEach((col, i) => {
    const name = String(col?.label || '').trim();
    if (name) idx.set(name, i);
  });
  return idx;
}

function makeRowMapper(headers) {
  // Lookup helper: return the raw cell value for a given header name,
  // or null if the column isn't in the sheet.
  const cellFor = (cells, name) => {
    const i = headers.get(name);
    if (i === undefined) return null;
    return cells[i]?.v ?? null;
  };

  return function mapRow(cells) {
    const get = (name) => cellFor(cells, name);

    // Discharges — per-discharge (cause, other) pairs.
    const dischargeDetail = [];
    for (let i = 1; i <= 20; i++) {
      const cause = toText(get(`Discharge ${i} Cause`));
      const other = toText(get(`Discharge ${i} Other`));
      if (cause) dischargeDetail.push({ cause, other });
    }

    // Incidents — per-incident "Report Filed?" yes/no.
    const incidentDetail = [];
    for (let i = 1; i <= 20; i++) {
      const reportFiled = toText(get(`Incident ${i} Report Filed?`));
      if (reportFiled) incidentDetail.push({ reportFiled });
    }

    // Changes of condition — per-change "Log Filed?" yes/no.
    const changeDetail = [];
    for (let i = 1; i <= 20; i++) {
      const logFiled = toText(get(`Change ${i} Log Filed?`));
      if (logFiled) changeDetail.push({ logFiled });
    }

    return {
      timestamp: parseGvizDate(get('Timestamp')),
      facility: canonicalizeFacility(toText(get('Facility'))),
      date: parseGvizDate(get('Date')),
      census: toNumber(get('Census Count')),
      overCapacityExplanation: toText(get('Over-Capacity Explanation')),
      admissions: toNumber(get('Admissions')),
      referralsFromAdmissions: toNumber(get('Referrals from Admissions')),
      discharges: toNumber(get('Discharges')),
      dischargeDetail,
      dischargeNotes: toText(get('Discharge Notes (overflow)')),
      inquiryCalls: toNumber(get('Inbound Call Inquiries')),
      tours: toNumber(get('Tour Inquiries')),
      staffingStatus: toText(get('Staffing Status')),
      staffingAssistance: toText(get('Staffing Assistance Needed')),
      incidentsToday: toYesNo(get('Incidents Today?')),
      incidentCount: toNumber(get('Incident Count')),
      incidentDetail,
      incidentNotes: toText(get('Incident Notes (overflow)')),
      changeOfConditionToday: toYesNo(get('Change of Condition Today?')),
      changeOfConditionCount: toNumber(get('Change of Condition Count')),
      changeDetail,
      changeNotes: toText(get('Change Notes (overflow)')),
    };
  };
}

export async function fetchOperationsRows() {
  const res = await fetch(GVIZ_URL);
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status})`);
  const text = await res.text();
  const payload = parseGvizPayload(text);
  const headers = buildHeaderIndex(payload.table?.cols);
  const mapRow = makeRowMapper(headers);
  const rows = (payload.table?.rows || [])
    .map((r) => mapRow(r.c || []))
    .filter((r) => r.facility && r.date);
  // Newest first
  rows.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
  return rows;
}

export function uniqueFacilities(rows) {
  const set = new Set();
  rows.forEach((r) => r.facility && set.add(r.facility));
  return Array.from(set).sort();
}

export function latestPerFacility(rows) {
  const map = new Map();
  rows.forEach((r) => {
    const existing = map.get(r.facility);
    if (!existing || (r.date && existing.date && r.date > existing.date)) {
      map.set(r.facility, r);
    }
  });
  return Array.from(map.values());
}
