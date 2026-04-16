// ═══════════════════════════════════════════════
// ALM — Today View
// Per-facility snapshot of the most recent daily
// submission, plus a quick-read activity feed and
// the day's referrals pulled from the same rows.
// ═══════════════════════════════════════════════

import { useMemo } from 'react';
import useAlmData from '../hooks/useAlmData';
import AlmStatusBar from '../components/AlmStatusBar';
import { latestPerFacility, uniqueFacilities } from '../services/almDataService';
import { fmtNum, fmtDate, dateKey } from '../utils/format';

// Status → lightweight indicator
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

function FacilityCard({ row }) {
  const tone = statusTone(row.staffingStatus);
  return (
    <Card>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--alm-text)' }}>
            {row.facility}
          </div>
          <div style={{ fontSize: 11, color: 'var(--alm-text-faint)', marginTop: 2 }}>
            {fmtDate(row.date)}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 28, fontWeight: 600, color: 'var(--alm-text)', lineHeight: 1 }}>
            {fmtNum(row.census)}
          </div>
          <div style={{ fontSize: 10, color: 'var(--alm-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 2 }}>
            Census
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
        {[
          { label: 'Admits', value: row.admissions },
          { label: 'Discharges', value: row.discharges },
          { label: 'Hosp.', value: row.hospitalizations },
          { label: 'Tours', value: row.tours },
        ].map((m) => (
          <div key={m.label}>
            <div style={{ fontSize: 10, color: 'var(--alm-text-faint)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {m.label}
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
          {row.openShifts > 0 && (
            <span style={{ color: 'var(--alm-text-faint)' }}> · {row.openShifts} open shift{row.openShifts > 1 ? 's' : ''}</span>
          )}
        </div>
        <div style={{ fontSize: 11, color: 'var(--alm-text-muted)' }}>
          {row.vacantBeds ? 'Vacant beds' : 'Full'}
        </div>
      </div>
    </Card>
  );
}

function MissingCard({ facility }) {
  return (
    <Card style={{ opacity: 0.6 }}>
      <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--alm-text)' }}>
        {facility}
      </div>
      <div style={{ fontSize: 11, color: 'var(--alm-text-faint)', marginTop: 2, marginBottom: 14 }}>
        No submissions yet
      </div>
      <div style={{ fontSize: 11, color: 'var(--alm-text-muted)' }}>
        Waiting for daily form entry.
      </div>
    </Card>
  );
}

export default function AlmToday() {
  const { rows, loading, error, lastSynced, refresh } = useAlmData();

  const { latestByFacility, facilities, todaysRows, referralsToday } = useMemo(() => {
    const facs = uniqueFacilities(rows);
    const latest = latestPerFacility(rows);

    // "Today" = the most recent date observed across facilities.
    const mostRecentDate = rows.length
      ? [...rows].sort((a, b) => (b.date?.getTime() || 0) - (a.date?.getTime() || 0))[0].date
      : null;
    const mostRecentKey = mostRecentDate ? dateKey(mostRecentDate) : '';
    const todays = rows.filter((r) => dateKey(r.date) === mostRecentKey);

    const refs = [];
    todays.forEach((r) => {
      (r.referrals || []).forEach((ref) => {
        refs.push({ ...ref, facility: r.facility, date: r.date });
      });
    });

    return {
      latestByFacility: latest,
      facilities: facs,
      todaysRows: todays,
      referralsToday: refs,
    };
  }, [rows]);

  const totalCensus = todaysRows.reduce((s, r) => s + (r.census || 0), 0);
  const totalAdmits = todaysRows.reduce((s, r) => s + (r.admissions || 0), 0);
  const totalDischarges = todaysRows.reduce((s, r) => s + (r.discharges || 0), 0);
  const totalHosp = todaysRows.reduce((s, r) => s + (r.hospitalizations || 0), 0);
  const totalTours = todaysRows.reduce((s, r) => s + (r.tours || 0), 0);
  const openShiftsAll = todaysRows.reduce((s, r) => s + (r.openShifts || 0), 0);

  const asOfDate = todaysRows[0]?.date;

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: 32 }}>
      <div style={{ marginBottom: 8 }}>
        <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: 'var(--alm-text)' }}>
          Today at a glance
        </h1>
        <p style={{ fontSize: 13, color: 'var(--alm-text-muted)', margin: '4px 0 0' }}>
          {asOfDate ? `As of ${fmtDate(asOfDate)}` : 'No data yet'}
          {facilities.length > 0 && ` · ${facilities.length} facilities reporting`}
        </p>
      </div>

      <AlmStatusBar loading={loading} error={error} lastSynced={lastSynced} onRefresh={() => refresh(true)} />

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
            <SummaryStat label="Total Census" value={fmtNum(totalCensus)} sub={`${todaysRows.length} of ${facilities.length || '--'} reporting`} />
            <SummaryStat label="Admits Today" value={fmtNum(totalAdmits)} sub={`${totalDischarges} discharges`} />
            <SummaryStat label="Hospitalizations" value={fmtNum(totalHosp)} />
            <SummaryStat label="Tours" value={fmtNum(totalTours)} sub={`${referralsToday.length} referrals`} />
            <SummaryStat label="Open Shifts" value={fmtNum(openShiftsAll)} />
          </div>

          {/* Facility cards */}
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)', marginBottom: 12 }}>
            Facilities
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12, marginBottom: 32 }}>
            {latestByFacility.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--alm-text-muted)' }}>No facilities reporting.</div>
            ) : (
              latestByFacility.map((row) => <FacilityCard key={row.facility} row={row} />)
            )}
          </div>

          {/* Today's referrals */}
          {referralsToday.length > 0 && (
            <>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--alm-text-faint)', marginBottom: 12 }}>
                Referrals Today
              </div>
              <Card style={{ padding: 0, marginBottom: 32 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--alm-border)' }}>
                      {['Facility', 'Source', 'Comments'].map((h) => (
                        <th key={h} style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 500, color: 'var(--alm-text-faint)', padding: '12px 16px' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {referralsToday.map((r, i) => (
                      <tr key={i} style={{ borderBottom: i < referralsToday.length - 1 ? '1px solid var(--alm-border)' : 'none' }}>
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
