// ═══════════════════════════════════════════════
// ALM — Dashboard Page
// Assisted Living Management overview
// ═══════════════════════════════════════════════

import useResponsive from '../hooks/useResponsive';

const mono = { fontFamily: "'Space Mono', monospace" };

export default function AlmDashboard() {
  const { isMobile } = useResponsive();

  return (
    <div className="main" style={{ padding: isMobile ? 16 : 32 }}>
      {/* Page Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--grn)', display: 'inline-block' }} />
          <span style={{ ...mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--grn)' }}>
            Active Module
          </span>
        </div>
        <h1 style={{ ...mono, fontSize: isMobile ? 24 : 32, fontWeight: 300, color: 'var(--t1)', margin: '0 0 8px', letterSpacing: '0.02em' }}>
          Assisted Living Management
        </h1>
        <p style={{ ...mono, fontSize: 13, color: 'var(--t4)', margin: 0 }}>
          Management &amp; Operations
        </p>
      </div>

      {/* Placeholder content — ready for buildout */}
      <div
        style={{
          textAlign: 'center',
          padding: '80px 0',
          background: 'var(--bg-card-half)',
          border: '1px solid var(--bd)',
          borderRadius: 6,
        }}
      >
        <svg viewBox="0 0 200 266" style={{ width: 36, height: 48, fill: 'var(--t5)', opacity: 0.2, marginBottom: 24 }}>
          <path d="M100,0c-8.8,61.66-27.56,110.27-51.34,133.09,23.79,22.82,42.54,71.43,51.34,133.09,8.8-61.66,27.56-110.27,51.34-133.09C127.55,110.27,108.8,61.66,100,0Z" />
        </svg>
        <div style={{ ...mono, fontSize: 16, fontWeight: 300, color: 'var(--t3)', marginBottom: 8 }}>
          ALM Dashboard
        </div>
        <div style={{ ...mono, fontSize: 12, color: 'var(--t5)' }}>
          Send brand guidelines to start building out this section
        </div>
      </div>
    </div>
  );
}
