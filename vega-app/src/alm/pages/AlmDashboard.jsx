// ═══════════════════════════════════════════════
// ALM — Dashboard Page
// Blank shell. Data and reporting will be wired up
// from Google Sheets in subsequent work.
// ═══════════════════════════════════════════════

import useResponsive from '../hooks/useResponsive';

const serif = { fontFamily: "'Noto Serif Display', Georgia, serif", fontWeight: 500, fontStretch: 'extra-condensed' };
const sans = { fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };

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

export default function AlmDashboard() {
  const { isMobile } = useResponsive();

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
        <p style={{ ...sans, fontSize: 14, fontWeight: 400, color: 'var(--alm-t3)', margin: 0 }}>
          Care that feels like home, managed with heart.
        </p>
      </div>

      {/* ── Empty State ─────────────────────────────────────── */}
      <div
        className="alm-card"
        style={{
          padding: isMobile ? 32 : 64,
          textAlign: 'center',
          borderLeft: '3px solid var(--alm-plum)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <PlumStar size={28} />
        </div>
        <div
          style={{
            ...serif,
            fontSize: isMobile ? 22 : 28,
            color: 'var(--alm-t1)',
            marginBottom: 12,
            lineHeight: 1.2,
          }}
        >
          Reporting dashboard coming online
        </div>
        <p
          style={{
            ...sans,
            fontSize: 13,
            fontWeight: 400,
            color: 'var(--alm-t3)',
            margin: '0 auto',
            maxWidth: 460,
            lineHeight: 1.6,
          }}
        >
          This module is being rebuilt to pull data and reporting directly from Google Sheets.
          New views will appear here as each report is wired up.
        </p>
      </div>
    </div>
  );
}
