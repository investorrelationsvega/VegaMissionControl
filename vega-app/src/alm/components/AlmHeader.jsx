import { useNavigate, useLocation } from 'react-router-dom';

const NAV = [
  { label: 'Today',        path: '/alm' },
  { label: 'Admissions',   path: '/alm/outreach' },
  { label: 'Trends',       path: '/alm/trends' },
  { label: 'Daily Report', path: '/alm/form' },
];

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
        background: 'rgba(245,245,247,0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--alm-border)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div className="alm-header-inner">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => navigate('/')}
            className="alm-header-back"
          >
            <span aria-hidden="true" style={{ fontSize: 16 }}>&#8249;</span>
            <span className="alm-header-back-text">Mission Control</span>
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

        <nav style={{ display: 'flex', alignItems: 'stretch', gap: 4 }}>
          {NAV.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  background: active ? 'var(--alm-accent-soft)' : 'transparent',
                  border: 'none',
                  borderRadius: 8,
                  color: active ? 'var(--alm-accent)' : 'var(--alm-ink-3)',
                  padding: '6px 14px',
                  margin: 'auto 0',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = 'var(--alm-ink-1)';
                    e.currentTarget.style.background = 'var(--alm-border)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!active) {
                    e.currentTarget.style.color = 'var(--alm-ink-3)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
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
