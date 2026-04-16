// ═══════════════════════════════════════════════
// ALM — Trends
// Pick any combination of metrics to overlay on a
// shared time axis. Each line is independently
// normalized so metrics with different scales can
// be compared by shape.
// ═══════════════════════════════════════════════

import { useMemo, useState } from 'react';
import useAlmData from '../hooks/useAlmData';
import AlmStatusBar from '../components/AlmStatusBar';
import AlmRangePicker from '../components/AlmRangePicker';
import AlmLineChart from '../components/AlmLineChart';
import { uniqueFacilities } from '../services/almDataService';
import { fmtNum, dateKey } from '../utils/format';
import { computeRange, rangeLabel, rowInRange } from '../utils/range';

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

function MetricChip({ metric, active, disabled, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled && !active}
      style={{
        fontSize: 12,
        padding: '6px 12px',
        borderRadius: 999,
        border: '1px solid ' + (active ? 'var(--alm-text)' : 'var(--alm-border)'),
        background: active ? 'var(--alm-text)' : 'transparent',
        color: active ? '#fff' : (disabled ? 'var(--alm-text-faint)' : 'var(--alm-text-muted)'),
        cursor: disabled && !active ? 'not-allowed' : 'pointer',
        opacity: disabled && !active ? 0.5 : 1,
      }}
    >
      {metric.label}
    </button>
  );
}

function buildSeries(rows, metricIds, range, facilityFilter) {
  const chosen = METRICS.filter((m) => metricIds.includes(m.id));
  const filtered = rows.filter((r) => {
    if (!rowInRange(r, range)) return false;
    if (facilityFilter !== 'all' && r.facility !== facilityFilter) return false;
    return true;
  });

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
  const [facilityFilter, setFacilityFilter] = useState('all');
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
    () => buildSeries(rows, selectedMetrics, range, facilityFilter),
    [rows, selectedMetrics, range, facilityFilter],
  );

  // Per-facility mini charts: same metrics per card
  const perFacilitySeries = useMemo(() => {
    if (selectedMetrics.length === 0) return [];
    const perFacFiltered = rows.filter((r) => rowInRange(r, range));
    const byFacility = new Map();
    perFacFiltered.forEach((r) => {
      if (!byFacility.has(r.facility)) byFacility.set(r.facility, []);
      byFacility.get(r.facility).push(r);
    });

    return Array.from(byFacility.entries()).map(([facility, fRows]) => {
      const { series: s } = buildSeries(fRows, selectedMetrics, range, 'all');
      const primary = s[0];
      const latest = primary?.points[primary.points.length - 1]?.y ?? 0;
      const first = primary?.points[0]?.y ?? 0;
      return { facility, series: s, latest, delta: latest - first };
    }).sort((a, b) => b.latest - a.latest);
  }, [rows, selectedMetrics, range]);

  const primaryLabel = METRICS.find((m) => m.id === selectedMetrics[0])?.label;
  const atMax = selectedMetrics.length >= MAX_OVERLAY;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 32 }}>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--alm-text)' }}>
          Trends
        </h1>
        <p style={{ fontSize: 13, color: 'var(--alm-text-muted)', margin: '4px 0 0' }}>
          {rangeLabel(range)} · pick any metrics to overlay and compare shape.
        </p>
      </div>

      <AlmStatusBar loading={loading} error={error} lastSynced={lastSynced} onRefresh={() => refresh(true)} />

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
        <AlmRangePicker value={range} onChange={setRange} />
        <select
          value={facilityFilter}
          onChange={(e) => setFacilityFilter(e.target.value)}
          style={{ fontSize: 12, padding: '5px 8px', border: '1px solid var(--alm-border)', borderRadius: 3, background: 'var(--alm-bg)', color: 'var(--alm-text)' }}
        >
          <option value="all">All facilities</option>
          {facilities.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <span style={{ fontSize: 11, color: 'var(--alm-text-faint)' }}>
          {recordCount} daily record{recordCount === 1 ? '' : 's'}
        </span>
      </div>

      {/* Metric toggles */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)' }}>
            Metrics · {selectedMetrics.length}/{MAX_OVERLAY} selected
          </div>
          {selectedMetrics.length > 0 && (
            <button
              onClick={() => setSelectedMetrics([])}
              style={{
                fontSize: 11,
                background: 'transparent',
                border: 'none',
                color: 'var(--alm-text-muted)',
                cursor: 'pointer',
                textDecoration: 'underline',
              }}
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
      <Card style={{ marginBottom: 24 }}>
        <AlmLineChart series={series} height={280} />
      </Card>

      {/* Per-facility mini charts */}
      {selectedMetrics.length > 0 && (
        <>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)', marginBottom: 12 }}>
            By Facility {primaryLabel && <span style={{ color: 'var(--alm-text-muted)', textTransform: 'none', letterSpacing: 0 }}> · latest {primaryLabel}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
            {perFacilitySeries.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--alm-text-muted)' }}>No data in this window.</div>
            ) : (
              perFacilitySeries.map((f) => (
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
                  <AlmLineChart series={f.series} height={110} showLegend={false} />
                </Card>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
}
