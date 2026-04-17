// ═══════════════════════════════════════════════
// ALM — Directory
// Running contact directory built from every daily
// submission. Auto-classified as Provider, Prospect,
// or Unclassified based on the stream the contact
// appeared in. Click a row to expand the full
// touchpoint history.
// ═══════════════════════════════════════════════

import { useMemo, useState } from 'react';
import useAlmData from '../hooks/useAlmData';
import AlmInlineSync from '../components/AlmInlineSync';
import { buildDirectory, CONTACT_TYPES, TYPE_LABELS } from '../utils/directory';
import { ALL_HOMES } from '../config/facilities';
import { fmtDate } from '../utils/format';

const STREAM_LABELS = {
  outreach: 'Outreach',
  followup: 'Follow-up',
  referrer: 'Referral (Source)',
  resident: 'Referral (Resident)',
};

const TYPE_FILTERS = [
  { id: 'all',          label: 'All' },
  { id: CONTACT_TYPES.PROVIDER,     label: 'Providers' },
  { id: CONTACT_TYPES.PROSPECT,     label: 'Prospects' },
  { id: CONTACT_TYPES.UNCLASSIFIED, label: 'Unclassified' },
];

function TypeChip({ type }) {
  const color =
    type === CONTACT_TYPES.PROVIDER ? 'var(--alm-accent)' :
    type === CONTACT_TYPES.PROSPECT ? '#8B2E2E' :
    'var(--alm-ink-4)';
  const bg =
    type === CONTACT_TYPES.PROVIDER ? 'rgba(47,93,62,0.10)' :
    type === CONTACT_TYPES.PROSPECT ? 'rgba(139,46,46,0.10)' :
    'rgba(0,0,0,0.04)';
  return (
    <span
      className="alm-serif"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 999,
        fontSize: 11,
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        color,
        background: bg,
      }}
    >
      {TYPE_LABELS[type]}
    </span>
  );
}

function ContactTimeline({ touchpoints }) {
  if (!touchpoints.length) return null;
  return (
    <div style={{ marginTop: 14, borderTop: '1px solid var(--alm-border)', paddingTop: 14 }}>
      <div
        className="alm-serif"
        style={{
          fontSize: 11,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: 'var(--alm-ink-3)',
          marginBottom: 10,
        }}
      >
        Touchpoints · {touchpoints.length}
      </div>
      {touchpoints.map((t, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            gap: 14,
            padding: '8px 0',
            borderBottom: i === touchpoints.length - 1 ? 'none' : '1px dashed var(--alm-border)',
            fontSize: 13,
            color: 'var(--alm-ink-2)',
          }}
        >
          <span style={{ width: 86, flexShrink: 0, color: 'var(--alm-ink-3)' }}>
            {fmtDate(t.date)}
          </span>
          <span style={{ width: 140, flexShrink: 0 }}>{STREAM_LABELS[t.stream] || t.stream}</span>
          <span style={{ flex: 1, color: 'var(--alm-ink-1)' }}>{t.facility}</span>
          {t.context && (
            <span style={{ flex: 2, color: 'var(--alm-ink-3)', fontStyle: 'italic' }}>
              {t.context}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

export default function AlmDirectory() {
  const { rows, loading, error, lastSynced, refresh } = useAlmData();
  const [typeFilter, setTypeFilter] = useState('all');
  const [facilityFilter, setFacilityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const allContacts = useMemo(() => buildDirectory(rows), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allContacts.filter((c) => {
      if (typeFilter !== 'all' && c.type !== typeFilter) return false;
      if (facilityFilter && !c.facilities.includes(facilityFilter)) return false;
      if (q) {
        const hay = [c.name, ...c.phones, ...c.emails].join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [allContacts, typeFilter, facilityFilter, search]);

  const counts = useMemo(() => {
    const out = { all: allContacts.length };
    Object.values(CONTACT_TYPES).forEach((t) => { out[t] = 0; });
    allContacts.forEach((c) => { out[c.type] = (out[c.type] || 0) + 1; });
    return out;
  }, [allContacts]);

  return (
    <div className="alm-page">
      <div className="alm-page-header">
        <div className="alm-page-header__row">
          <div className="alm-page-header__main">
            <div className="alm-page-dot"><span>Directory</span></div>
            <h1 className="alm-page-title">Contacts &amp; Providers</h1>
            <p className="alm-page-subtitle">
              {allContacts.length} unique contact{allContacts.length === 1 ? '' : 's'} ·
              auto-built from every daily submission
            </p>
          </div>
          <AlmInlineSync loading={loading} error={error} lastSynced={lastSynced} onRefresh={() => refresh(true)} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        <div className="alm-pill-group">
          {TYPE_FILTERS.map((f) => (
            <button
              key={f.id}
              className={`alm-pill${typeFilter === f.id ? ' alm-pill--active' : ''}`}
              onClick={() => setTypeFilter(f.id)}
            >
              {f.label} · {counts[f.id] ?? 0}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Search name, phone, or email"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="alm-input"
            style={{ flex: 1, minWidth: 220 }}
          />
          <select
            value={facilityFilter}
            onChange={(e) => setFacilityFilter(e.target.value)}
            className="alm-select"
          >
            <option value="">Any facility</option>
            {ALL_HOMES.map((f) => (
              <option key={f} value={f}>{f}</option>
            ))}
          </select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="alm-card alm-card--p" style={{ textAlign: 'center', color: 'var(--alm-ink-4)' }}>
          {allContacts.length === 0
            ? 'No contacts yet. Admins populate the directory automatically as they file daily reports.'
            : 'No contacts match the current filters.'}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map((c) => {
            const expanded = expandedId === c.id;
            return (
              <div
                key={c.id}
                className="alm-card"
                style={{ padding: '14px 18px', cursor: 'pointer' }}
                onClick={() => setExpandedId(expanded ? null : c.id)}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: 16,
                    flexWrap: 'wrap',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--alm-ink-1)' }}>
                        {c.name}
                      </span>
                      <TypeChip type={c.type} />
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--alm-ink-3)', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                      {c.phones.length > 0 && <span>{c.phones[0]}{c.phones.length > 1 ? ` +${c.phones.length - 1}` : ''}</span>}
                      {c.emails.length > 0 && <span>{c.emails[0]}{c.emails.length > 1 ? ` +${c.emails.length - 1}` : ''}</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', fontSize: 12, color: 'var(--alm-ink-3)' }}>
                    <div style={{ fontSize: 14, color: 'var(--alm-ink-1)', fontWeight: 600 }}>
                      {c.touchpointCount} touch{c.touchpointCount === 1 ? '' : 'es'}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      Last · {fmtDate(c.lastDate)}
                    </div>
                    <div style={{ marginTop: 2 }}>
                      {c.facilities.length === 1
                        ? c.facilities[0]
                        : `${c.facilities.length} facilities`}
                    </div>
                  </div>
                </div>
                {expanded && <ContactTimeline touchpoints={c.touchpoints} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
