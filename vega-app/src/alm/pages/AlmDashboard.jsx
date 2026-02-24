// ═══════════════════════════════════════════════
// ALM — Dashboard Page
// Assisted Living Management overview
// Brand: Noto Serif Display headings, HK Grotesk
// body, plum accents, cream/night sky backgrounds
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

// Placeholder homes data (will move to store/data later)
const HOMES = [
  { name: 'Riverton', lovedOnes: 16, caregivers: 12, status: 'Active' },
  { name: 'Herriman', lovedOnes: 16, caregivers: 11, status: 'Active' },
  { name: 'Magna', lovedOnes: 16, caregivers: 10, status: 'Active' },
  { name: 'South Jordan', lovedOnes: 16, caregivers: 12, status: 'Active' },
  { name: 'West Jordan', lovedOnes: 16, caregivers: 11, status: 'Active' },
  { name: 'Taylorsville', lovedOnes: 16, caregivers: 10, status: 'Active' },
  { name: 'Sandy', lovedOnes: 16, caregivers: 12, status: 'Active' },
  { name: 'Draper', lovedOnes: 16, caregivers: 11, status: 'Pre-Open' },
];

export default function AlmDashboard() {
  const { isMobile, isTablet } = useResponsive();

  const totalLovedOnes = HOMES.reduce((s, h) => s + h.lovedOnes, 0);
  const totalCaregivers = HOMES.reduce((s, h) => s + h.caregivers, 0);
  const activeHomes = HOMES.filter((h) => h.status === 'Active').length;

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
          { label: 'Homes', value: HOMES.length, accent: false },
          { label: 'Active', value: activeHomes, accent: false },
          { label: 'Loved Ones', value: totalLovedOnes, accent: true },
          { label: 'Caregivers', value: totalCaregivers, accent: false },
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
          {HOMES.map((home) => (
            <div
              key={home.name}
              className="alm-card"
              style={{ cursor: 'pointer', position: 'relative', overflow: 'hidden' }}
            >
              {/* Status badge */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span
                  className="alm-badge"
                  style={{
                    background: home.status === 'Active' ? 'var(--alm-neptune-bg)' : 'var(--alm-plum-bg)',
                    color: home.status === 'Active' ? 'var(--alm-neptune)' : 'var(--alm-plum)',
                  }}
                >
                  {home.status}
                </span>
                <PlumStar size={8} style={{ opacity: 0.3 }} />
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

              {/* Stats */}
              <div style={{ display: 'flex', gap: 20 }}>
                <div>
                  <div style={{ ...sans, fontSize: 10, fontWeight: 400, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                    Loved Ones
                  </div>
                  <div style={{ ...serif, fontSize: 18, color: 'var(--alm-t1)' }}>
                    {home.lovedOnes}
                  </div>
                </div>
                <div>
                  <div style={{ ...sans, fontSize: 10, fontWeight: 400, color: 'var(--alm-t4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                    Caregivers
                  </div>
                  <div style={{ ...serif, fontSize: 18, color: 'var(--alm-t1)' }}>
                    {home.caregivers}
                  </div>
                </div>
              </div>

              {/* Enter link */}
              <div
                style={{
                  ...sans,
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--alm-plum)',
                  marginTop: 16,
                  letterSpacing: '0.05em',
                }}
              >
                View Home &rarr;
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Two Column: Quick Look + Values ─────────────────── */}
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
            Quick Look
          </div>
          <div className="alm-stat-row">
            <span className="alm-stat-label">Total Capacity</span>
            <span className="alm-stat-value">{totalLovedOnes}</span>
          </div>
          <div className="alm-stat-row">
            <span className="alm-stat-label">Current Occupancy</span>
            <span className="alm-stat-value">--</span>
          </div>
          <div className="alm-stat-row">
            <span className="alm-stat-label">Caregiver Ratio</span>
            <span className="alm-stat-value">--</span>
          </div>
          <div className="alm-stat-row">
            <span className="alm-stat-label">Open Positions</span>
            <span className="alm-stat-value">--</span>
          </div>
          <div className="alm-stat-row">
            <span className="alm-stat-label">Family Satisfaction</span>
            <span className="alm-stat-value">--</span>
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
          Eight homes across Utah
        </span>
      </div>
    </div>
  );
}
