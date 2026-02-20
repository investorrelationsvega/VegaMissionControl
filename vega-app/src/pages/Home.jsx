// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Home / Landing Page
// Company-level view showing all business units
// ═══════════════════════════════════════════════

import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useUiStore from '../stores/uiStore';
import useBlueskyStore from '../stores/blueskyStore';
import useGoogleStore from '../stores/googleStore';
import useRingCentralStore from '../stores/ringcentralStore';
import { revokeToken } from '../services/googleAuth';
import useResponsive from '../hooks/useResponsive';

const CURRENT_USER = 'jjones@vegarei.com';

const BUSINESS_UNITS = [
  { num: '01', name: 'Assisted Living Management', subtitle: 'Management & Operations', route: '/alm' },
  { num: '02', name: 'Builders', subtitle: 'Construction', route: '/builders' },
  { num: '03', name: 'Capital Markets', subtitle: 'Debt & Equity Financing', route: '/capital-markets' },
  { num: '04', name: 'Development', subtitle: 'Land Development', route: '/development' },
  { num: '05', name: 'Hospice', subtitle: 'End-of-Life Care', route: '/hospice' },
  { num: '06', name: 'Private Equity', subtitle: 'Sales & Fund Administration', route: '/pe' },
  { num: '07', name: 'Property Management & Real Estate', subtitle: 'Operations & Holdings', route: '/pmre' },
  { num: '08', name: 'Valuations', subtitle: 'Appraisal & Advisory', route: '/valuations' },
];

// ── Notification type styling ─────────────────────────────────────────────────
const NOTIF_TYPE_COLORS = {
  assignment: 'var(--blu)',
  urgent: 'var(--red)',
  tag: 'var(--ylw)',
  bluesky: '#c084fc',
  email: 'var(--ylw)',
};

