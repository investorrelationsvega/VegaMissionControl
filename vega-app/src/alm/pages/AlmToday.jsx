// ═══════════════════════════════════════════════
// ALM — Today / Overview View
// Snapshot of the latest per-facility state, with
// summary stats and referrals aggregated over the
// selected time range.
// ═══════════════════════════════════════════════

import { useMemo, useState } from 'react';
import useAlmData from '../hooks/useAlmData';
import AlmStatusBar from '../components/AlmStatusBar';
import AlmRangePicker from '../components/AlmRangePicker';
import { latestPerFacility, uniqueFacilities } from '../services/almDataService';
import { fmtNum, fmtDate } from '../utils/format';
import { computeRange, rangeLabel, rowInRange } from '../utils/range';

const STATUS_TONE = {
  'Fully staffed': { dot: 'var(--alm-up)',   label: 'Fully staffed' },
  'Understaffed':  { dot: 'var(--alm-down)', label: 'Understaffed'  },
  'Short-staffed': { dot: 'var(--alm-down)', label: 'Short-staffed' },
  'Overstaffed':   { dot: 'var(--alm-ink-5)',label: 'Overstaffed'   },
};
const statusTone = (s) => (s && STATUS_TONE[s]) || { dot: 'var(--alm-ink-5)', label: s || 'Unknown' };

function SummaryStat({ label, value, sub }) {
  return (
    <div className="alm-card alm-card--p">
      <div className="alm-stat-label">{label}</div>
      <div className="alm-stat-value">{value}</div>
      {sub && <div className="alm-stat-sub">{sub}</div>}
    </div>
  );
}

