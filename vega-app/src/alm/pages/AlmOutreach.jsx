// ═══════════════════════════════════════════════
// ALM — Outreach & Referrals
// Funnel from outbound contacts → follow-ups →
// referrals → tours → admits, plus a breakdown of
// referral sources and a recent referrals feed.
// ═══════════════════════════════════════════════

import { useMemo, useState } from 'react';
import useAlmData from '../hooks/useAlmData';
import AlmStatusBar from '../components/AlmStatusBar';
import { uniqueFacilities } from '../services/almDataService';
import { fmtNum, fmtPct, fmtDate } from '../utils/format';

const RANGES = [
  { label: '7d',  days: 7 },
  { label: '30d', days: 30 },
  { label: '90d', days: 90 },
  { label: 'All', days: null },
];

function Card({ children, style = {} }) {
  return (
    <div
      style={{
        background: 'var(--alm-surface)',
        border: '1px solid var(--alm-border)',
        borderRadius: 4,
        padding: 20,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// Horizontal bar relative to the step above it in the funnel.
function FunnelStep({ label, value, pctOfPrev, pctOfTop, isFirst }) {
  const width = Math.max(6, pctOfTop);
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
        <span style={{ color: 'var(--alm-text)' }}>{label}</span>
        <span style={{ color: 'var(--alm-text-muted)' }}>
          {fmtNum(value)}
          {!isFirst && <span style={{ color: 'var(--alm-text-faint)' }}>  ·  {fmtPct(pctOfPrev, 0)} of prev</span>}
        </span>
      </div>
      <div style={{ height: 8, background: '#f2f2f2', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${width}%`, height: '100%', background: '#333' }} />
      </div>
    </div>
  );
}

function pct(numer, denom) {
  if (!denom) return null;
  return (numer / denom) * 100;
}

export default function AlmOutreach() {
  const { rows, loading, error, lastSynced, refresh } = useAlmData();
  const [rangeIdx, setRangeIdx] = useState(1); // default 30d
  const [facilityFilter, setFacilityFilter] = useState('all');

  const { filtered, facilities, funnel, sources, recentReferrals, perFacility } = useMemo(() => {
    const facs = uniqueFacilities(rows);
    const range = RANGES[rangeIdx];
    const cutoff = range.days
      ? new Date(Date.now() - range.days * 24 * 60 * 60 * 1000)
      : null;

    const f = rows.filter((r) => {
      if (cutoff && r.date && r.date < cutoff) return false;
      if (facilityFilter !== 'all' && r.facility !== facilityFilter) return false;
      return true;
    });

    const totals = f.reduce(
      (acc, r) => {
        acc.outbound += r.outboundContacts || 0;
        acc.followUps += r.followUps || 0;
        acc.referrals += (r.referrals || []).length;
        acc.inquiry += r.inquiryCalls || 0;
        acc.walkIns += r.walkIns || 0;
        acc.tours += r.tours || 0;
        acc.admits += r.admissions || 0;
        return acc;
      },
      { outbound: 0, followUps: 0, referrals: 0, inquiry: 0, walkIns: 0, tours: 0, admits: 0 },
    );

    // Source breakdown
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

    // Recent referrals feed
    const recent = [];
    f.forEach((r) => {
      (r.referrals || []).forEach((ref) => {
        recent.push({ ...ref, facility: r.facility, date: r.date });
      });
    });
    recent.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

    // Per-facility activity
    const facMap = new Map();
    f.forEach((r) => {
      const key = r.facility;
      const cur = facMap.get(key) || { facility: key, outbound: 0, followUps: 0, referrals: 0, tours: 0, admits: 0 };
      cur.outbound += r.outboundContacts || 0;
      cur.followUps += r.followUps || 0;
      cur.referrals += (r.referrals || []).length;
      cur.tours += r.tours || 0;
      cur.admits += r.admissions || 0;
      facMap.set(key, cur);
    });
    const pf = Array.from(facMap.values()).sort((a, b) => b.tours - a.tours);

    return {
      filtered: f,
      facilities: facs,
      funnel: totals,
      sources: srcRows,
      recentReferrals: recent,
      perFacility: pf,
    };
  }, [rows, rangeIdx, facilityFilter]);

  const topOfFunnel = Math.max(funnel.outbound, 1);
  const funnelSteps = [
    { label: 'Outbound Contacts', value: funnel.outbound },
    { label: 'Follow-ups',        value: funnel.followUps },
    { label: 'Referrals',         value: funnel.referrals },
    { label: 'Tours',             value: funnel.tours },
    { label: 'Admits',            value: funnel.admits },
  ];

  const maxSource = Math.max(1, ...sources.map((s) => s.count));

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 32 }}>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--alm-text)' }}>
          Outreach & Referrals
        </h1>
        <p style={{ fontSize: 13, color: 'var(--alm-text-muted)', margin: '4px 0 0' }}>
          Activity and conversion across facilities over the selected window.
        </p>
      </div>

      <AlmStatusBar loading={loading} error={error} lastSynced={lastSynced} onRefresh={() => refresh(true)} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 0, border: '1px solid var(--alm-border)', borderRadius: 3, overflow: 'hidden' }}>
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRangeIdx(i)}
              style={{
                fontSize: 11,
                padding: '6px 12px',
                background: rangeIdx === i ? 'var(--alm-text)' : 'transparent',
                color: rangeIdx === i ? '#fff' : 'var(--alm-text-muted)',
                border: 'none',
                borderRight: i < RANGES.length - 1 ? '1px solid var(--alm-border)' : 'none',
                cursor: 'pointer',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
        <select
          value={facilityFilter}
          onChange={(e) => setFacilityFilter(e.target.value)}
          style={{
            fontSize: 12,
            padding: '5px 8px',
            border: '1px solid var(--alm-border)',
            borderRadius: 3,
            background: 'var(--alm-bg)',
            color: 'var(--alm-text)',
          }}
        >
          <option value="all">All facilities</option>
          {facilities.map((f) => (
            <option key={f} value={f}>{f}</option>
          ))}
        </select>
        <span style={{ fontSize: 11, color: 'var(--alm-text-faint)' }}>
          {filtered.length} daily record{filtered.length === 1 ? '' : 's'}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1fr) minmax(320px, 1fr)', gap: 16, marginBottom: 24 }}>
        {/* Funnel */}
        <Card>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)', marginBottom: 16 }}>
            Activity Funnel
          </div>
          {funnelSteps.map((step, i) => (
            <FunnelStep
              key={step.label}
              label={step.label}
              value={step.value}
              pctOfPrev={i === 0 ? null : pct(step.value, funnelSteps[i - 1].value)}
              pctOfTop={pct(step.value, topOfFunnel) || 0}
              isFirst={i === 0}
            />
          ))}
          <div style={{ fontSize: 11, color: 'var(--alm-text-faint)', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--alm-border)' }}>
            Tours → Admits: <span style={{ color: 'var(--alm-text)' }}>{fmtPct(pct(funnel.admits, funnel.tours), 0) || '--'}</span>
            {'   ·   '}
            Referrals → Tours: <span style={{ color: 'var(--alm-text)' }}>{fmtPct(pct(funnel.tours, funnel.referrals), 0) || '--'}</span>
          </div>
        </Card>

        {/* Referral Sources */}
        <Card>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)', marginBottom: 16 }}>
            Referral Sources
          </div>
          {sources.length === 0 ? (
            <div style={{ fontSize: 12, color: 'var(--alm-text-muted)' }}>No referrals in this window.</div>
          ) : (
            sources.map((s) => (
              <div key={s.source} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: 'var(--alm-text)' }}>{s.source}</span>
                  <span style={{ color: 'var(--alm-text-muted)' }}>{s.count}</span>
                </div>
                <div style={{ height: 6, background: '#f2f2f2', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ width: `${(s.count / maxSource) * 100}%`, height: '100%', background: '#555' }} />
                </div>
              </div>
            ))
          )}
        </Card>
      </div>

      {/* Per-facility breakdown */}
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)', marginBottom: 12 }}>
        By Facility
      </div>
      <Card style={{ padding: 0, marginBottom: 24 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--alm-border)' }}>
              {['Facility', 'Outbound', 'Follow-ups', 'Referrals', 'Tours', 'Admits', 'Ref→Tour', 'Tour→Admit'].map((h, i) => (
                <th key={h} style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontWeight: 500,
                  color: 'var(--alm-text-faint)',
                  padding: '12px 14px',
                  textAlign: i === 0 ? 'left' : 'right',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {perFacility.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ padding: 16, fontSize: 12, color: 'var(--alm-text-muted)' }}>
                  No activity in this window.
                </td>
              </tr>
            ) : (
              perFacility.map((r, i) => (
                <tr key={r.facility} style={{ borderBottom: i < perFacility.length - 1 ? '1px solid var(--alm-border)' : 'none' }}>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--alm-text)' }}>{r.facility}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--alm-text)', textAlign: 'right' }}>{fmtNum(r.outbound)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--alm-text)', textAlign: 'right' }}>{fmtNum(r.followUps)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--alm-text)', textAlign: 'right' }}>{fmtNum(r.referrals)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--alm-text)', textAlign: 'right' }}>{fmtNum(r.tours)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--alm-text)', textAlign: 'right' }}>{fmtNum(r.admits)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--alm-text-muted)', textAlign: 'right' }}>{fmtPct(pct(r.tours, r.referrals), 0) || '--'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--alm-text-muted)', textAlign: 'right' }}>{fmtPct(pct(r.admits, r.tours), 0) || '--'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      {/* Recent referrals */}
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)', marginBottom: 12 }}>
        Recent Referrals
      </div>
      <Card style={{ padding: 0 }}>
        {recentReferrals.length === 0 ? (
          <div style={{ padding: 16, fontSize: 12, color: 'var(--alm-text-muted)' }}>
            No referrals in this window.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--alm-border)' }}>
                {['Date', 'Facility', 'Source', 'Comments'].map((h) => (
                  <th key={h} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, color: 'var(--alm-text-faint)', padding: '12px 14px' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentReferrals.slice(0, 20).map((r, i) => (
                <tr key={i} style={{ borderBottom: i < Math.min(19, recentReferrals.length - 1) ? '1px solid var(--alm-border)' : 'none' }}>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--alm-text-muted)' }}>{fmtDate(r.date)}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--alm-text)' }}>{r.facility}</td>
                  <td style={{ padding: '12px 14px', fontSize: 13, color: 'var(--alm-text)' }}>
                    {r.source}{r.other ? ` — ${r.other}` : ''}
                  </td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: 'var(--alm-text-muted)', whiteSpace: 'pre-wrap' }}>
                    {r.comments || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
