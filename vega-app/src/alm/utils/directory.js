// ═══════════════════════════════════════════════
// ALM — Directory
// Builds a running, deduplicated contact directory
// from every daily submission. Contacts come from
// three streams (outreach / follow-ups / referrals)
// and get classified automatically:
//   - Provider  — outreach contacts + referral referrers
//   - Prospect  — residents listed on referrals
//   - Unclass.  — follow-ups that never appeared in a
//                 stream with a definitive type
// Dedup key: normalized name + (phone OR email).
// ═══════════════════════════════════════════════

const normName  = (s) => (s || '').trim().toLowerCase().replace(/\s+/g, ' ');
const normPhone = (s) => (s || '').replace(/\D/g, '');
const normEmail = (s) => (s || '').trim().toLowerCase();

// Produce 0..2 dedup keys for a raw contact. A contact matches an
// existing entry if *any* key overlaps — so phone-only contacts can
// merge with email-only contacts if the name matches either.
function keysFor({ name, phone, email }) {
  const n = normName(name);
  if (!n) return [];
  const keys = [];
  const p = normPhone(phone);
  const e = normEmail(email);
  if (p) keys.push(`${n}|p:${p}`);
  if (e) keys.push(`${n}|e:${e}`);
  if (keys.length === 0) keys.push(`${n}|?`);
  return keys;
}

const TYPE_RANK = { prospect: 3, provider: 2, unclassified: 1 };

export const CONTACT_TYPES = {
  PROVIDER:     'provider',
  PROSPECT:     'prospect',
  UNCLASSIFIED: 'unclassified',
};

export const TYPE_LABELS = {
  provider:     'Provider',
  prospect:     'Prospect',
  unclassified: 'Unclassified',
};

// Walk every row and emit raw touchpoint events. Each event is a
// single occurrence — the dedup pass folds them into contact cards.
function collectTouchpoints(rows) {
  const events = [];
  rows.forEach((row) => {
    const facility = row.facility;
    const date = row.date;

    (row.outreachContacts || []).forEach((c) => {
      events.push({
        name: c.name, phone: c.phone, email: c.email,
        type: CONTACT_TYPES.PROVIDER,
        stream: 'outreach',
        facility, date,
      });
    });

    (row.followUpContacts || []).forEach((c) => {
      events.push({
        name: c.name, phone: c.phone, email: c.email,
        type: CONTACT_TYPES.UNCLASSIFIED,
        stream: 'followup',
        facility, date,
      });
    });

    (row.referrals || []).forEach((ref) => {
      if (ref.referrerName || ref.referrerPhone || ref.referrerEmail) {
        events.push({
          name: ref.referrerName,
          phone: ref.referrerPhone,
          email: ref.referrerEmail,
          type: CONTACT_TYPES.PROVIDER,
          stream: 'referrer',
          context: ref.source + (ref.other ? ` · ${ref.other}` : ''),
          facility, date,
        });
      }
      if (ref.residentName || ref.residentPhone || ref.residentEmail) {
        events.push({
          name: ref.residentName,
          phone: ref.residentPhone,
          email: ref.residentEmail,
          type: CONTACT_TYPES.PROSPECT,
          stream: 'resident',
          context: ref.comments || '',
          facility, date,
        });
      }
    });
  });
  return events.filter((e) => normName(e.name));
}

// Merge events into contact cards. Each card aggregates phones,
// emails, facilities contacted by, and a full touchpoint timeline.
export function buildDirectory(rows) {
  const events = collectTouchpoints(rows);

  const byKey = new Map();   // dedup key -> contact id
  const byId  = new Map();   // contact id -> contact card
  let nextId = 1;

  events.forEach((ev) => {
    const keys = keysFor(ev);
    if (keys.length === 0) return;

    let contactId = null;
    for (const k of keys) {
      if (byKey.has(k)) { contactId = byKey.get(k); break; }
    }
    if (contactId == null) {
      contactId = `c${nextId++}`;
      byId.set(contactId, {
        id: contactId,
        name: ev.name,
        phones: new Set(),
        emails: new Set(),
        facilities: new Set(),
        streams: new Set(),
        types: new Set(),
        touchpoints: [],
        firstDate: null,
        lastDate: null,
      });
    }
    keys.forEach((k) => byKey.set(k, contactId));

    const card = byId.get(contactId);
    if (ev.phone) card.phones.add(ev.phone.trim());
    if (ev.email) card.emails.add(ev.email.trim());
    if (ev.facility) card.facilities.add(ev.facility);
    card.streams.add(ev.stream);
    card.types.add(ev.type);
    card.touchpoints.push({
      date: ev.date,
      facility: ev.facility,
      stream: ev.stream,
      type: ev.type,
      context: ev.context || '',
    });
    if (ev.date) {
      if (!card.firstDate || ev.date < card.firstDate) card.firstDate = ev.date;
      if (!card.lastDate  || ev.date > card.lastDate)  card.lastDate  = ev.date;
    }
    // Prefer the fullest-looking name we've seen (longest, most capitalized).
    if ((ev.name || '').trim().length > (card.name || '').trim().length) {
      card.name = ev.name.trim();
    }
  });

  // Finalize: pick the strongest classification seen.
  const cards = Array.from(byId.values()).map((card) => {
    const primary = Array.from(card.types).sort(
      (a, b) => (TYPE_RANK[b] || 0) - (TYPE_RANK[a] || 0),
    )[0] || CONTACT_TYPES.UNCLASSIFIED;

    card.touchpoints.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

    return {
      id: card.id,
      name: card.name,
      phones: Array.from(card.phones),
      emails: Array.from(card.emails),
      facilities: Array.from(card.facilities).sort(),
      streams: Array.from(card.streams),
      type: primary,
      touchpointCount: card.touchpoints.length,
      touchpoints: card.touchpoints,
      firstDate: card.firstDate,
      lastDate: card.lastDate,
    };
  });

  cards.sort((a, b) => (b.lastDate?.getTime() || 0) - (a.lastDate?.getTime() || 0));
  return cards;
}
