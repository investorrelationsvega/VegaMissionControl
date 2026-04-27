// ═══════════════════════════════════════════════
// ALM — Admissions & Discharges
// Operational movement view: the inquiry-to-admit
// funnel, discharge cause analysis, per-facility
// performance, and a recent discharge log. Built
// around the fields the admin form actually writes
// to the Daily Log sheet.
// ═══════════════════════════════════════════════

import { useMemo, useState } from 'react';
import useAlmData from '../hooks/useAlmData';
import AlmInlineSync from '../components/AlmInlineSync';
import AlmRangePicker from '../components/AlmRangePicker';
import AlmFacilityFilter from '../components/AlmFacilityFilter';
import { fmtNum, fmtPct, fmtDate } from '../utils/format';
import { computeRange, rangeLabel, rowInRange } from '../utils/range';
import { ALL_SCOPE, rowInScope, scopeLabel } from '../utils/scope';

function pct(numer, denom) {
  if (!denom) return null;
  return (numer / denom) * 100;
}

function KpiCard({ label, value, sub, tone }) {
  const toneColor =
    tone === 'up' ? 'var(--alm-up)' :
    tone === 'down' ? 'var(--alm-down)' :
    'var(--alm-ink-1)';
  return (
    <div className="alm-card" style={{ padding: '18px 20px' }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--alm-ink-4)',
          textTransform: 'uppercase',
          letterSpacing: '0.03em',
          marginBottom: 10,
        }}
      >
        {label}
      </div>
      <div
        className="alm-num"
        style={{
          fontSize: 32,
          fontWeight: 600,
          color: toneColor,
          letterSpacing: '-0.02em',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--alm-ink-4)',
            marginTop: 8,
            lineHeight: 1.4,
          }}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

