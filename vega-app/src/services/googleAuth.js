// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Google Auth Service
// Google Identity Services (GIS) + gapi client
// ═══════════════════════════════════════════════

const SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/documents.readonly',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://mail.google.com/',
  'https://www.googleapis.com/auth/chat.messages',
].join(' ');

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

let tokenClient = null;
let gapiLoaded = false;
let gisLoaded = false;

// ---------------------------------------------------------------------------
// Script Loaders
// ---------------------------------------------------------------------------

/** Load Google API client library (gapi) */
export function loadGapiScript() {
  return new Promise((resolve, reject) => {
    if (gapiLoaded) return resolve();
    const script = document.createElement('script');
    script.src = 'https://apis.google.com/js/api.js';
    script.onload = () => {
      gapiLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google API script'));
    document.head.appendChild(script);
  });
}

/** Load Google Identity Services (GIS) */
export function loadGisScript() {
  return new Promise((resolve, reject) => {
    if (gisLoaded) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.onload = () => {
      gisLoaded = true;
      resolve();
    };
    script.onerror = () => reject(new Error('Failed to load Google Identity Services'));
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// Initialization
// ---------------------------------------------------------------------------

/** Initialize gapi client with Drive discovery doc */
export async function initGapi() {
  await loadGapiScript();
  return new Promise((resolve, reject) => {
    window.gapi.load('client', async () => {
      try {
        await window.gapi.client.init({
          discoveryDocs: [
            'https://www.googleapis.com/discovery/v1/apis/drive/v3/rest',
          ],
        });
        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

/** Initialize GIS token client */
export async function initTokenClient() {
  await loadGisScript();
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPES,
    callback: '', // set per-request
  });
  return tokenClient;
}

// ---------------------------------------------------------------------------
// Token Requests
// ---------------------------------------------------------------------------

/**
 * Request an access token from Google.
 * First call shows consent popup; subsequent calls may be silent.
 * Returns a promise that resolves with the token response.
 */
export function requestAccessToken() {
  return new Promise(async (resolve, reject) => {
    try {
      if (!tokenClient) {
        await initTokenClient();
      }
      tokenClient.callback = (tokenResponse) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error));
          return;
        }
        // Add expiry timestamp
        tokenResponse.expires_at =
          Date.now() + (tokenResponse.expires_in || 3600) * 1000;
        resolve(tokenResponse);
      };
      tokenClient.error_callback = (err) => {
        reject(new Error(err.type || 'Auth error'));
      };
      tokenClient.requestAccessToken({ prompt: '' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Request access token with explicit consent prompt (first time).
 */
export function requestAccessTokenWithConsent() {
  return new Promise(async (resolve, reject) => {
    try {
      if (!tokenClient) {
        await initTokenClient();
      }
      tokenClient.callback = (tokenResponse) => {
        if (tokenResponse.error) {
          reject(new Error(tokenResponse.error));
          return;
        }
        tokenResponse.expires_at =
          Date.now() + (tokenResponse.expires_in || 3600) * 1000;
        resolve(tokenResponse);
      };
      tokenClient.error_callback = (err) => {
        reject(new Error(err.type || 'Auth error'));
      };
      tokenClient.requestAccessToken({ prompt: 'consent' });
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check if a token is still valid */
export function isTokenValid(token) {
  if (!token || !token.access_token) return false;
  return token.expires_at > Date.now() + 60000; // 1-min buffer
}

/** Revoke the current token */
export function revokeToken(accessToken) {
  if (accessToken) {
    window.google.accounts.oauth2.revoke(accessToken, () => {});
  }
}
