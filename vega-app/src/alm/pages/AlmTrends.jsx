// ═══════════════════════════════════════════════
// ALM — Trends & Patterns
// Five analysis sections built for investor-grade
// operational transparency:
//   1. Portfolio Occupancy — census/capacity trend
//   2. Period Comparison — current vs prior period
//   3. Net Movement — admits minus discharges
//   4. Metric Explorer — multi-metric overlay
//   5. Discharge Cause Mix — cause breakdown
// ═══════════════════════════════════════════════

import { useMemo, useState } from 'react';
import useAlmData from '../hooks/useAlmData';
import AlmInlineSync from '../components/AlmInlineSync';
import AlmRangePicker from '../components/AlmRangePicker';
import AlmFacilityFilter from '../components/AlmFacilityFilter';
import AlmLineChart from '../components/AlmLineChart';
import { uniqueFacilities } from '../services/almDataService';
import { FACILITY_CONFIG, facilityCapacity } from '../config/facilities';
import { fmtNum, fmtPct, fmtDateShort, dateKey } from '../utils/format';
import { computeRange, rangeLabel, rowInRange } from '../utils/range';
import { ALL_SCOPE, rowInScope, facilityInScope, scopeLabel } from '../utils/scope';

// ── Metric definitions ──────────────────────────────────
const METRICS = [
  { id: 'census',                  label: 'Census',                 field: 'census',                  aggregate: 'sum' },
  { id: 'admissions',              label: 'Admits',                 field: 'admissions',              aggregate: 'sum' },
  { id: 'referralsFromAdmissions', label: 'Admits from Referral',   field: 'referralsFromAdmissions', aggregate: 'sum' },
  { id: 'discharges',              label: 'Discharges',             field: 'discharges',              aggregate: 'sum' },
  { id: 'inquiryCalls',            label: 'Inbound Calls',          field: 'inquiryCalls',            aggregate: 'sum' },
  { id: 'tours',                   label: 'Tours',                  field: 'tours',                   aggregate: 'sum' },
  { id: 'incidentCount',           label: 'Incidents',              field: 'incidentCount',           aggregate: 'sum' },
  { id: 'changeOfConditionCount',  label: 'Changes of Condition',   field: 'changeOfConditionCount',  aggregate: 'sum' },
];

const COMPARISON_METRICS = [
  { id: 'census',      label: 'Avg Census',    field: 'census',      mode: 'avg' },
  { id: 'admissions',  label: 'Admits',         field: 'admissions',  mode: 'sum' },
  { id: 'discharges',  label: 'Discharges',     field: 'discharges',  mode: 'sum' },
  { id: 'tours',       label: 'Tours',          field: 'tours',       mode: 'sum' },
  { id: 'inquiryCalls',label: 'Calls',          field: 'inquiryCalls',mode: 'sum' },
  { id: 'incidentCount',label: 'Incidents',     field: 'incidentCount',mode: 'sum' },
];

const MAX_OVERLAY = 6;

// ── Data helpers ────────────────────────────────────────

function groupByDay(rows) {
  const byDay = new Map();
  rows.forEach((r) => {
    const k = dateKey(r.date);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(r);
  });
  return byDay;
}

function valueForDay(dayRows, field) {
  return dayRows.reduce((s, r) => s + (r[field] || 0), 0);
}

function rollingAverage(points, windowSize) {
  return points.map((p, i) => {
    const start = Math.max(0, i - windowSize + 1);
    const window = points.slice(start, i + 1).filter((w) => w.y != null);
    if (window.length === 0) return { x: p.x, y: null };
    const avg = window.reduce((s, w) => s + w.y, 0) / window.length;
    return { x: p.x, y: Math.round(avg * 10) / 10 };
  });
}

function totalCapacity(rows, scope) {
  if (scope?.type === 'facility') {
    return facilityCapacity(scope.value);
  }
  if (scope?.type === 'fund') {
    return FACILITY_CONFIG
      .filter((f) => facilityInScope(f.name, scope))
      .reduce((s, f) => s + f.capacity, 0);
  }
  return FACILITY_CONFIG.reduce((s, f) => s + f.capacity, 0);
}

// ── Section: Portfolio Occupancy ─────────────────────────

