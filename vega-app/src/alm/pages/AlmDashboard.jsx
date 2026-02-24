// ═══════════════════════════════════════════════
// ALM — Dashboard Page
// Assisted Living Management overview
// Brand: Noto Serif Display headings, HK Grotesk
// body, plum accents, cream/night sky backgrounds
// Data: ALF II Annual Report (Feb 2026) + West Jordan (Fund I)
// ═══════════════════════════════════════════════

import useResponsive from '../hooks/useResponsive';

const serif = { fontFamily: "'Noto Serif Display', Georgia, serif", fontWeight: 500, fontStretch: 'extra-condensed' };
const sans = { fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

// Plum diamond star (reusable)
function PlumStar({ size = 12, style = {} }) {
  return (
    <svg viewBox="0 0 100 133" style={{ width: size * 0.75, height: size, flexShrink: 0, ...style }}>
      <path
        d="M50,0c-4.4,30.83-13.78,55.14-25.67,66.55,11.89,11.41,21.27,35.71,25.67,66.55,4.4-30.83,13.78-55.14,25.67-66.55C63.78,55.14,54.4,30.83,50,0Z"
        fill="var(--alm-plum)"
      />
    </svg>
  );
}

// Format helpers
const fmtK = (n) => {
  if (n == null) return '--';
  if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `$${Math.round(n / 1000)}K`;
  return `$${n.toLocaleString()}`;
};
const fmtNum = (n) => (n == null ? '--' : n.toLocaleString());
const fmtPct = (n) => (n == null ? '--' : `${n.toFixed(1)}%`);

// ── Real Home Data ─────────────────────────────────────────
// Source: Vega ALF II Annual Report (Feb 2026) + West Jordan (Fund I)
// NOI figures from P&L statements (Sept–Dec 2025 reporting period)
const HOMES = [
  // Fund II — Operational (with P&L data)
  { name: 'Cedar City',        beds: 20, sqft: 12962, noi: 142667, margin: 43.5, acquired: "Aug '25", status: 'Active',         fund: 'II', state: 'UT' },
  { name: 'Riverton',          beds: 18, sqft: 9180,  noi: 80565,  margin: 28.0, acquired: "Aug '25", status: 'Active',         fund: 'II', state: 'UT' },
  { name: 'Elk Ridge',         beds: 29, sqft: 15896, noi: 71535,  margin: 48.8, acquired: "Oct '25", status: 'Active',         fund: 'II', state: 'UT' },
  { name: 'Hearthstone Manor', beds: 35, sqft: 21323, noi: 134920, margin: 57.6, acquired: "Oct '25", status: 'Active',         fund: 'II', state: 'UT' },
  // Fund II — Ramping / Pre-Revenue
  { name: 'Sandy',             beds: 16, sqft: 7536,  noi: null,   margin: null, acquired: "Sep '25", status: 'Ramping',        fund: 'II', state: 'UT', note: 'Grand Opening Jan 23, 2026' },
  // Fund II — Pipeline
  { name: 'Riverton Phase II', beds: 20, sqft: null,  noi: null,   margin: null, acquired: null,      status: 'Development',    fund: 'II', state: 'UT', note: 'Construction Q2 2026' },
  { name: 'Gilbert',           beds: null, sqft: null, noi: null,   margin: null, acquired: null,      status: 'Under Contract', fund: 'II', state: 'AZ', note: 'First out-of-state acquisition' },
  // Fund I
  { name: 'West Jordan',       beds: 16, sqft: null,  noi: null,   margin: null, acquired: null,      status: 'Active',         fund: 'I',  state: 'UT' },
];

// Status → badge color mapping
const STATUS_COLORS = {
  Active:           { bg: 'var(--alm-neptune-bg)', color: 'var(--alm-neptune)' },
  Ramping:          { bg: 'var(--alm-plum-bg)',    color: 'var(--alm-plum)' },
  Development:      { bg: 'var(--alm-plum-bg)',    color: 'var(--alm-t4)' },
  'Under Contract': { bg: 'var(--alm-plum-bg)',    color: 'var(--alm-t4)' },
};

export default function AlmDashboard() {
  const { isMobile, isTablet } = useResponsive();

  // ── Summary computations ──────────────────────────────
  const operational = HOMES.filter((h) => ['Active', 'Ramping'].includes(h.status));
  const totalBeds = operational.reduce((s, h) => s + (h.beds || 0), 0);
  const homesWithNoi = HOMES.filter((h) => h.noi != null);
  const totalNoi = homesWithNoi.reduce((s, h) => s + h.noi, 0);
  const avgMargin =
    homesWithNoi.length > 0
      ? homesWithNoi.reduce((s, h) => s + h.margin, 0) / homesWithNoi.length
      : 0;
  const totalSqft = HOMES.reduce((s, h) => s + (h.sqft || 0), 0);

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? 16 : 32 }}>

      {/* ── Page Header ─────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <PlumStar size={10} />
          <span className="alm-section-label" style={{ color: 'var(--alm-plum)' }}>
            Active Module
          </span>
        </div>
        <h1
          style={{
            ...serif,
            fontSize: isMobile ? 28 : 38,
            color: 'var(--alm-t1)',
            margin: '0 0 8px',
            letterSpacing: '-0.01em',
            lineHeight: 1.1,
          }}
        >
          Assisted Living Management
        </h1>
        <p style={{ ...sans, fontSize: 14, fontWeight: 300, color: 'var(--alm-t4)', margin: 0 }}>
          Care that feels like home, managed with heart.
        </p>
      </div>

      {/* ── Summary Stats ───────────────────────────────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
          gap: 16,
          marginBottom: 32,
        }}
      >
        {[
          { label: 'Homes', value: HOMES.length },
          { label: 'Operational', value: operational.length },
          { label: 'Total Beds', value: totalBeds, accent: true },
          { label: 'Portfolio NOI', value: fmtK(totalNoi) },
        ].map((stat, i) => (
          <div
            key={i}
            className="alm-card"
            style={{
              padding: '20px 24px',
              borderLeft: stat.accent ? '3px solid var(--alm-plum)' : undefined,
            }}
          >
            <div className="alm-section-label" style={{ marginBottom: 8 }}>
              {stat.label}
            </div>
            <div style={{ ...serif, fontSize: 32, color: 'var(--alm-t1)', lineHeight: 1 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Homes Grid ──────────────────────────────────────── */}
      <div style={{ marginBottom: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--alm-bd)' }} />
          <span className="alm-section-label">Our Homes</span>
          <div style={{ flex: 1, height: 1, background: 'var(--alm-bd)' }} />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
            gap: 16,
          }}
        >
          {HOMES.map((home) => {
            const sc = STATUS_COLORS[home.status] || STATUS_COLORS.Active;
            return (
              <div
                key={home.name}
                className="alm-card"
                style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
              >
                {/* Top row: status + fund/state badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                  <span
                    className="alm-badge"
                    style={{ background: sc.bg, color: sc.color }}
                  >
                    {home.status}
                  </span>
                  <span
                    style={{
                      ...sans,
                      fontSize: 9,
                      fontWeight: 400,
                      color: 'var(--alm-t5)',
                      letterSpacing: '0.08em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Fund {home.fund} · {home.state}
                  </span>
                </div>

                {/* Home name */}
                <div
                  style={{
                    ...serif,
                    fontSize: 20,
                    color: 'var(--alm-t1)',
                    marginBottom: 14,
                    lineHeight: 1.2,
                  }}
                >
                  {home.name}
                </div>

                {/* Primary stats: Beds + Sq Ft */}
                <div style={{ display: 'flex', gap: 20 }}>
                  {home.beds != null && (
                    <div>
                      <div style={{ ...sans, fontSize: 10, fontWeight: 400, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                        Beds
                      </div>
                      <div style={{ ...serif, fontSize: 18, color: 'var(--alm-t1)' }}>
                        {home.beds}
                      </div>
                    </div>
                  )}
                  {home.sqft != null && (
                    <div>
                      <div style={{ ...sans, fontSize: 10, fontWeight: 400, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                        Sq Ft
                      </div>
                      <div style={{ ...serif, fontSize: 18, color: 'var(--alm-t1)' }}>
                        {fmtNum(home.sqft)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Financial stats — only for homes with P&L data */}
                {home.noi != null && (
                  <div style={{ display: 'flex', gap: 20, marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--alm-bd)' }}>
                    <div>
                      <div style={{ ...sans, fontSize: 10, fontWeight: 400, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                        NOI
                      </div>
                      <div style={{ ...serif, fontSize: 16, color: 'var(--alm-neptune)' }}>
                        {fmtK(home.noi)}
                      </div>
                    </div>
                    <div>
                      <div style={{ ...sans, fontSize: 10, fontWeight: 400, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                        Margin
                      </div>
                      <div style={{ ...serif, fontSize: 16, color: 'var(--alm-neptune)' }}>
                        {fmtPct(home.margin)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Note for pre-revenue / pipeline homes */}
                {home.note && home.noi == null && (
                  <div style={{ ...sans, fontSize: 11, fontWeight: 300, color: 'var(--alm-t4)', marginTop: 10, fontStyle: 'italic' }}>
                    {home.note}
                  </div>
                )}

                {/* Footer: acquired date + view link */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  {home.acquired ? (
                    <span style={{ ...sans, fontSize: 10, fontWeight: 300, color: 'var(--alm-t5)' }}>
                      Acquired {home.acquired}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span
                    style={{
                      ...sans,
                      fontSize: 11,
                      fontWeight: 400,
                      color: 'var(--alm-plum)',
                      letterSpacing: '0.05em',
                    }}
                  >
                    View Home &rarr;
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Two Column: Portfolio Quick Look + Values ─────────── */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
          gap: 24,
          marginBottom: 40,
        }}
      >
        {/* Quick Look */}
        <div className="alm-card">
          <div className="alm-section-label" style={{ marginBottom: 16, color: 'var(--alm-plum)' }}>
            Portfolio Quick Look
          </div>
          <div className="alm-stat-row">
            <span className="alm-stat-label">Total Beds (Operational)</span>
            <span className="alm-stat-value">{totalBeds}</span>
          </div>
          <div className="alm-stat-row">
            <span className="alm-stat-label">Total Sq Ft</span>
            <span className="alm-stat-value">{fmtNum(totalSqft)}</span>
          </div>
          <div className="alm-stat-row">
            <span className="alm-stat-label">Q4 Portfolio NOI</span>
            <span className="alm-stat-value">{fmtK(totalNoi)}</span>
          </div>
          <div className="alm-stat-row">
            <span className="alm-stat-label">Avg Operating Margin</span>
            <span className="alm-stat-value">{fmtPct(avgMargin)}</span>
          </div>
          <div className="alm-stat-row">
            <span className="alm-stat-label">Markets</span>
            <span className="alm-stat-value">Utah · Arizona</span>
          </div>
        </div>

        {/* Values */}
        <div className="alm-card" style={{ borderLeft: '3px solid var(--alm-plum)' }}>
          <div className="alm-section-label" style={{ marginBottom: 16, color: 'var(--alm-plum)' }}>
            Our Values
          </div>
          {[
            { num: '1', title: 'Home, Not a Facility' },
            { num: '2', title: 'Loved Ones First, Always' },
            { num: '3', title: 'Dignity in the Details' },
            { num: '4', title: 'Consistency, Earned Every Day' },
            { num: '5', title: 'Grow Our People' },
          ].map((v) => (
            <div key={v.num} style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--alm-bd)' }}>
              <span style={{ ...serif, fontSize: 18, color: 'var(--alm-plum)', opacity: 0.5, lineHeight: 1 }}>
                {v.num}
              </span>
              <span style={{ ...sans, fontSize: 13, fontWeight: 300, color: 'var(--alm-t2)' }}>
                {v.title}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '24px 0',
          borderTop: '1px solid var(--alm-bd)',
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <PlumStar size={8} />
          <span style={{ ...sans, fontSize: 10, fontWeight: 300, color: 'var(--alm-t5)' }}>
            Vega Assisted Living Management
          </span>
        </div>
        <span style={{ ...sans, fontSize: 10, fontWeight: 300, color: 'var(--alm-t5)' }}>
          {HOMES.length} homes across Utah &amp; Arizona
        </span>
      </div>
    </div>
  );
}
