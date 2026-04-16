// ═══════════════════════════════════════════════
// ALM — Trends
// Per-facility time series with overlay between
// census and sales activity (tours) on dual axes.
// Also exposes hospitalizations and open shifts.
// ═══════════════════════════════════════════════

import { useMemo, useState } from 'react';
import useAlmData from '../hooks/useAlmData';
import AlmStatusBar from '../components/AlmStatusBar';
import AlmLineChart from '../components/AlmLineChart';
import { uniqueFacilities } from '../services/almDataService';
import { fmtNum, dateKey } from '../utils/format';

const RANGES = [
  { label: '14d',  days: 14 },
  { label: '30d',  days: 30 },
  { label: '90d',  days: 90 },
  { label: 'All',  days: null },
];

const METRIC_SETS = [
  { id: 'census-tours',   label: 'Census + Tours',           left: 'census',           right: 'tours',           leftName: 'Census',           rightName: 'Tours' },
  { id: 'admits-disc',    label: 'Admits vs Discharges',     left: 'admissions',       right: 'discharges',      leftName: 'Admits',           rightName: 'Discharges' },
  { id: 'hosp-shifts',    label: 'Hospitalizations + Open Shifts', left: 'hospitalizations', right: 'openShifts',  leftName: 'Hospitalizations', rightName: 'Open Shifts' },
  { id: 'outreach-refs',  label: 'Outreach + Referrals',     left: 'outboundContacts', right: 'referralsCount',  leftName: 'Outbound',         rightName: 'Referrals' },
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

function sumDay(rows, key) {
  if (key === 'referralsCount') {
    return rows.reduce((s, r) => s + (r.referrals?.length || 0), 0);
  }
  return rows.reduce((s, r) => s + (r[key] || 0), 0);
}

// For census we want to show the last-known value per day, not a sum
// (since multiple facilities each report their own census).
function valueForDay(rows, key) {
  if (key === 'census') {
    // Sum of latest census reported that day across the filtered rows
    return rows.reduce((s, r) => s + (r.census || 0), 0);
  }
  return sumDay(rows, key);
}

export default function AlmTrends() {
  const { rows, loading, error, lastSynced, refresh } = useAlmData();
  const [rangeIdx, setRangeIdx] = useState(1);
  const [facilityFilter, setFacilityFilter] = useState('all');
  const [metricSetId, setMetricSetId] = useState('census-tours');

  const facilities = useMemo(() => uniqueFacilities(rows), [rows]);
  const metricSet = METRIC_SETS.find((m) => m.id === metricSetId) || METRIC_SETS[0];

  const { series, filteredCount } = useMemo(() => {
    const range = RANGES[rangeIdx];
    const cutoff = range.days ? new Date(Date.now() - range.days * 24 * 60 * 60 * 1000) : null;

    const f = rows.filter((r) => {
      if (!r.date) return false;
      if (cutoff && r.date < cutoff) return false;
      if (facilityFilter !== 'all' && r.facility !== facilityFilter) return false;
      return true;
    });

    // Group by day
    const byDay = new Map();
    f.forEach((r) => {
      const k = dateKey(r.date);
      if (!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(r);
    });
    const sortedKeys = Array.from(byDay.keys()).sort();

    const leftPts = sortedKeys.map((k) => {
      const dayRows = byDay.get(k);
      return { x: dayRows[0].date, y: valueForDay(dayRows, metricSet.left) };
    });
    const rightPts = sortedKeys.map((k) => {
      const dayRows = byDay.get(k);
      return { x: dayRows[0].date, y: valueForDay(dayRows, metricSet.right) };
    });

    return {
      series: [
        { name: metricSet.leftName,  points: leftPts,  axis: 'left' },
        { name: metricSet.rightName, points: rightPts, axis: 'right' },
      ],
      filteredCount: f.length,
    };
  }, [rows, rangeIdx, facilityFilter, metricSetId, metricSet]);

  // Per-facility sparkline data for the primary (left) metric
  const perFacility = useMemo(() => {
    const range = RANGES[rangeIdx];
    const cutoff = range.days ? new Date(Date.now() - range.days * 24 * 60 * 60 * 1000) : null;

    const facRows = new Map();
    rows.forEach((r) => {
      if (!r.date) return;
      if (cutoff && r.date < cutoff) return;
      if (!facRows.has(r.facility)) facRows.set(r.facility, []);
      facRows.get(r.facility).push(r);
    });

    return Array.from(facRows.entries()).map(([facility, rs]) => {
      const byDay = new Map();
      rs.forEach((r) => {
        const k = dateKey(r.date);
        if (!byDay.has(k)) byDay.set(k, []);
        byDay.get(k).push(r);
      });
      const sortedKeys = Array.from(byDay.keys()).sort();
      const points = sortedKeys.map((k) => ({
        x: byDay.get(k)[0].date,
        y: valueForDay(byDay.get(k), metricSet.left),
      }));
      const latest = points[points.length - 1]?.y ?? 0;
      const first = points[0]?.y ?? 0;
      const delta = latest - first;
      return { facility, points, latest, delta };
    }).sort((a, b) => b.latest - a.latest);
  }, [rows, rangeIdx, metricSet]);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 32 }}>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--alm-text)' }}>
          Trends
        </h1>
        <p style={{ fontSize: 13, color: 'var(--alm-text-muted)', margin: '4px 0 0' }}>
          Overlay operational signals to see how they move together.
        </p>
      </div>

      <AlmStatusBar loading={loading} error={error} lastSynced={lastSynced} onRefresh={() => refresh(true)} />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
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
          style={{ fontSize: 12, padding: '5px 8px', border: '1px solid var(--alm-border)', borderRadius: 3, background: 'var(--alm-bg)', color: 'var(--alm-text)' }}
        >
          <option value="all">All facilities</option>
          {facilities.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select
          value={metricSetId}
          onChange={(e) => setMetricSetId(e.target.value)}
          style={{ fontSize: 12, padding: '5px 8px', border: '1px solid var(--alm-border)', borderRadius: 3, background: 'var(--alm-bg)', color: 'var(--alm-text)' }}
        >
          {METRIC_SETS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: 'var(--alm-text-faint)' }}>
          {filteredCount} daily record{filteredCount === 1 ? '' : 's'}
        </span>
      </div>

      {/* Main overlay chart */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)', marginBottom: 14 }}>
          {metricSet.label}
        </div>
        <AlmLineChart series={series} height={260} />
      </Card>

      {/* Per-facility mini-sparklines for the left metric */}
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)', marginBottom: 12 }}>
        {metricSet.leftName} by Facility
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {perFacility.length === 0 ? (
          <div style={{ fontSize: 12, color: 'var(--alm-text-muted)' }}>No data in this window.</div>
        ) : (
          perFacility.map((f) => (
            <Card key={f.facility}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--alm-text)' }}>{f.facility}</div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--alm-text)', lineHeight: 1 }}>{fmtNum(f.latest)}</div>
                  <div style={{ fontSize: 10, color: f.delta === 0 ? 'var(--alm-text-faint)' : f.delta > 0 ? '#3a7a3a' : '#a04040' }}>
                    {f.delta === 0 ? '—' : `${f.delta > 0 ? '+' : ''}${fmtNum(f.delta)} vs start`}
                  </div>
                </div>
              </div>
              <AlmLineChart series={[{ name: metricSet.leftName, points: f.points, axis: 'left' }]} height={90} />
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
