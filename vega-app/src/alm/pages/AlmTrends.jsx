// ═══════════════════════════════════════════════
// ALM — Trends
// Pick any combination of metrics to overlay on a
// shared time axis. Each line is independently
// normalized so metrics with different scales can
// be compared by shape.
// ═══════════════════════════════════════════════

import { useMemo, useState } from 'react';
import useAlmData from '../hooks/useAlmData';
import AlmInlineSync from '../components/AlmInlineSync';
import AlmRangePicker from '../components/AlmRangePicker';
import AlmFacilityFilter from '../components/AlmFacilityFilter';
import AlmLineChart from '../components/AlmLineChart';
import { uniqueFacilities } from '../services/almDataService';
import { fmtNum, dateKey } from '../utils/format';
import { computeRange, rangeLabel, rowInRange } from '../utils/range';
import { ALL_SCOPE, rowInScope, facilityInScope, scopeLabel } from '../utils/scope';

// Every metric is individually toggleable. `aggregate` controls how
// we combine multiple rows on the same day (e.g. across facilities).
const METRICS = [
  { id: 'census',            label: 'Census',            field: 'census',           aggregate: 'sum' },
  { id: 'admissions',        label: 'Admits',            field: 'admissions',       aggregate: 'sum' },
  { id: 'discharges',        label: 'Discharges',        field: 'discharges',       aggregate: 'sum' },
  { id: 'hospitalizations',  label: 'Hospitalizations',  field: 'hospitalizations', aggregate: 'sum' },
  { id: 'tours',             label: 'Tours',             field: 'tours',            aggregate: 'sum' },
  { id: 'inquiryCalls',      label: 'Inquiry Calls',     field: 'inquiryCalls',     aggregate: 'sum' },
  { id: 'walkIns',           label: 'Walk-ins',          field: 'walkIns',          aggregate: 'sum' },
  { id: 'outboundContacts',  label: 'Outbound Contacts', field: 'outboundContacts', aggregate: 'sum' },
  { id: 'followUps',         label: 'Follow-ups',        field: 'followUps',        aggregate: 'sum' },
  { id: 'referrals',         label: 'Referrals',         field: null,               aggregate: 'referrals' },
  { id: 'openShifts',        label: 'Open Shifts',       field: 'openShifts',       aggregate: 'sum' },
];

const MAX_OVERLAY = 6;

function valueForDay(rows, metric) {
  if (metric.aggregate === 'referrals') {
    return rows.reduce((s, r) => s + (r.referrals?.length || 0), 0);
  }
  return rows.reduce((s, r) => s + (r[metric.field] || 0), 0);
}

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

function buildSeries(rows, metricIds, range, scope) {
  const chosen = METRICS.filter((m) => metricIds.includes(m.id));
  const filtered = rows.filter((r) => rowInRange(r, range) && rowInScope(r, scope));

  const byDay = new Map();
  filtered.forEach((r) => {
    const k = dateKey(r.date);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k).push(r);
  });
  const sortedKeys = Array.from(byDay.keys()).sort();

  return {
    series: chosen.map((m) => ({
      name: m.label,
      points: sortedKeys.map((k) => ({
        x: byDay.get(k)[0].date,
        y: valueForDay(byDay.get(k), m),
      })),
    })),
    recordCount: filtered.length,
  };
}

export default function AlmTrends() {
  const { rows, loading, error, lastSynced, refresh } = useAlmData();
  const [range, setRange] = useState(() => computeRange('monthly'));
  const [scope, setScope] = useState(ALL_SCOPE);
  const [selectedMetrics, setSelectedMetrics] = useState(['census']);

  const facilities = useMemo(() => uniqueFacilities(rows), [rows]);

  const toggleMetric = (id) => {
    setSelectedMetrics((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_OVERLAY) return prev;
      return [...prev, id];
    });
  };

  const { series, recordCount } = useMemo(
    () => buildSeries(rows, selectedMetrics, range, scope),
    [rows, selectedMetrics, range, scope],
  );

  // Per-facility mini charts: same metrics per card, honoring the
  // active scope so fund selection narrows the grid too.
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
        const { series: s } = buildSeries(fRows, selectedMetrics, range, ALL_SCOPE);
        const primary = s[0];
        const latest = primary?.points[primary.points.length - 1]?.y ?? 0;
        const first = primary?.points[0]?.y ?? 0;
        return { facility, series: s, latest, delta: latest - first };
      })
      .sort((a, b) => b.latest - a.latest);
  }, [rows, selectedMetrics, range, scope]);

  const primaryLabel = METRICS.find((m) => m.id === selectedMetrics[0])?.label;
  const atMax = selectedMetrics.length >= MAX_OVERLAY;

  return (
    <div className="alm-page">
      <div className="alm-page-header">
        <div className="alm-page-header__row">
          <div className="alm-page-header__main">
            <div className="alm-page-dot"><span>Trends</span></div>
            <h1 className="alm-page-title">Trends &amp; Patterns</h1>
            <p className="alm-page-subtitle">
              {rangeLabel(range)} · {scopeLabel(scope)} · {recordCount} daily record{recordCount === 1 ? '' : 's'}
            </p>
          </div>
          <AlmInlineSync loading={loading} error={error} lastSynced={lastSynced} onRefresh={() => refresh(true)} />
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
        <AlmRangePicker value={range} onChange={setRange} />
        <AlmFacilityFilter value={scope} onChange={setScope} />
      </div>

      {/* Metric toggles */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div className="alm-mono" style={{ fontSize: 10, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.18em' }}>
            Metrics · {selectedMetrics.length}/{MAX_OVERLAY} selected
          </div>
          {selectedMetrics.length > 0 && (
            <button
              onClick={() => setSelectedMetrics([])}
              className="alm-mono"
              style={{
                fontSize: 10,
                background: 'transparent',
                border: 'none',
                color: 'var(--alm-ink-4)',
                cursor: 'pointer',
                textTransform: 'uppercase',
                letterSpacing: '0.16em',
                padding: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--alm-ink-1)')}
              onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--alm-ink-4)')}
            >
              Clear
            </button>
          )}
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

      {/* Main overlay chart */}
      <div className="alm-card alm-card--p" style={{ marginBottom: 8 }}>
        <AlmLineChart series={series} height={280} />
      </div>

      {/* Per-facility mini charts */}
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
                      <div className="alm-serif" style={{ fontSize: 17, fontWeight: 500, color: 'var(--alm-ink-1)', letterSpacing: '-0.005em' }}>
                        {f.facility}
                      </div>
                      <div className="alm-mono" style={{ fontSize: 9, color: 'var(--alm-ink-5)', textTransform: 'uppercase', letterSpacing: '0.16em', marginTop: 4 }}>
                        {primaryLabel}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div className="alm-display" style={{ fontSize: 24, lineHeight: 1 }}>{fmtNum(f.latest)}</div>
                      <div
                        className="alm-mono"
                        style={{
                          fontSize: 10,
                          marginTop: 4,
                          letterSpacing: '0.08em',
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
