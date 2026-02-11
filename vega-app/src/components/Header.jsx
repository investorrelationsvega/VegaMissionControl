import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import useUiStore from '../stores/uiStore';
import useGoogleStore from '../stores/googleStore';
import useRingCentralStore from '../stores/ringcentralStore';
import useBlueskyStore from '../stores/blueskyStore';
import { requestAccessTokenWithConsent, revokeToken } from '../services/googleAuth';
import { startAuthFlow } from '../services/ringcentralAuth';
import BlueskyFilingModal from './BlueskyFilingModal';

const NOTIF_TYPE_COLORS = {
  assignment: 'var(--blu)',
  urgent: 'var(--red)',
  tag: 'var(--ylw)',
  bluesky: '#c084fc',
};

const NOTIF_TYPE_LABELS = {
  assignment: 'Assignment',
  urgent: 'Urgent',
  tag: 'Mention',
  bluesky: 'Bluesky Filing',
};

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Connection Status Indicators ─────────────────────────────────────────────
function ConnectionIndicators() {
  const googleAuth = useGoogleStore((s) => s.isAuthenticated);
  const googleToken = useGoogleStore((s) => s.accessToken);
  const googleClear = useGoogleStore((s) => s.clearAuth);
  const rcAuth = useRingCentralStore((s) => s.isAuthenticated);
  const rcClear = useRingCentralStore((s) => s.clearAuth);

  const handleGoogleClick = async () => {
    if (googleAuth) {
      if (googleToken) revokeToken(googleToken);
      googleClear();
    } else {
      try {
        const token = await requestAccessTokenWithConsent();
        useGoogleStore.getState().setToken(token);
      } catch (err) {
        console.error('Google auth failed:', err);
      }
    }
  };

  const handleRCClick = () => {
    if (rcAuth) {
      rcClear();
    } else {
      startAuthFlow(window.location.pathname);
    }
  };

  const indicatorStyle = (connected) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '4px 10px',
    borderRadius: 4,
    border: '1px solid',
    borderColor: connected ? 'rgba(52,211,153,0.25)' : 'var(--bd)',
    background: connected ? 'rgba(52,211,153,0.06)' : 'transparent',
    cursor: 'pointer',
    transition: 'all 0.15s',
  });

  const dotStyle = (connected) => ({
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: connected ? 'var(--grn)' : 'var(--t5)',
    flexShrink: 0,
  });

  const labelStyle = {
    fontFamily: "'Space Mono', monospace",
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
    color: 'var(--t4)',
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {/* Google Drive */}
      <button
        onClick={handleGoogleClick}
        style={{ ...indicatorStyle(googleAuth), background: 'none', }}
        title={googleAuth ? 'Google Drive connected — click to disconnect' : 'Connect Google Drive'}
      >
        <span style={dotStyle(googleAuth)} />
        <span style={labelStyle}>
          {/* Google Drive icon */}
          <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: googleAuth ? 'var(--grn)' : 'var(--t5)', verticalAlign: 'middle', marginRight: 3 }}>
            <path d="M7.71 3.5L1.15 15l2.79 4.84L10.5 8.34l-2.79-4.84zm1.42 0l6.56 11.5H2.56l2.79 4.84h13.09l-2.79-4.84L9.13 3.5z" />
          </svg>
          Drive
        </span>
      </button>

      {/* RingCentral */}
      <button
        onClick={handleRCClick}
        style={{ ...indicatorStyle(rcAuth), background: 'none', }}
        title={rcAuth ? 'RingCentral connected — click to disconnect' : 'Connect RingCentral'}
      >
        <span style={dotStyle(rcAuth)} />
        <span style={labelStyle}>
          {/* Phone icon */}
          <svg viewBox="0 0 24 24" style={{ width: 11, height: 11, fill: rcAuth ? 'var(--grn)' : 'var(--t5)', verticalAlign: 'middle', marginRight: 3 }}>
            <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
          </svg>
          RC
        </span>
      </button>
    </div>
  );
}

