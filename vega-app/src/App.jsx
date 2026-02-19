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
import Sales from './pages/Sales';
import UnitPlaceholder from './pages/UnitPlaceholder';
import { exchangeCodeForToken, getReturnPath, startAuthFlow } from './services/ringcentralAuth';
import { exchangeSalesforceCode, getSalesforceReturnPath, refreshSalesforceToken } from './services/salesforceAuth';
import useRingCentralStore from './stores/ringcentralStore';
import useSalesforceStore from './stores/salesforceStore';
import useGoogleStore from './stores/googleStore';
import useInvestorStore from './stores/investorStore';
import useBlueskyStore from './stores/blueskyStore';
import useUiStore from './stores/uiStore';
import { initGapi, initTokenClient, isTokenValid } from './services/googleAuth';
import { refreshAccessToken } from './services/ringcentralAuth';
import { checkUnansweredEmails } from './services/gmailService';

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
    '/pe/sales': 'sales',
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

// ── Salesforce OAuth Callback ────────────────────────────────────────────────
function SFCallback() {
  const navigate = useNavigate();
  const setTokens = useSalesforceStore((s) => s.setTokens);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (!code) {
      navigate('/pe/sales');
      return;
    }

    exchangeSalesforceCode(code)
      .then((tokenData) => {
        setTokens(tokenData);
        const returnPath = getSalesforceReturnPath();
        navigate(returnPath, { replace: true });
      })
      .catch((err) => {
        console.error('Salesforce auth failed:', err);
        navigate('/pe/sales', { replace: true });
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
      Connecting Salesforce...
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

  // ── Token Lifecycle: Salesforce ───────────────────────────────────────────
  const sfRefreshToken = useSalesforceStore((s) => s.refreshToken);
  const sfSetTokens = useSalesforceStore((s) => s.setTokens);
  const sfClearAuth = useSalesforceStore((s) => s.clearAuth);

  useEffect(() => {
    // On mount, if we have a SF refresh token, try to get a new access token
    if (sfRefreshToken) {
      refreshSalesforceToken(sfRefreshToken)
        .then((tokenData) => sfSetTokens(tokenData))
        .catch(() => sfClearAuth());
    }
  }, []); // run only on mount

  // ── Auto-connect RingCentral after Google auth ────────────────────────────
  const googleAuth = useGoogleStore((s) => s.isAuthenticated);
  const rcAuth = useRingCentralStore((s) => s.isAuthenticated);

  useEffect(() => {
    // If Google is connected but RC is not (and no refresh token to auto-refresh),
    // kick off the RC OAuth flow automatically
    if (googleAuth && !rcAuth && !rcRefreshToken) {
      startAuthFlow(window.location.pathname);
    }
  }, [googleAuth, rcAuth, rcRefreshToken]);

  // ── 48h Unanswered Email Check ─────────────────────────────────────────────
  const googleTokenForCheck = useGoogleStore((s) => s.accessToken);

  useEffect(() => {
    if (!googleAuth || !googleTokenForCheck) return;

    const investors = useInvestorStore.getState().getAll();
    const contactEmails = investors
      .map((inv) => inv.email)
      .filter(Boolean)
      .filter((e, i, arr) => arr.indexOf(e) === i); // dedupe

    if (contactEmails.length === 0) return;

    const ui = useUiStore.getState();
    const existingNotifs = ui.notifications;

    checkUnansweredEmails(googleTokenForCheck, contactEmails, 48)
      .then((unanswered) => {
        unanswered.forEach((item) => {
          // Skip if we already have a notification for this thread
          const alreadyNotified = existingNotifs.some(
            (n) => n.type === 'email' && n.threadId === item.threadId
          );
          if (alreadyNotified) return;

          // Find the investor name for the notification
          const inv = investors.find((i) => i.email === item.contactEmail);
          const name = inv?.name || item.contactEmail;

          ui.addNotification({
            type: 'email',
            title: `Unanswered: ${item.subject}`,
            detail: `${name} — no reply in ${Math.round(item.hoursAgo / 24)}d. Last message from ${item.from.split('<')[0].trim()}.`,
            link: '/pe/directory',
            threadId: item.threadId,
          });
        });
      })
      .catch((err) => {
        console.error('Unanswered email check failed:', err);
      });
  }, [googleAuth, googleTokenForCheck]);

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
        <Route path="/pe/sales" element={<Sales />} />

        {/* Other business units (placeholder dashboards) */}
        <Route path="/alm" element={<UnitPlaceholder name="Assisted Living Management" subtitle="Management & Operations" />} />
        <Route path="/builders" element={<UnitPlaceholder name="Builders" subtitle="Construction" />} />
        <Route path="/capital-markets" element={<UnitPlaceholder name="Capital Markets" subtitle="Debt & Equity Financing" />} />
        <Route path="/development" element={<UnitPlaceholder name="Development" subtitle="Land Development" />} />
        <Route path="/hospice" element={<UnitPlaceholder name="Hospice" subtitle="End-of-Life Care" />} />
        <Route path="/pmre" element={<UnitPlaceholder name="Property Management & Real Estate" subtitle="Operations & Holdings" />} />
        <Route path="/valuations" element={<UnitPlaceholder name="Valuations" subtitle="Appraisal & Advisory" />} />

        {/* Auth callbacks */}
        <Route path="/auth/rc/callback" element={<RCCallback />} />
        <Route path="/auth/sf/callback" element={<SFCallback />} />
      </Routes>
      <Toast />
    </>
  );
}
