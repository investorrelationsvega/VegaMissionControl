// ═══════════════════════════════════════════════
// ALM — Today / Overview View
// Snapshot of the latest per-facility state, with
// summary stats (drill down to property + fund
// level breakdown) and referrals aggregated over
// the selected time range.
// ═══════════════════════════════════════════════

import { useMemo, useState } from 'react';
import useAlmData from '../hooks/useAlmData';
import AlmRangePicker from '../components/AlmRangePicker';
import AlmFacilityFilter from '../components/AlmFacilityFilter';
import AlmSparkline from '../components/AlmSparkline';
import AlmInlineSync from '../components/AlmInlineSync';
import { latestPerFacility } from '../services/almDataService';
import { fmtNum, fmtDate, fmtPct, dateKey } from '../utils/format';
import { computeRange, rangeLabel, rowInRange } from '../utils/range';
import { ALL_SCOPE, rowInScope, facilityInScope } from '../utils/scope';
import { FUNDS, fundForFacility, facilitiesInFund } from '../config/funds';
import { ALL_HOMES, facilityCapacity } from '../config/facilities';

// Each stat card has a metric config. `kind: snapshot` means we use
// the most recent in-range row per facility (current-state metrics);
// `kind: sum` means we accumulate the field across every row in range.
const STAT_METRICS = [
  { id: 'census',         label: 'Total Census',   kind: 'snapshot', field: 'census'         },
  { id: 'admissions',     label: 'Admits',         kind: 'sum',      field: 'admissions'     },
  { id: 'discharges',     label: 'Discharges',     kind: 'sum',      field: 'discharges'     },
  { id: 'tours',          label: 'Tour Inquiries', kind: 'sum',      field: 'tours'          },
  { id: 'incidentCount',  label: 'Incidents',      kind: 'sum',      field: 'incidentCount'  },
];

const STATUS_TONE = {
  'Fully staffed': { dot: 'var(--alm-up)',    label: 'Fully staffed' },
  'Manageable':    { dot: 'var(--alm-ink-5)', label: 'Manageable'    },
  'Short-staffed': { dot: 'var(--alm-down)',  label: 'Short-staffed' },
};
const statusTone = (s) => (s && STATUS_TONE[s]) || { dot: 'var(--alm-ink-5)', label: s || 'Unknown' };