function FunnelStep({ label, value, pctOfPrev, pctOfTop, isFirst, sublabel }) {
  const width = Math.max(4, pctOfTop);
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ fontSize: 11, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            {label}
          </span>
          {sublabel && (
            <span style={{ fontSize: 11, color: 'var(--alm-ink-5)' }}>
              {sublabel}
            </span>
          )}
        </div>
        <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span className="alm-num" style={{ fontSize: 22, fontWeight: 600, color: 'var(--alm-ink-1)', letterSpacing: '-0.01em' }}>
            {fmtNum(value)}
          </span>
          {!isFirst && (
            <span style={{ fontSize: 11, color: 'var(--alm-ink-5)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
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

export default function AlmOutreach() {
  const { rows, loading, error, lastSynced, refresh } = useAlmData();
  const [range, setRange] = useState(() => computeRange('monthly'));
  const [scope, setScope] = useState(ALL_SCOPE);

  const {
    filtered,
    totals,
    dischargeCauses,
    recentDischarges,
    perFacility,
  } = useMemo(() => {
    const f = rows.filter((r) => rowInRange(r, range) && rowInScope(r, scope));

    const t = f.reduce(
      (acc, r) => {
        acc.admissions += r.admissions || 0;
        acc.fromReferral += r.referralsFromAdmissions || 0;
        acc.discharges += r.discharges || 0;
        acc.inquiryCalls += r.inquiryCalls || 0;
        acc.tours += r.tours || 0;
        return acc;
      },
      { admissions: 0, fromReferral: 0, discharges: 0, inquiryCalls: 0, tours: 0 },
    );
    t.net = t.admissions - t.discharges;

    // Discharge cause aggregation from per-discharge detail rows.
    const causeMap = new Map();
    f.forEach((r) => {
      (r.dischargeDetail || []).forEach((d) => {
        const key = d.cause || 'Unspecified';
        causeMap.set(key, (causeMap.get(key) || 0) + 1);
      });
    });
    const causes = Array.from(causeMap.entries())
      .map(([cause, count]) => ({ cause, count }))
      .sort((a, b) => b.count - a.count);

    // Flattened recent discharge entries with date + facility + cause/other.
    const recent = [];
    f.forEach((r) => {
      (r.dischargeDetail || []).forEach((d) => {
        recent.push({
          date: r.date,
          facility: r.facility,
          cause: d.cause,
          other: d.other,
        });
      });
    });
    recent.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

    // Per-facility roll-up.
    const facMap = new Map();
    f.forEach((r) => {
      const key = r.facility;
      const cur = facMap.get(key) || {
        facility: key,
        admissions: 0,
        fromReferral: 0,
        discharges: 0,
        inquiryCalls: 0,
        tours: 0,
      };
      cur.admissions += r.admissions || 0;
      cur.fromReferral += r.referralsFromAdmissions || 0;
      cur.discharges += r.discharges || 0;
      cur.inquiryCalls += r.inquiryCalls || 0;
      cur.tours += r.tours || 0;
      facMap.set(key, cur);
    });
    const pf = Array.from(facMap.values())
      .map((r) => ({ ...r, net: r.admissions - r.discharges }))
      .sort((a, b) => b.admissions - a.admissions);

    return {
      filtered: f,
      totals: t,
      dischargeCauses: causes,
      recentDischarges: recent,
      perFacility: pf,
    };
  }, [rows, range, scope]);

  const funnelSteps = [
    { label: 'Inbound Calls', value: totals.inquiryCalls, sublabel: 'Placement inquiries' },
    { label: 'Tour Inquiries', value: totals.tours, sublabel: 'Scheduled or completed' },
    { label: 'Admits', value: totals.admissions, sublabel: `${totals.fromReferral} from referral` },
  ];
  const funnelTop = Math.max(totals.inquiryCalls, totals.tours, totals.admissions, 1);
  const maxCause = Math.max(1, ...dischargeCauses.map((c) => c.count));
  const netTone = totals.net > 0 ? 'up' : totals.net < 0 ? 'down' : null;

  return (
    <div className="alm-page">
      <div className="alm-page-header">
        <div className="alm-page-header__row">
          <div className="alm-page-header__main">
            <div className="alm-page-dot"><span>Admissions</span></div>
            <h1 className="alm-page-title">Admissions &amp; Discharges</h1>
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

      {/* KPI strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          marginBottom: 28,
        }}
      >
        <KpiCard
          label="Admits"
          value={fmtNum(totals.admissions)}
          sub={
            totals.admissions > 0
              ? `${totals.fromReferral} from referral · ${fmtPct(pct(totals.fromReferral, totals.admissions), 0) || '—'}`
              : 'No admissions in range'
          }
        />
        <KpiCard
          label="Discharges"
          value={fmtNum(totals.discharges)}
          sub={
            dischargeCauses[0]
              ? `Top cause · ${dischargeCauses[0].cause}`
              : 'No discharges in range'
          }
        />
        <KpiCard
          label="Net Movement"
          value={`${totals.net > 0 ? '+' : ''}${fmtNum(totals.net)}`}
          sub="Admits − Discharges"
          tone={netTone}
        />
        <KpiCard
          label="Tour → Admit"
          value={fmtPct(pct(totals.admissions, totals.tours), 0) || '—'}
          sub={`${fmtNum(totals.tours)} tour inquiries`}
        />
        <KpiCard
          label="Call → Admit"
          value={fmtPct(pct(totals.admissions, totals.inquiryCalls), 0) || '—'}
          sub={`${fmtNum(totals.inquiryCalls)} inbound calls`}
        />
      </div>

      {/* Funnel + Discharge causes */}
      <div className="alm-two-col" style={{ marginBottom: 28 }}>
        <div className="alm-card alm-card--p">
          <div className="alm-stat-label">Inquiry Funnel</div>
          <div style={{ marginTop: 6 }}>
            {funnelSteps.map((step, i) => (
              <FunnelStep
                key={step.label}
                label={step.label}
                value={step.value}
                sublabel={step.sublabel}
                pctOfPrev={i === 0 ? null : pct(step.value, funnelSteps[i - 1].value)}
                pctOfTop={pct(step.value, funnelTop) || 0}
                isFirst={i === 0}
              />
            ))}
          </div>
        </div>

        <div className="alm-card alm-card--p">
          <div className="alm-stat-label">Discharge Causes</div>
          {dischargeCauses.length === 0 ? (
            <div style={{ fontSize: 13, color: 'var(--alm-ink-4)', marginTop: 8 }}>
              No discharges in this window.
            </div>
          ) : (
            <div style={{ marginTop: 6 }}>
              {dischargeCauses.map((c) => (
                <div key={c.cause} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: 'var(--alm-ink-2)' }}>{c.cause}</span>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
                      <span className="alm-num" style={{ fontSize: 16, fontWeight: 600, color: 'var(--alm-ink-1)' }}>
                        {c.count}
                      </span>
                      <span style={{ fontSize: 11, color: 'var(--alm-ink-5)', letterSpacing: '0.03em', textTransform: 'uppercase' }}>
                        {fmtPct(pct(c.count, totals.discharges), 0)}
                      </span>
                    </span>
                  </div>
                  <div style={{ height: 3, background: 'var(--alm-surface-alt)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${(c.count / maxCause) * 100}%`, height: '100%', background: 'var(--alm-accent)', transition: 'width 0.3s' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="alm-section"><span>By Facility</span></div>
      <div className="alm-card alm-card--flush" style={{ marginBottom: 28 }}>
        <table className="alm-table">
          <thead>
            <tr>
              <th>Facility</th>
              <th className="right">Admits</th>
              <th className="right">From Ref.</th>
              <th className="right">Discharges</th>
              <th className="right">Net</th>
              <th className="right">Calls</th>
              <th className="right">Tours</th>
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
                  <td className="right">{fmtNum(r.admissions)}</td>
                  <td className="right muted">{fmtNum(r.fromReferral)}</td>
                  <td className="right">{fmtNum(r.discharges)}</td>
                  <td
                    className="right"
                    style={{
                      color: r.net > 0 ? 'var(--alm-up)' : r.net < 0 ? 'var(--alm-down)' : 'var(--alm-ink-3)',
                      fontWeight: 600,
                    }}
                  >
                    {r.net > 0 ? '+' : ''}{fmtNum(r.net)}
                  </td>
                  <td className="right muted">{fmtNum(r.inquiryCalls)}</td>
                  <td className="right muted">{fmtNum(r.tours)}</td>
                  <td className="right muted">{fmtPct(pct(r.admissions, r.tours), 0) || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="alm-section"><span>Recent Discharges</span></div>
      <div className="alm-card alm-card--flush">
        {recentDischarges.length === 0 ? (
          <div style={{ padding: 20, fontSize: 13, color: 'var(--alm-ink-4)' }}>
            No discharges in this window.
          </div>
        ) : (
          <table className="alm-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Facility</th>
                <th>Cause</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              {recentDischarges.slice(0, 30).map((d, i) => (
                <tr key={i}>
                  <td className="muted">{fmtDate(d.date)}</td>
                  <td>{d.facility}</td>
                  <td>{d.cause}</td>
                  <td className="muted">{d.other || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