function useOccupancyData(rows, range, scope) {
  return useMemo(() => {
    const filtered = rows.filter((r) => rowInRange(r, range) && rowInScope(r, scope));
    const byDay = groupByDay(filtered);
    const sortedKeys = Array.from(byDay.keys()).sort();
    const cap = totalCapacity(rows, scope);

    const censusPoints = sortedKeys.map((k) => {
      const dayRows = byDay.get(k);
      const census = valueForDay(dayRows, 'census');
      return { x: dayRows[0].date, y: census };
    });

    const occupancyPoints = censusPoints.map((p) => ({
      x: p.x,
      y: cap > 0 ? Math.round((p.y / cap) * 1000) / 10 : null,
    }));

    const rollingOccupancy = rollingAverage(occupancyPoints, 7);

    const latestCensus = censusPoints.length > 0 ? censusPoints[censusPoints.length - 1].y : 0;
    const latestOccPct = cap > 0 ? (latestCensus / cap) * 100 : 0;

    return {
      censusPoints,
      occupancySeries: [
        { name: 'Occupancy %', points: occupancyPoints },
        { name: '7-Day Avg', points: rollingOccupancy },
      ],
      latestCensus,
      latestOccPct,
      capacity: cap,
    };
  }, [rows, range, scope]);
}

// ── Section: Period Comparison ───────────────────────────

function usePeriodComparison(rows, range, scope) {
  return useMemo(() => {
    const filtered = rows.filter((r) => rowInScope(r, scope));
    if (!range.from || !range.to) return { current: {}, previous: {}, baseline: {} };

    const periodMs = range.to.getTime() - range.from.getTime();
    const prevFrom = new Date(range.from.getTime() - periodMs);
    const prevTo = new Date(range.from.getTime() - 1);

    const baselineFrom = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const baselineTo = new Date();

    const inWindow = (r, from, to) => r.date >= from && r.date <= to;

    const computeStats = (windowRows) => {
      const byDay = groupByDay(windowRows);
      const dayCount = byDay.size || 1;
      const result = {};
      COMPARISON_METRICS.forEach((m) => {
        const total = windowRows.reduce((s, r) => s + (r[m.field] || 0), 0);
        result[m.id] = m.mode === 'avg' ? Math.round(total / dayCount) : total;
      });
      result._days = byDay.size;
      return result;
    };

    const current = computeStats(filtered.filter((r) => inWindow(r, range.from, range.to)));
    const previous = computeStats(filtered.filter((r) => inWindow(r, prevFrom, prevTo)));
    const baseline = computeStats(filtered.filter((r) => inWindow(r, baselineFrom, baselineTo)));

    return { current, previous, baseline };
  }, [rows, range, scope]);
}

// ── Section: Net Movement ───────────────────────────────

function useNetMovement(rows, range, scope) {
  return useMemo(() => {
    const filtered = rows.filter((r) => rowInRange(r, range) && rowInScope(r, scope));
    const byFacility = new Map();
    filtered.forEach((r) => {
      if (!byFacility.has(r.facility)) byFacility.set(r.facility, { admits: 0, discharges: 0 });
      const entry = byFacility.get(r.facility);
      entry.admits += r.admissions || 0;
      entry.discharges += r.discharges || 0;
    });

    return Array.from(byFacility.entries())
      .map(([facility, data]) => ({
        facility,
        admits: data.admits,
        discharges: data.discharges,
        net: data.admits - data.discharges,
      }))
      .sort((a, b) => b.net - a.net);
  }, [rows, range, scope]);
}

// ── Section: Discharge Cause Mix ────────────────────────

function useDischargeMix(rows, range, scope) {
  return useMemo(() => {
    const filtered = rows.filter((r) => rowInRange(r, range) && rowInScope(r, scope));

    const causeCounts = new Map();
    let totalDischarges = 0;
    filtered.forEach((r) => {
      (r.dischargeDetail || []).forEach((d) => {
        const cause = d.cause || 'Unknown';
        causeCounts.set(cause, (causeCounts.get(cause) || 0) + 1);
        totalDischarges++;
      });
    });

    const sorted = Array.from(causeCounts.entries())
      .map(([cause, count]) => ({ cause, count, pct: totalDischarges > 0 ? (count / totalDischarges) * 100 : 0 }))
      .sort((a, b) => b.count - a.count);

    return { causes: sorted, total: totalDischarges };
  }, [rows, range, scope]);
}

// ── Metric Explorer builder ─────────────────────────────

function buildSeries(rows, metricIds, range, scope, includeRolling) {
  const chosen = METRICS.filter((m) => metricIds.includes(m.id));
  const filtered = rows.filter((r) => rowInRange(r, range) && rowInScope(r, scope));

  const byDay = groupByDay(filtered);
  const sortedKeys = Array.from(byDay.keys()).sort();

  const series = [];
  chosen.forEach((m) => {
    const points = sortedKeys.map((k) => ({
      x: byDay.get(k)[0].date,
      y: valueForDay(byDay.get(k), m.field),
    }));
    series.push({ name: m.label, points });
    if (includeRolling && points.length >= 3) {
      series.push({ name: `${m.label} (7d avg)`, points: rollingAverage(points, 7) });
    }
  });

  return { series, recordCount: filtered.length };
}

