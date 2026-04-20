// ═══════════════════════════════════════════════
// ALM — Daily Report Form
// Embeds the Apps Script web app so leadership can
// see exactly what admins are asked to submit each
// day. Form is identical across facilities; we use
// Hearthstone's link as the sample.
// ═══════════════════════════════════════════════

import { useState } from 'react';

const FORM_BASE = 'https://script.google.com/a/macros/vegarei.com/s/AKfycbwiPSh-ZUHPbyl-OXHhhaF-W1I6YxpwHUb-wqvvSgGojg6KkjR0noUcrR1vIAv2kogfHw/exec';
const PREVIEW_URL = FORM_BASE + '?facility=hearthstone';
const BLANK_URL = FORM_BASE;

export default function AlmForm() {
  const [loaded, setLoaded] = useState(false);

  return (
    <div className="alm-page">
      <div className="alm-page-header">
        <div className="alm-page-header__row">
          <div className="alm-page-header__main">
            <div className="alm-page-dot"><span>Daily Report</span></div>
            <h1 className="alm-page-title">Admin Submission Form</h1>
            <p className="alm-page-subtitle">
              A read-only preview of what facility admins fill out each day. Identical across all homes.
            </p>
          </div>
          <a
            href={BLANK_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="alm-refresh-btn"
            style={{ textDecoration: 'none' }}
          >
            Open in New Tab ↗
          </a>
        </div>
      </div>

      <div
        className="alm-card"
        style={{
          padding: 0,
          overflow: 'hidden',
          position: 'relative',
          minHeight: 720,
        }}
      >
        {!loaded && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--alm-ink-4)',
              fontSize: 14,
              pointerEvents: 'none',
            }}
          >
            Loading form…
          </div>
        )}

        {/* Transparent overlay prevents all interaction — preview only */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            cursor: 'default',
          }}
        />

        {/* Preview badge */}
        <div
          className="alm-serif"
          style={{
            position: 'absolute',
            top: 12,
            right: 16,
            zIndex: 3,
            background: 'var(--alm-ink-6, rgba(0,0,0,0.7))',
            color: '#fff',
            fontSize: 11,
            fontWeight: 600,
            padding: '4px 12px',
            borderRadius: 4,
            letterSpacing: '0.04em',
            pointerEvents: 'none',
          }}
        >
          PREVIEW ONLY
        </div>

        <iframe
          src={PREVIEW_URL}
          onLoad={() => setLoaded(true)}
          title="ALM Daily Report Form"
          style={{
            width: '100%',
            height: 'calc(100vh - 260px)',
            minHeight: 720,
            border: 'none',
            display: 'block',
            background: 'var(--alm-surface)',
          }}
        />
      </div>

      <p
        className="alm-serif"
        style={{
          marginTop: 14,
          fontSize: 12,
          color: 'var(--alm-ink-4)',
          textAlign: 'center',
          letterSpacing: 0,
        }}
      >
        This is a non-interactive preview. Use "Open in New Tab" to access a blank, submittable form.
      </p>
    </div>
  );
}
