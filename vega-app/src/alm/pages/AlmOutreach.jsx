// ═══════════════════════════════════════════════
// ALM — Outreach & Referrals
// Funnel from outbound contacts → follow-ups →
// referrals → tours → admits, plus a breakdown of
// referral sources and a recent referrals feed.
// ═══════════════════════════════════════════════

import { useMemo, useState } from 'react';
import useAlmData from '../hooks/useAlmData';
import AlmInlineSync from '../components/AlmInlineSync';
import AlmRangePicker from '../components/AlmRangePicker';
import AlmFacilityFilter from '../components/AlmFacilityFilter';
import { uniqueFacilities } from '../services/almDataService';
import { fmtNum, fmtPct, fmtDate } from '../utils/format';
import { computeRange, rangeLabel, rowInRange } from '../utils/range';
import { ALL_SCOPE, rowInScope, scopeLabel } from '../utils/scope';

function FunnelStep({ label, value, pctOfPrev, pctOfTop, isFirst }) {
  const width = Math.max(4, pctOfTop);
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span className="alm-mono" style={{ fontSize: 10, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.16em' }}>
          {label}
        </span>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="alm-num" style={{ fontSize: 20, fontWeight: 600, color: 'var(--alm-ink-1)', letterSpacing: '-0.01em' }}>
            {fmtNum(value)}
          </span>
          {!isFirst && (
            <span className="alm-mono" style={{ fontSize: 10, color: 'var(--alm-ink-5)', letterSpacing: '0.08em' }}>
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

export default function AlmOutreach() {
  const { rows, loading, error, lastSynced, refresh } = useAlmData();
  const [range, setRange] = useState(() => computeRange('monthly'));
  const [scope, setScope] = useState(ALL_SCOPE);

  const { filtered, facilities, funnel, sources, recentReferrals, perFacility } = useMemo(() => {
    const facs = uniqueFacilities(rows);

    const f = rows.filter((r) => rowInRange(r, range) && rowInScope(r, scope));

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
  }, [rows, range, scope]);

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
    <div className="alm-page">
      <div className="alm-page-header">
        <div className="alm-page-header__row">
          <div className="alm-page-header__main">
            <div className="alm-page-dot"><span>Outreach</span></div>
            <h1 className="alm-page-title">Outreach &amp; Referrals</h1>
            <p className="alm-page-subtitle">
              {rangeLabel(range)} · {scopeLabel(scope)} · {filtered.length} daily record{filtered.length === 1 ? '' : 's'}
            </p>
          </div>
          <AlmInlineSync loading={loading} error={error} lastSynced={lastSynced} onRefresh={() => refresh(true)} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
        <AlmRangePicker value={range} onChange={setRange} />
        <AlmFacilityFilter value={scope} onChange={setScope} />
      </div>

      <div className="alm-two-col" style={{ marginBottom: 8 }}>
        <div className="alm-card alm-card--p">
          <div className="alm-stat-label">Activity Funnel</div>
          <div style={{ marginTop: 4 }}>
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
          </div>
          <div
            className="alm-mono"
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
              Tours → Admits <span style={{ color: 'var(--alm-ink-1)', marginLeft: 6 }}>{fmtPct(pct(funnel.admits, funnel.tours), 0) || '—'}</span>
            </span>
            <span>
              Refs → Tours <span style={{ color: 'var(--alm-ink-1)', marginLeft: 6 }}>{fmtPct(pct(funnel.tours, funnel.referrals), 0) || '—'}</span>
            </span>
          </div>
        </div>

        <div className="alm-card alm-card--p">
          <div className="alm-stat-label">Referral Sources</div>
          {sources.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--alm-ink-4)', marginTop: 4 }}>No referrals in this window.</div>
          ) : (
            <div style={{ marginTop: 4 }}>
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
      </div>

      <div className="alm-section"><span>By Facility</span></div>
      <div className="alm-card alm-card--flush" style={{ marginBottom: 8 }}>
        <table className="alm-table">
          <thead>
            <tr>
              <th>Facility</th>
              <th className="right">Outbound</th>
              <th className="right">Follow-ups</th>
              <th className="right">Referrals</th>
              <th className="right">Tours</th>
              <th className="right">Admits</th>
              <th className="right">Ref→Tour</th>
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
                  <td className="right">{fmtNum(r.referrals)}</td>
                  <td className="right">{fmtNum(r.tours)}</td>
                  <td className="right">{fmtNum(r.admits)}</td>
                  <td className="right muted">{fmtPct(pct(r.tours, r.referrals), 0) || '—'}</td>
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
                <th>Comments</th>
              </tr>
            </thead>
            <tbody>
              {recentReferrals.slice(0, 20).map((r, i) => (
                <tr key={i}>
                  <td className="muted">{fmtDate(r.date)}</td>
                  <td>{r.facility}</td>
                  <td>{r.source}{r.other ? ` — ${r.other}` : ''}</td>
                  <td className="muted" style={{ whiteSpace: 'pre-wrap' }}>{r.comments || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