// ── Sub-components ──────────────────────────────────────

function MetricChip({ metric, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !active}
      className={`alm-chip${active ? ' alm-chip--active' : ''}`}
    >
      {metric.label}
    </button>
  );
}

function ComparisonCard({ label, current, previous, baseline, mode }) {
  const delta = previous != null && previous !== 0
    ? ((current - previous) / Math.abs(previous)) * 100
    : null;
  const isUp = delta != null && delta > 0;
  const isDown = delta != null && delta < 0;

  return (
    <div className="alm-card alm-card--p" style={{ minWidth: 0 }}>
      <div className="alm-stat-label">{label}</div>
      <div className="alm-stat-value" style={{ fontSize: 28 }}>{fmtNum(current)}</div>
      <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ fontSize: 12, color: 'var(--alm-ink-4)', display: 'flex', justifyContent: 'space-between' }}>
          <span>vs prior period</span>
          {delta != null ? (
            <span style={{ color: isUp ? 'var(--alm-up)' : isDown ? 'var(--alm-down)' : 'var(--alm-ink-4)', fontWeight: 600 }}>
              {isUp ? '+' : ''}{delta.toFixed(1)}%
            </span>
          ) : (
            <span>--</span>
          )}
        </div>
        <div style={{ fontSize: 12, color: 'var(--alm-ink-5)', display: 'flex', justifyContent: 'space-between' }}>
          <span>90-day {mode === 'avg' ? 'avg' : 'total'}</span>
          <span>{fmtNum(baseline)}</span>
        </div>
      </div>
    </div>
  );
}

function NetMovementBar({ item, maxAbs }) {
  const barScale = maxAbs > 0 ? Math.abs(item.net) / maxAbs : 0;
  const barWidth = `${Math.max(barScale * 100, 2)}%`;
  const isPositive = item.net >= 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px dashed var(--alm-border)' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--alm-ink-2)', width: 180, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {item.facility}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', height: 20 }}>
        <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-end', paddingRight: 2 }}>
          {!isPositive && (
            <div style={{
              height: 16,
              width: barWidth,
              background: 'var(--alm-down)',
              borderRadius: '2px 0 0 2px',
              opacity: 0.75,
            }} />
          )}
        </div>
        <div style={{ width: 1, height: 24, background: 'var(--alm-border-strong)', flexShrink: 0 }} />
        <div style={{ width: '50%', display: 'flex', justifyContent: 'flex-start', paddingLeft: 2 }}>
          {isPositive && item.net > 0 && (
            <div style={{
              height: 16,
              width: barWidth,
              background: 'var(--alm-up)',
              borderRadius: '0 2px 2px 0',
              opacity: 0.75,
            }} />
          )}
        </div>
      </div>
      <div style={{
        fontSize: 13,
        fontWeight: 600,
        width: 60,
        textAlign: 'right',
        flexShrink: 0,
        fontVariantNumeric: 'tabular-nums',
        color: item.net > 0 ? 'var(--alm-up)' : item.net < 0 ? 'var(--alm-down)' : 'var(--alm-ink-4)',
      }}>
        {item.net > 0 ? '+' : ''}{item.net}
      </div>
      <div style={{ fontSize: 11, color: 'var(--alm-ink-5)', width: 80, textAlign: 'right', flexShrink: 0 }}>
        {item.admits}A / {item.discharges}D
      </div>
    </div>
  );
}

