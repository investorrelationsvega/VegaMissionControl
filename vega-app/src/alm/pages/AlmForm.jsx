// ═══════════════════════════════════════════════
// ALM — Daily Report Form
// One link per facility. Each facility has its own
// unique Apps Script URL. Update FACILITY_LINKS
// with the correct URL for each home.
// ═══════════════════════════════════════════════

import { ALL_HOMES } from '../config/facilities';

// Map each facility to its deployed Apps Script form URL.
// Hearthstone's URL is confirmed; update the rest as needed.
const FACILITY_LINKS = {
  'All Seasons Senior Living of Cedar City':
    'https://script.google.com/a/macros/vegarei.com/s/AKfycbwiPSh-ZUHPbyl-OXHhhaF-W1I6YxpwHUb-wqvvSgGojg6KkjR0noUcrR1vIAv2kogfHw/exec?facility=cedarcity',
  'Elk Ridge Assisted Living':
    'https://script.google.com/a/macros/vegarei.com/s/AKfycbwiPSh-ZUHPbyl-OXHhhaF-W1I6YxpwHUb-wqvvSgGojg6KkjR0noUcrR1vIAv2kogfHw/exec?facility=elkridge',
  'Hearthstone Manor Assisted Living':
    'https://script.google.com/a/macros/vegarei.com/s/AKfycbwiPSh-ZUHPbyl-OXHhhaF-W1I6YxpwHUb-wqvvSgGojg6KkjR0noUcrR1vIAv2kogfHw/exec?facility=hearthstone',
  'Beehive Homes of Riverton':
    'https://script.google.com/a/macros/vegarei.com/s/AKfycbwiPSh-ZUHPbyl-OXHhhaF-W1I6YxpwHUb-wqvvSgGojg6KkjR0noUcrR1vIAv2kogfHw/exec?facility=riverton',
  'Beehive Homes of Sandy':
    'https://script.google.com/a/macros/vegarei.com/s/AKfycbwiPSh-ZUHPbyl-OXHhhaF-W1I6YxpwHUb-wqvvSgGojg6KkjR0noUcrR1vIAv2kogfHw/exec?facility=sandy',
  'Beehive Homes of West Jordan':
    'https://script.google.com/a/macros/vegarei.com/s/AKfycbwiPSh-ZUHPbyl-OXHhhaF-W1I6YxpwHUb-wqvvSgGojg6KkjR0noUcrR1vIAv2kogfHw/exec?facility=westjordan',
};

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
        {ALL_HOMES.map((facility) => {
          const url = FACILITY_LINKS[facility];
          return (
            <a
              key={facility}
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
                {facility}
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
        Each link opens that facility's form in a new tab. Only admins signed in with a vegarei.com
        account can submit.
      </p>
    </div>
  );
}
