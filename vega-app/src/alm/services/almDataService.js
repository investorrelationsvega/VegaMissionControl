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
//
// Layout (0-indexed):
//   0  Timestamp         1  Facility         2  Date
//   3  Census            4  Over-Capacity    5  Admissions
//   6  Discharges        7  Hospitalizations 8  Vacant Beds?
//   9  Outbound Contacts
//  10–39  Outreach 1–10 (Name/Phone/Email × 10)
//  40  Follow-ups Today
//  41–70  Follow-up 1–10 (Name/Phone/Email × 10)
//  71  Referral Today?   72  Referrals from Admissions
//  73–99  Referral 1–3 (Source, Other, Referrer N/P/E, Resident N/P/E, Comments × 3)
// 100  Inquiry Calls    101  Walk-ins         102  Tours
// 103  Open Shifts      104  Staffing Status
function mapRow(cells) {
  const c = (i) => (cells[i] ? cells[i].v : null);

  const outreachContacts = [];
  for (let i = 0; i < 10; i++) {
    const base = 10 + i * 3;
    const name = toText(c(base));
    const phone = toText(c(base + 1));
    const email = toText(c(base + 2));
    if (name || phone || email) outreachContacts.push({ name, phone, email });
  }

  const followUpContacts = [];
  for (let i = 0; i < 10; i++) {
    const base = 41 + i * 3;
    const name = toText(c(base));
    const phone = toText(c(base + 1));
    const email = toText(c(base + 2));
    if (name || phone || email) followUpContacts.push({ name, phone, email });
  }

  const referrals = [];
  for (let i = 0; i < 3; i++) {
    const base = 73 + i * 9;
    const source = toText(c(base));
    const other = toText(c(base + 1));
    const referrerName = toText(c(base + 2));
    const referrerPhone = toText(c(base + 3));
    const referrerEmail = toText(c(base + 4));
    const residentName = toText(c(base + 5));
    const residentPhone = toText(c(base + 6));
    const residentEmail = toText(c(base + 7));
    const comments = toText(c(base + 8));
    if (source || other || referrerName || residentName || comments) {
      referrals.push({
        source,
        other,
        referrerName,
        referrerPhone,
        referrerEmail,
        residentName,
        residentPhone,
        residentEmail,
        comments,
      });
    }
  }

  return {
    timestamp: parseGvizDate(c(0)),
    facility: toText(c(1)),
    date: parseGvizDate(c(2)),
    census: toNumber(c(3)),
    overCapacityExplanation: toText(c(4)),
    admissions: toNumber(c(5)),
    discharges: toNumber(c(6)),
    hospitalizations: toNumber(c(7)),
    vacantBeds: toYesNo(c(8)),
    outboundContacts: toNumber(c(9)),
    outreachContacts,
    followUps: toNumber(c(40)),
    followUpContacts,
    referralToday: toYesNo(c(71)),
    referralsFromAdmissions: toNumber(c(72)),
    referrals,
    inquiryCalls: toNumber(c(100)),
    walkIns: toNumber(c(101)),
    tours: toNumber(c(102)),
    openShifts: toNumber(c(103)),
    staffingStatus: toText(c(104)),
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