function CauseBar({ cause, count, pct, maxCount }) {
  const barWidth = maxCount > 0 ? `${(count / maxCount) * 100}%` : '0%';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--alm-ink-2)', width: 160, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {cause}
      </div>
      <div style={{ flex: 1, height: 14, background: 'var(--alm-surface-alt)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: barWidth, background: 'var(--alm-accent)', borderRadius: 2, opacity: 0.7, transition: 'width 0.3s ease' }} />
      </div>
      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--alm-ink-1)', width: 36, textAlign: 'right', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
        {count}
      </div>
      <div style={{ fontSize: 11, color: 'var(--alm-ink-4)', width: 44, textAlign: 'right', flexShrink: 0 }}>
        {fmtPct(pct, 0)}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════

export default function AlmTrends() {
  const { rows, loading, error, lastSynced, refresh } = useAlmData();
  const [range, setRange] = useState(() => computeRange('monthly'));
  const [scope, setScope] = useState(ALL_SCOPE);
  const [selectedMetrics, setSelectedMetrics] = useState(['census']);
  const [showRolling, setShowRolling] = useState(false);

  const facilities = useMemo(() => uniqueFacilities(rows), [rows]);
  const recordCount = useMemo(
    () => rows.filter((r) => rowInRange(r, range) && rowInScope(r, scope)).length,
    [rows, range, scope],
  );

  // Section data
  const occupancy = useOccupancyData(rows, range, scope);
  const { current, previous, baseline } = usePeriodComparison(rows, range, scope);
  const netMovement = useNetMovement(rows, range, scope);
  const dischargeMix = useDischargeMix(rows, range, scope);

  // Metric explorer
  const toggleMetric = (id) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_OVERLAY) return prev;
      return [...prev, id];
    });
  };

  const { series } = useMemo(
    () => buildSeries(rows, selectedMetrics, range, scope, showRolling),
    [rows, selectedMetrics, range, scope, showRolling],
  );

  const perFacilitySeries = useMemo(() => {
    if (selectedMetrics.length === 0) return [];
    const perFacFiltered = rows.filter((r) => rowInRange(r, range) && rowInScope(r, scope));
    const byFacility = new Map();
    perFacFiltered.forEach((r) => {
      if (!byFacility.has(r.facility)) byFacility.set(r.facility, []);
      byFacility.get(r.facility).push(r);
    });

    return Array.from(byFacility.entries())
      .filter(([facility]) => facilityInScope(facility, scope))
      .map(([facility, fRows]) => {
        const { series: s } = buildSeries(fRows, selectedMetrics, range, ALL_SCOPE, false);
        const primary = s[0];
        const latest = primary?.points[primary.points.length - 1]?.y ?? 0;
        const first = primary?.points[0]?.y ?? 0;
        return { facility, series: s, latest, delta: latest - first };
      })
      .sort((a, b) => b.latest - a.latest);
  }, [rows, selectedMetrics, range, scope]);

  const primaryLabel = METRICS.find((m) => m.id === selectedMetrics[0])?.label;
  const atMax = selectedMetrics.length >= MAX_OVERLAY;
  const maxAbsNet = netMovement.length > 0 ? Math.max(...netMovement.map((m) => Math.abs(m.net)), 1) : 1;

  return (
    <div className="alm-page">
      {/* ── Page header ────────────────────────────────── */}
      <div className="alm-page-header">
        <div className="alm-page-header__row">
          <div className="alm-page-header__main">
            <div className="alm-page-dot"><span>Trends</span></div>
            <h1 className="alm-page-title">Trends &amp; Patterns</h1>
            <p className="alm-page-subtitle">
              {scopeLabel(scope)} · {recordCount} daily record{recordCount === 1 ? '' : 's'}
            </p>
          </div>
          <AlmInlineSync loading={loading} error={error} lastSynced={lastSynced} onRefresh={() => refresh(true)} dateLabel={rangeLabel(range)} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        <AlmRangePicker value={range} onChange={setRange} />
        <AlmFacilityFilter value={scope} onChange={setScope} />
      </div>

      {/* ═══ 1. Portfolio Occupancy ═══════════════════ */}
      <div className="alm-section"><span>Portfolio Occupancy</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '200px 1fr', gap: 16, alignItems: 'stretch' }}>
        <div className="alm-card alm-card--p" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="alm-stat-label">Occupancy</div>
          <div className="alm-stat-value" style={{ fontSize: 36 }}>
            {fmtPct(occupancy.latestOccPct, 1)}
          </div>
          <div className="alm-stat-sub">
            {fmtNum(occupancy.latestCensus)} / {fmtNum(occupancy.capacity)} beds
          </div>
        </div>
        <div className="alm-card alm-card--p">
          <AlmLineChart series={occupancy.occupancySeries} height={160} />
        </div>
      </div>

      {/* ═══ 2. Period Comparison ═════════════════════ */}
      <div className="alm-section"><span>Period Comparison</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12 }}>
        {COMPARISON_METRICS.map((m) => (
          <ComparisonCard
            key={m.id}
            label={m.label}
            current={current[m.id] ?? 0}
            previous={previous[m.id]}
            baseline={baseline[m.id]}
            mode={m.mode}
          />
        ))}
      </div>

      {/* ═══ 3. Net Movement ═════════════════════════ */}
      <div className="alm-section"><span>Net Movement by Facility</span></div>
      <div className="alm-card alm-card--p">
        {netMovement.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--alm-ink-4)', textAlign: 'center', padding: 20 }}>
            No admission or discharge data in this period.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: 'var(--alm-ink-5)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                Discharges ←
              </div>
              <div style={{ fontSize: 11, color: 'var(--alm-ink-5)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                → Admissions
              </div>
            </div>
            {netMovement.map((item) => (
              <NetMovementBar key={item.facility} item={item} maxAbs={maxAbsNet} />
            ))}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 16 }}>
              <div style={{ fontSize: 11, color: 'var(--alm-ink-4)' }}>
                Portfolio net: <span style={{
                  fontWeight: 600,
                  color: netMovement.reduce((s, m) => s + m.net, 0) > 0 ? 'var(--alm-up)' :
                    netMovement.reduce((s, m) => s + m.net, 0) < 0 ? 'var(--alm-down)' : 'var(--alm-ink-4)',
                }}>
                  {netMovement.reduce((s, m) => s + m.net, 0) > 0 ? '+' : ''}
                  {netMovement.reduce((s, m) => s + m.net, 0)}
                </span>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ═══ 4. Metric Explorer ══════════════════════ */}
      <div className="alm-section"><span>Metric Explorer</span></div>

      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
            Metrics · {selectedMetrics.length}/{MAX_OVERLAY} selected
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <label style={{ fontSize: 11, color: 'var(--alm-ink-4)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showRolling}
                onChange={(e) => setShowRolling(e.target.checked)}
                style={{ accentColor: 'var(--alm-accent)' }}
              />
              7-day rolling avg
            </label>
            {selectedMetrics.length > 0 && (
              <button
                onClick={() => setSelectedMetrics([])}
                style={{
                  fontSize: 11,
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--alm-ink-4)',
                  cursor: 'pointer',
                  textTransform: 'uppercase',
                  letterSpacing: '0.03em',
                  padding: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--alm-ink-1)')}
                onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--alm-ink-4)')}
              >
                Clear
              </button>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {METRICS.map((m) => (
            <MetricChip
              key={m.id}
              metric={m}
              active={selectedMetrics.includes(m.id)}
              disabled={atMax}
              onClick={() => toggleMetric(m.id)}
            />
          ))}
        </div>
      </div>

      <div className="alm-card alm-card--p" style={{ marginBottom: 8 }}>
        <AlmLineChart series={series} height={280} />
      </div>

      {/* ═══ 5. Discharge Cause Mix ══════════════════ */}
      <div className="alm-section"><span>Discharge Causes</span></div>
      <div className="alm-card alm-card--p">
        {dischargeMix.causes.length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--alm-ink-4)', textAlign: 'center', padding: 20 }}>
            No discharge detail data in this period.
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
              <div style={{ fontSize: 11, color: 'var(--alm-ink-5)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                {dischargeMix.total} total discharge{dischargeMix.total === 1 ? '' : 's'} with cause data
              </div>
            </div>
            {dischargeMix.causes.map((c) => (
              <CauseBar
                key={c.cause}
                cause={c.cause}
                count={c.count}
                pct={c.pct}
                maxCount={dischargeMix.causes[0]?.count || 1}
              />
            ))}
          </>
        )}
      </div>

      {/* ═══ Per-Facility Mini Charts ════════════════ */}
      {selectedMetrics.length > 0 && (
        <>
          <div className="alm-section">
            <span>By Facility{primaryLabel ? ` · Latest ${primaryLabel}` : ''}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {perFacilitySeries.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--alm-ink-4)' }}>No data in this window.</div>
            ) : (
              perFacilitySeries.map((f) => (
                <div key={f.facility} className="alm-card alm-card--hover alm-card--p">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <div style={{ fontSize: 17, fontWeight: 500, color: 'var(--alm-ink-1)', letterSpacing: '-0.005em' }}>
                        {f.facility}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--alm-ink-5)', textTransform: 'uppercase', letterSpacing: '0.03em', marginTop: 4 }}>
                        {primaryLabel}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="alm-display" style={{ fontSize: 24, lineHeight: 1 }}>{fmtNum(f.latest)}</div>
                      <div
                        style={{
                          fontSize: 11,
                          marginTop: 4,
                          letterSpacing: '0.03em',
                          color: f.delta === 0 ? 'var(--alm-ink-5)' : f.delta > 0 ? 'var(--alm-up)' : 'var(--alm-down)',
                        }}
                      >
                        {f.delta === 0 ? '—' : `${f.delta > 0 ? '+' : ''}${fmtNum(f.delta)}`}
                      </div>
                    </div>
                  </div>
                  <AlmLineChart series={f.series} height={100} showLegend={false} />
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
