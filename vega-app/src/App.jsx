import { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Toast from './components/Toast';
import Home from './pages/Home';
import Dashboard from './pages/Dashboard';
import Directory from './pages/Directory';
import Compliance from './pages/Compliance';
import Tasks from './pages/Tasks';
import Distributions from './pages/Distributions';
import FundOverview from './pages/FundOverview';
import Reports from './pages/Reports';
import UnitPlaceholder from './pages/UnitPlaceholder';
import { exchangeCodeForToken, getReturnPath } from './services/ringcentralAuth';
import useRingCentralStore from './stores/ringcentralStore';
import useGoogleStore from './stores/googleStore';
import useInvestorStore from './stores/investorStore';
import useBlueskyStore from './stores/blueskyStore';
import useUiStore from './stores/uiStore';
import { initGapi, initTokenClient, isTokenValid } from './services/googleAuth';
import { refreshAccessToken } from './services/ringcentralAuth';

// Map pathname to a friendly page name for the Header
function getPageName(pathname) {
  const map = {
    '/pe': 'dashboard',
    '/pe/directory': 'directory',
    '/pe/compliance': 'compliance',
    '/pe/tasks': 'tasks',
    '/pe/distributions': 'distributions',
    '/pe/funds': 'funds',
    '/pe/reports': 'reports',
  };
  return map[pathname] || 'dashboard';
}

// ── RingCentral OAuth Callback ──────────────────────────────────────────────
function RCCallback() {
  const navigate = useNavigate();
  const setTokens = useRingCentralStore((s) => s.setTokens);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      navigate('/');
      return;
    }

    exchangeCodeForToken(code)
      .then((tokenData) => {
        setTokens(tokenData);
        const returnPath = getReturnPath() || '/';
        navigate(returnPath, { replace: true });
      })
      .catch((err) => {
        console.error('RingCentral auth failed:', err);
        navigate('/', { replace: true });
      });
  }, [navigate, setTokens]);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        color: 'var(--t3)',
        fontFamily: "'Space Mono', monospace",
        fontSize: 13,
      }}
    >
      Connecting RingCentral...
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const currentPage = getPageName(location.pathname);
  const isHomePage = location.pathname === '/';

  // ── Token Lifecycle: Google ─────────────────────────────────────────────
  const googleToken = useGoogleStore((s) => s.accessToken);
  const googleExpiry = useGoogleStore((s) => s.tokenExpiresAt);

  useEffect(() => {
    // Initialize Google APIs on mount
    initGapi().catch(() => {});
    initTokenClient().catch(() => {});
  }, []);

  useEffect(() => {
    // Auto-refresh Google token 2 min before expiry
    if (!googleToken || !googleExpiry) return;
    const refreshIn = googleExpiry - Date.now() - 120000;
    if (refreshIn <= 0) return;
    const timer = setTimeout(() => {
      if (!isTokenValid({ access_token: googleToken, expires_at: googleExpiry })) {
        // Token expired — user will need to re-auth via popup
        useGoogleStore.getState().clearAuth();
      }
    }, refreshIn);
    return () => clearTimeout(timer);
  }, [googleToken, googleExpiry]);

  // ── Token Lifecycle: RingCentral ────────────────────────────────────────
  const rcRefreshToken = useRingCentralStore((s) => s.refreshToken);
  const rcTokenExpiry = useRingCentralStore((s) => s.tokenExpiresAt);
  const rcSetTokens = useRingCentralStore((s) => s.setTokens);
  const rcClearAuth = useRingCentralStore((s) => s.clearAuth);

  useEffect(() => {
    // On mount, if we have a refresh token, try to get a new access token
    if (rcRefreshToken) {
      refreshAccessToken(rcRefreshToken)
        .then((tokenData) => rcSetTokens(tokenData))
        .catch(() => rcClearAuth());
    }
  }, []); // intentionally run only on mount

  useEffect(() => {
    // Auto-refresh RC token 5 min before expiry
    if (!rcRefreshToken || !rcTokenExpiry) return;
    const refreshIn = rcTokenExpiry - Date.now() - 300000;
    if (refreshIn <= 0) return;
    const timer = setTimeout(() => {
      refreshAccessToken(rcRefreshToken)
        .then((tokenData) => rcSetTokens(tokenData))
        .catch(() => rcClearAuth());
    }, refreshIn);
    return () => clearTimeout(timer);
  }, [rcRefreshToken, rcTokenExpiry, rcSetTokens, rcClearAuth]);

  // ── Bluesky Filing Scan on Mount ───────────────────────────────────────────
  useEffect(() => {
    const positions = useInvestorStore.getState().positions;
    const bluesky = useBlueskyStore.getState();
    const ui = useUiStore.getState();

    // Track which investors we've already created filings for (one per investor)
    const processed = new Set();

    positions.forEach((pos) => {
      // Skip if: no webform completion, is Utah, or already has a filing
      if (!pos.pipeline?.webformCompleteDate) return;
      if (!pos.state || pos.state === 'UT') return;
      if (processed.has(pos.invId)) return;
      if (bluesky.hasFiling(pos.invId)) return;

      processed.add(pos.invId);
      const filing = bluesky.addFiling(pos);
      if (filing) {
        ui.addNotification({
          type: 'bluesky',
          title: 'Blue Sky Filing Required',
          detail: `${pos.name} (${pos.state}) — ${pos.fund}. File within 30 days.`,
          link: '/pe/compliance',
          filingId: filing.id,
        });
      }
    });
  }, []); // run once on mount

  return (
    <>
      <div className="grid-bg" />
      {!isHomePage && <Header currentPage={currentPage} />}
      <Routes>
        {/* Landing page */}
        <Route path="/" element={<Home />} />

        {/* Private Equity */}
        <Route path="/pe" element={<Dashboard />} />
        <Route path="/pe/directory" element={<Directory />} />
        <Route path="/pe/compliance" element={<Compliance />} />
        <Route path="/pe/tasks" element={<Tasks />} />
        <Route path="/pe/distributions" element={<Distributions />} />
        <Route path="/pe/funds" element={<FundOverview />} />
        <Route path="/pe/reports" element={<Reports />} />

        {/* Other business units (placeholder dashboards) */}
        <Route path="/alm" element={<UnitPlaceholder name="Assisted Living Management" subtitle="Management & Operations" />} />
        <Route path="/builders" element={<UnitPlaceholder name="Builders" subtitle="Construction" />} />
        <Route path="/capital-markets" element={<UnitPlaceholder name="Capital Markets" subtitle="Debt & Equity Financing" />} />
        <Route path="/development" element={<UnitPlaceholder name="Development" subtitle="Land Development" />} />
        <Route path="/hospice" element={<UnitPlaceholder name="Hospice" subtitle="End-of-Life Care" />} />
        <Route path="/pmre" element={<UnitPlaceholder name="Property Management & Real Estate" subtitle="Operations & Holdings" />} />
        <Route path="/valuations" element={<UnitPlaceholder name="Valuations" subtitle="Appraisal & Advisory" />} />

        {/* Auth callback */}
        <Route path="/auth/rc/callback" element={<RCCallback />} />
      </Routes>
      <Toast />
    </>
  );
}
