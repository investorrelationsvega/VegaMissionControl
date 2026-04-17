// ═══════════════════════════════════════════════
// ALM — Header
// Vega · Assisted Living sub-brand lockup:
//   [V-icon]  VEGA
//             Assisted Living  (Source Serif italic)
// Preserves icon integrity while giving the module
// its own editorial voice.
// ═══════════════════════════════════════════════

import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'Today',    path: '/alm' },
  { label: 'Outreach', path: '/alm/outreach' },
  { label: 'Trends',   path: '/alm/trends' },
];

// Inline Vega V + star-burst mark, sourced from /public/vega-icon.svg
// so we can color via `fill: currentColor` and keep the element
// scalable without another HTTP request.
function VegaMark({ className }) {
  return (
    <svg
      className={className}
      viewBox="0 0 186.57 293.85"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path d="M0,67.93h32.68l59.02,184.67h.63l62.83-184.67h31.41l-80.27,225.92h-30.78L0,67.93Z" />
      <path d="M93.29,0c-4.49,31.47-14.06,56.29-26.21,67.93,12.14,11.65,21.71,36.46,26.21,67.93,4.49-31.47,14.06-56.29,26.21-67.93-12.14-11.65-21.71-36.46-26.21-67.93Z" />
    </svg>
  );
}

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
        {/* Left: back link + brand lockup */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <button
            onClick={() => navigate('/')}
            className="alm-header-back"
          >
            <span aria-hidden="true">←</span>
            <span className="alm-header-back-text"> Mission Control</span>
          </button>
          <span className="alm-header-divider" />
          <div
            onClick={() => navigate('/alm')}
            className="alm-header-lockup"
            role="link"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate('/alm'); }}
          >
            <VegaMark className="alm-header-lockup__icon" />
            <span className="alm-header-lockup__text">
              <span className="alm-header-lockup__wordmark">Vega</span>
              <span className="alm-header-lockup__sub">Assisted Living</span>
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
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.18em',
                  background: 'transparent',
                  border: 'none',
                  borderBottom: active ? '2px solid var(--alm-accent)' : '2px solid transparent',
                  color: active ? 'var(--alm-ink-1)' : 'var(--alm-ink-3)',
                  padding: '0 16px',
                  marginLeft: 4,
                  cursor: 'pointer',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = 'var(--alm-ink-1)'; }}
                onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = 'var(--alm-ink-3)'; }}
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
