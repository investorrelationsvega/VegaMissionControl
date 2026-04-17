// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Current User
// Single source of truth for attribution writes.
// Reads the signed-in user from the Google store at
// call time so audit logs, notes, and assignments
// always get attributed to whoever is actually
// using the app — no stale hardcoded fallbacks.
// ═══════════════════════════════════════════════

import useGoogleStore from '../stores/googleStore';

// Returns the signed-in user's email. If no one is signed in yet
// (shouldn't happen once the domain gate has passed, but possible
// during hydration or tests), returns 'unknown' so writes still
// succeed and the gap is visible in audit logs.
export function getCurrentUserEmail() {
  return useGoogleStore.getState().userEmail || 'unknown';
}

// Prefer the caller-supplied user if they passed one explicitly;
// otherwise fall through to the signed-in user. Use this in store
// actions where the caller may pass a user (e.g. tests) but we
// want live attribution in production.
export function resolveUser(passed) {
  return passed || getCurrentUserEmail();
}
