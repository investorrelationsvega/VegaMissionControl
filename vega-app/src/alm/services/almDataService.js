// ═══════════════════════════════════════════════
// ALM — Data Service
// Reads the Daily Log sheet via Google's gviz JSON
// endpoint. No OAuth required while the sheet is
// shared as view-only-by-link.
//
// Column layout (0-indexed) mirrors the Apps Script
// buildHeaders() output — 59 columns total:
//   0   Timestamp
//   1   Facility
//   2   Date
//   3   Census Count
//   4   Over-Capacity Explanation
//   5   Admissions
//   6   Referrals from Admissions
//   7   Discharges (count)
//   8–27 Discharge 1–10 (Cause, Other × 10)
//  28   Discharge Notes (overflow)
//  29   Inbound Call Inquiries
//  30   Tour Inquiries
//  31   Staffing Status
//  32   Staffing Assistance Needed
//  33   Incidents Today? (Yes/No)
//  34   Incident Count
//  35–44 Incident 1–10 Report Filed? (Yes/No)
//  45   Incident Notes (overflow)
//  46   Change of Condition Today? (Yes/No)
//  47   Change of Condition Count
//  48–57 Change 1–10 Log Filed? (Yes/No)
//  58   Change Notes (overflow)
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

function mapRow(cells) {
  const c = (i) => (cells[i] ? cells[i].v : null);

  // Discharges: up to 10 (Cause, Other) pairs starting at col 8
  const dischargeDetail = [];
  for (let i = 0; i < 10; i++) {
    const base = 8 + i * 2;
    const cause = toText(c(base));
    const other = toText(c(base + 1));
    if (cause) dischargeDetail.push({ cause, other });
  }

  // Incidents: up to 10 "Report Filed?" yes/no starting at col 35
  const incidentDetail = [];
  for (let i = 0; i < 10; i++) {
    const reportFiled = toText(c(35 + i));
    if (reportFiled) incidentDetail.push({ reportFiled });
  }

  // Changes of condition: up to 10 "Log Filed?" yes/no starting at col 48
  const changeDetail = [];
  for (let i = 0; i < 10; i++) {
    const logFiled = toText(c(48 + i));
    if (logFiled) changeDetail.push({ logFiled });
  }

  return {
    timestamp: parseGvizDate(c(0)),
    facility: canonicalizeFacility(toText(c(1))),
    date: parseGvizDate(c(2)),
    census: toNumber(c(3)),
    overCapacityExplanation: toText(c(4)),
    admissions: toNumber(c(5)),
    referralsFromAdmissions: toNumber(c(6)),
    discharges: toNumber(c(7)),
    dischargeDetail,
    dischargeNotes: toText(c(28)),
    inquiryCalls: toNumber(c(29)),
    tours: toNumber(c(30)),
    staffingStatus: toText(c(31)),
    staffingAssistance: toText(c(32)),
    incidentsToday: toYesNo(c(33)),
    incidentCount: toNumber(c(34)),
    incidentDetail,
    incidentNotes: toText(c(45)),
    changeOfConditionToday: toYesNo(c(46)),
    changeOfConditionCount: toNumber(c(47)),
    changeDetail,
    changeNotes: toText(c(58)),
  };
}

export async function fetchOperationsRows() {
  const res = await fetch(GVIZ_URL);
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status})`);
  const text = await res.text();
  const payload = parseGvizPayload(text);
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
