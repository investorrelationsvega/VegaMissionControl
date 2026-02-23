// ===================================================
// VEGA MISSION CONTROL — Dashboard Page
// Private Equity Fund Management & Investor Relations
// ===================================================

import { useState, useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import useUiStore from '../stores/uiStore';
import useFundStore from '../stores/fundStore';
import useInvestorStore from '../stores/investorStore';
import useComplianceStore from '../stores/complianceStore';
import useGoogleStore from '../stores/googleStore';
import useTicStore from '../stores/ticStore';
import { fetchUpcomingEvents } from '../services/calendarService';
import { fmt, fmtK } from '../utils/format';
import DriveDocuments from '../components/DriveDocuments';
import UpcomingDetailModal from '../components/UpcomingDetailModal';
import useResponsive from '../hooks/useResponsive';

// ---------------------------------------------------------------------------
// Activity data keyed by fund shortName
// ---------------------------------------------------------------------------
const activityByFund = {
  'Fund I': [
    { text: 'Sayer Leslie funded', meta: '$300K \u2014 Jul 2025', green: true },
    { text: 'John Sirrine funded', meta: '$100K \u2014 Jul 2025', green: true },
    { text: 'Cameron Cope funded', meta: '$200K \u2014 Dec 2024', green: true },
    { text: 'Fund I closed', meta: 'Jul 31, 2025', green: false },
  ],
  'Fund II': [
    { text: 'Jeremiah Post committed', meta: '$100K \u2014 Jan 28', green: true },
    { text: 'Kelly Buchanan funded', meta: '$50K \u2014 Dec 31', green: true },
    { text: 'Elissa Oleole funded', meta: '$50K \u2014 Dec 31', green: true },
    { text: 'Jan distributions sent', meta: '28 payments \u2014 Jan 2026', green: false },
  ],
  'Fund III': [
    { text: 'Fund in planning', meta: 'Launch TBD', green: false },
  ],
};

// ---------------------------------------------------------------------------
// Overview stats keyed by fund shortName
// ---------------------------------------------------------------------------
// overviewByFund is now computed dynamically inside the component from store data

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function Dashboard() {
  const navigate = useNavigate();
  const { isMobile, isTablet } = useResponsive();

  // Stores
  const attentionItems = useUiStore((s) => s.attentionItems);
  const upcomingDates = useUiStore((s) => s.upcomingDates);
  const quickLinks = useUiStore((s) => s.quickLinks);
  const showToast = useUiStore((s) => s.showToast);
  const updateUpcoming = useUiStore((s) => s.updateUpcoming);

  const funds = useFundStore((s) => s.funds);
  const investorStore = useInvestorStore();
  const ticStore = useTicStore();

  const openCompliance = useComplianceStore((s) => s.getOpen);

  // Google / Calendar
  const isGoogleAuth = useGoogleStore((s) => s.isAuthenticated);
  const accessToken = useGoogleStore((s) => s.accessToken);
  const calendarSyncStatus = useUiStore((s) => s.calendarSyncStatus);
  const calendarLastSyncAt = useUiStore((s) => s.calendarLastSyncAt);
  const setCalendarEvents = useUiStore((s) => s.setCalendarEvents);
  const setCalendarSyncStatus = useUiStore((s) => s.setCalendarSyncStatus);
  const getMergedUpcoming = useUiStore((s) => s.getMergedUpcoming);

  // Local state
  const [attSlide, setAttSlide] = useState(0);
  const [selectedFundIdx, setSelectedFundIdx] = useState(1); // default Fund II
  const [showEditModal, setShowEditModal] = useState(false);
  const [editDates, setEditDates] = useState([]);
  const [hoveredNav, setHoveredNav] = useState(null);
  const [selectedUpcoming, setSelectedUpcoming] = useState(null);

  const trackRef = useRef(null);

  // Derived
  const selectedFund = funds[selectedFundIdx];
  const activity = activityByFund[selectedFund?.shortName] || [];

  // TIC outside capital
  const ticOutsideCapital = useMemo(() => {
    const props = ticStore.getProperties();
    return props.reduce((s, p) => s + p.totalTicFunds, 0);
  }, [ticStore.ticProperties]);

  // Dynamic overview from store data
  const overview = useMemo(() => {
    if (!selectedFund) return {};
    const fundInvestors = investorStore.getByFund(selectedFund.shortName);
    const investorCount = fundInvestors.length;
    const raised = selectedFund.committed || 0;
    const avg = investorCount > 0 ? Math.round(raised / investorCount) : 0;
    return {
      raised: fmt(raised),
      target: selectedFund.target > 0 ? fmt(selectedFund.target) : 'TBD',
      investors: String(investorCount),
      avg: avg > 0 ? fmtK(avg) : '--',
    };
  }, [selectedFund, investorStore.investors]);

  // Carousel calculations
  const visibleCards = 3;
  const totalCards = attentionItems.length;
  const maxSlide = Math.max(0, totalCards - visibleCards);
  const counterStart = attSlide + 1;
  const counterEnd = Math.min(attSlide + visibleCards, totalCards);

  // Carousel card width calculation
  const [cardWidth, setCardWidth] = useState(0);
  useEffect(() => {
    if (trackRef.current && trackRef.current.children.length > 0) {
      const firstCard = trackRef.current.children[0];
      setCardWidth(firstCard.offsetWidth + 16); // card width + gap
    }
  }, [attentionItems]);

  // ── Calendar sync ───────────────────────────────────────────────────────
  const syncCalendar = async () => {
    if (!accessToken) return;
    setCalendarSyncStatus('syncing');
    try {
      const events = await fetchUpcomingEvents(accessToken);
      setCalendarEvents(events);
      showToast('Calendar synced');
    } catch (err) {
      console.error('Calendar sync failed:', err);
      setCalendarSyncStatus('error');
      showToast('Calendar sync failed');
    }
  };

  // Auto-sync on mount when authenticated (5-min cache)
  useEffect(() => {
    if (!isGoogleAuth || !accessToken) return;
    const cacheAge = calendarLastSyncAt ? Date.now() - calendarLastSyncAt : Infinity;
    if (cacheAge > 5 * 60 * 1000) {
      syncCalendar();
    }
  }, [isGoogleAuth, accessToken]); // eslint-disable-line react-hooks/exhaustive-deps

  // Merged display dates — calendar events when synced, seed data otherwise
  const allDisplayDates = getMergedUpcoming();
  const maxCards = 8;
  const displayDates = allDisplayDates.slice(0, maxCards);
  const overflowCount = Math.max(0, allDisplayDates.length - maxCards);

  // Fund amount display
  const getFundAmountText = (fund) => {
    if (fund.target === 0) return 'Target: TBD';
    return `${fmtK(fund.committed)} of ${fmtK(fund.target)} raised`;
  };

  const getFundProgress = (fund) => {
    if (fund.target === 0) return 0;
    return Math.min(100, (fund.committed / fund.target) * 100);
  };

  const getFundFooter = (fund) => {
    if (fund.status === 'Closed') return { left: `Closed ${fund.closeDate}`, right: `${fund.positionCount} positions` };
    if (fund.status === 'Open') return { left: `Aug 1, 2025 \u2014 Open`, right: `${fund.positionCount} positions` };
    return { left: 'Launch: TBD', right: 'Prospects only' };
  };

  const getBadgeClass = (status) => {
    if (status === 'Closed') return 'badge badge-closed';
    if (status === 'Open') return 'badge badge-open';
    return 'badge badge-pending';
  };

  // Edit modal handlers
  const openEditModal = () => {
    setEditDates(
      upcomingDates.map((d) => ({ ...d }))
    );
    setShowEditModal(true);
  };

  const closeEditModal = () => {
    setShowEditModal(false);
  };

  const handleEditChange = (index, field, value) => {
    setEditDates((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleSave = () => {
    updateUpcoming(editDates.filter((d) => d.title && d.title.trim()));
    setShowEditModal(false);
    showToast('Team dates updated');
  };

  // Quick nav card data
  const navCards = [
    {
      title: 'Directory',
      desc: '33 investors \u2014 1 pending, 20 in review',
      dotColor: 'var(--red)',
      route: '/pe/directory',
    },
    {
      title: 'Distributions',
      desc: 'Feb 2026 \u2014 all sent',
      dotColor: 'var(--grn)',
      route: '/pe/distributions',
    },
    {
      title: 'Compliance',
      desc: '22 open sub doc issues',
      dotColor: 'var(--red)',
      route: '/pe/compliance',
    },
    {
      title: 'Sales Operations',
      desc: 'Fund II capital raise pipeline',
      dotColor: 'var(--blu)',
      route: '/pe/sales',
    },
  ];

  return (
    <div className="main">

      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-dot"><span>Active Module</span></div>
        <h1 className="page-title">Private Equity</h1>
        <p className="page-subtitle">Sales &amp; Fund Administration</p>
      </div>

      {/* ── Attention Needed Carousel ────────────────────────────── */}
      <div
        style={{
          background: 'var(--bg-card-half)',
          border: '1px solid var(--ylwB)',
          borderRadius: 6,
          padding: 20,
          marginBottom: 24,
          overflow: 'hidden',
        }}
      >
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, background: 'var(--ylw)', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
            <span className="section-label">Attention Needed</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="mono" style={{ fontSize: 11, color: 'var(--t5)' }}>
              {counterStart}-{counterEnd} of {totalCards}
            </span>
            <button
              disabled={attSlide === 0}
              onClick={() => setAttSlide((p) => Math.max(0, p - 1))}
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                border: '1px solid var(--bd)',
                background: 'transparent',
                color: 'var(--t3)',
                cursor: attSlide === 0 ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                opacity: attSlide === 0 ? 0.3 : 1,
                transition: 'all 0.15s',
              }}
            >
              &#8592;
            </button>
            <button
              disabled={attSlide >= maxSlide}
              onClick={() => setAttSlide((p) => Math.min(maxSlide, p + 1))}
              style={{
                width: 28,
                height: 28,
                borderRadius: 4,
                border: '1px solid var(--bd)',
                background: 'transparent',
                color: 'var(--t3)',
                cursor: attSlide >= maxSlide ? 'default' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 14,
                opacity: attSlide >= maxSlide ? 0.3 : 1,
                transition: 'all 0.15s',
              }}
            >
              &#8594;
            </button>
          </div>
        </div>

        {/* Track */}
        <div style={{ overflow: 'hidden' }}>
          <div
            ref={trackRef}
            style={{
              display: 'flex',
              gap: 16,
              transition: 'transform 0.3s ease',
              transform: `translateX(-${attSlide * cardWidth}px)`,
            }}
          >
            {attentionItems.map((item) => (
              <div
                key={item.id}
                onClick={() => navigate(item.link)}
                style={{
                  background: 'var(--bgI)',
                  borderRadius: 6,
                  padding: 16,
                  borderLeft: '2px solid var(--ylw)',
                  cursor: 'pointer',
                  transition: 'background 0.15s',
                  minWidth: isMobile ? '100%' : isTablet ? 'calc(50% - 8px)' : 'calc(33.333% - 11px)',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bgH)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--bgI)')}
              >
                <div className="mono" style={{ fontSize: 11, color: 'var(--t4)', marginBottom: 4 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: 14, color: 'var(--t1)', marginBottom: 10, lineHeight: 1.4 }}>
                  {item.text}
                </div>
                <span className="mono" style={{ fontSize: 11, color: 'var(--t4)', transition: 'color 0.15s' }}>
                  {item.linkText} &rarr;
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Team Upcoming ────────────────────────────────────────── */}
      <div
        style={{
          background: 'var(--bg-card-half)',
          border: '1px solid var(--bd)',
          borderRadius: 6,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ width: 8, height: 8, background: 'var(--t5)', borderRadius: '50%', display: 'inline-block', flexShrink: 0 }} />
            <span className="section-label">Team Upcoming</span>
            {calendarSyncStatus === 'syncing' && (
              <span className="mono" style={{ fontSize: 10, color: 'var(--t5)' }}>Syncing...</span>
            )}
            {calendarSyncStatus === 'synced' && (
              <span className="mono" style={{ fontSize: 10, color: 'var(--grn)' }}>Synced</span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {isGoogleAuth && (
              <button
                onClick={syncCalendar}
                disabled={calendarSyncStatus === 'syncing'}
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--t5)',
                  background: 'none',
                  border: '1px solid var(--bd)',
                  padding: '4px 12px',
                  borderRadius: 4,
                  cursor: calendarSyncStatus === 'syncing' ? 'default' : 'pointer',
                  opacity: calendarSyncStatus === 'syncing' ? 0.5 : 1,
                  transition: 'all 0.15s',
                }}
              >
                Sync Calendar
              </button>
            )}
            <button
              onClick={openEditModal}
              className="mono"
              style={{
                fontSize: 11,
                color: 'var(--t5)',
                background: 'none',
                border: '1px solid var(--bd)',
                padding: '4px 12px',
                borderRadius: 4,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              Edit Dates
            </button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
          {displayDates.map((item) => (
            <div
              key={item.id}
              onClick={() => setSelectedUpcoming(item)}
              style={{
                background: 'var(--bgM3)',
                borderRadius: 6,
                padding: '12px 16px',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <div style={{ fontSize: 14, color: 'var(--t1)' }}>{item.title}</div>
                <span className={`badge ${item.badgeClass}`}>{item.badgeText}</span>
              </div>
              <div className="mono" style={{ fontSize: 11, color: 'var(--t4)', marginBottom: item.primary ? 6 : 0 }}>{item.date}</div>
              {(item.primary || item.secondary) && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 4 }}>
                  {item.primary && (
                    <span className="mono" style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'var(--bluM)',
                      color: 'var(--blu)',
                    }}>
                      {item.primary.split('@')[0]}
                    </span>
                  )}
                  {item.secondary && (
                    <span className="mono" style={{
                      fontSize: 9,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      padding: '2px 6px',
                      borderRadius: 3,
                      background: 'var(--bgM)',
                      color: 'var(--t4)',
                    }}>
                      {item.secondary.split('@')[0]}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
          {overflowCount > 0 && (
            <div
              style={{
                background: 'var(--bgM3)',
                borderRadius: 6,
                padding: '12px 16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span className="mono" style={{ fontSize: 13, color: 'var(--t4)' }}>
                +{overflowCount} more
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Quick Nav Cards ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {navCards.map((card, i) => (
          <div
            key={card.title}
            onClick={() => card.route && navigate(card.route)}
            onMouseEnter={() => setHoveredNav(i)}
            onMouseLeave={() => setHoveredNav(null)}
            style={{
              background: 'var(--bg-card-half)',
              border: `1px solid ${hoveredNav === i && card.route ? 'var(--grnB)' : 'var(--bd)'}`,
              borderRadius: 6,
              padding: 18,
              cursor: card.route ? 'pointer' : 'default',
              opacity: card.route ? 1 : 0.5,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              {card.dotColor ? (
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: card.dotColor, display: 'inline-block' }} />
              ) : (
                <span style={{ width: 8, height: 8 }} />
              )}
              <span
                className="mono"
                style={{
                  fontSize: 11,
                  color: hoveredNav === i ? 'var(--grn)' : 'var(--t5)',
                  transition: 'color 0.15s',
                }}
              >
                Enter &rarr;
              </span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)', marginBottom: 3 }}>{card.title}</div>
            <div style={{ fontSize: 12, color: 'var(--t4)' }}>{card.desc}</div>
          </div>
        ))}
      </div>

      {/* ── Content Grid (2fr + 1fr) ─────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 24 }}>

        {/* LEFT COLUMN */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Fund Selector */}
          <div>
            <div className="section-label" style={{ marginBottom: 16 }}>Select Fund</div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 16 }}>
              {funds.map((fund, idx) => {
                const isActive = idx === selectedFundIdx;
                const footer = getFundFooter(fund);
                return (
                  <div
                    key={fund.id}
                    onClick={() => setSelectedFundIdx(idx)}
                    style={{
                      background: isActive ? 'rgba(52,211,153,0.03)' : 'var(--bg-card-half)',
                      border: `1px solid ${isActive ? 'var(--grn)' : 'var(--bd)'}`,
                      borderRadius: 6,
                      padding: 20,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.borderColor = 'var(--grn)';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.borderColor = 'var(--bd)';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <span className={getBadgeClass(fund.status)}>{fund.status}</span>
                      <span className="mono" style={{ fontSize: 11, color: 'var(--t5)' }}>{fund.shortName}</span>
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 300, color: 'var(--t1)', marginBottom: 6, lineHeight: 1.3 }}>
                      {fund.name}
                    </div>
                    {fund.shortName === 'Fund II' && ticOutsideCapital > 0 ? (
                      <>
                        {/* LP Raised */}
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span className="mono" style={{ fontSize: 10, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>LP Raised</span>
                            <span className="mono" style={{ fontSize: 11, color: 'var(--grn)' }}>{fmtK(fund.committed)}</span>
                          </div>
                          {fund.target > 0 && (
                            <div style={{ width: '100%', height: 5, background: 'var(--bd)', borderRadius: 3, overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: 'var(--grn)', borderRadius: 3, width: `${getFundProgress(fund)}%`, transition: 'width 0.4s ease' }} />
                            </div>
                          )}
                        </div>
                        {/* TIC Capital */}
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                            <span className="mono" style={{ fontSize: 10, color: 'var(--t4)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>TIC Capital</span>
                            <span className="mono" style={{ fontSize: 11, color: 'var(--blu)' }}>{fmtK(ticOutsideCapital)}</span>
                          </div>
                          <div style={{ width: '100%', height: 5, background: 'var(--bd)', borderRadius: 3, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: 'var(--blu)', borderRadius: 3, width: fund.target > 0 ? `${Math.min(100, (ticOutsideCapital / fund.target) * 100)}%` : '0%', transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                        {/* Total */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                          <span className="mono" style={{ fontSize: 10, color: 'var(--t3)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Total</span>
                          <span className="mono" style={{ fontSize: 12, color: 'var(--t1)', fontWeight: 500 }}>{fmtK(fund.committed + ticOutsideCapital)}</span>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="mono" style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 12 }}>
                          {getFundAmountText(fund)}
                        </div>
                        {fund.target > 0 && (
                          <div style={{ width: '100%', height: 5, background: 'var(--bd)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: 'var(--grn)', borderRadius: 3, width: `${getFundProgress(fund)}%`, transition: 'width 0.4s ease' }} />
                          </div>
                        )}
                      </>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t4)' }}>
                      <span>{footer.left}</span>
                      <span>{footer.right}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Documents — Google Drive Integration */}
          <DriveDocuments fundId={selectedFund?.id} fundShortName={selectedFund?.shortName} />
        </div>

        {/* RIGHT COLUMN (Sidebar) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Fund Overview */}
          <div className="sidebar-box">
            <div className="sidebar-title">{selectedFund?.shortName} Overview</div>
            <div className="stat-row">
              <div className="stat-row-label">{selectedFund?.shortName === 'Fund II' && ticOutsideCapital > 0 ? 'LP Raised' : 'Total Raised'}</div>
              <div className="stat-row-value">{overview.raised}</div>
            </div>
            {selectedFund?.shortName === 'Fund II' && ticOutsideCapital > 0 && (
              <>
                <div className="stat-row">
                  <div className="stat-row-label" style={{ color: 'var(--blu)' }}>TIC Capital</div>
                  <div className="stat-row-value small" style={{ color: 'var(--blu)' }}>{fmt(ticOutsideCapital)}</div>
                </div>
                <div className="stat-row">
                  <div className="stat-row-label">Combined Total</div>
                  <div className="stat-row-value small">{fmt((selectedFund?.committed || 0) + ticOutsideCapital)}</div>
                </div>
              </>
            )}
            <div className="stat-row">
              <div className="stat-row-label">Target</div>
              <div className="stat-row-value small">{overview.target}</div>
            </div>
            <div className="stat-row">
              <div className="stat-row-label">Active Investors</div>
              <div className="stat-row-value small">{overview.investors}</div>
            </div>
            <div className="stat-row">
              <div className="stat-row-label">Avg Investment</div>
              <div className="stat-row-value small">{overview.avg}</div>
            </div>
          </div>

          {/* Recent Activity */}
          <div className="sidebar-box">
            <div className="sidebar-title">Recent Activity</div>
            {activity.map((item, idx) => (
              <div key={idx} className={`activity-item${item.green ? ' green' : ''}`}>
                <div className="activity-item-title">{item.text}</div>
                <div className="activity-item-meta">{item.meta}</div>
              </div>
            ))}
            <a className="view-all-link" onClick={() => navigate('/pe/directory')} style={{ cursor: 'pointer' }}>View All Activity &rarr;</a>
          </div>

          {/* Quick Links */}
          <div className="sidebar-box">
            <div className="sidebar-title">Quick Links</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {quickLinks.map((link, idx) => (
                <li key={idx} style={{ marginBottom: idx < quickLinks.length - 1 ? 10 : 0 }}>
                  <a
                    href={link.url}
                    style={{
                      fontSize: 13,
                      color: 'var(--t3)',
                      textDecoration: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      transition: 'color 0.15s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = 'var(--grn)';
                      const arrow = e.currentTarget.querySelector('.ql-arrow');
                      if (arrow) arrow.style.color = 'var(--grn)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = 'var(--t3)';
                      const arrow = e.currentTarget.querySelector('.ql-arrow');
                      if (arrow) arrow.style.color = 'var(--t5)';
                    }}
                  >
                    <span className="mono ql-arrow" style={{ fontSize: 11, color: 'var(--t5)', transition: 'color 0.15s' }}>&rarr;</span>
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <footer className="footer">
        <div className="footer-inner">
          <span className="footer-text">Vega Capital &copy; 2026</span>
          <span className="footer-text">Mission Control v1.0</span>
        </div>
      </footer>

      {/* ── Edit Upcoming Modal ──────────────────────────────────── */}
      {showEditModal && (
        <div
          className="modal-overlay active"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeEditModal();
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Edit Team Dates</div>
              <button className="modal-close" onClick={closeEditModal}>&times;</button>
            </div>
            <div className="modal-body">
              {editDates.map((item, idx) => (
                <div key={item.id || idx} style={{ marginBottom: 20, paddingBottom: 16, borderBottom: '1px solid var(--bd)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 10 }}>
                    <div>
                      <label className="form-label">Event</label>
                      <input
                        type="text"
                        className="form-input"
                        value={item.title}
                        onChange={(e) => handleEditChange(idx, 'title', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="form-label">Date</label>
                      <input
                        type="text"
                        className="form-input"
                        value={item.date}
                        onChange={(e) => handleEditChange(idx, 'date', e.target.value)}
                      />
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                    <div>
                      <label className="form-label">Primary Assignee</label>
                      <select
                        className="form-select"
                        value={item.primary || ''}
                        onChange={(e) => handleEditChange(idx, 'primary', e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        <option value="j@vegarei.com">j@vegarei.com</option>
                        <option value="cory@vegacapital.com">cory@vegacapital.com</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label">Secondary Assignee</label>
                      <select
                        className="form-select"
                        value={item.secondary || ''}
                        onChange={(e) => handleEditChange(idx, 'secondary', e.target.value)}
                      >
                        <option value="">Unassigned</option>
                        <option value="j@vegarei.com">j@vegarei.com</option>
                        <option value="cory@vegacapital.com">cory@vegacapital.com</option>
                      </select>
                    </div>
                  </div>
                </div>
              ))}
              {/* Empty row for adding new */}
              <div style={{ marginBottom: 0 }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12 }}>
                  <div>
                    <label className="form-label">Event</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="Add new event..."
                      onBlur={(e) => {
                        if (e.target.value.trim()) {
                          setEditDates((prev) => [
                            ...prev,
                            {
                              id: `U${String(prev.length + 1).padStart(2, '0')}`,
                              title: e.target.value.trim(),
                              date: '',
                              badgeText: 'Due',
                              badgeClass: 'badge-muted',
                              primary: '',
                              secondary: '',
                            },
                          ]);
                          e.target.value = '';
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="form-label">Date</label>
                    <input type="text" className="form-input" placeholder="" />
                  </div>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeEditModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Upcoming Detail Modal ──────────────────────────── */}
      {selectedUpcoming && (
        <UpcomingDetailModal
          item={selectedUpcoming}
          onClose={() => setSelectedUpcoming(null)}
        />
      )}
    </div>
  );
}
