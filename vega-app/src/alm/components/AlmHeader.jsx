// ═══════════════════════════════════════════════
// ALM — Header
// Elevated Vega nav: mono labels, hairline divider,
// underline-active tabs.
// ═══════════════════════════════════════════════

import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'Today',    path: '/alm' },
  { label: 'Outreach', path: '/alm/outreach' },
  { label: 'Trends',   path: '/alm/trends' },
];

export default function AlmHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) =>
    path === '/alm'
      ? location.pathname === '/alm' || location.pathname === '/alm/'
      : location.pathname === path;

  return (
    <header
      style={{
        borderBottom: '1px solid var(--alm-border)',
        background: 'var(--alm-bg)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div className="alm-header-inner">
        {/* Left: back link + module label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/')}
            className="alm-mono alm-header-back"
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--alm-ink-1)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--alm-ink-4)')}
          >
            <span aria-hidden="true">←</span>
            <span className="alm-header-back-text"> Mission Control</span>
          </button>
          <span className="alm-header-divider" />
          <div
            onClick={() => navigate('/alm')}
            style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', lineHeight: 1 }}
          >
            <span className="alm-mono alm-header-eyebrow">
              Vega · Operations
            </span>
            <span className="alm-header-title">
              Assisted Living
            </span>
          </div>
        </div>

        {/* Right: tabs */}
        <nav style={{ display: 'flex', alignItems: 'stretch' }}>
          {NAV_ITEMS.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="alm-mono"
                style={{
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--alm-accent)' : '2px solid transparent',
                  color: active ? 'var(--alm-ink-1)' : 'var(--alm-ink-4)',
                  padding: '0 16px',
                  marginLeft: 4,
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--alm-ink-2)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--alm-ink-4)'; }}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
