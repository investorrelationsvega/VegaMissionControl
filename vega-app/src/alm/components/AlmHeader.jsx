// ═══════════════════════════════════════════════
// ALM — Header Component (self-contained)
// Navigation header for Assisted Living Management
// Brand: Night Sky bg, Noto Serif Display wordmark,
// plum diamond star, HK Grotesk nav
// ═══════════════════════════════════════════════

import { useNavigate, useLocation } from 'react-router-dom';
import useResponsive from '../hooks/useResponsive';

const sans = { fontFamily: "'HK Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" };
const serif = { fontFamily: "'Noto Serif Display', Georgia, serif", fontWeight: 500, fontStretch: 'extra-condensed' };

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/alm' },
  // Future:
  // { label: 'Homes', path: '/alm/homes' },
  // { label: 'Caregivers', path: '/alm/caregivers' },
  // { label: 'Loved Ones', path: '/alm/loved-ones' },
  // { label: 'Compliance', path: '/alm/compliance' },
  // { label: 'Reports', path: '/alm/reports' },
];

// Plum diamond/star SVG matching the brand mark
function PlumStar({ size = 12 }) {
  return (
    <svg viewBox="0 0 100 133" style={{ width: size * 0.75, height: size, flexShrink: 0 }}>
      <path
        d="M50,0c-4.4,30.83-13.78,55.14-25.67,66.55,11.89,11.41,21.27,35.71,25.67,66.55,4.4-30.83,13.78-55.14,25.67-66.55C63.78,55.14,54.4,30.83,50,0Z"
        fill="var(--alm-plum)"
      />
    </svg>
  );
}

export default function AlmHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useResponsive();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 16px' : '0 32px',
        height: 56,
        borderBottom: '1px solid var(--alm-bd)',
        background: 'var(--alm-bg0)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left: Back + Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span
          onClick={() => navigate('/')}
          style={{
            ...sans,
            fontSize: 11,
            fontWeight: 300,
            color: 'var(--alm-t4)',
            cursor: 'pointer',
            letterSpacing: '0.05em',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--alm-t2)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--alm-t4)')}
        >
          &larr; Mission Control
        </span>

        <span style={{ width: 1, height: 24, background: 'var(--alm-bd)' }} />

        {/* ALM Logo Lockup */}
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
          onClick={() => navigate('/alm')}
        >
          <PlumStar size={14} />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span
              style={{
                ...serif,
                fontSize: 20,
                color: 'var(--alm-t1)',
                letterSpacing: '-0.02em',
                lineHeight: 1,
              }}
            >
              VEGA
            </span>
            <span
              style={{
                ...sans,
                fontSize: 7,
                fontWeight: 400,
                color: 'var(--alm-t3)',
                letterSpacing: '0.25em',
                textTransform: 'uppercase',
                lineHeight: 1,
                marginTop: 1,
              }}
            >
              Assisted Living
            </span>
          </div>
        </div>
      </div>

      {/* Center: Nav */}
      {!isMobile && (
        <nav style={{ display: 'flex', gap: 4 }}>
          {NAV_ITEMS.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  ...sans,
                  fontSize: 11,
                  fontWeight: isActive ? 400 : 300,
                  background: isActive ? 'var(--alm-plum-bg)' : 'transparent',
                  border: 'none',
                  color: isActive ? 'var(--alm-plum)' : 'var(--alm-t4)',
                  padding: '6px 14px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Right: spacer */}
      <div />
    </header>
  );
}
