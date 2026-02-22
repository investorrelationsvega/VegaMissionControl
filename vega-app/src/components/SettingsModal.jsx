// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Settings Modal
// Theme picker + future settings
// ═══════════════════════════════════════════════

import useUiStore from '../stores/uiStore';

const mono = { fontFamily: "'Space Mono', monospace" };

export default function SettingsModal({ onClose }) {
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 500,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 400,
          maxWidth: '92vw',
          background: 'var(--bg1)',
          border: '1px solid var(--bd)',
          borderRadius: 12,
          zIndex: 501,
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--bd)',
          }}
        >
          <span
            style={{
              ...mono,
              fontSize: 13,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: 'var(--t1)',
            }}
          >
            Settings
          </span>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--t4)',
              fontSize: 20,
              cursor: 'pointer',
              lineHeight: 1,
              padding: 0,
            }}
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '24px' }}>
          {/* Section label */}
          <div
            style={{
              ...mono,
              fontSize: 9,
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: 'var(--t4)',
              marginBottom: 14,
            }}
          >
            Appearance
          </div>

          {/* Theme cards */}
          <div style={{ display: 'flex', gap: 12 }}>
            {/* Dark card */}
            <button
              onClick={() => setTheme('dark')}
              style={{
                flex: 1,
                background: theme === 'dark' ? 'rgba(52,211,153,0.06)' : 'var(--bg2)',
                border: `2px solid ${theme === 'dark' ? 'var(--grn)' : 'var(--bd)'}`,
                borderRadius: 8,
                padding: 16,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'center',
              }}
            >
              {/* Preview swatch */}
              <div
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 4,
                  background: '#1e3a40',
                  border: '1px solid #345c63',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Mini preview bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '60%' }}>
                  <div style={{ height: 4, borderRadius: 2, background: '#f1f5f9', opacity: 0.6 }} />
                  <div style={{ height: 4, borderRadius: 2, background: '#34d399', opacity: 0.5, width: '70%' }} />
                  <div style={{ height: 4, borderRadius: 2, background: '#b0bec9', opacity: 0.3, width: '85%' }} />
                </div>
              </div>
              {/* Moon icon + label */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: theme === 'dark' ? 'var(--grn)' : 'var(--t4)' }}>
                  <path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9 9-4.03 9-9c0-.46-.04-.92-.1-1.36-.98 1.37-2.58 2.26-4.4 2.26-2.98 0-5.4-2.42-5.4-5.4 0-1.81.89-3.42 2.26-4.4-.44-.06-.9-.1-1.36-.1z" />
                </svg>
                <span
                  style={{
                    ...mono,
                    fontSize: 11,
                    fontWeight: 700,
                    color: theme === 'dark' ? 'var(--grn)' : 'var(--t4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Dark
                </span>
              </div>
              {theme === 'dark' && (
                <div
                  style={{
                    ...mono,
                    fontSize: 8,
                    color: 'var(--grn)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    marginTop: 6,
                  }}
                >
                  Active
                </div>
              )}
            </button>

            {/* Light card */}
            <button
              onClick={() => setTheme('light')}
              style={{
                flex: 1,
                background: theme === 'light' ? 'rgba(52,211,153,0.06)' : 'var(--bg2)',
                border: `2px solid ${theme === 'light' ? 'var(--grn)' : 'var(--bd)'}`,
                borderRadius: 8,
                padding: 16,
                cursor: 'pointer',
                transition: 'all 0.15s',
                textAlign: 'center',
              }}
            >
              {/* Preview swatch */}
              <div
                style={{
                  width: '100%',
                  height: 48,
                  borderRadius: 4,
                  background: '#f8f9fb',
                  border: '1px solid #dce1e6',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {/* Mini preview bars */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: '60%' }}>
                  <div style={{ height: 4, borderRadius: 2, background: '#1a1f2b', opacity: 0.6 }} />
                  <div style={{ height: 4, borderRadius: 2, background: '#0d9668', opacity: 0.5, width: '70%' }} />
                  <div style={{ height: 4, borderRadius: 2, background: '#4a5568', opacity: 0.3, width: '85%' }} />
                </div>
              </div>
              {/* Sun icon + label */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: theme === 'light' ? 'var(--grn)' : 'var(--t4)' }}>
                  <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 0 0-1.41 0 .996.996 0 0 0 0 1.41l1.06 1.06c.39.39 1.03.39 1.41 0a.996.996 0 0 0 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.36a.996.996 0 0 0 0-1.41.996.996 0 0 0-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z" />
                </svg>
                <span
                  style={{
                    ...mono,
                    fontSize: 11,
                    fontWeight: 700,
                    color: theme === 'light' ? 'var(--grn)' : 'var(--t4)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  Light
                </span>
              </div>
              {theme === 'light' && (
                <div
                  style={{
                    ...mono,
                    fontSize: 8,
                    color: 'var(--grn)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    marginTop: 6,
                  }}
                >
                  Active
                </div>
              )}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--bd)',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              ...mono,
              fontSize: 9,
              color: 'var(--t5)',
              letterSpacing: '0.1em',
            }}
          >
            Vega Mission Control v2.0
          </span>
        </div>
      </div>
    </>
  );
}
