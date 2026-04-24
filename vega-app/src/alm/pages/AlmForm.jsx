// ═══════════════════════════════════════════════
// ALM — Daily Report Form
// One link per facility. Each facility opens the
// shared Apps Script web app with its slug appended
// so the form pre-fills the facility + capacity.
// ═══════════════════════════════════════════════

import { FACILITY_CONFIG } from '../config/facilities';

const FORM_BASE =
  'https://script.google.com/macros/s/AKfycbwRFCSnhd-nsiC7SPwv-spzjNiM423WvnazC2tzyPTmco7pfC2D_pjQoQnpYiXi92b7/exec';

export default function AlmForm() {
  return (
    <div className="alm-page">
      <div className="alm-page-header">
        <div className="alm-page-header__row">
          <div className="alm-page-header__main">
            <div className="alm-page-dot"><span>Daily Report</span></div>
            <h1 className="alm-page-title">Admin Submission Forms</h1>
            <p className="alm-page-subtitle">
              Each facility has a dedicated daily report form. The form itself is identical across
              homes — only the target facility differs.
            </p>
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 14,
        }}
      >
        {FACILITY_CONFIG.map((f) => {
          const url = `${FORM_BASE}?facility=${f.slug}`;
          return (
            <a
              key={f.name}
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="alm-card"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                padding: 18,
                textDecoration: 'none',
                color: 'inherit',
                transition: 'transform 120ms ease, border-color 120ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = 'var(--alm-accent, #3b82f6)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = '';
              }}
            >
              <div
                className="alm-serif"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: 'var(--alm-ink-4)',
                }}
              >
                Daily Report Form
              </div>
              <div
                className="alm-serif"
                style={{
                  fontSize: 18,
                  fontWeight: 600,
                  lineHeight: 1.25,
                  color: 'var(--alm-ink-1)',
                }}
              >
                {f.name}
              </div>
              <div
                className="alm-serif"
                style={{
                  fontSize: 12,
                  color: 'var(--alm-ink-4)',
                }}
              >
                Capacity · {f.capacity} rooms
              </div>
              <div
                className="alm-serif"
                style={{
                  marginTop: 'auto',
                  fontSize: 12,
                  color: 'var(--alm-accent, #3b82f6)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Open form ↗
              </div>
            </a>
          );
        })}
      </div>

      <p
        className="alm-serif"
        style={{
          marginTop: 18,
          fontSize: 12,
          color: 'var(--alm-ink-4)',
          textAlign: 'center',
          letterSpacing: 0,
        }}
      >
        Each link opens that facility's form in a new tab. Anyone with the link can submit.
      </p>
    </div>
  );
}