const UNIT_LABELS = {
  pe: 'Private Equity',
  alm: 'Assisted Living',
  builders: 'Builders',
  'capital-markets': 'Capital Markets',
  development: 'Development',
  hospice: 'Hospice',
  pmre: 'Property Management',
  valuations: 'Valuations',
};

export default function Header({ currentPage }) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [showDropdown, setShowDropdown] = useState(false);
  const [blueskyModalFilingId, setBlueskyModalFilingId] = useState(null);
  const dropdownRef = useRef(null);

  // Derive back link: sub-pages go to their unit root, unit roots go to Mission Control
  const segments = pathname.split('/').filter(Boolean); // e.g. ['pe','distributions']
  const unitSlug = segments[0]; // e.g. 'pe'
  const isSubPage = segments.length > 1;
  const backTo = isSubPage ? `/${unitSlug}` : '/';
  const backLabel = isSubPage ? (UNIT_LABELS[unitSlug] || 'Back') : 'Mission Control';

  const notifications = useUiStore((s) => s.notifications);
  const markNotificationRead = useUiStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useUiStore((s) => s.markAllNotificationsRead);
  const dismissNotification = useUiStore((s) => s.dismissNotification);
  const unreadCount = useUiStore((s) => s.getUnreadCount());
  const filings = useBlueskyStore((s) => s.filings);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    if (showDropdown) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showDropdown]);

  const handleNotifClick = (notif) => {
    markNotificationRead(notif.id);
    if (notif.link) navigate(notif.link);
    setShowDropdown(false);
  };

  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-left">
          <Link to={backTo} className="header-back">
            &larr; {backLabel}
          </Link>
          <div className="header-logo">
            <svg viewBox="0 0 1602.14 586.87" style={{ height: 27, fill: 'var(--t1)' }}>
              <polygon points="474.94 371.81 694.38 371.81 694.38 320.83 474.94 320.83 474.94 184.06 727.34 184.06 727.34 133.09 416.51 133.09 416.51 575.71 733.55 575.71 733.55 524.74 474.94 524.74 474.94 371.81" />
              <path d="M1441.79,133.12h-62.16l-169.15,442.55h62.82l51.03-135.47,18-51.03,67.08-183.39h1.3l63.46,183.39,18,51.03,47.27,135.47h62.69l-160.34-442.55Z" />
              <path d="M0,133.09h64.04l115.63,361.8h1.24l123.09-361.8h61.54l-157.28,442.62h-60.3L0,133.09Z" />
              <path d="M182.77,0c-8.8,61.66-27.56,110.27-51.34,133.09,23.79,22.82,42.54,71.43,51.34,133.09,8.8-61.66,27.56-110.27,51.34-133.09-23.79-22.82-42.54-71.43-51.34-133.09Z" />
              <path d="M965.68,381.82h137.75v129.49c-10.38,6.49-21.85,11.63-34.51,15.59-19.29,6.09-40.54,9.07-63.72,9.07-27.33,0-51.03-5.05-71.23-15.28-20.07-10.1-36.65-23.7-49.73-40.67-12.95-16.97-22.66-36.78-28.88-59.06-6.22-22.41-9.33-45.85-9.33-70.33s3.63-46.11,10.88-67.74c7.25-21.5,17.74-40.41,31.47-56.6,13.6-16.19,30.3-29.01,49.99-38.85,19.69-9.71,41.96-14.63,66.82-14.63,21.12,0,39.89,2.46,56.21,7.25,16.45,4.79,30.56,11.27,42.61,19.56,8.28,5.7,16.7,12.56,23.96,20.08l33.41-43.52c-9.45-8.81-21.11-16.84-29.14-21.76-18-11.01-37.68-18.52-59.31-24.09-21.5-5.7-44.17-8.42-67.74-8.42-35.62,0-67.22,6.73-94.8,20.2-27.58,13.47-50.9,31.21-69.94,53.1-19.04,22.02-33.42,46.88-43.13,74.6-9.84,27.84-14.63,55.95-14.63,84.57,0,34.45,5.05,65.92,15.15,94.54,10.23,28.49,24.87,53.1,44.17,73.56,19.29,20.59,42.74,36.39,70.2,47.66,27.58,11.14,58.54,16.71,92.99,16.71,31.09,0,65.15-2.59,92.73-12.95,2.48-.88,5.08-1.96,7.76-3.17h0c.16-.07.32-.14.48-.22.19-.09.38-.17.58-.26,16.42-7.43,35.61-19.49,51.54-35.86v-207.45h-192.61v54.86Z" />
            </svg>
          </div>
        </div>
        <div className="header-right">
          <div className="live-dot">
            <span>Live</span>
          </div>

          {/* Connection Status Indicators */}
          <ConnectionIndicators />

          {/* Notification Bell (Vega Star) */}
          <div ref={dropdownRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Notifications"
            >
              {/* Vega Star Icon */}
              <svg viewBox="0 0 200 266" style={{ width: 18, height: 24, fill: unreadCount > 0 ? 'var(--ylw)' : 'var(--grn)', transition: 'fill 0.2s' }}>
                <path d="M100,0c-8.8,61.66-27.56,110.27-51.34,133.09,23.79,22.82,42.54,71.43,51.34,133.09,8.8-61.66,27.56-110.27,51.34-133.09C127.55,110.27,108.8,61.66,100,0Z" />
              </svg>
              {/* Unread badge */}
              {unreadCount > 0 && (
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: -2,
                    width: 16,
                    height: 16,
                    borderRadius: '50%',
                    background: 'var(--red)',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: "'Space Mono', monospace",
                  }}
                >
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <>
              {/* Backdrop overlay */}
              <div
                onClick={() => setShowDropdown(false)}
                style={{
                  position: 'fixed',
                  inset: 0,
                  background: 'rgba(0,0,0,0.3)',
                  zIndex: 299,
                }}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: 8,
                  width: 360,
                  maxHeight: 440,
                  overflowY: 'auto',
                  background: '#0f172a',
                  border: '1px solid var(--bdH)',
                  borderRadius: 8,
                  boxShadow: '0 12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(51,65,85,0.3)',
                  zIndex: 300,
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '14px 16px',
                    borderBottom: '1px solid var(--bd)',
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Space Mono', monospace",
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: 'var(--t4)',
                    }}
                  >
                    Notifications {unreadCount > 0 && `(${unreadCount})`}
                  </span>
                  {unreadCount > 0 && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAllNotificationsRead();
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontFamily: "'Space Mono', monospace",
                        fontSize: 10,
                        color: 'var(--grn)',
                        cursor: 'pointer',
                        padding: 0,
                      }}
                    >
                      Mark all read
                    </button>
                  )}
                </div>

                {/* Notification list */}
                {notifications.length === 0 ? (
                  <div
                    style={{
                      padding: '32px 16px',
                      textAlign: 'center',
                      color: 'var(--t5)',
                      fontSize: 13,
                    }}
                  >
                    No notifications
                  </div>
                ) : (
                  notifications.map((notif) => {
                    // For bluesky notifications, compute deadline info
                    let deadlineInfo = null;
                    if (notif.type === 'bluesky' && notif.filingId) {
                      const filing = filings.find((f) => f.id === notif.filingId);
                      if (filing && filing.status === 'Pending') {
                        const daysLeft = Math.ceil(
                          (new Date(filing.deadlineDate) - new Date()) / (1000 * 60 * 60 * 24),
                        );
                        const color =
                          daysLeft < 0 ? 'var(--red)' : daysLeft <= 7 ? 'var(--ylw)' : 'var(--t4)';
                        deadlineInfo = {
                          text:
                            daysLeft < 0
                              ? `${Math.abs(daysLeft)}d overdue`
                              : `${daysLeft}d remaining`,
                          color,
                        };
                      }
                    }

                    return (
                    <div
                      key={notif.id}
                      onClick={() => {
                        if (notif.type !== 'bluesky') handleNotifClick(notif);
                      }}
                      style={{
                        display: 'flex',
                        gap: 12,
                        padding: '12px 16px',
                        borderBottom: '1px solid rgba(30,41,59,0.3)',
                        cursor: notif.type === 'bluesky' ? 'default' : 'pointer',
                        background: notif.read ? 'transparent' : 'rgba(52,211,153,0.02)',
                        transition: 'background 0.1s',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bgH)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(52,211,153,0.02)')}
                    >
                      {/* Unread dot */}
                      <div style={{ flexShrink: 0, paddingTop: 5 }}>
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: notif.read ? 'transparent' : NOTIF_TYPE_COLORS[notif.type] || 'var(--grn)',
                          }}
                        />
                      </div>
                      {/* Content */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                          <span
                            style={{
                              fontFamily: "'Space Mono', monospace",
                              fontSize: 9,
                              fontWeight: 700,
                              textTransform: 'uppercase',
                              color: NOTIF_TYPE_COLORS[notif.type] || 'var(--t4)',
                              padding: '1px 5px',
                              borderRadius: 3,
                              background: `color-mix(in srgb, ${NOTIF_TYPE_COLORS[notif.type] || 'var(--t4)'} 15%, transparent)`,
                            }}
                          >
                            {NOTIF_TYPE_LABELS[notif.type] || notif.type}
                          </span>
                          <span
                            style={{
                              fontFamily: "'Space Mono', monospace",
                              fontSize: 9,
                              color: 'var(--t5)',
                            }}
                          >
                            {timeAgo(notif.timestamp)}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: notif.read ? 'var(--t4)' : 'var(--t1)', fontWeight: notif.read ? 400 : 500, marginBottom: 2 }}>
                          {notif.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--t4)', lineHeight: 1.4 }}>
                          {notif.detail}
                        </div>
                        {/* Deadline countdown for bluesky */}
                        {deadlineInfo && (
                          <div
                            className="mono"
                            style={{
                              fontSize: 10,
                              color: deadlineInfo.color,
                              marginTop: 4,
                            }}
                          >
                            {deadlineInfo.text}
                          </div>
                        )}
                        {/* Review button for bluesky */}
                        {notif.type === 'bluesky' && notif.filingId && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markNotificationRead(notif.id);
                              setBlueskyModalFilingId(notif.filingId);
                              setShowDropdown(false);
                            }}
                            className="mono"
                            style={{
                              marginTop: 6,
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '4px 12px',
                              border: '1px solid rgba(192,132,252,0.3)',
                              borderRadius: 3,
                              background: 'rgba(192,132,252,0.1)',
                              color: '#c084fc',
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                            }}
                          >
                            Review
                          </button>
                        )}
                      </div>
                      {/* Dismiss */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          dismissNotification(notif.id);
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--t5)',
                          fontSize: 14,
                          cursor: 'pointer',
                          padding: '0 2px',
                          flexShrink: 0,
                          opacity: 0.5,
                          transition: 'opacity 0.15s',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}
                      >
                        &times;
                      </button>
                    </div>
                    );
                  })
                )}
              </div>
              </>
            )}
          </div>

          <span className="header-email">j@vegarei.com</span>
          <button className="header-signout">Sign Out</button>
        </div>
      </div>

      {/* Bluesky Filing Modal */}
      {blueskyModalFilingId && (
        <BlueskyFilingModal
          filingId={blueskyModalFilingId}
          onClose={() => setBlueskyModalFilingId(null)}
        />
      )}
    </header>
  );
}
