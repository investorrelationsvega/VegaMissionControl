// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Unit Placeholder
// Empty dashboard shell for business units
// that don't yet have a full dashboard
// ═══════════════════════════════════════════════

export default function UnitPlaceholder({ name, subtitle }) {
  return (
    <div className="main">
      <div className="page-header">
        <div className="page-header-dot"><span>Active Module</span></div>
        <h1 className="page-title">{name}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>

      <div
        style={{
          textAlign: 'center',
          padding: '80px 0',
          color: 'var(--t4)',
        }}
      >
        <svg viewBox="0 0 200 266" style={{ width: 36, height: 48, fill: 'var(--t5)', opacity: 0.2, marginBottom: 24 }}>
          <path d="M100,0c-8.8,61.66-27.56,110.27-51.34,133.09,23.79,22.82,42.54,71.43,51.34,133.09,8.8-61.66,27.56-110.27,51.34-133.09C127.55,110.27,108.8,61.66,100,0Z" />
        </svg>
        <div style={{ fontSize: 16, fontWeight: 300, color: 'var(--t3)', marginBottom: 8 }}>
          {name}
        </div>
        <div className="mono" style={{ fontSize: 13, color: 'var(--t5)' }}>
          Dashboard coming soon
        </div>
      </div>
    </div>
  );
}
