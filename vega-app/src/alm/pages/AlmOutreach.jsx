// ═══════════════════════════════════════════════
// ALM — Outreach & Referrals
// Split into two lenses:
//   1. Lead Pipeline — inbound leads (inquiries +
//      walk-ins + referrals) → tours → admits.
//   2. Outreach Activity — proactive outbound
//      contacts + follow-ups, with names surfaced.
// Referral detail expanded to show referrer &
// resident names alongside source + comments.
// ═══════════════════════════════════════════════

import { useMemo, useState } from 'react';
import useAlmData from '../hooks/useAlmData';
import AlmInlineSync from '../components/AlmInlineSync';
import AlmRangePicker from '../components/AlmRangePicker';
import AlmFacilityFilter from '../components/AlmFacilityFilter';
import { fmtNum, fmtPct, fmtDate } from '../utils/format';
import { computeRange, rangeLabel, rowInRange } from '../utils/range';
import { ALL_SCOPE, rowInScope, scopeLabel } from '../utils/scope';

function FunnelStep({ label, value, pctOfPrev, pctOfTop, isFirst, sublabel }) {
  const width = Math.max(4, pctOfTop);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span className="alm-serif" style={{ fontSize: 10, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
            {label}
          </span>
          {sublabel && (
            <span className="alm-serif" style={{ fontSize: 11, color: 'var(--alm-ink-5)' }}>
              {sublabel}
            </span>
          )}
        </div>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="alm-num" style={{ fontSize: 20, fontWeight: 600, color: 'var(--alm-ink-1)', letterSpacing: '-0.01em' }}>
            {fmtNum(value)}
          </span>
          {!isFirst && (
            <span className="alm-serif" style={{ fontSize: 10, color: 'var(--alm-ink-5)', letterSpacing: '0.08em' }}>
              {fmtPct(pctOfPrev, 0) || '—'} of prev
            </span>
          )}
        </span>
      </div>
      <div style={{ height: 4, background: 'var(--alm-surface-alt)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: 'var(--alm-ink-1)', transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function pct(numer, denom) {
  if (!denom) return null;
  return (numer / denom) * 100;
}

function ContactList({ title, contacts, empty }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? contacts : contacts.slice(0, 6);
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--alm-border)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span className="alm-serif" style={{ fontSize: 10, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          {title} ({contacts.length})
        </span>
        {contacts.length > 6 && (
          <button
            onClick={() => setExpanded((v) => !v)}
            className="alm-serif"
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              fontSize: 11,
              color: 'var(--alm-ink-3)',
              textDecoration: 'underline',
              textUnderlineOffset: 3,
            }}
          >
            {expanded ? 'Show fewer' : `Show all ${contacts.length}`}
          </button>
        )}
      </div>
      {contacts.length === 0 ? (
        <div style={{ fontSize: 12, color: 'var(--alm-ink-4)', fontStyle: 'italic' }}>{empty}</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {visible.map((c, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                fontSize: 13,
                color: 'var(--alm-ink-2)',
                padding: '6px 0',
                borderBottom: i < visible.length - 1 ? '1px dashed var(--alm-border)' : 'none',
              }}
            >
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name || '(unnamed)'}
              </span>
              <span style={{ color: 'var(--alm-ink-4)', fontSize: 11, whiteSpace: 'nowrap' }}>
                {c.facility}
              </span>
              <span style={{ color: 'var(--alm-ink-5)', fontSize: 11, whiteSpace: 'nowrap' }}>
                {fmtDate(c.date)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AlmOutreach() {
  const { rows, loading, error, lastSynced, refresh } = useAlmData();
  const [range, setRange] = useState(() => computeRange('monthly'));
  const [scope, setScope] = useState(ALL_SCOPE);

  const {
    filtered,
    pipeline,
    activity,
    sources,
    recentReferrals,
    perFacility,
    outreachContactsFlat,
    followUpContactsFlat,
  } = useMemo(() => {
    const f = rows.filter((r) => rowInRange(r, range) && rowInScope(r, scope));

    // Lead pipeline: inquiry + walk-ins + referrals → tours → admits
    const pipe = f.reduce(
      (acc, r) => {
        acc.inquiries += r.inquiryCalls || 0;
        acc.walkIns += r.walkIns || 0;
        acc.referrals += (r.referrals || []).length;
        acc.tours += r.tours || 0;
        acc.admits += r.admissions || 0;
        return acc;
      },
      { inquiries: 0, walkIns: 0, referrals: 0, tours: 0, admits: 0 },
    );
    pipe.leads = pipe.inquiries + pipe.walkIns + pipe.referrals;

    // Outreach activity: outbound + follow-ups (count-based)
    const act = f.reduce(
      (acc, r) => {
        acc.outbound += r.outboundContacts || 0;
        acc.followUps += r.followUps || 0;
        return acc;
      },
      { outbound: 0, followUps: 0 },
    );

    // Flattened contact lists with date/facility metadata
    const outreach = [];
    const follows = [];
    f.forEach((r) => {
      (r.outreachContacts || []).forEach((c) =>
        outreach.push({ ...c, facility: r.facility, date: r.date }),
      );
      (r.followUpContacts || []).forEach((c) =>
        follows.push({ ...c, facility: r.facility, date: r.date }),
      );
    });
    outreach.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));
    follows.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

    const sourceMap = new Map();
    f.forEach((r) => {
      (r.referrals || []).forEach((ref) => {
        const key = ref.source || 'Unspecified';
        sourceMap.set(key, (sourceMap.get(key) || 0) + 1);
      });
    });
    const srcRows = Array.from(sourceMap.entries())
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count);

    const recent = [];
    f.forEach((r) => {
      (r.referrals || []).forEach((ref) => {
        recent.push({ ...ref, facility: r.facility, date: r.date });
      });
    });
    recent.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

    const facMap = new Map();
    f.forEach((r) => {
      const key = r.facility;
      const cur = facMap.get(key) || {
        facility: key,
        outbound: 0,
        followUps: 0,
        inquiries: 0,
        walkIns: 0,
        referrals: 0,
        tours: 0,
        admits: 0,
      };
      cur.outbound += r.outboundContacts || 0;
      cur.followUps += r.followUps || 0;
      cur.inquiries += r.inquiryCalls || 0;
      cur.walkIns += r.walkIns || 0;
      cur.referrals += (r.referrals || []).length;
      cur.tours += r.tours || 0;
      cur.admits += r.admissions || 0;
      facMap.set(key, cur);
    });
    const pf = Array.from(facMap.values())
      .map((r) => ({ ...r, leads: r.inquiries + r.walkIns + r.referrals }))
      .sort((a, b) => b.tours - a.tours);

    return {
      filtered: f,
      pipeline: pipe,
      activity: act,
      sources: srcRows,
      recentReferrals: recent,
      perFacility: pf,
      outreachContactsFlat: outreach,
      followUpContactsFlat: follows,
    };
  }, [rows, range, scope]);

  const pipelineSteps = [
    {
      label: 'Leads',
      value: pipeline.leads,
      sublabel: `${pipeline.inquiries} inquiry · ${pipeline.walkIns} walk-in · ${pipeline.referrals} referral`,
    },
    { label: 'Tours', value: pipeline.tours },
    { label: 'Admits', value: pipeline.admits },
  ];
  const pipelineTop = Math.max(pipeline.leads, 1);

  const maxSource = Math.max(1, ...sources.map((s) => s.count));

  return (
    <div className="alm-page">
      <div className="alm-page-header">
        <div className="alm-page-header__row">
          <div className="alm-page-header__main">
            <div className="alm-page-dot"><span>Outreach</span></div>
            <h1 className="alm-page-title">Outreach &amp; Referrals</h1>
            <p className="alm-page-subtitle">
              {scopeLabel(scope)} · {filtered.length} daily record{filtered.length === 1 ? '' : 's'}
            </p>
          </div>
          <AlmInlineSync loading={loading} error={error} lastSynced={lastSynced} onRefresh={() => refresh(true)} dateLabel={rangeLabel(range)} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
        <AlmRangePicker value={range} onChange={setRange} />
        <AlmFacilityFilter value={scope} onChange={setScope} />
      </div>

      <div className="alm-two-col" style={{ marginBottom: 8 }}>
        <div className="alm-card alm-card--p">
          <div className="alm-stat-label">Lead Pipeline</div>
          <div style={{ marginTop: 4 }}>
            {pipelineSteps.map((step, i) => (
              <FunnelStep
                key={step.label}
                label={step.label}
                value={step.value}
                sublabel={step.sublabel}
                pctOfPrev={i === 0 ? null : pct(step.value, pipelineSteps[i - 1].value)}
                pctOfTop={pct(step.value, pipelineTop) || 0}
                isFirst={i === 0}
              />
            ))}
          </div>
          <div
            className="alm-serif"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 16,
              fontSize: 10,
              color: 'var(--alm-ink-4)',
              textTransform: 'uppercase',
              letterSpacing: '0.14em',
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px solid var(--alm-border)',
            }}
          >
            <span>
              Leads → Tours <span style={{ color: 'var(--alm-ink-1)', marginLeft: 6 }}>{fmtPct(pct(pipeline.tours, pipeline.leads), 0) || '—'}</span>
            </span>
            <span>
              Tours → Admits <span style={{ color: 'var(--alm-ink-1)', marginLeft: 6 }}>{fmtPct(pct(pipeline.admits, pipeline.tours), 0) || '—'}</span>
            </span>
          </div>
        </div>

        <div className="alm-card alm-card--p">
          <div className="alm-stat-label">Outreach Activity</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 4 }}>
            <div>
              <div className="alm-serif" style={{ fontSize: 10, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 6 }}>
                Outbound Contacts
              </div>
              <div className="alm-num" style={{ fontSize: 28, fontWeight: 600, color: 'var(--alm-ink-1)', letterSpacing: '-0.015em', lineHeight: 1 }}>
                {fmtNum(activity.outbound)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--alm-ink-5)', marginTop: 4 }}>
                {outreachContactsFlat.length} named
              </div>
            </div>
            <div>
              <div className="alm-serif" style={{ fontSize: 10, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 6 }}>
                Follow-ups
              </div>
              <div className="alm-num" style={{ fontSize: 28, fontWeight: 600, color: 'var(--alm-ink-1)', letterSpacing: '-0.015em', lineHeight: 1 }}>
                {fmtNum(activity.followUps)}
              </div>
              <div style={{ fontSize: 11, color: 'var(--alm-ink-5)', marginTop: 4 }}>
                {followUpContactsFlat.length} named
              </div>
            </div>
          </div>

          <ContactList
            title="Outreach Contacts"
            contacts={outreachContactsFlat}
            empty="No named outreach contacts in this window."
          />
          <ContactList
            title="Follow-up Contacts"
            contacts={followUpContactsFlat}
            empty="No named follow-up contacts in this window."
          />
        </div>
      </div>

      <div className="alm-section"><span>Referral Sources</span></div>
      <div className="alm-card alm-card--p" style={{ marginBottom: 8 }}>
        {sources.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--alm-ink-4)' }}>No referrals in this window.</div>
        ) : (
          <div>
            {sources.map((s) => (
              <div key={s.source} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                  <span style={{ fontSize: 13, color: 'var(--alm-ink-2)' }}>{s.source}</span>
                  <span className="alm-num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--alm-ink-1)' }}>{s.count}</span>
                </div>
                <div style={{ height: 3, background: 'var(--alm-surface-alt)', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(s.count / maxSource) * 100}%`, height: '100%', background: 'var(--alm-ink-3)', transition: 'width 0.3s' }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="alm-section"><span>By Facility</span></div>
      <div className="alm-card alm-card--flush" style={{ marginBottom: 8 }}>
        <table className="alm-table">
          <thead>
            <tr>
              <th>Facility</th>
              <th className="right">Outbound</th>
              <th className="right">Follow-ups</th>
              <th className="right">Leads</th>
              <th className="right">Tours</th>
              <th className="right">Admits</th>
              <th className="right">Lead→Tour</th>
              <th className="right">Tour→Admit</th>
            </tr>
          </thead>
          <tbody>
            {perFacility.length === 0 ? (
              <tr>
                <td colSpan={8} className="muted">No activity in this window.</td>
              </tr>
            ) : (
              perFacility.map((r) => (
                <tr key={r.facility}>
                  <td>{r.facility}</td>
                  <td className="right">{fmtNum(r.outbound)}</td>
                  <td className="right">{fmtNum(r.followUps)}</td>
                  <td className="right">{fmtNum(r.leads)}</td>
                  <td className="right">{fmtNum(r.tours)}</td>
                  <td className="right">{fmtNum(r.admits)}</td>
                  <td className="right muted">{fmtPct(pct(r.tours, r.leads), 0) || '—'}</td>
                  <td className="right muted">{fmtPct(pct(r.admits, r.tours), 0) || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="alm-section"><span>Recent Referrals</span></div>
      <div className="alm-card alm-card--flush">
        {recentReferrals.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13, color: 'var(--alm-ink-4)' }}>
            No referrals in this window.
          </div>
        ) : (
          <table className="alm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Facility</th>
                <th>Source</th>
                <th>Referrer</th>
                <th>Resident</th>
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {recentReferrals.slice(0, 20).map((r, i) => (
                <tr key={i}>
                  <td className="muted">{fmtDate(r.date)}</td>
                  <td>{r.facility}</td>
                  <td>{r.source}{r.other ? ` — ${r.other}` : ''}</td>
                  <td>
                    {r.referrerName || '—'}
                    {(r.referrerPhone || r.referrerEmail) && (
                      <div style={{ fontSize: 11, color: 'var(--alm-ink-4)', marginTop: 2 }}>
                        {[r.referrerPhone, r.referrerEmail].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td>
                    {r.residentName || '—'}
                    {(r.residentPhone || r.residentEmail) && (
                      <div style={{ fontSize: 11, color: 'var(--alm-ink-4)', marginTop: 2 }}>
                        {[r.residentPhone, r.residentEmail].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </td>
                  <td className="muted" style={{ whiteSpace: 'pre-wrap', maxWidth: 260 }}>{r.comments || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
