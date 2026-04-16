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
  'Fully staffed': { dot: '#3a7a3a', label: 'Fully staffed' },
  'Understaffed':  { dot: '#a04040', label: 'Understaffed' },
  'Short-staffed': { dot: '#a04040', label: 'Short-staffed' },
  'Overstaffed':   { dot: '#888888', label: 'Overstaffed' },
};
function statusTone(s) {
  if (!s) return { dot: '#cccccc', label: 'Unknown' };
  return STATUS_TONE[s] || { dot: '#888888', label: s };
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

function SummaryStat({ label, value, sub }) {
  return (
    <Card>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontSize: 26, fontWeight: 600, color: 'var(--alm-text)', lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontSize: 11, color: 'var(--alm-text-muted)', marginTop: 6 }}>
          {sub}
        </div>
      )}
    </Card>
  );
}

function FacilityCard({ facility, latest, totals, isMultiDay }) {
  const tone = statusTone(latest?.staffingStatus);
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--alm-text)' }}>
            {facility}
          </div>
          <div style={{ fontSize: 11, color: 'var(--alm-text-faint)', marginTop: 2 }}>
            {latest ? `Last report ${fmtDate(latest.date)}` : 'No submissions in range'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--alm-text)', lineHeight: 1 }}>
            {latest ? fmtNum(latest.census) : '--'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--alm-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
            Census
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Admits',     value: totals.admissions },
          { label: 'Discharges', value: totals.discharges },
          { label: 'Hosp.',      value: totals.hospitalizations },
          { label: 'Tours',      value: totals.tours },
        ].map((m) => (
          <div key={m.label}>
            <div style={{ fontSize: 10, color: 'var(--alm-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {m.label}
              {isMultiDay && <span style={{ textTransform: 'none', letterSpacing: 0 }}> Σ</span>}
            </div>
            <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--alm-text)' }}>
              {fmtNum(m.value)}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 12, borderTop: '1px solid var(--alm-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--alm-text-muted)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: tone.dot }} />
          {tone.label}
          {latest?.openShifts > 0 && (
            <span style={{ color: 'var(--alm-text-faint)' }}> · {latest.openShifts} open shift{latest.openShifts > 1 ? 's' : ''}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--alm-text-muted)' }}>
          {latest?.vacantBeds ? 'Vacant beds' : latest ? 'Full' : '—'}
        </div>
      </div>
    </Card>
  );
}

export default function AlmToday() {
  const { rows, loading, error, lastSynced, refresh } = useAlmData();
  const [range, setRange] = useState(() => computeRange('daily'));

  const { facilities, inRange, latestByFacility, perFacilityTotals, referralsInRange, summary } = useMemo(() => {
    const facs = uniqueFacilities(rows);
    const ir = rows.filter((r) => rowInRange(r, range));
    const latest = latestPerFacility(ir);

    // Per-facility totals over the range
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

  // Build the display list: every known facility, merged with its latest + totals
  const facilityCards = facilities.map((name) => {
    const latest = latestByFacility.find((r) => r.facility === name) || null;
    const totals = perFacilityTotals.get(name) || { admissions: 0, discharges: 0, hospitalizations: 0, tours: 0 };
    return { facility: name, latest, totals };
  });

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 32 }}>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--alm-text)' }}>
          {range.preset === 'daily' ? 'Today at a glance' : 'Overview'}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--alm-text-muted)', margin: '4px 0 0' }}>
          {rangeLabel(range)}
          {facilities.length > 0 && ` · ${facilities.length} facilities reporting`}
        </p>
      </div>

      <AlmStatusBar loading={loading} error={error} lastSynced={lastSynced} onRefresh={() => refresh(true)} />

      <div style={{ marginBottom: 24 }}>
        <AlmRangePicker value={range} onChange={setRange} />
      </div>

      {rows.length === 0 && !loading ? (
        <Card>
          <div style={{ fontSize: 13, color: 'var(--alm-text-muted)' }}>
            No rows found in the sheet yet. Daily form submissions will appear here.
          </div>
        </Card>
      ) : (
        <>
          {/* Summary stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 32 }}>
            <SummaryStat label="Total Census" value={fmtNum(summary.census)} sub={`${latestByFacility.length} of ${facilities.length || '--'} reporting`} />
            <SummaryStat label={isMultiDay ? 'Admits (period)' : 'Admits Today'} value={fmtNum(summary.admissions)} sub={`${summary.discharges} discharges`} />
            <SummaryStat label={isMultiDay ? 'Hospitalizations' : 'Hospitalizations'} value={fmtNum(summary.hospitalizations)} />
            <SummaryStat label="Tours" value={fmtNum(summary.tours)} sub={`${referralsInRange.length} referrals`} />
            <SummaryStat label="Open Shifts" value={fmtNum(summary.openShifts)} />
          </div>

          {/* Facility cards */}
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)', marginBottom: 12 }}>
            Facilities
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 32 }}>
            {facilityCards.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--alm-text-muted)' }}>No facilities reporting.</div>
            ) : (
              facilityCards.map((c) => <FacilityCard key={c.facility} {...c} isMultiDay={isMultiDay} />)
            )}
          </div>

          {/* Referrals in range */}
          {referralsInRange.length > 0 && (
            <>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)', marginBottom: 12 }}>
                {isMultiDay ? 'Referrals in Range' : 'Referrals Today'}
              </div>
              <Card style={{ padding: 0, marginBottom: 32 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--alm-border)' }}>
                      {['Date', 'Facility', 'Source', 'Comments'].map((h) => (
                        <th key={h} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, color: 'var(--alm-text-faint)', padding: '12px 16px' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {referralsInRange.slice(0, 50).map((r, i) => (
                      <tr key={i} style={{ borderBottom: i < Math.min(49, referralsInRange.length - 1) ? '1px solid var(--alm-border)' : 'none' }}>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--alm-text-muted)' }}>{fmtDate(r.date)}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--alm-text)' }}>{r.facility}</td>
                        <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--alm-text)' }}>
                          {r.source}{r.other ? ` — ${r.other}` : ''}
                        </td>
                        <td style={{ padding: '12px 16px', fontSize: 12, color: 'var(--alm-text-muted)', whiteSpace: 'pre-wrap' }}>
                          {r.comments || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}
        </>
      )}
    </div>
  );
}
