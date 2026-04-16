// ═══════════════════════════════════════════════
// ALM — Header (blank shell)
// Back link + module label.
// ═══════════════════════════════════════════════

import { useNavigate, useLocation } from 'react-router-dom';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/alm' },
];

export default function AlmHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: 56,
        borderBottom: '1px solid var(--alm-border)',
        background: 'var(--alm-bg)',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span
          onClick={() => navigate('/')}
          style={{
            fontSize: 12,
            color: 'var(--alm-text-muted)',
            cursor: 'pointer',
          }}
        >
          &larr; Mission Control
        </span>
        <span style={{ width: 1, height: 20, background: 'var(--alm-border)' }} />
        <span
          onClick={() => navigate('/alm')}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--alm-text)',
            cursor: 'pointer',
            letterSpacing: '0.02em',
          }}
        >
          Assisted Living
        </span>
      </div>

      <nav style={{ display: 'flex', gap: 4 }}>
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                background: 'transparent',
                border: 'none',
                color: isActive ? 'var(--alm-text)' : 'var(--alm-text-muted)',
                padding: '6px 12px',
                cursor: 'pointer',
              }}
            >
              {item.label}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
