// ═══════════════════════════════════════════════
// ALM — Proforma Tracker (3-Lens View)
//
// Lens 1: Monthly Health — this month's actual vs
//         proforma ÷ 12 per home (the pulse check)
// Lens 2: YTD Tracker — cumulative actuals vs
//         prorated proforma (are we on pace?)
//
// Lens 3 (Report Card) is separate — already built,
// covers QuickBooks budget vs actual with grading.
// ═══════════════════════════════════════════════

import useResponsive from '../hooks/useResponsive';
import PROFORMA_DATA, { getMonthlyComparison, getYtdComparison } from '../data/proformaData';

const serif = { fontFamily: "'Noto Serif Display', Georgia, serif", fontWeight: 500, fontStretch: 'extra-condensed' };
const sans  = { fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

function fmtK(n) {
  if (n == null) return '--';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(2)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pct(actual, target) {
  if (!target) return 0;
  return actual / target;
}

function fmtPct(ratio) {
  return `${(ratio * 100).toFixed(1)}%`;
}

// ── Status pill ──

function StatusPill({ ratio, inverse }) {
  // For expenses, lower is better (inverse)
  const effective = inverse ? (2 - ratio) : ratio;
  let label, color, bg;

  if (effective >= 1.03) {
    label = 'Ahead';
    color = 'var(--alm-neptune)';
    bg = 'var(--alm-neptune-bg)';
  } else if (effective >= 0.95) {
    label = 'On Track';
    color = 'var(--alm-neptune)';
    bg = 'var(--alm-neptune-bg)';
  } else if (effective >= 0.85) {
    label = 'Watch';
    color = 'var(--alm-plum)';
    bg = 'var(--alm-plum-bg)';
  } else {
    label = 'Behind';
    color = 'var(--alm-danger)';
    bg = '#fef2f2';
  }

  return (
    <span style={{
      ...sans, fontSize: 10, fontWeight: 600,
      padding: '2px 8px', borderRadius: 8,
      background: bg, color,
      letterSpacing: '0.05em', textTransform: 'uppercase',
    }}>
      {label}
    </span>
  );
}

// ── Thin progress bar ──

function ProgressBar({ ratio, inverse }) {
  const effective = inverse ? (2 - ratio) : ratio;
  const fillPct = Math.min(ratio * 100, 115);
  const isGood = effective >= 0.95;
  const color = isGood ? 'var(--alm-neptune)' : 'var(--alm-danger)';

  return (
    <div style={{ position: 'relative', height: 4, borderRadius: 2, background: 'var(--alm-bd)', width: '100%' }}>
      <div style={{
        height: '100%', borderRadius: 2, width: `${Math.min(fillPct, 100)}%`,
        background: color, transition: 'width 0.6s ease-out',
      }} />
      {/* Target mark at 100% */}
      <div style={{
        position: 'absolute', left: `${Math.min(100, (100 / Math.max(fillPct, 100)) * 100)}%`,
        top: -2, height: 8, width: 1.5, background: 'var(--alm-t3)', borderRadius: 1,
      }} />
    </div>
  );
}


// ═══════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════

export default function ProformaTracker({ periods = [], selectedPeriod }) {
  const { isMobile } = useResponsive();

  // ── Lens 1: Monthly Health ──
  // Use the selected period (or latest) for monthly view
  const currentPeriod = selectedPeriod || periods[periods.length - 1];
  const monthLabel = currentPeriod
    ? `${currentPeriod.month} ${currentPeriod.year}`
    : '';
  const monthlyHomes = (currentPeriod?.homes || [])
    .map((home) => getMonthlyComparison(home))
    .filter(Boolean);

  // ── Lens 2: YTD Tracker ──
  const homeNames = ['Cedar City', 'Riverton', 'Elk Ridge', 'Hearthstone Manor'];
  const ytdData = homeNames
    .map((name) => getYtdComparison(periods, name))
    .filter(Boolean);

  // Portfolio YTD totals
  const ytdTotals = ytdData.reduce(
    (acc, h) => ({
      revenue:  { actual: acc.revenue.actual + h.revenue.actual,   target: acc.revenue.target + h.revenue.target },
      expenses: { actual: acc.expenses.actual + h.expenses.actual, target: acc.expenses.target + h.expenses.target },
      noi:      { actual: acc.noi.actual + h.noi.actual,           target: acc.noi.target + h.noi.target },
    }),
    { revenue: { actual: 0, target: 0 }, expenses: { actual: 0, target: 0 }, noi: { actual: 0, target: 0 } }
  );

  if (monthlyHomes.length === 0 && ytdData.length === 0) {
    return (
      <div className="alm-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
        <div style={{ ...sans, fontSize: 13, fontWeight: 400, color: 'var(--alm-t4)' }}>
          No proforma comparison data available yet.
        </div>
      </div>
    );
  }

  return (
    <div>

      {/* ════════════════════════════════════════════
          LENS 1: MONTHLY HEALTH
          ════════════════════════════════════════════ */}
      {monthlyHomes.length > 0 && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ ...sans, fontSize: 11, fontWeight: 500, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, paddingLeft: 4 }}>
            Monthly vs Proforma Target &middot; {monthLabel}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : `repeat(${Math.min(monthlyHomes.length, 4)}, 1fr)`,
            gap: 12,
          }}>
            {monthlyHomes.map((h) => {
              const revR = pct(h.revenue.actual, h.revenue.target);
              const expR = pct(h.expenses.actual, h.expenses.target);
              const noiR = pct(h.noi.actual, h.noi.target);

              return (
                <div key={h.name} className="alm-card" style={{ padding: '20px 24px' }}>
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <div>
                      <div style={{ ...sans, fontSize: 13, fontWeight: 400, color: 'var(--alm-t1)' }}>{h.name}</div>
                      <div style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)' }}>
                        {PROFORMA_DATA[h.name]?.beds} beds
                      </div>
                    </div>
                    <StatusPill ratio={noiR} inverse={false} />
                  </div>

                  {/* Revenue */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ ...sans, fontSize: 11, fontWeight: 500, color: 'var(--alm-t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Revenue</span>
                      <span style={{ ...sans, fontSize: 11, fontWeight: 500, color: revR >= 0.95 ? 'var(--alm-neptune)' : 'var(--alm-danger)' }}>
                        {fmtPct(revR)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                      <span style={{ ...serif, fontSize: 20, color: 'var(--alm-t1)', lineHeight: 1 }}>{fmtK(h.revenue.actual)}</span>
                      <span style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)' }}>/ {fmtK(h.revenue.target)}</span>
                    </div>
                    <ProgressBar ratio={revR} inverse={false} />
                  </div>

                  {/* Expenses */}
                  <div style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ ...sans, fontSize: 11, fontWeight: 500, color: 'var(--alm-t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Expenses</span>
                      <span style={{ ...sans, fontSize: 11, fontWeight: 500, color: expR <= 1.05 ? 'var(--alm-neptune)' : 'var(--alm-danger)' }}>
                        {fmtPct(expR)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                      <span style={{ ...serif, fontSize: 20, color: 'var(--alm-t1)', lineHeight: 1 }}>{fmtK(h.expenses.actual)}</span>
                      <span style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)' }}>/ {fmtK(h.expenses.target)}</span>
                    </div>
                    <ProgressBar ratio={expR} inverse />
                  </div>

                  {/* NOI */}
                  <div style={{ paddingTop: 12, borderTop: '1px solid var(--alm-bd)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ ...sans, fontSize: 11, fontWeight: 500, color: 'var(--alm-t3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>NOI</span>
                      <span style={{ ...sans, fontSize: 11, fontWeight: 500, color: noiR >= 0.95 ? 'var(--alm-neptune)' : 'var(--alm-danger)' }}>
                        {fmtPct(noiR)}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 6 }}>
                      <span style={{ ...serif, fontSize: 22, color: noiR >= 0.95 ? 'var(--alm-neptune)' : 'var(--alm-t1)', lineHeight: 1 }}>
                        {fmtK(h.noi.actual)}
                      </span>
                      <span style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)' }}>/ {fmtK(h.noi.target)}</span>
                    </div>
                    <ProgressBar ratio={noiR} inverse={false} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}


      {/* ════════════════════════════════════════════
          LENS 2: YTD TRACKER
          ════════════════════════════════════════════ */}
      {ytdData.length > 0 && (
        <div>
          <div style={{ ...sans, fontSize: 11, fontWeight: 500, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12, paddingLeft: 4 }}>
            Year-to-Date vs Proforma &middot; Are We on Pace?
          </div>

          {/* Portfolio summary row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
            gap: 12,
            marginBottom: 16,
          }}>
            {[
              { label: 'Portfolio Revenue', ...ytdTotals.revenue, good: ytdTotals.revenue.actual >= ytdTotals.revenue.target },
              { label: 'Portfolio Expenses', ...ytdTotals.expenses, good: ytdTotals.expenses.actual <= ytdTotals.expenses.target },
              { label: 'Portfolio NOI', ...ytdTotals.noi, good: ytdTotals.noi.actual >= ytdTotals.noi.target },
            ].map((item) => {
              const variance = item.actual - item.target;
              return (
                <div key={item.label} className="alm-card" style={{ padding: '16px 20px' }}>
                  <div style={{ ...sans, fontSize: 11, fontWeight: 500, color: 'var(--alm-t3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                    {item.label}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 2 }}>
                    <span style={{ ...serif, fontSize: 24, color: 'var(--alm-t1)', lineHeight: 1 }}>{fmtK(item.actual)}</span>
                    <span style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)' }}>/ {fmtK(item.target)}</span>
                  </div>
                  <span style={{ ...sans, fontSize: 11, fontWeight: 400, color: item.good ? 'var(--alm-neptune)' : 'var(--alm-danger)' }}>
                    {variance >= 0 ? '+' : ''}{fmtK(variance)}
                    {' '}
                    ({item.target > 0 ? fmtPct(item.actual / item.target) : '--'})
                  </span>
                </div>
              );
            })}
          </div>

          {/* Per-home YTD table */}
          <div className="alm-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--alm-bd)' }}>
                    {['Home', 'Months', 'YTD Revenue', 'Target', 'YTD NOI', 'Target', 'Status'].map((h) => (
                      <th key={h} style={{
                        ...sans, fontSize: 11, fontWeight: 500, color: 'var(--alm-t3)',
                        textAlign: h === 'Home' ? 'left' : 'right',
                        padding: '10px 14px', textTransform: 'uppercase', letterSpacing: '0.08em',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {ytdData.map((h) => {
                    const noiR = pct(h.noi.actual, h.noi.target);
                    return (
                      <tr key={h.name} style={{ borderBottom: '1px solid var(--alm-bd)' }}>
                        <td style={{ padding: '12px 14px' }}>
                          <div style={{ ...sans, fontSize: 13, fontWeight: 400, color: 'var(--alm-t1)' }}>{h.name}</div>
                          <div style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)' }}>
                            {PROFORMA_DATA[h.name]?.beds} beds
                          </div>
                        </td>
                        <td style={{ ...sans, fontSize: 12, fontWeight: 400, color: 'var(--alm-t2)', textAlign: 'right', padding: '12px 14px' }}>
                          {h.months}
                        </td>
                        <td style={{ ...serif, fontSize: 14, color: 'var(--alm-t1)', textAlign: 'right', padding: '12px 14px' }}>
                          {fmtK(h.revenue.actual)}
                        </td>
                        <td style={{ ...sans, fontSize: 12, fontWeight: 400, color: 'var(--alm-t4)', textAlign: 'right', padding: '12px 14px' }}>
                          {fmtK(h.revenue.target)}
                        </td>
                        <td style={{ ...serif, fontSize: 14, color: 'var(--alm-t1)', textAlign: 'right', padding: '12px 14px' }}>
                          {fmtK(h.noi.actual)}
                        </td>
                        <td style={{ ...sans, fontSize: 12, fontWeight: 400, color: 'var(--alm-t4)', textAlign: 'right', padding: '12px 14px' }}>
                          {fmtK(h.noi.target)}
                        </td>
                        <td style={{ textAlign: 'right', padding: '12px 14px' }}>
                          <StatusPill ratio={noiR} inverse={false} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ padding: '10px 14px', borderTop: '1px solid var(--alm-bd)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)' }}>
                Targets = proforma monthly (annual &divide; 12) &times; months tracked
              </span>
              <span style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)' }}>
                Source: Acquisition underwriting models
              </span>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
