// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Email Compose Dialog
// In-app email compose modal (Gmail API)
// ═══════════════════════════════════════════════

import { useState } from 'react';
import useGoogleStore from '../stores/googleStore';
import useUiStore from '../stores/uiStore';
import { requestAccessToken } from '../services/googleAuth';

const mono = { fontFamily: "'Space Mono', monospace" };

// Build RFC 2822 email and base64url-encode it
function buildRawEmail({ from, to, subject, body }) {
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ];
  const raw = lines.join('\r\n');
  // base64url encode
  return btoa(unescape(encodeURIComponent(raw)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function sendGmailMessage(accessToken, { to, subject, body, from }) {
  const raw = buildRawEmail({ from, to, subject, body });

  const resp = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gmail API error (${resp.status})`);
  }

  return resp.json();
}

export default function EmailComposeDialog({ to, toName, onClose }) {
  const googleAuth = useGoogleStore((s) => s.isAuthenticated);
  const googleToken = useGoogleStore((s) => s.accessToken);
  const userEmail = useGoogleStore((s) => s.userEmail);
  const setToken = useGoogleStore((s) => s.setToken);
  const showToast = useUiStore((s) => s.showToast);

  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      setError('Subject and body are required');
      return;
    }

    setSending(true);
    setError(null);

    try {
      let token = googleToken;

      // If not authenticated, request a token
      if (!token) {
        const tokenResp = await requestAccessToken();
        setToken(tokenResp);
        token = tokenResp.access_token;
      }

      await sendGmailMessage(token, {
        to,
        subject: subject.trim(),
        body: body.trim(),
        from: userEmail,
      });

      showToast(`Email sent to ${toName || to}`);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to send email');
    } finally {
      setSending(false);
    }
  };

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
            width: 480,
            maxHeight: '80vh',
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 16px 64px rgba(0,0,0,0.8)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--bd)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'var(--ylw)' }}>
                <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
              </svg>
              <span
                style={{
                  ...mono,
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  color: 'var(--t3)',
                }}
              >
                Compose Email
              </span>
            </div>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--t4)',
                cursor: 'pointer',
                fontSize: 18,
                lineHeight: 1,
                padding: '0 4px',
              }}
            >
              ✕
            </button>
          </div>

          {/* Form */}
          <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
            {/* From */}
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  ...mono,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--t4)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                From
              </label>
              <div
                style={{
                  ...mono,
                  fontSize: 12,
                  color: 'var(--t3)',
                  padding: '8px 10px',
                  background: 'var(--bgS)',
                  border: '1px solid var(--bd)',
                  borderRadius: 4,
                }}
              >
                {userEmail || '(not signed in)'}
              </div>
            </div>

            {/* To */}
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  ...mono,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--t4)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                To
              </label>
              <div
                style={{
                  ...mono,
                  fontSize: 12,
                  color: 'var(--t1)',
                  padding: '8px 10px',
                  background: 'var(--bgS)',
                  border: '1px solid var(--bd)',
                  borderRadius: 4,
                }}
              >
                {toName && <span style={{ color: 'var(--t3)', marginRight: 8 }}>{toName}</span>}
                {to}
              </div>
            </div>

            {/* Subject */}
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  ...mono,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--t4)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Subject
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Enter subject..."
                style={{
                  ...mono,
                  fontSize: 12,
                  color: 'var(--t1)',
                  padding: '8px 10px',
                  background: 'var(--bgS)',
                  border: '1px solid var(--bd)',
                  borderRadius: 4,
                  width: '100%',
                  boxSizing: 'border-box',
                  outline: 'none',
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--grn)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--bd)')}
              />
            </div>

            {/* Body */}
            <div style={{ marginBottom: 12 }}>
              <label
                style={{
                  ...mono,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: 'var(--t4)',
                  display: 'block',
                  marginBottom: 4,
                }}
              >
                Message
              </label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Compose your message..."
                rows={8}
                style={{
                  ...mono,
                  fontSize: 12,
                  color: 'var(--t1)',
                  padding: '8px 10px',
                  background: 'var(--bgS)',
                  border: '1px solid var(--bd)',
                  borderRadius: 4,
                  width: '100%',
                  boxSizing: 'border-box',
                  outline: 'none',
                  resize: 'vertical',
                  minHeight: 120,
                  lineHeight: 1.5,
                }}
                onFocus={(e) => (e.target.style.borderColor = 'var(--grn)')}
                onBlur={(e) => (e.target.style.borderColor = 'var(--bd)')}
              />
            </div>

            {/* Error */}
            {error && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--red)',
                  marginBottom: 12,
                  padding: '8px 12px',
                  background: 'var(--redM)',
                  borderRadius: 4,
                }}
              >
                {error}
              </div>
            )}

            {/* Not authenticated hint */}
            {!googleAuth && (
              <div
                style={{
                  ...mono,
                  fontSize: 10,
                  color: 'var(--t4)',
                  marginBottom: 12,
                  padding: '8px 12px',
                  background: 'var(--bdS)',
                  borderRadius: 4,
                }}
              >
                You'll be prompted to connect Google when you send.
              </div>
            )}
          </div>

          {/* Footer Buttons */}
          <div
            style={{
              display: 'flex',
              gap: 10,
              justifyContent: 'flex-end',
              padding: '12px 20px',
              borderTop: '1px solid var(--bd)',
            }}
          >
            <button
              onClick={onClose}
              style={{
                ...mono,
                fontSize: 11,
                fontWeight: 700,
                padding: '10px 20px',
                border: '1px solid var(--bd)',
                background: 'transparent',
                color: 'var(--t3)',
                borderRadius: 6,
                cursor: 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSend}
              disabled={sending}
              style={{
                ...mono,
                fontSize: 11,
                fontWeight: 700,
                padding: '10px 20px',
                border: '1px solid rgba(52,211,153,0.3)',
                background: 'var(--grnM)',
                color: 'var(--grn)',
                borderRadius: 6,
                cursor: sending ? 'wait' : 'pointer',
                opacity: sending ? 0.6 : 1,
              }}
            >
              {sending ? 'Sending...' : 'Send Email'}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
