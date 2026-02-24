// ═══════════════════════════════════════════════
// ALM — Header Component (self-contained)
// Navigation header for Assisted Living Management
// ═══════════════════════════════════════════════

import { useNavigate, useLocation } from 'react-router-dom';
import useAlmUiStore from '../stores/almUiStore';
import useResponsive from '../hooks/useResponsive';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/alm' },
  // Future nav items will go here:
  // { label: 'Facilities', path: '/alm/facilities' },
  // { label: 'Staff', path: '/alm/staff' },
  // { label: 'Residents', path: '/alm/residents' },
  // { label: 'Compliance', path: '/alm/compliance' },
  // { label: 'Reports', path: '/alm/reports' },
];

export default function AlmHeader() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isMobile } = useResponsive();
  const theme = useAlmUiStore((s) => s.theme);
  const toggleTheme = useAlmUiStore((s) => s.toggleTheme);

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 16px' : '0 32px',
        height: 56,
        borderBottom: '1px solid var(--bd)',
        background: 'var(--bg0)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      {/* Left: Back + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span
          onClick={() => navigate('/')}
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 11,
            color: 'var(--t4)',
            cursor: 'pointer',
            letterSpacing: '0.05em',
          }}
        >
          &larr; Mission Control
        </span>
        <span style={{ width: 1, height: 20, background: 'var(--bd)' }} />
        <span
          style={{
            fontFamily: "'Space Mono', monospace",
            fontSize: 13,
            fontWeight: 700,
            color: 'var(--t1)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
          }}
        >
          ALM
        </span>
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
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 11,
                  background: isActive ? 'var(--bgS)' : 'transparent',
                  border: 'none',
                  color: isActive ? 'var(--t1)' : 'var(--t4)',
                  padding: '6px 14px',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontWeight: isActive ? 700 : 400,
                  transition: 'all 0.15s',
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      )}

      {/* Right: Theme toggle */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={toggleTheme}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          style={{
            background: 'none',
            border: '1px solid var(--bd)',
            borderRadius: 4,
            padding: '4px 8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--t4)',
            fontSize: 14,
          }}
        >
          {theme === 'dark' ? '\u2600' : '\u263E'}
        </button>
      </div>
    </header>
  );
}
