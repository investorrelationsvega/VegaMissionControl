// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — RingCentral Auth Service
// PKCE OAuth2 flow for SPA
// ═══════════════════════════════════════════════

const RC_BASE = 'https://platform.ringcentral.com';
const CLIENT_ID = import.meta.env.VITE_RC_CLIENT_ID;
const REDIRECT_URI = `${window.location.origin}/auth/rc/callback`;

// ---------------------------------------------------------------------------
// PKCE Helpers
// ---------------------------------------------------------------------------

/** Generate a random code verifier (43-128 chars) */
export function generateCodeVerifier() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

/** Generate SHA-256 code challenge from verifier */
export async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

/** Base64URL encode (no padding, URL-safe) */
function base64UrlEncode(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  let str = '';
  bytes.forEach((b) => (str += String.fromCharCode(b)));
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ---------------------------------------------------------------------------
// OAuth Flow
// ---------------------------------------------------------------------------

/**
 * Build the RingCentral authorization URL.
 * Stores code verifier and return path in sessionStorage.
 */
export async function startAuthFlow(returnPath = '/') {
  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);

  // Store for the callback
  sessionStorage.setItem('rc_code_verifier', codeVerifier);
  sessionStorage.setItem('rc_return_path', returnPath);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
    state: crypto.randomUUID(),
  });

  window.location.href = `${RC_BASE}/restapi/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange authorization code for tokens.
 * Called from the OAuth callback page.
 */
export async function exchangeCodeForToken(code) {
  const codeVerifier = sessionStorage.getItem('rc_code_verifier');
  if (!codeVerifier) {
    throw new Error('Missing code verifier — please try logging in again.');
  }

  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: codeVerifier,
  });

  const response = await fetch(`${RC_BASE}/restapi/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error_description || `Token exchange failed (${response.status})`);
  }

  const data = await response.json();

  // Clean up sessionStorage
  sessionStorage.removeItem('rc_code_verifier');

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

/**
 * Refresh the access token using a refresh token.
 */
export async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  });

  const response = await fetch(`${RC_BASE}/restapi/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error('Token refresh failed — please reconnect RingCentral.');
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_in: data.expires_in,
    expires_at: Date.now() + data.expires_in * 1000,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if token data is still valid */
export function isTokenValid(tokenData) {
  if (!tokenData || !tokenData.access_token) return false;
  return tokenData.expires_at > Date.now() + 60000; // 1-min buffer
}

/** Get the stored return path from sessionStorage */
export function getReturnPath() {
  const path = sessionStorage.getItem('rc_return_path') || '/';
  sessionStorage.removeItem('rc_return_path');
  return path;
}
