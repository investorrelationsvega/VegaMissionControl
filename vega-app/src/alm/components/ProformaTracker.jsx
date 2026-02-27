// ═══════════════════════════════════════════════
// ALM — Proforma Tracker
// Compares cumulative QuickBooks actuals against
// the underwriting proforma targets.
//
// Shows per-home:
//   • Prorated proforma target (annual × months/12)
//   • Cumulative actual from QuickBooks
//   • Variance ($) and % of proforma
//   • Annualized run rate vs full-year proforma
// ═══════════════════════════════════════════════

import useResponsive from '../hooks/useResponsive';
import PROFORMA_DATA, { getProformaComparison } from '../data/proformaData';

const serif = { fontFamily: "'Noto Serif Display', Georgia, serif", fontWeight: 500, fontStretch: 'extra-condensed' };
const sans  = { fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

function fmtK(n) {
  if (n == null) return '--';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1000000) return `${sign}$${(abs / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${sign}$${(abs / 1000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString()}`;
}

function fmtPct(n) {
  if (n == null) return '--';
  return `${(n * 100).toFixed(1)}%`;
}

// ── Gauge bar (horizontal fill with proforma mark) ──

function GaugeBar({ actual, target, width = '100%' }) {
  const ratio = target > 0 ? actual / target : 0;
  const fillPct = Math.min(ratio * 100, 120);
  const isOver = actual > target;
  const color = isOver ? 'var(--alm-neptune)' : 'var(--alm-danger)';

  return (
    <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'var(--alm-bd)', width }}>
      <div style={{
        height: '100%', borderRadius: 3, width: `${Math.min(fillPct, 100)}%`,
        background: color, transition: 'width 0.6s ease-out',
      }} />
      {/* Proforma target mark at 100% */}
      <div style={{
        position: 'absolute', left: `${Math.min(100, (100 / Math.max(fillPct, 100)) * 100)}%`,
        top: -3, height: 12, width: 2, background: 'var(--alm-t3)', borderRadius: 1,
      }} />
    </div>
  );
}

// ── Main component ──