function FacilityCard({ facility, latest, totals, isMultiDay }) {
  const tone = statusTone(latest?.staffingStatus);
  return (
    <div className="alm-card alm-card--hover alm-card--p">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--alm-ink-1)', letterSpacing: '-0.005em' }}>
            {facility}
          </div>
          <div className="alm-mono" style={{ fontSize: 10, color: 'var(--alm-ink-4)', marginTop: 4, letterSpacing: '0.06em' }}>
            {latest ? `LAST REPORT · ${fmtDate(latest.date).toUpperCase()}` : 'NO SUBMISSIONS IN RANGE'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="alm-display" style={{ fontSize: 32, lineHeight: 1 }}>
            {latest ? fmtNum(latest.census) : '—'}
          </div>
          <div className="alm-mono" style={{ fontSize: 9, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.18em', marginTop: 4 }}>
            Census
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16, paddingBottom: 16, borderBottom: '1px solid var(--alm-border)' }}>
        {[
          { label: 'Admits',     value: totals.admissions },
          { label: 'Discharges', value: totals.discharges },
          { label: 'Hosp.',      value: totals.hospitalizations },
          { label: 'Tours',      value: totals.tours },
        ].map((m) => (
          <div key={m.label}>
            <div className="alm-mono" style={{ fontSize: 9, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.18em', marginBottom: 4 }}>
              {m.label}{isMultiDay ? ' Σ' : ''}
            </div>
            <div className="alm-num" style={{ fontSize: 18, fontWeight: 300, color: 'var(--alm-ink-1)', letterSpacing: '-0.01em', lineHeight: 1 }}>
              {fmtNum(m.value)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="alm-mono" style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 10, color: 'var(--alm-ink-3)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          <span className="alm-dot" style={{ background: tone.dot }} />
          {tone.label}
          {latest?.openShifts > 0 && (
            <span style={{ color: 'var(--alm-ink-4)' }}> · {latest.openShifts} Open</span>
          )}
        </div>
        <div className="alm-mono" style={{ fontSize: 10, color: 'var(--alm-ink-4)', textTransform: 'uppercase', letterSpacing: '0.14em' }}>
          {latest?.vacantBeds ? 'Vacant beds' : latest ? 'Full' : '—'}
        </div>
      </div>
    </div>
  );
}

export default function AlmToday() {
  const { rows, loading, error, lastSynced, refresh } = useAlmData();
  const [range, setRange] = useState(() => computeRange('daily'));

  const { facilities, inRange, latestByFacility, perFacilityTotals, referralsInRange, summary } = useMemo(() => {
    const facs = uniqueFacilities(rows);
    const ir = rows.filter((r) => rowInRange(r, range));
    const latest = latestPerFacility(ir);

    const totalsMap = new Map();
    ir.forEach((r) => {
      const cur = totalsMap.get(r.facility) || { admissions: 0, discharges: 0, hospitalizations: 0, tours: 0 };
      cur.admissions += r.admissions || 0;
      cur.discharges += r.discharges || 0;
      cur.hospitalizations += r.hospitalizations || 0;
      cur.tours += r.tours || 0;
      totalsMap.set(r.facility, cur);
    });

    const refs = [];
    ir.forEach((r) => {
      (r.referrals || []).forEach((ref) => {
        refs.push({ ...ref, facility: r.facility, date: r.date });
      });
    });
    refs.sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0));

    const sum = {
      census: latest.reduce((s, r) => s + (r.census || 0), 0),
      admissions: ir.reduce((s, r) => s + (r.admissions || 0), 0),
      discharges: ir.reduce((s, r) => s + (r.discharges || 0), 0),
      hospitalizations: ir.reduce((s, r) => s + (r.hospitalizations || 0), 0),
      tours: ir.reduce((s, r) => s + (r.tours || 0), 0),
      openShifts: latest.reduce((s, r) => s + (r.openShifts || 0), 0),
    };

    return {
      facilities: facs,
      inRange: ir,
      latestByFacility: latest,
      perFacilityTotals: totalsMap,
      referralsInRange: refs,
      summary: sum,
    };
  }, [rows, range]);

  const isMultiDay = range.preset !== 'daily';

  const facilityCards = facilities.map((name) => {
    const latest = latestByFacility.find((r) => r.facility === name) || null;
    const totals = perFacilityTotals.get(name) || { admissions: 0, discharges: 0, hospitalizations: 0, tours: 0 };
    return { facility: name, latest, totals };
  });

  return (
    <div className="alm-page">
      <div className="alm-page-header">
        <div className="alm-page-dot"><span>{isMultiDay ? 'Overview' : 'Today'}</span></div>
        <h1 className="alm-page-title">
          {isMultiDay ? 'Operational overview' : 'Today at a glance'}
        </h1>
        <p className="alm-page-subtitle">
          {rangeLabel(range)}{facilities.length > 0 && ` · ${facilities.length} facilities reporting`}
        </p>
      </div>

      <AlmStatusBar loading={loading} error={error} lastSynced={lastSynced} onRefresh={() => refresh(true)} />

      <div style={{ marginBottom: 32 }}>
        <AlmRangePicker value={range} onChange={setRange} />
      </div>

      {rows.length === 0 && !loading ? (
        <div className="alm-card alm-card--p">
          <div style={{ fontSize: 13, color: 'var(--alm-ink-4)' }}>
            No rows found in the sheet yet. Daily form submissions will appear here.
          </div>
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 12 }}>
            <SummaryStat label="Total Census" value={fmtNum(summary.census)} sub={`${latestByFacility.length} of ${facilities.length || '—'} reporting`} />
            <SummaryStat label={isMultiDay ? 'Admits · Period' : 'Admits Today'} value={fmtNum(summary.admissions)} sub={`${summary.discharges} discharges`} />
            <SummaryStat label="Hospitalizations" value={fmtNum(summary.hospitalizations)} />
            <SummaryStat label="Tours" value={fmtNum(summary.tours)} sub={`${referralsInRange.length} referrals`} />
            <SummaryStat label="Open Shifts" value={fmtNum(summary.openShifts)} />
          </div>

          <div className="alm-section"><span>Facilities</span></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginBottom: 8 }}>
            {facilityCards.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--alm-ink-4)' }}>No facilities reporting.</div>
            ) : (
              facilityCards.map((c) => <FacilityCard key={c.facility} {...c} isMultiDay={isMultiDay} />)
            )}
          </div>

          {referralsInRange.length > 0 && (
            <>
              <div className="alm-section"><span>{isMultiDay ? 'Referrals in Range' : 'Referrals Today'}</span></div>
              <div className="alm-card alm-card--flush">
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
                    {referralsInRange.slice(0, 50).map((r, i) => (
                      <tr key={i}>
                        <td className="muted">{fmtDate(r.date)}</td>
                        <td>{r.facility}</td>
                        <td>{r.source}{r.other ? ` — ${r.other}` : ''}</td>
                        <td className="muted" style={{ whiteSpace: 'pre-wrap' }}>{r.comments || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
