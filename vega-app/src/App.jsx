import { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import Header from './components/Header';
import Toast from './components/Toast';
import Dashboard from './pages/Dashboard';
import Directory from './pages/Directory';
import Compliance from './pages/Compliance';
import Tasks from './pages/Tasks';
import Distributions from './pages/Distributions';
import FundOverview from './pages/FundOverview';
import Reports from './pages/Reports';
import { exchangeCodeForToken, getReturnPath } from './services/ringcentralAuth';
import useRingCentralStore from './stores/ringcentralStore';
import useGoogleStore from './stores/googleStore';
import { initGapi, initTokenClient, isTokenValid } from './services/googleAuth';
import { refreshAccessToken } from './services/ringcentralAuth';

// Map pathname to a friendly page name for the Header
function getPageName(pathname) {
  const map = {
    '/': 'dashboard',
    '/directory': 'directory',
    '/compliance': 'compliance',
    '/tasks': 'tasks',
    '/distributions': 'distributions',
    '/funds': 'funds',
    '/reports': 'reports',
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

  return (
    <>
      <div className="grid-bg" />
      <Header currentPage={currentPage} />
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/directory" element={<Directory />} />
        <Route path="/compliance" element={<Compliance />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/distributions" element={<Distributions />} />
        <Route path="/funds" element={<FundOverview />} />
        <Route path="/reports" element={<Reports />} />
        <Route path="/auth/rc/callback" element={<RCCallback />} />
      </Routes>
      <Toast />
    </>
  );
}