export default function ProformaTracker({ periods = [] }) {
  const { isMobile } = useResponsive();

  // Only show homes that have proforma data AND actuals
  const homeNames = ['Cedar City', 'Riverton', 'Elk Ridge', 'Hearthstone Manor'];
  const comparisons = homeNames
    .map((name) => getProformaComparison(periods, name))
    .filter(Boolean);

  if (comparisons.length === 0) {
    return (
      <div className="alm-card" style={{ textAlign: 'center', padding: '32px 24px' }}>
        <div style={{ ...sans, fontSize: 13, fontWeight: 300, color: 'var(--alm-t4)' }}>
          No proforma comparison data available yet.
        </div>
      </div>
    );
  }

  // Portfolio totals
  const portfolioProrated = {
    revenue: comparisons.reduce((s, c) => s + c.proforma.prorated.revenue, 0),
    expenses: comparisons.reduce((s, c) => s + c.proforma.prorated.expenses, 0),
    noi: comparisons.reduce((s, c) => s + c.proforma.prorated.noi, 0),
  };
  const portfolioActual = {
    revenue: comparisons.reduce((s, c) => s + c.actual.cumulative.revenue, 0),
    expenses: comparisons.reduce((s, c) => s + c.actual.cumulative.expenses, 0),
    noi: comparisons.reduce((s, c) => s + c.actual.cumulative.noi, 0),
  };
  const portfolioVariance = {
    revenue: portfolioActual.revenue - portfolioProrated.revenue,
    expenses: portfolioActual.expenses - portfolioProrated.expenses,
    noi: portfolioActual.noi - portfolioProrated.noi,
  };

  return (
    <div>
      {/* ── Portfolio Summary Cards ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)',
        gap: 16,
        marginBottom: 20,
      }}>
        {[
          {
            label: 'Revenue',
            actual: portfolioActual.revenue,
            proforma: portfolioProrated.revenue,
            variance: portfolioVariance.revenue,
            good: portfolioVariance.revenue >= 0,
          },
          {
            label: 'Expenses',
            actual: portfolioActual.expenses,
            proforma: portfolioProrated.expenses,
            variance: portfolioVariance.expenses,
            good: portfolioVariance.expenses <= 0,  // lower expenses = good
          },
          {
            label: 'Net Operating Income',
            actual: portfolioActual.noi,
            proforma: portfolioProrated.noi,
            variance: portfolioVariance.noi,
            good: portfolioVariance.noi >= 0,
          },
        ].map((item) => (
          <div key={item.label} className="alm-card" style={{ padding: '20px 24px' }}>
            <div style={{ ...sans, fontSize: 10, fontWeight: 400, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
              Portfolio {item.label}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 4 }}>
              <span style={{ ...serif, fontSize: 28, color: 'var(--alm-t1)', lineHeight: 1 }}>
                {fmtK(item.actual)}
              </span>
              <span style={{ ...sans, fontSize: 12, fontWeight: 300, color: 'var(--alm-t4)' }}>
                / {fmtK(item.proforma)} proforma
              </span>
            </div>
            <div style={{
              ...sans, fontSize: 12, fontWeight: 400,
              color: item.good ? 'var(--alm-neptune)' : 'var(--alm-danger)',
            }}>
              {item.variance >= 0 ? '+' : ''}{fmtK(item.variance)} variance
              {' · '}
              {item.proforma > 0 ? fmtPct(item.actual / item.proforma) : '--'} of target
            </div>
          </div>
        ))}
      </div>

      {/* ── Per-Home Comparison Table ── */}
      <div className="alm-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--alm-bd)' }}>
                <th style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', textAlign: 'left', padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Home
                </th>
                <th style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', textAlign: 'right', padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Months
                </th>
                <th style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', textAlign: 'right', padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Actual Revenue
                </th>
                <th style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', textAlign: 'right', padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Proforma Target
                </th>
                <th style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', textAlign: 'right', padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Rev %
                </th>
                <th style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', textAlign: 'right', padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Actual NOI
                </th>
                <th style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', textAlign: 'right', padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  NOI Target
                </th>
                <th style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', textAlign: 'right', padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  NOI %
                </th>
                <th style={{ ...sans, fontSize: 11, fontWeight: 400, color: 'var(--alm-t4)', textAlign: 'right', padding: '12px 16px', textTransform: 'uppercase', letterSpacing: '0.1em', minWidth: 110 }}>
                  Track
                </th>
              </tr>
            </thead>
            <tbody>
              {comparisons.map((c) => {
                const revGood = c.pctOfProforma.revenue >= 0.95;
                const noiGood = c.pctOfProforma.noi >= 0.95;
                const revPct = c.pctOfProforma.revenue;
                const noiPct = c.pctOfProforma.noi;

                return (
                  <tr key={c.homeName} style={{ borderBottom: '1px solid var(--alm-bd)' }}>
                    <td style={{ padding: '14px 16px' }}>
                      <div style={{ ...sans, fontSize: 13, fontWeight: 400, color: 'var(--alm-t1)' }}>
                        {c.homeName}
                      </div>
                      <div style={{ ...sans, fontSize: 10, fontWeight: 300, color: 'var(--alm-t5)' }}>
                        {PROFORMA_DATA[c.homeName]?.beds} beds
                      </div>
                    </td>
                    <td style={{ ...sans, fontSize: 13, fontWeight: 300, color: 'var(--alm-t3)', textAlign: 'right', padding: '14px 16px' }}>
                      {c.monthsTracked}
                    </td>
                    <td style={{ ...serif, fontSize: 15, color: 'var(--alm-t1)', textAlign: 'right', padding: '14px 16px' }}>
                      {fmtK(c.actual.cumulative.revenue)}
                    </td>
                    <td style={{ ...sans, fontSize: 13, fontWeight: 300, color: 'var(--alm-t4)', textAlign: 'right', padding: '14px 16px' }}>
                      {fmtK(c.proforma.prorated.revenue)}
                    </td>
                    <td style={{
                      ...sans, fontSize: 13, fontWeight: 400, textAlign: 'right', padding: '14px 16px',
                      color: revGood ? 'var(--alm-neptune)' : 'var(--alm-danger)',
                    }}>
                      {fmtPct(revPct)}
                    </td>
                    <td style={{ ...serif, fontSize: 15, color: 'var(--alm-t1)', textAlign: 'right', padding: '14px 16px' }}>
                      {fmtK(c.actual.cumulative.noi)}
                    </td>
                    <td style={{ ...sans, fontSize: 13, fontWeight: 300, color: 'var(--alm-t4)', textAlign: 'right', padding: '14px 16px' }}>
                      {fmtK(c.proforma.prorated.noi)}
                    </td>
                    <td style={{
                      ...sans, fontSize: 13, fontWeight: 400, textAlign: 'right', padding: '14px 16px',
                      color: noiGood ? 'var(--alm-neptune)' : 'var(--alm-danger)',
                    }}>
                      {fmtPct(noiPct)}
                    </td>
                    <td style={{ padding: '14px 16px' }}>
                      <GaugeBar actual={c.actual.cumulative.noi} target={c.proforma.prorated.noi} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--alm-bd)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <span style={{ ...sans, fontSize: 10, fontWeight: 300, color: 'var(--alm-t5)' }}>
            Proforma targets prorated for months tracked &middot; Source: Acquisition underwriting models
          </span>
          <span style={{ ...sans, fontSize: 10, fontWeight: 300, color: 'var(--alm-t5)' }}>
            {comparisons.length} homes tracked
          </span>
        </div>
      </div>

      {/* ── Annualized Run Rate Cards ── */}
      <div style={{ marginTop: 16 }}>
        <div style={{ ...sans, fontSize: 10, fontWeight: 400, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 10, paddingLeft: 4 }}>
          Annualized Run Rate vs Year 1 Proforma
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : `repeat(${Math.min(comparisons.length, 4)}, 1fr)`,
          gap: 12,
        }}>
          {comparisons.map((c) => {
            const pf = PROFORMA_DATA[c.homeName];
            const annRev = c.actual.annualized.revenue;
            const annNoi = c.actual.annualized.noi;
            const pfRev = pf.annual.revenue.total;
            const pfNoi = pf.annual.noi;
            const revOnTrack = annRev / pfRev >= 0.95;
            const noiOnTrack = annNoi / pfNoi >= 0.95;

            return (
              <div key={c.homeName} className="alm-card" style={{ padding: '16px 20px' }}>
                <div style={{ ...sans, fontSize: 12, fontWeight: 400, color: 'var(--alm-t1)', marginBottom: 12 }}>
                  {c.homeName}
                </div>
                {/* Revenue run rate */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ ...sans, fontSize: 10, fontWeight: 300, color: 'var(--alm-t4)' }}>Revenue Run Rate</span>
                    <span style={{ ...sans, fontSize: 10, fontWeight: 400, color: revOnTrack ? 'var(--alm-neptune)' : 'var(--alm-danger)' }}>
                      {fmtPct(annRev / pfRev)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ ...serif, fontSize: 18, color: 'var(--alm-t1)', lineHeight: 1 }}>{fmtK(annRev)}</span>
                    <span style={{ ...sans, fontSize: 10, fontWeight: 300, color: 'var(--alm-t5)' }}>/ {fmtK(pfRev)}</span>
                  </div>
                </div>
                {/* NOI run rate */}
                <div style={{ paddingTop: 10, borderTop: '1px solid var(--alm-bd)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ ...sans, fontSize: 10, fontWeight: 300, color: 'var(--alm-t4)' }}>NOI Run Rate</span>
                    <span style={{ ...sans, fontSize: 10, fontWeight: 400, color: noiOnTrack ? 'var(--alm-neptune)' : 'var(--alm-danger)' }}>
                      {fmtPct(annNoi / pfNoi)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                    <span style={{ ...serif, fontSize: 18, color: noiOnTrack ? 'var(--alm-neptune)' : 'var(--alm-t1)', lineHeight: 1 }}>{fmtK(annNoi)}</span>
                    <span style={{ ...sans, fontSize: 10, fontWeight: 300, color: 'var(--alm-t5)' }}>/ {fmtK(pfNoi)}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
