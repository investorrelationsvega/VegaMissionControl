// ═══════════════════════════════════════════════
// ALM — Data Service
// Reads the public ALF Daily Operations sheet via
// Google's gviz JSON endpoint. No OAuth required
// while the sheet is shared as view-only-by-link.
// ═══════════════════════════════════════════════

const SHEET_ID = '18GTugnLQOoHlWnj61M9hLNOJQfnlQxRppZeyQ6JVQYc';
const SHEET_NAME = 'ALF Daily Operations Data';

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

// Map the gviz row (array of cells) to a normalized operations record.
// Column order is fixed by the Form, so positional access is safe.
function mapRow(cells) {
  const c = (i) => (cells[i] ? cells[i].v : null);

  const referralBlock = (base) => {
    const source = toText(c(base));
    const other = toText(c(base + 1));
    const comments = toText(c(base + 2));
    if (!source && !other && !comments) return null;
    return { source, other, comments };
  };

  const referrals = [referralBlock(13), referralBlock(16), referralBlock(19)].filter(Boolean);

  return {
    timestamp: parseGvizDate(c(0)),
    facility: toText(c(1)),
    date: parseGvizDate(c(2)),
    census: toNumber(c(3)),
    admissions: toNumber(c(4)),
    discharges: toNumber(c(5)),
    hospitalizations: toNumber(c(6)),
    vacantBeds: toYesNo(c(7)),
    outboundContacts: toNumber(c(8)),
    whoReachedOut: toText(c(9)),
    followUps: toNumber(c(10)),
    whoFollowedUp: toText(c(11)),
    referralToday: toYesNo(c(12)),
    referrals,
    inquiryCalls: toNumber(c(22)),
    walkIns: toNumber(c(23)),
    tours: toNumber(c(24)),
    openShifts: toNumber(c(25)),
    staffingStatus: toText(c(26)),
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
