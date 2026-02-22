import { useEffect, useState } from 'react';
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
import { exchangeCodeForToken, getReturnPath } from './services/ringcentralAuth';
import { exchangeSalesforceCode, getSalesforceReturnPath, refreshSalesforceToken } from './services/salesforceAuth';
import useRingCentralStore from './stores/ringcentralStore';
import useSalesforceStore from './stores/salesforceStore';
import useGoogleStore from './stores/googleStore';
import useInvestorStore from './stores/investorStore';
import useBlueskyStore from './stores/blueskyStore';
import useUiStore from './stores/uiStore';
import { initGapi, initTokenClient, isTokenValid, requestAccessToken, requestAccessTokenWithConsent, revokeToken, fetchUserEmail } from './services/googleAuth';
import { refreshAccessToken } from './services/ringcentralAuth';
import { checkUnansweredEmails } from './services/gmailService';
import { fetchAllSheetData, ensureContactsColumn, ensureTicTab, populateTicTab, backfillContactInfo, ensureSubscriptionsTab } from './services/sheetsService';
import useFundStore from './stores/fundStore';
import useComplianceStore from './stores/complianceStore';
import useDistributionStore from './stores/distributionStore';
import useTicStore from './stores/ticStore';

// Contact data for backfill (from Contact_Report.xlsx + Company Dashboard CSV)
// Keys match the 'name' column in Investors sheet for exact matching
const CSV_CONTACT_MAP = {
  'Alex Smith': { phone: '801-455-5185', email: 'utahscaper@gmail.com' },
  'Benjamin Nelson': { phone: '801-664-0971', email: 'ben@blackrocklaw.net' },
  'Blake Seifers': { phone: '801-450-9388', email: 'seifersblake@gmail.com' },
  'Bowen England': { phone: '801-577-9980', email: 'bowenengland@gmail.com' },
  'Brady Simon': { phone: '801-403-8155', email: 'xbrady@yahoo.com' },
  'Brian Jones': { phone: '801-750-6981', email: 'bjones4631@gmail.com' },
  'Bridger Wilde': { phone: '435-671-3289', email: 'bridger.wilde@premiertaxfinancial.com' },
  'Bryan Griffith': { phone: '801-699-7522', email: 'bgriffith@griffcographics.com' },
  'Cameron Cope': { phone: '801-809-2565', email: 'camcope@gmail.com' },
  'Chase Benson': { phone: '', email: 'chasebdental@gmail.com' },
  'Chieh Chang': { phone: '626-236-0763', email: 'chieh.chang@gmail.com' },
  'Chris Hermansen': { phone: '801-358-7343', email: 'lakeshoregolfclub@yahoo.com' },
  'Clark Evans': { phone: '801-953-3640', email: 'clark.evans@arbitersports.com' },
  'Connor Clissold': { phone: '801-712-3057', email: 'cjclissold@gmail.com' },
  'Curtis Larsen': { phone: '801-633-7037', email: 'curtlarsen4@gmail.com' },
  'Daniel Cerf': { phone: '415-205-2608', email: 'danocerf@gmail.com' },
  'Darrin Simon': { phone: '801-232-2305', email: 'darrin0@yahoo.com' },
  'Dave Soper': { phone: '501-707-4321', email: 'davsoper@gmail.com' },
  'David Child': { phone: '801-656-5678', email: 'davidchild43@gmail.com' },
  'Dustin Jorgenson': { phone: '801-641-9845', email: 'workhardplayharddustin@gmail.com' },
  'Elissa Oleole': { phone: '808-389-6922', email: 'mangomom808@gmail.com' },
  'Jeremiah Post': { phone: '801-560-3559', email: 'jer@solidrenovationcompany.com' },
  'Jim Cook': { phone: '209-329-6051', email: 'jimandmelaniecook@yahoo.com' },
  'Joel Reichert': { phone: '832-797-4890', email: 'joel.reichert5@gmail.com' },
  'John Sirrine': { phone: '801-673-3840', email: 'john.sirrine9@gmail.com' },
  'Kelly Buchanan': { phone: '', email: 'kwoody56@hotmail.com' },
  'Lance Jorgenson': { phone: '801-694-0040', email: 'lancejorgenson@outlook.com' },
  'Matt Cragun': { phone: '801-404-6021', email: 'mcragun@gmail.com' },
  'Sam Ellis': { phone: '801-664-7803', email: 'samwellis95@gmail.com' },
  'Sayer Leslie': { phone: '208-339-1073', email: 'sayer.leslie@gmail.com' },
  'Spencer Evans': { phone: '801-474-9637', email: '1520kens@gmail.com' },
  'Stephen Collette': { phone: '801-367-5565', email: 'colletteclan07@gmail.com' },
  'Vega Property Holdings': { phone: '801-664-7803', email: 'vegapropertyholdings@gmail.com' },
  'Woody Klemetson': { phone: '801-664-5961', email: 'jwklemetson@gmail.com' },
};

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
    '/pe/sales': 'sales-operations',
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

