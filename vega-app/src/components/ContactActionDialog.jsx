// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Contact Action Dialog
// Call or Text choice when clicking a phone number
// ═══════════════════════════════════════════════

import { formatPhoneForDisplay } from '../services/ringcentralService';

const mono = { fontFamily: "'Space Mono', monospace" };

export default function ContactActionDialog({ phone, name, onCall, onText, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Modal */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            background: 'var(--bg1)',
            border: '1px solid var(--bdH)',
            borderRadius: 10,
            padding: 32,
            width: 300,
            textAlign: 'center',
            boxShadow: '0 16px 64px rgba(0,0,0,0.8)',
          }}
        >
          {/* Contact icon */}
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: 'rgba(74,122,130,0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px',
            }}
          >
            <svg viewBox="0 0 24 24" style={{ width: 22, height: 22, fill: 'var(--t3)' }}>
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
            </svg>
          </div>

          {/* Name */}
          <div style={{ fontSize: 16, fontWeight: 300, color: 'var(--t1)', marginBottom: 4 }}>
            {name}
          </div>

          {/* Phone */}
          <div style={{ ...mono, fontSize: 12, color: 'var(--t4)', marginBottom: 24 }}>
            {formatPhoneForDisplay(phone)}
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {/* Call */}
            <button
              onClick={onCall}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '16px 12px',
                border: '1px solid rgba(52,211,153,0.3)',
                background: 'var(--grnM)',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'var(--grn)' }}>
                <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
              </svg>
              <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: 'var(--grn)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Call
              </span>
            </button>

            {/* Text */}
            <button
              onClick={onText}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '16px 12px',
                border: '1px solid rgba(96,165,250,0.3)',
                background: 'var(--bluM)',
                borderRadius: 8,
                cursor: 'pointer',
                transition: 'opacity 0.15s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <svg viewBox="0 0 24 24" style={{ width: 20, height: 20, fill: 'var(--blu)' }}>
                <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
              </svg>
              <span style={{ ...mono, fontSize: 10, fontWeight: 700, color: 'var(--blu)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                Text
              </span>
            </button>
          </div>

          {/* Cancel */}
          <button
            onClick={onClose}
            style={{
              ...mono,
              fontSize: 10,
              color: 'var(--t5)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              marginTop: 16,
              padding: '4px 8px',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