const NOTIF_TYPE_LABELS = {
  assignment: 'Assignment',
  urgent: 'Urgent',
  tag: 'Mention',
  bluesky: 'Bluesky Filing',
  email: 'Email Follow-up',
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

export default function Home() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const googleAuth = useGoogleStore((s) => s.isAuthenticated);
  const googleToken = useGoogleStore((s) => s.accessToken);
  const googleClear = useGoogleStore((s) => s.clearAuth);
  const rcClear = useRingCentralStore((s) => s.clearAuth);

  const handleSignOut = () => {
    // Revoke Google token before clearing
    if (googleAuth && googleToken) {
      try { revokeToken(googleToken); } catch (e) { /* GIS may not be loaded */ }
    }
    // Nuke all localStorage then force full page reload
    // (href='/' is a no-op when already at '/', so we must use reload())
    localStorage.clear();
    window.location.reload();
  };

  const allNotifications = useUiStore((s) => s.notifications);
  const markNotificationRead = useUiStore((s) => s.markNotificationRead);
  const markAllNotificationsRead = useUiStore((s) => s.markAllNotificationsRead);
  const dismissNotification = useUiStore((s) => s.dismissNotification);

  // Home page: show only notifications assigned to current user
  const notifications = allNotifications.filter((n) => n.assignee === CURRENT_USER);
  const unreadCount = notifications.filter((n) => !n.read).length;

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
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: isMobile ? '0 16px' : '0 32px',
          height: 56,
          borderBottom: '1px solid var(--blu)',
          background: 'var(--bg0)',
          position: 'sticky',
          top: 0,
          zIndex: 100,
        }}
      >
        {/* Logo */}
        <svg viewBox="0 0 1602.14 586.87" style={{ height: 24, fill: 'var(--t1)' }}>
          <polygon points="474.94 371.81 694.38 371.81 694.38 320.83 474.94 320.83 474.94 184.06 727.34 184.06 727.34 133.09 416.51 133.09 416.51 575.71 733.55 575.71 733.55 524.74 474.94 524.74 474.94 371.81" />
          <path d="M1441.79,133.12h-62.16l-169.15,442.55h62.82l51.03-135.47,18-51.03,67.08-183.39h1.3l63.46,183.39,18,51.03,47.27,135.47h62.69l-160.34-442.55Z" />
          <path d="M0,133.09h64.04l115.63,361.8h1.24l123.09-361.8h61.54l-157.28,442.62h-60.3L0,133.09Z" />
          <path d="M182.77,0c-8.8,61.66-27.56,110.27-51.34,133.09,23.79,22.82,42.54,71.43,51.34,133.09,8.8-61.66,27.56-110.27,51.34-133.09-23.79-22.82-42.54-71.43-51.34-133.09Z" />
          <path d="M965.68,381.82h137.75v129.49c-10.38,6.49-21.85,11.63-34.51,15.59-19.29,6.09-40.54,9.07-63.72,9.07-27.33,0-51.03-5.05-71.23-15.28-20.07-10.1-36.65-23.7-49.73-40.67-12.95-16.97-22.66-36.78-28.88-59.06-6.22-22.41-9.33-45.85-9.33-70.33s3.63-46.11,10.88-67.74c7.25-21.5,17.74-40.41,31.47-56.6,13.6-16.19,30.3-29.01,49.99-38.85,19.69-9.71,41.96-14.63,66.82-14.63,21.12,0,39.89,2.46,56.21,7.25,16.45,4.79,30.56,11.27,42.61,19.56,8.28,5.7,16.7,12.56,23.96,20.08l33.41-43.52c-9.45-8.81-21.11-16.84-29.14-21.76-18-11.01-37.68-18.52-59.31-24.09-21.5-5.7-44.17-8.42-67.74-8.42-35.62,0-67.22,6.73-94.8,20.2-27.58,13.47-50.9,31.21-69.94,53.1-19.04,22.02-33.42,46.88-43.13,74.6-9.84,27.84-14.63,55.95-14.63,84.57,0,34.45,5.05,65.92,15.15,94.54,10.23,28.49,24.87,53.1,44.17,73.56,19.29,20.59,42.74,36.39,70.2,47.66,27.58,11.14,58.54,16.71,92.99,16.71,31.09,0,65.15-2.59,92.73-12.95,2.48-.88,5.08-1.96,7.76-3.17h0c.16-.07.32-.14.48-.22.19-.09.38-.17.58-.26,16.42-7.43,35.61-19.49,51.54-35.86v-207.45h-192.61v54.86Z" />
        </svg>

        {/* Right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {/* Online dot */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--grn)', display: 'inline-block' }} />
            <span className="mono" style={{ fontSize: 10, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Online</span>
          </div>

          {/* Notification Bell */}
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
              <svg viewBox="0 0 200 266" style={{ width: 18, height: 24, fill: unreadCount > 0 ? 'var(--ylw)' : 'var(--grn)', transition: 'fill 0.2s' }}>
                <path d="M100,0c-8.8,61.66-27.56,110.27-51.34,133.09,23.79,22.82,42.54,71.43,51.34,133.09,8.8-61.66,27.56-110.27,51.34-133.09C127.55,110.27,108.8,61.66,100,0Z" />
              </svg>
              {unreadCount > 0 && (
                <span style={{
                  position: 'absolute', top: 0, right: -2, width: 16, height: 16, borderRadius: '50%',
                  background: 'var(--red)', color: '#fff', fontSize: 9, fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: "'Space Mono', monospace",
                }}>
                  {unreadCount}
                </span>
              )}
            </button>

            {/* Dropdown */}
            {showDropdown && (
              <>
                <div onClick={() => setShowDropdown(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 299 }} />
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 8, width: 360, maxHeight: 440,
                  overflowY: 'auto', background: 'var(--bg1)', border: '1px solid var(--bdH)', borderRadius: 8,
                  boxShadow: '0 12px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(74,122,130,0.3)', zIndex: 300,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--bd)' }}>
                    <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)' }}>
                      Notifications {unreadCount > 0 && `(${unreadCount})`}
                    </span>
                    {unreadCount > 0 && (
                      <button onClick={(e) => { e.stopPropagation(); markAllNotificationsRead(); }}
                        style={{ background: 'none', border: 'none', fontFamily: "'Space Mono', monospace", fontSize: 10, color: 'var(--grn)', cursor: 'pointer', padding: 0 }}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  {notifications.length === 0 ? (
                    <div className="mono" style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--t5)', fontSize: 11 }}>No notifications</div>
                  ) : (
                    notifications.map((notif) => (
                      <div key={notif.id} onClick={() => handleNotifClick(notif)}
                        style={{ display: 'flex', gap: 12, padding: '12px 16px', borderBottom: '1px solid rgba(52,92,99,0.3)', cursor: 'pointer', background: notif.read ? 'transparent' : 'rgba(52,211,153,0.02)', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bgH)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(52,211,153,0.02)')}>
                        <div style={{ flexShrink: 0, paddingTop: 5 }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: notif.read ? 'transparent' : NOTIF_TYPE_COLORS[notif.type] || 'var(--grn)' }} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                            <span className="mono" style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: NOTIF_TYPE_COLORS[notif.type] || 'var(--t4)', padding: '1px 5px', borderRadius: 3, background: `color-mix(in srgb, ${NOTIF_TYPE_COLORS[notif.type] || 'var(--t4)'} 15%, transparent)` }}>
                              {NOTIF_TYPE_LABELS[notif.type] || notif.type}
                            </span>
                            <span className="mono" style={{ fontSize: 9, color: 'var(--t5)' }}>{timeAgo(notif.timestamp)}</span>
                          </div>
                          <div className="mono" style={{ fontSize: 11, color: notif.read ? 'var(--t4)' : 'var(--t1)', fontWeight: notif.read ? 400 : 700, marginBottom: 2 }}>{notif.title}</div>
                          <div className="mono" style={{ fontSize: 10, color: 'var(--t4)', lineHeight: 1.5 }}>{notif.detail}</div>
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); dismissNotification(notif.id); }}
                          style={{ background: 'none', border: 'none', color: 'var(--t5)', fontSize: 14, cursor: 'pointer', padding: '0 2px', flexShrink: 0, opacity: 0.5, transition: 'opacity 0.15s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.5')}>
                          &times;
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>

          <span className="mono" style={{ fontSize: 11, color: 'var(--t3)' }}>{CURRENT_USER}</span>
          <button onClick={handleSignOut} style={{ background: 'none', border: '1px solid var(--bd)', borderRadius: 4, padding: '4px 12px', fontFamily: "'Space Mono', monospace", fontSize: 10, color: 'var(--t4)', cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Hero Section ────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', padding: isMobile ? '32px 16px 24px' : '60px 32px 48px' }}>
          {/* Vega V + Star Icon (large) */}
          <svg viewBox="0 0 366 576" style={{ width: 56, height: 88, fill: 'var(--t5)', marginBottom: 24, opacity: 0.4 }}>
            <path d="M182.77,0c-8.8,61.66-27.56,110.27-51.34,133.09,23.79,22.82,42.54,71.43,51.34,133.09,8.8-61.66,27.56-110.27,51.34-133.09-23.79-22.82-42.54-71.43-51.34-133.09Z" />
            <path d="M0,133.09h64.04l115.63,361.8h1.24l123.09-361.8h61.54l-157.28,442.62h-60.3L0,133.09Z" />
          </svg>
          <div className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.25em', color: 'var(--grn)', marginBottom: 12 }}>
            Vega Companies
          </div>
          <h1 className="mono" style={{ fontSize: isMobile ? 24 : 36, fontWeight: 400, color: 'var(--t1)', margin: '0 0 14px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            Mission Control
          </h1>
          <p className="mono" style={{ fontSize: 11, color: 'var(--grn)', margin: 0, letterSpacing: '0.12em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <span>Performance</span>
            <svg viewBox="0 0 200 266" style={{ width: 7, height: 9, fill: 'var(--grn)', opacity: 0.6 }}><path d="M100,0c-8.8,61.66-27.56,110.27-51.34,133.09,23.79,22.82,42.54,71.43,51.34,133.09,8.8-61.66,27.56-110.27,51.34-133.09C127.55,110.27,108.8,61.66,100,0Z" /></svg>
            <span>Partnership</span>
            <svg viewBox="0 0 200 266" style={{ width: 7, height: 9, fill: 'var(--grn)', opacity: 0.6 }}><path d="M100,0c-8.8,61.66-27.56,110.27-51.34,133.09,23.79,22.82,42.54,71.43,51.34,133.09,8.8-61.66,27.56-110.27,51.34-133.09C127.55,110.27,108.8,61.66,100,0Z" /></svg>
            <span>Prosperity</span>
          </p>
        </div>

        {/* ── Business Units Section ──────────────────────────────────────── */}
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: isMobile ? '0 16px' : '0 32px', width: '100%', boxSizing: 'border-box' }}>
          {/* Section divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 32 }}>
            <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
            <span className="mono" style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em', color: 'var(--t4)', flexShrink: 0 }}>
              Business Units
            </span>
            <div style={{ flex: 1, height: 1, background: 'var(--bd)' }} />
          </div>

          {/* Cards grid */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 16, marginBottom: 48 }}>
            {BUSINESS_UNITS.map((unit) => (
              <div
                key={unit.num}
                onClick={() => navigate(unit.route)}
                style={{
                  background: 'var(--bg-card-half)',
                  border: '1px solid var(--bd)',
                  borderRadius: 6,
                  padding: '20px 20px 18px',
                  cursor: 'pointer',
                  transition: 'border-color 0.2s, background 0.2s',
                  display: 'flex',
                  flexDirection: 'column',
                  minHeight: 130,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--grnB)';
                  e.currentTarget.style.background = 'var(--bgH)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--bd)';
                  e.currentTarget.style.background = 'var(--bg-card-half)';
                }}
              >
                {/* Number with dot */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--grn)', display: 'inline-block' }} />
                  <span className="mono" style={{ fontSize: 11, color: 'var(--t5)' }}>{unit.num}</span>
                </div>

                {/* Name */}
                <div className="mono" style={{ fontSize: 13, fontWeight: 700, color: 'var(--t1)', marginBottom: 6, lineHeight: 1.3 }}>
                  {unit.name}
                </div>

                {/* Subtitle */}
                <div className="mono" style={{ fontSize: 10, color: 'var(--t4)', marginBottom: 'auto', lineHeight: 1.5, letterSpacing: '0.02em' }}>
                  {unit.subtitle}
                </div>

                {/* Enter link */}
                <div className="mono" style={{ fontSize: 11, color: 'var(--grn)', marginTop: 14 }}>
                  Enter &rarr;
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div style={{ marginTop: 'auto', padding: isMobile ? '16px' : '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
          <span className="mono" style={{ fontSize: 10, color: 'var(--t5)' }}>
            Vega &copy; 2025
          </span>
          <span className="mono" style={{ fontSize: 10, color: 'var(--t5)' }}>
            System Status: Operational
          </span>
        </div>
      </div>
    </div>
  );
}
