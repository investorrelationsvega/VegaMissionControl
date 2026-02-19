// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Salesforce Auth Service
// OAuth 2.0 Authorization Code flow
// ═══════════════════════════════════════════════

const SF_CLIENT_ID = import.meta.env.VITE_SALESFORCE_CLIENT_ID;
const SF_CLIENT_SECRET = import.meta.env.VITE_SALESFORCE_CLIENT_SECRET;
const REDIRECT_URI = `${window.location.origin}/auth/sf/callback`;

// Salesforce login URLs
const SF_AUTH_URL = 'https://login.salesforce.com/services/oauth2/authorize';
const SF_TOKEN_URL = 'https://login.salesforce.com/services/oauth2/token';

// ---------------------------------------------------------------------------
// OAuth Flow
// ---------------------------------------------------------------------------

/**
 * Start the Salesforce OAuth flow.
 * Redirects the user to Salesforce login page.
 */
export function startSalesforceAuth(returnPath = '/') {
  sessionStorage.setItem('sf_return_path', returnPath);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: SF_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    scope: 'api refresh_token id',
    state: crypto.randomUUID(),
  });

  window.location.href = `${SF_AUTH_URL}?${params.toString()}`;
}

/**
 * Exchange authorization code for access + refresh tokens.
 * Called from the OAuth callback page.
 */
export async function exchangeSalesforceCode(code) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    client_id: SF_CLIENT_ID,
    client_secret: SF_CLIENT_SECRET,
    redirect_uri: REDIRECT_URI,
  });

  const response = await fetch(SF_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error_description || `Salesforce token exchange failed (${response.status})`);
  }

  const data = await response.json();

  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    instance_url: data.instance_url, // e.g. https://yourorg.my.salesforce.com
    token_type: data.token_type,
    id_url: data.id,
    issued_at: Number(data.issued_at),
    // SF tokens don't have a fixed expiry — they last until revoked or session timeout
    // Default session timeout is 2 hours
    expires_at: Date.now() + 7200000,
  };
}

/**
 * Refresh the Salesforce access token using a refresh token.
 */
export async function refreshSalesforceToken(refreshToken) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: SF_CLIENT_ID,
    client_secret: SF_CLIENT_SECRET,
  });

  const response = await fetch(SF_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });

  if (!response.ok) {
    throw new Error('Salesforce token refresh failed — please reconnect.');
  }

  const data = await response.json();
  return {
    access_token: data.access_token,
    instance_url: data.instance_url,
    expires_at: Date.now() + 7200000,
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Get the stored return path from sessionStorage */
export function getSalesforceReturnPath() {
  const path = sessionStorage.getItem('sf_return_path') || '/pe/sales';
  sessionStorage.removeItem('sf_return_path');
  return path;
}

/** Check if token is still valid (with 5-min buffer) */
export function isSalesforceTokenValid(tokenData) {
  if (!tokenData || !tokenData.access_token) return false;
  return tokenData.expires_at > Date.now() + 300000;
}