// ── Auth Gate ────────────────────────────────────────────────────────────────
const ALLOWED_DOMAIN = 'vegarei.com';

function LoginGate() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await requestAccessTokenWithConsent();
      const { email, name } = await fetchUserEmail(token.access_token);
      const domain = email.split('@')[1]?.toLowerCase();
      if (domain !== ALLOWED_DOMAIN) {
        revokeToken(token.access_token);
        setError(`Access restricted to @${ALLOWED_DOMAIN} accounts.`);
        setLoading(false);
        return;
      }
      const store = useGoogleStore.getState();
      store.setToken(token);
      store.setUserEmail(email);
      store.setUserName(name);

      // Load Google Sheets data before the app re-renders and triggers RC auto-connect
      try {
        console.log('[Sheets] Loading live data from Google Sheets...');
        const data = await fetchAllSheetData();
        console.log(`[Sheets] Loaded: ${data.positions.length} positions, ${data.compliance.length} compliance, ${data.distributions.length} distributions`);
        useInvestorStore.getState().loadFromSheets(data.positions, data.investorLookup);
        useFundStore.getState().loadFromSheets(data.funds, data.advisors, data.custodians, data.positions);
        useComplianceStore.getState().loadFromSheets(data.compliance);
        useDistributionStore.getState().loadFromSheets(data.distributions);
        useTicStore.getState().loadFromSheets(data.ticProperties);
        ensureContactsColumn();
        ensureSubscriptionsTab();
        ensureTicTab().then(() => {
          if (!data.ticProperties || data.ticProperties.length === 0) {
            populateTicTab(useTicStore.getState().ticProperties);
          }
        });
        backfillContactInfo(CSV_CONTACT_MAP).then((updates) => {
          if (updates && Object.keys(updates).length > 0) {
            const invStore = useInvestorStore.getState();
            Object.entries(updates).forEach(([invId, fields]) => {
              if (invStore.investors[invId]) {
                invStore.updateInvestorContact(invId, fields, 'system-backfill');
              }
            });
          }
        });
      } catch (sheetErr) {
        console.error('[Sheets] Failed to load sheet data, using seed data:', sheetErr);
      }
    } catch (err) {
      if (err.message !== 'popup_closed') {
        setError('Sign-in failed. Please try again.');
      }
      setLoading(false);
    }
  };

  const mono = { fontFamily: "'Space Mono', monospace" };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div className="grid-bg" />
      <div style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        {/* Vega V + Star */}
        <svg viewBox="0 0 366 576" style={{ width: 48, height: 75, fill: 'var(--t5)', marginBottom: 24, opacity: 0.4 }}>
          <path d="M182.77,0c-8.8,61.66-27.56,110.27-51.34,133.09,23.79,22.82,42.54,71.43,51.34,133.09,8.8-61.66,27.56-110.27,51.34-133.09-23.79-22.82-42.54-71.43-51.34-133.09Z" />
          <path d="M0,133.09h64.04l115.63,361.8h1.24l123.09-361.8h61.54l-157.28,442.62h-60.3L0,133.09Z" />
        </svg>
        <div style={{ ...mono, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.25em', color: 'var(--grn)', marginBottom: 12 }}>
          Vega Companies
        </div>
        <h1 style={{ ...mono, fontSize: 28, fontWeight: 400, color: 'var(--t1)', margin: '0 0 40px', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Mission Control
        </h1>
        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            ...mono,
            fontSize: 12,
            fontWeight: 700,
            padding: '12px 32px',
            border: '1px solid var(--grn)',
            borderRadius: 6,
            background: 'rgba(52,211,153,0.08)',
            color: 'var(--grn)',
            cursor: loading ? 'wait' : 'pointer',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            margin: '0 auto',
          }}
        >
          {/* Google icon */}
          <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'currentColor' }}>
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          {loading ? 'Signing in...' : 'Sign in with Google'}
        </button>
        {error && (
          <div style={{ ...mono, fontSize: 11, color: 'var(--red)', marginTop: 16 }}>
            {error}
          </div>
        )}
        <div style={{ ...mono, fontSize: 10, color: 'var(--t5)', marginTop: 24 }}>
          Restricted to @{ALLOWED_DOMAIN} accounts
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();
  const currentPage = getPageName(location.pathname);
  const isHomePage = location.pathname === '/';

  // ── Auth Gate ─────────────────────────────────────────────────────────────
  const userEmail = useGoogleStore((s) => s.userEmail);
  const isAuthorized = userEmail && userEmail.split('@')[1]?.toLowerCase() === ALLOWED_DOMAIN;

  // ── Token Lifecycle: Google ─────────────────────────────────────────────
  const googleToken = useGoogleStore((s) => s.accessToken);
  const googleExpiry = useGoogleStore((s) => s.tokenExpiresAt);

  useEffect(() => {
    // Initialize Google APIs on mount, then silently re-acquire token for returning users
    Promise.all([initGapi(), initTokenClient()])
      .then(() => {
        // If user already passed the auth gate but token is gone (page refresh), try silent re-auth
        if (isAuthorized && !useGoogleStore.getState().accessToken) {
          requestAccessToken()
            .then((tokenResponse) => {
              const store = useGoogleStore.getState();
              store.setToken(tokenResponse);
              console.log('[Auth] Silent token refresh succeeded');
            })
            .catch((err) => {
              // Silent re-auth failed — this is normal after page refreshes.
              // Keep userEmail so the user stays past the auth gate.
              // They'll need to use the consent flow from LoginGate on next full sign-in.
              console.log('[Auth] Silent token refresh unavailable:', err.message || err);
            });
        }
      })
      .catch(() => {});
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

  // ── RingCentral connection ─────────────────────────────────────────────────
  // RC no longer auto-redirects to OAuth after Google sign-in.
  // If a refresh token exists, silent refresh handles it (see useEffect above).
  // Otherwise, the user connects manually via the RC button in the header.
  const googleAuth = useGoogleStore((s) => s.isAuthenticated);
  const rcAuth = useRingCentralStore((s) => s.isAuthenticated);

  // ── Google Sheets Data Load ──────────────────────────────────────────────────
  const sheetsLoaded = useInvestorStore((s) => s.sheetsLoaded);

  useEffect(() => {
    if (!googleAuth || !googleToken || sheetsLoaded) return;

    console.log('[Sheets] Loading live data from Google Sheets...');
    fetchAllSheetData()
      .then((data) => {
        console.log(`[Sheets] Loaded: ${data.positions.length} positions, ${data.compliance.length} compliance, ${data.distributions.length} distributions`);
        useInvestorStore.getState().loadFromSheets(data.positions, data.investorLookup);
        useFundStore.getState().loadFromSheets(data.funds, data.advisors, data.custodians, data.positions);
        useComplianceStore.getState().loadFromSheets(data.compliance);
        useDistributionStore.getState().loadFromSheets(data.distributions);
        useTicStore.getState().loadFromSheets(data.ticProperties);
        ensureContactsColumn();
        ensureSubscriptionsTab();
        ensureTicTab().then(() => {
          if (!data.ticProperties || data.ticProperties.length === 0) {
            populateTicTab(useTicStore.getState().ticProperties);
          }
        });
        backfillContactInfo(CSV_CONTACT_MAP).then((updates) => {
          if (updates && Object.keys(updates).length > 0) {
            const invStore = useInvestorStore.getState();
            Object.entries(updates).forEach(([invId, fields]) => {
              if (invStore.investors[invId]) {
                invStore.updateInvestorContact(invId, fields, 'system-backfill');
              }
            });
          }
        });
      })
      .catch((err) => {
        console.error('[Sheets] Failed to load sheet data, using seed data:', err);
      });
  }, [googleAuth, googleToken, sheetsLoaded]);

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

  // Show login gate if not authorized (but allow auth callbacks through)
  if (!isAuthorized && !location.pathname.startsWith('/auth/')) {
    return <LoginGate />;
  }

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