function ReportingPanel({ reportedSet, scope, lastReportByFacility, rangeLabel }) {
  const inScope = ALL_HOMES.filter((h) => facilityInScope(h, scope));
  const reportedCount = inScope.filter((h) => reportedSet.has(h)).length;
  return (
    <div className="alm-reporting-panel">
      <div className="alm-reporting-panel__head">
        <span>Reporting status · {rangeLabel}</span>
        <span>{reportedCount} of {inScope.length} reported</span>
      </div>
      {inScope.length === 0 ? (
        <div style={{ fontSize: 13, color: 'var(--alm-ink-4)', padding: '6px 0' }}>
          No homes in scope.
        </div>
      ) : (
        inScope.map((home) => {
          const reported = reportedSet.has(home);
          const fund = fundForFacility(home);
          const lastSeen = lastReportByFacility?.get(home);
          return (
            <div key={home} className="alm-reporting-row">
              <div className="alm-reporting-row__name">
                <span>{home}</span>
                {fund && <span className="alm-reporting-row__fund">{fund.label}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                {!reported && lastSeen && (
                  <span style={{ fontSize: 12, color: 'var(--alm-ink-4)', fontStyle: 'italic' }}>
                    last: {fmtDate(lastSeen)}
                  </span>
                )}
                {!reported && !lastSeen && (
                  <span style={{ fontSize: 12, color: 'var(--alm-ink-4)', fontStyle: 'italic' }}>
                    never reported
                  </span>
                )}
                <span
                  className={`alm-reporting-row__status alm-reporting-row__status--${reported ? 'reported' : 'pending'}`}
                >
                  <span className={`alm-reporting-row__mark${reported ? ' alm-reporting-row__mark--reported' : ''}`}>
                    {reported ? '✓' : ''}
                  </span>
                  {reported ? 'Reported' : 'Not yet'}
                </span>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function SummaryStatCard({ metric, value, sub, sparkPoints, active, onClick }) {
  return (
    <button
      type="button"
      className={`alm-stat-card${active ? ' alm-stat-card--active' : ''}`}
      onClick={onClick}
      aria-pressed={active}
    >
      <div className="alm-stat-card__top">
        <div className="alm-stat-label" style={{ margin: 0 }}>{metric.label}</div>
        {sparkPoints && sparkPoints.length >= 2 && (
          <div className="alm-stat-card__spark">
            <AlmSparkline points={sparkPoints} width={72} height={18} />
          </div>
        )}
      </div>
      <div className="alm-stat-value">{value}</div>
      {sub && <div className="alm-stat-sub">{sub}</div>}
    </button>
  );
}

function BreakdownPanel({ metric, total, fundBlocks, onClose }) {
  return (
    <div className="alm-breakdown" role="region" aria-label={`${metric.label} breakdown`}>
      <div className="alm-breakdown__head">
        <div>
          <div className="alm-stat-label" style={{ margin: 0 }}>{metric.label} · Breakdown</div>
          <div className="alm-display" style={{ fontSize: 28, lineHeight: 1, marginTop: 8 }}>
            {fmtNum(total)}
          </div>
        </div>
        <button className="alm-breakdown__close" onClick={onClose} aria-label="Close breakdown">
          Close ×
        </button>
      </div>

      <div className="alm-two-col">
        {fundBlocks.map(({ fund, subtotal, rows }) => (
          <div key={fund.id}>
            <div className="alm-breakdown__fund-head">
              <span className="alm-breakdown__fund-label">{fund.label}</span>
              <span className="alm-breakdown__fund-total">{fmtNum(subtotal)}</span>
            </div>
            {rows.length === 0 ? (
              <div className="alm-breakdown__empty">No facilities in scope</div>
            ) : (
              rows.map((r) => (
                <div key={r.facility} className="alm-breakdown__row">
                  <span>{r.facility}</span>
                  <span className="alm-breakdown__row-value">{fmtNum(r.value)}</span>
                </div>
              ))
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FacilityCard({ facility, latest, totals, isMultiDay }) {
  const tone = statusTone(latest?.staffingStatus);
  const capacity = facilityCapacity(facility);
  const occupancy = capacity && latest?.census ? (latest.census / capacity) * 100 : null;
  return (
    <div className="alm-card alm-card--hover alm-card--p">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div className="alm-serif" style={{ fontSize: 19, fontWeight: 500, color: 'var(--alm-ink-1)', letterSpacing: '-0.005em', lineHeight: 1.15 }}>
            {facility}
          </div>
          <div className="alm-serif" style={{ fontSize: 10, color: 'var(--alm-ink-4)', marginTop: 4, letterSpacing: '0.06em' }}>
            {latest ? `LAST REPORT · ${fmtDate(latest.date).toUpperCase()}` : 'NO SUBMISSIONS IN RANGE'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="alm-display" style={{ fontSize: 32, lineHeight: 1 }}>
            {latest ? fmtNum(latest.census) : '—'}
          </div>
          <div className="alm-serif" style={{ fontSize: 9, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.18em', marginTop: 4 }}>
            {capacity ? `of ${capacity} · ${fmtPct(occupancy, 0) || '—'}` : 'Census'}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--alm-border)' }}>
        {[
          { label: 'Admits',     value: totals.admissions },
          { label: 'Discharges', value: totals.discharges },
          { label: 'Inquiries',  value: totals.inquiryCalls },
          { label: 'Tours',      value: totals.tours },
        ].map((m) => (
          <div key={m.label}>
            <div className="alm-serif" style={{ fontSize: 9, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 4 }}>
              {m.label}{isMultiDay ? ' Σ' : ''}
            </div>
            <div className="alm-num" style={{ fontSize: 20, fontWeight: 600, color: 'var(--alm-ink-1)', letterSpacing: '-0.01em', lineHeight: 1 }}>
              {fmtNum(m.value)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="alm-serif" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--alm-ink-3)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          <span className="alm-dot" style={{ background: tone.dot }} />
          {tone.label}
        </div>
        <div className="alm-serif" style={{ display: 'flex', gap: 12, fontSize: 10, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          {totals.incidents > 0 && <span>{totals.incidents} Incident{totals.incidents === 1 ? '' : 's'}</span>}
          {totals.changes > 0 && <span>{totals.changes} Change{totals.changes === 1 ? '' : 's'}</span>}
          {totals.incidents === 0 && totals.changes === 0 && <span>No incidents</span>}
        </div>
      </div>
    </div>
  );
}

// When preset=daily, rangeLabel returns "Today · Apr 17, 2026".
// The word "Today" is redundant with the page title, so strip the
// "Today · " prefix for the subtitle on daily.
function subtitleDateLabel(range) {
  const label = rangeLabel(range);
  return label.replace(/^Today\s*·\s*/, '');
}

export default function AlmToday() {
  const { rows, loading, error, lastSynced, refresh } = useAlmData();
  const [range, setRange] = useState(() => computeRange('daily'));
  const [scope, setScope] = useState(ALL_SCOPE);
  const [activeMetricId, setActiveMetricId] = useState(null);
  const [reportingOpen, setReportingOpen] = useState(true);

  const {
    facilities,
    latestByFacility,
    perFacilityLatest,
    perFacilityTotals,
    referralsInRange,
    summary,
    sparklines,
    breakdowns,
  } = useMemo(() => {
    const facs = ALL_HOMES.filter((f) => facilityInScope(f, scope));
    const ir = rows.filter((r) => rowInRange(r, range) && rowInScope(r, scope));
    const latest = latestPerFacility(ir);

    const latestMap = new Map(latest.map((r) => [r.facility, r]));

    const totalsMap = new Map();
    ir.forEach((r) => {
      const cur = totalsMap.get(r.facility) || {
        admissions: 0, discharges: 0, tours: 0, inquiryCalls: 0,
        referralsFromAdmissions: 0, incidents: 0, changes: 0,
      };
      cur.admissions              += r.admissions              || 0;
      cur.discharges              += r.discharges              || 0;
      cur.tours                   += r.tours                   || 0;
      cur.inquiryCalls            += r.inquiryCalls            || 0;
      cur.referralsFromAdmissions += r.referralsFromAdmissions || 0;
      cur.incidents               += r.incidentCount           || 0;
      cur.changes                 += r.changeOfConditionCount  || 0;
      totalsMap.set(r.facility, cur);
    });

    const sum = {
      census:                  latest.reduce((s, r) => s + (r.census                  || 0), 0),
      admissions:              ir.reduce(    (s, r) => s + (r.admissions              || 0), 0),
      discharges:              ir.reduce(    (s, r) => s + (r.discharges              || 0), 0),
      tours:                   ir.reduce(    (s, r) => s + (r.tours                   || 0), 0),
      inquiryCalls:            ir.reduce(    (s, r) => s + (r.inquiryCalls            || 0), 0),
      referralsFromAdmissions: ir.reduce(    (s, r) => s + (r.referralsFromAdmissions || 0), 0),
      incidentCount:           ir.reduce(    (s, r) => s + (r.incidentCount           || 0), 0),
      changeOfConditionCount:  ir.reduce(    (s, r) => s + (r.changeOfConditionCount  || 0), 0),
    };

    // Daily sparkline points per metric: sum of the metric's field across
    // all reporting facilities on that day. Shape over the window.
    const sparkMap = {};
    STAT_METRICS.forEach((m) => { sparkMap[m.id] = new Map(); });
    ir.forEach((r) => {
      const k = dateKey(r.date);
      STAT_METRICS.forEach((m) => {
        const v = r[m.field] || 0;
        sparkMap[m.id].set(k, (sparkMap[m.id].get(k) || 0) + v);
      });
    });
    const toPoints = (m) =>
      Array.from(sparkMap[m.id].entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => ({ date: k, value: v }));
    const sparkSeries = {};
    STAT_METRICS.forEach((m) => { sparkSeries[m.id] = toPoints(m); });

    // Breakdown tree per metric: fund → [{ facility, value }].
    const buildBreakdown = (m) => {
      const facValue = (fac) => {
        if (m.kind === 'snapshot') return latestMap.get(fac)?.[m.field] || 0;
        return totalsMap.get(fac)?.[m.field] || 0;
      };
      const blocks = FUNDS.map((fund) => {
        const facsInFund = facilitiesInFund(fund.id, facs);
        const blockRows = facsInFund
          .map((f) => ({ facility: f, value: facValue(f) }))
          .sort((a, b) => b.value - a.value);
        const subtotal = blockRows.reduce((s, r) => s + r.value, 0);
        return { fund, rows: blockRows, subtotal };
      });
      const total = blocks.reduce((s, b) => s + b.subtotal, 0);
      return { blocks, total };
    };
    const breakdownMap = {};
    STAT_METRICS.forEach((m) => { breakdownMap[m.id] = buildBreakdown(m); });

    return {
      facilities: facs,
      latestByFacility: latest,
      perFacilityLatest: latestMap,
      perFacilityTotals: totalsMap,
      summary: sum,
      sparklines: sparkSeries,
      breakdowns: breakdownMap,
    };
  }, [rows, range, scope]);

  const isMultiDay = range.preset !== 'daily';
  const reportedSet = useMemo(
    () => new Set(latestByFacility.map((r) => r.facility)),
    [latestByFacility],
  );
  // Last report date per facility across ALL rows — used to show
  // "last: Apr 22" for facilities that didn't report in-range.
  const lastReportByFacility = useMemo(() => {
    const map = new Map();
    rows.forEach((r) => {
      if (!r.facility || !r.date) return;
      const existing = map.get(r.facility);
      if (!existing || r.date > existing) map.set(r.facility, r.date);
    });
    return map;
  }, [rows]);
  const inScopeHomes = useMemo(
    () => ALL_HOMES.filter((h) => facilityInScope(h, scope)),
    [scope],
  );
  const reportedInScope = useMemo(
    () => inScopeHomes.filter((h) => reportedSet.has(h)).length,
    [inScopeHomes, reportedSet],
  );

  // Only render cards for homes that have actually submitted in range.
  // (Homes that haven't reported are visible via the "X/N Homes Reporting"
  // panel — avoids making the facility grid feel empty.)
  const facilityCards = facilities
    .filter((name) => perFacilityLatest.has(name))
    .map((name) => {
      const latest = perFacilityLatest.get(name) || null;
      const totals = perFacilityTotals.get(name) || {
        admissions: 0, discharges: 0, tours: 0, inquiryCalls: 0,
        referralsFromAdmissions: 0, incidents: 0, changes: 0,
      };
      return { facility: name, latest, totals };
    });

  const statDisplays = {
    census:        { value: fmtNum(summary.census),        sub: `${reportedInScope}/${inScopeHomes.length} reporting` },
    admissions:    { value: fmtNum(summary.admissions),    sub: `${summary.referralsFromAdmissions} from referral` },
    discharges:    { value: fmtNum(summary.discharges),    sub: null },
    tours:         { value: fmtNum(summary.tours),         sub: `${summary.inquiryCalls} inbound calls` },
    incidentCount: { value: fmtNum(summary.incidentCount), sub: `${summary.changeOfConditionCount} changes of condition` },
  };

  const activeMetric = STAT_METRICS.find((m) => m.id === activeMetricId);
  const activeBreakdown = activeMetric ? breakdowns[activeMetric.id] : null;

  return (
    <div className="alm-page">
      <div className="alm-page-header">
        <div className="alm-page-header__row">
          <div className="alm-page-header__main">
            <div className="alm-page-dot"><span>{isMultiDay ? 'Overview' : 'Today'}</span></div>
            <h1 className="alm-page-title">
              {isMultiDay ? 'Operational Overview' : 'Today at a Glance'}
            </h1>
            <p className="alm-page-subtitle">
              <button
                type="button"
                className={`alm-reporting-trigger${reportingOpen ? ' alm-reporting-trigger--open' : ''}`}
                onClick={() => setReportingOpen((v) => !v)}
                aria-expanded={reportingOpen}
              >
                {reportedInScope}/{inScopeHomes.length} Homes Reporting
                <span className="alm-reporting-trigger__caret" aria-hidden="true">▾</span>
              </button>
            </p>
          </div>
          <AlmInlineSync loading={loading} error={error} lastSynced={lastSynced} onRefresh={() => refresh(true)} dateLabel={subtitleDateLabel(range)} />
        </div>
      </div>

      {reportingOpen && (
        <ReportingPanel
          reportedSet={reportedSet}
          scope={scope}
          lastReportByFacility={lastReportByFacility}
          rangeLabel={isMultiDay ? rangeLabel(range) : fmtDate(range.to)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 28 }}>
        <AlmRangePicker value={range} onChange={setRange} />
        <AlmFacilityFilter value={scope} onChange={setScope} />
      </div>

      {rows.length === 0 && !loading ? (
        <div className="alm-card alm-card--p">
          <div style={{ fontSize: 13, color: 'var(--alm-ink-4)' }}>
            No rows found in the sheet yet. Daily form submissions will appear here.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
            {STAT_METRICS.map((m) => (
              <SummaryStatCard
                key={m.id}
                metric={m}
                value={statDisplays[m.id].value}
                sub={statDisplays[m.id].sub}
                sparkPoints={sparklines[m.id]}
                active={activeMetricId === m.id}
                onClick={() => setActiveMetricId((cur) => (cur === m.id ? null : m.id))}
              />
            ))}
          </div>

          {activeMetric && activeBreakdown && (
            <BreakdownPanel
              metric={activeMetric}
              total={activeBreakdown.total}
              fundBlocks={activeBreakdown.blocks}
              onClose={() => setActiveMetricId(null)}
            />
          )}

          <div className="alm-section"><span>Facilities</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginBottom: 8 }}>
            {facilityCards.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--alm-ink-4)' }}>No facilities reporting.</div>
            ) : (
              facilityCards.map((c) => <FacilityCard key={c.facility} {...c} isMultiDay={isMultiDay} />)
            )}
          </div>

        </>
      )}
    </div>
  );
}
