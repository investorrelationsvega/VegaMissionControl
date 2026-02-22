// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Bluesky Filing Modal
// Resolution modal for Blue Sky regulatory filings.
// Gmail email picker, notes, and audit trail.
// ═══════════════════════════════════════════════

import { useState } from 'react';
import useBlueskyStore from '../stores/blueskyStore';
import useGoogleStore from '../stores/googleStore';
import useUiStore from '../stores/uiStore';
import { searchMessages } from '../services/gmailService';

function daysUntil(deadline) {
  const now = new Date();
  const dl = new Date(deadline);
  return Math.ceil((dl - now) / (1000 * 60 * 60 * 24));
}

function deadlineColor(days) {
  if (days < 0) return 'var(--red)';
  if (days <= 7) return 'var(--ylw)';
  return 'var(--t4)';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  );
}

export default function BlueskyFilingModal({ filingId, onClose }) {
  const filing = useBlueskyStore((s) => s.getFiling(filingId));
  const resolveFiling = useBlueskyStore((s) => s.resolveFiling);
  const dismissNotification = useUiStore((s) => s.dismissNotification);
  const notifications = useUiStore((s) => s.notifications);
  const showToast = useUiStore((s) => s.showToast);
  const googleAuth = useGoogleStore((s) => s.isAuthenticated);
  const accessToken = useGoogleStore((s) => s.accessToken);

  const [notes, setNotes] = useState('');
  const [attachedEmails, setAttachedEmails] = useState([]);
  const [emailQuery, setEmailQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');

  if (!filing) return null;

  const daysLeft = daysUntil(filing.deadlineDate);
  const isPending = filing.status === 'Pending';

  const handleSearch = async () => {
    if (!emailQuery.trim() || !accessToken) return;
    setSearching(true);
    setSearchError('');
    try {
      const results = await searchMessages(emailQuery.trim(), accessToken);
      setSearchResults(results);
      if (results.length === 0) setSearchError('No emails found');
    } catch (err) {
      setSearchError(err.message || 'Search failed');
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAttach = (email) => {
    if (attachedEmails.some((e) => e.messageId === email.messageId)) return;
    setAttachedEmails((prev) => [...prev, email]);
    setSearchResults((prev) => prev.filter((r) => r.messageId !== email.messageId));
  };

  const handleRemove = (messageId) => {
    setAttachedEmails((prev) => prev.filter((e) => e.messageId !== messageId));
  };

  const handleSubmit = () => {
    if (!notes.trim()) {
      showToast('Notes are required to mark as filed');
      return;
    }
    resolveFiling(filingId, 'j@vegarei.com', notes.trim(), attachedEmails);

    // Dismiss the matching bluesky notification
    const matchingNotif = notifications.find(
      (n) => n.type === 'bluesky' && n.filingId === filingId,
    );
    if (matchingNotif) dismissNotification(matchingNotif.id);

    showToast(`Blue Sky filing resolved for ${filing.name}`);
    onClose();
  };

  const canSubmit = notes.trim().length > 0;

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
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 560,
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'var(--bg1)',
          border: '1px solid var(--bdH)',
          borderRadius: 10,
          boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          zIndex: 1001,
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px 16px',
            borderBottom: '1px solid var(--bd)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: '#c084fc',
                  padding: '2px 8px',
                  borderRadius: 3,
                  background: 'rgba(192,132,252,0.15)',
                }}
              >
                Blue Sky Filing
              </span>
              <span
                className="mono"
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  color: filing.status === 'Filed' ? 'var(--grn)' : deadlineColor(daysLeft),
                  padding: '2px 8px',
                  borderRadius: 3,
                  background:
                    filing.status === 'Filed'
                      ? 'rgba(52,211,153,0.15)'
                      : `color-mix(in srgb, ${deadlineColor(daysLeft)} 15%, transparent)`,
                }}
              >
                {filing.status === 'Filed' ? 'Filed' : `${daysLeft >= 0 ? daysLeft : Math.abs(daysLeft)} day${Math.abs(daysLeft) !== 1 ? 's' : ''} ${daysLeft >= 0 ? 'remaining' : 'overdue'}`}
              </span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 500, color: 'var(--t1)' }}>{filing.name}</div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>
              {filing.state} &middot; {filing.fund}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--t5)',
              fontSize: 20,
              cursor: 'pointer',
              padding: '0 4px',
            }}
          >
            &times;
          </button>
        </div>

        {/* Filing Details */}
        <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div
                className="mono"
                style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--t5)', letterSpacing: '0.1em' }}
              >
                Trigger Date
              </div>
              <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 2 }}>
                {formatDate(filing.triggerDate)}
              </div>
            </div>
            <div>
              <div
                className="mono"
                style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--t5)', letterSpacing: '0.1em' }}
              >
                Deadline (30 days)
              </div>
              <div style={{ fontSize: 13, color: deadlineColor(daysLeft), marginTop: 2, fontWeight: 500 }}>
                {formatDate(filing.deadlineDate)}
              </div>
            </div>
            {filing.status === 'Filed' && (
              <>
                <div>
                  <div
                    className="mono"
                    style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--t5)', letterSpacing: '0.1em' }}
                  >
                    Filed By
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t2)', marginTop: 2 }}>{filing.filedBy}</div>
                </div>
                <div>
                  <div
                    className="mono"
                    style={{ fontSize: 9, textTransform: 'uppercase', color: 'var(--t5)', letterSpacing: '0.1em' }}
                  >
                    Filed Date
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--grn)', marginTop: 2 }}>
                    {formatDate(filing.filedDate)}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Notes + Email Picker (only for pending) */}
        {isPending && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)' }}>
            {/* Notes */}
            <div style={{ marginBottom: 16 }}>
              <label
                className="mono"
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--t4)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Filing Notes <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <textarea
                placeholder="Describe the filing action taken..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
                style={{
                  width: '100%',
                  background: 'var(--bg1)',
                  border: '1px solid var(--bd)',
                  borderRadius: 4,
                  padding: '8px 12px',
                  fontSize: 13,
                  color: 'var(--t2)',
                  fontFamily: 'inherit',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Gmail Email Picker */}
            <div>
              <label
                className="mono"
                style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--t4)',
                  display: 'block',
                  marginBottom: 6,
                }}
              >
                Attach Gmail Evidence
              </label>

              {!googleAuth ? (
                <div
                  style={{
                    padding: '12px 16px',
                    background: 'rgba(251,191,36,0.06)',
                    border: '1px solid rgba(251,191,36,0.2)',
                    borderRadius: 4,
                    fontSize: 12,
                    color: 'var(--ylw)',
                  }}
                >
                  Connect Google Drive to search Gmail emails
                </div>
              ) : (
                <>
                  {/* Search bar */}
                  <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <input
                      type="text"
                      placeholder="Search Gmail (e.g. blue sky filing)..."
                      value={emailQuery}
                      onChange={(e) => setEmailQuery(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSearch();
                      }}
                      style={{
                        flex: 1,
                        background: 'var(--bg1)',
                        border: '1px solid var(--bd)',
                        borderRadius: 4,
                        padding: '8px 12px',
                        fontSize: 13,
                        color: 'var(--t2)',
                        fontFamily: 'inherit',
                        outline: 'none',
                      }}
                    />
                    <button
                      onClick={handleSearch}
                      disabled={searching || !emailQuery.trim()}
                      className="mono"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '8px 16px',
                        border: '1px solid rgba(192,132,252,0.3)',
                        borderRadius: 4,
                        background: emailQuery.trim() ? 'rgba(192,132,252,0.1)' : 'transparent',
                        color: emailQuery.trim() ? '#c084fc' : 'var(--t5)',
                        cursor: emailQuery.trim() ? 'pointer' : 'default',
                        textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {searching ? 'Searching...' : 'Search'}
                    </button>
                  </div>

                  {/* Search results */}
                  {searchError && (
                    <div style={{ fontSize: 12, color: 'var(--t5)', fontStyle: 'italic', marginBottom: 8 }}>
                      {searchError}
                    </div>
                  )}
                  {searchResults.length > 0 && (
                    <div
                      style={{
                        maxHeight: 160,
                        overflowY: 'auto',
                        border: '1px solid var(--bd)',
                        borderRadius: 4,
                        marginBottom: 8,
                      }}
                    >
                      {searchResults.map((email) => (
                        <div
                          key={email.messageId}
                          onClick={() => handleAttach(email)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 10,
                            padding: '8px 12px',
                            borderBottom: '1px solid var(--bgM3)',
                            cursor: 'pointer',
                            transition: 'background 0.1s',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bgH)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ color: '#c084fc', fontSize: 14, flexShrink: 0, marginTop: 1 }}>+</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                color: 'var(--t2)',
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {email.subject}
                            </div>
                            <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', marginTop: 1 }}>
                              {email.from} &middot; {email.date}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Attached emails */}
                  {attachedEmails.length > 0 && (
                    <div>
                      <div
                        className="mono"
                        style={{
                          fontSize: 9,
                          textTransform: 'uppercase',
                          color: 'var(--grn)',
                          letterSpacing: '0.1em',
                          marginBottom: 4,
                        }}
                      >
                        Attached ({attachedEmails.length})
                      </div>
                      {attachedEmails.map((email) => (
                        <div
                          key={email.messageId}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '6px 10px',
                            background: 'rgba(52,211,153,0.04)',
                            borderLeft: '2px solid var(--grn)',
                            borderRadius: '0 4px 4px 0',
                            marginBottom: 4,
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                color: 'var(--t2)',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {email.subject}
                            </div>
                            <div className="mono" style={{ fontSize: 10, color: 'var(--t5)' }}>
                              {email.from}
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemove(email.messageId)}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: 'var(--red)',
                              fontSize: 14,
                              cursor: 'pointer',
                              padding: '0 4px',
                              flexShrink: 0,
                            }}
                          >
                            &times;
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Filed info (for resolved filings) */}
        {!isPending && filing.notes && (
          <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--bd)' }}>
            <div
              className="mono"
              style={{
                fontSize: 9,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: 'var(--t4)',
                marginBottom: 6,
              }}
            >
              Resolution Notes
            </div>
            <div
              style={{
                padding: '8px 12px',
                background: 'rgba(52,211,153,0.04)',
                borderLeft: '2px solid var(--grn)',
                borderRadius: '0 4px 4px 0',
                fontSize: 13,
                color: 'var(--t3)',
                fontStyle: 'italic',
              }}
            >
              {filing.notes}
            </div>
            {filing.attachedEmails.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 9,
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    color: 'var(--t4)',
                    marginBottom: 4,
                  }}
                >
                  Attached Emails ({filing.attachedEmails.length})
                </div>
                {filing.attachedEmails.map((email) => (
                  <div
                    key={email.messageId}
                    style={{
                      padding: '6px 10px',
                      background: 'rgba(52,211,153,0.04)',
                      borderLeft: '2px solid var(--grn)',
                      borderRadius: '0 4px 4px 0',
                      marginBottom: 4,
                    }}
                  >
                    <div style={{ fontSize: 12, color: 'var(--t2)' }}>{email.subject}</div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--t5)' }}>
                      {email.from} &middot; {email.date}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Audit Trail */}
        <div style={{ padding: '16px 24px', borderBottom: isPending ? '1px solid var(--bd)' : 'none' }}>
          <div
            className="mono"
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'var(--t4)',
              marginBottom: 10,
            }}
          >
            Audit Trail
          </div>
          {filing.auditLog.map((entry) => (
            <div
              key={entry.id}
              style={{
                padding: '6px 0',
                borderBottom: '1px solid var(--bdS)',
                fontSize: 12,
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', width: 130, flexShrink: 0 }}>
                  {formatTimestamp(entry.timestamp)}
                </div>
                <div style={{ flex: 1 }}>
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        entry.action === 'Filing Resolved'
                          ? 'var(--grn)'
                          : entry.action === 'Filing Created'
                            ? '#c084fc'
                            : 'var(--t3)',
                    }}
                  >
                    {entry.action}
                  </span>
                  <span style={{ color: 'var(--t4)', marginLeft: 8 }}>{entry.detail}</span>
                </div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', flexShrink: 0 }}>
                  {entry.user}
                </div>
              </div>
              {entry.notes && (
                <div
                  style={{
                    marginTop: 3,
                    marginLeft: 140,
                    padding: '3px 8px',
                    background: 'rgba(52,211,153,0.04)',
                    borderLeft: '2px solid var(--grn)',
                    borderRadius: '0 3px 3px 0',
                    fontSize: 11,
                    color: 'var(--t4)',
                    fontStyle: 'italic',
                  }}
                >
                  {entry.notes}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Submit Button (only for pending) */}
        {isPending && (
          <div style={{ padding: '16px 24px' }}>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              style={{
                width: '100%',
                padding: '10px 0',
                borderRadius: 6,
                fontFamily: "'Space Mono', monospace",
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                cursor: canSubmit ? 'pointer' : 'default',
                background: canSubmit ? 'rgba(192,132,252,0.15)' : 'rgba(192,132,252,0.05)',
                color: canSubmit ? '#c084fc' : 'var(--t5)',
                border: `1px solid ${canSubmit ? 'rgba(192,132,252,0.3)' : 'var(--bd)'}`,
                transition: 'all 0.15s',
              }}
            >
              Mark as Filed
            </button>
          </div>
        )}
      </div>
    </>
  );
}
