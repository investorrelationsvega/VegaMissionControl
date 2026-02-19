// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — RingCentral Service
// REST API wrappers for calls, SMS, call log
// ═══════════════════════════════════════════════

const RC_API = 'https://platform.ringcentral.com/restapi/v1.0';

// ---------------------------------------------------------------------------
// Base Fetch Helper
// ---------------------------------------------------------------------------

async function rcFetch(path, options = {}, accessToken) {
  const response = await fetch(`${RC_API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(
      err.message || err.error_description || `RC API error (${response.status})`,
    );
  }

  return response.json();
}

// ---------------------------------------------------------------------------
// RingOut (Click-to-Dial)
// ---------------------------------------------------------------------------

/**
 * Initiate a RingOut call.
 * RingCentral calls your phone first, then connects to the target.
 */
export async function initiateRingOut(accessToken, { from, to }) {
  return rcFetch(
    '/account/~/extension/~/ring-out',
    {
      method: 'POST',
      body: JSON.stringify({
        from: { phoneNumber: formatPhoneForRC(from) },
        to: { phoneNumber: formatPhoneForRC(to) },
        playPrompt: true,
        callerId: { phoneNumber: formatPhoneForRC(from) },
      }),
    },
    accessToken,
  );
}

/**
 * Get the status of an active RingOut session.
 */
export async function getRingOutStatus(accessToken, ringOutId) {
  return rcFetch(
    `/account/~/extension/~/ring-out/${ringOutId}`,
    { method: 'GET' },
    accessToken,
  );
}

/**
 * Cancel an active RingOut session.
 */
export async function cancelRingOut(accessToken, ringOutId) {
  await fetch(`${RC_API}/account/~/extension/~/ring-out/${ringOutId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

// ---------------------------------------------------------------------------
// Call Log
// ---------------------------------------------------------------------------

/**
 * Fetch call log entries.
 */
export async function getCallLog(accessToken, params = {}) {
  const query = new URLSearchParams({
    view: 'Detailed',
    perPage: '50',
    ...params,
  });

  const data = await rcFetch(
    `/account/~/extension/~/call-log?${query.toString()}`,
    { method: 'GET' },
    accessToken,
  );

  return data.records || [];
}

// ---------------------------------------------------------------------------
// SMS
// ---------------------------------------------------------------------------

/**
 * Send an SMS message.
 */
export async function sendSMS(accessToken, { to, from, text }) {
  return rcFetch(
    '/account/~/extension/~/sms',
    {
      method: 'POST',
      body: JSON.stringify({
        to: [{ phoneNumber: formatPhoneForRC(to) }],
        from: { phoneNumber: formatPhoneForRC(from) },
        text,
      }),
    },
    accessToken,
  );
}

// ---------------------------------------------------------------------------
// Message Store (SMS history from RC API — includes phone app messages)
// ---------------------------------------------------------------------------

/**
 * Fetch SMS message history for a phone number from RC message store.
 * Returns all sent/received SMS — including those from the RC mobile app.
 */
export async function getMessageStore(accessToken, phoneNumber, perPage = 50) {
  const query = new URLSearchParams({
    messageType: 'SMS',
    perPage: String(perPage),
    direction: 'Inbound,Outbound',
  });

  // Filter by phone number if provided
  if (phoneNumber) {
    query.set('phoneNumber', formatPhoneForRC(phoneNumber));
  }

  const data = await rcFetch(
    `/account/~/extension/~/message-store?${query.toString()}`,
    { method: 'GET' },
    accessToken,
  );

  // Normalize into a simpler format
  return (data.records || []).map((msg) => ({
    id: msg.id,
    direction: msg.direction === 'Inbound' ? 'inbound' : 'outbound',
    text: msg.subject || '',
    from: msg.from?.phoneNumber || '',
    to: (msg.to || []).map((t) => t.phoneNumber).join(', '),
    timestamp: msg.creationTime || msg.lastModifiedTime,
    status: msg.messageStatus,
  }));
}

// ---------------------------------------------------------------------------
// Extension Info
// ---------------------------------------------------------------------------

/**
 * Get the current user's extension info (phone numbers, name, etc.).
 */
export async function getExtensionInfo(accessToken) {
  return rcFetch(
    '/account/~/extension/~',
    { method: 'GET' },
    accessToken,
  );
}

/**
 * Get the user's direct phone numbers.
 */
export async function getPhoneNumbers(accessToken) {
  const data = await rcFetch(
    '/account/~/extension/~/phone-number',
    { method: 'GET' },
    accessToken,
  );
  return data.records || [];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert display phone format to E.164.
 * (801) 555-0101 → +18015550101
 */
export function formatPhoneForRC(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return `+${digits}`;
}

/**
 * Format E.164 phone to display format.
 * +18015550101 → (801) 555-0101
 */
export function formatPhoneForDisplay(phone) {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  const local = digits.length === 11 ? digits.slice(1) : digits;
  if (local.length === 10) {
    return `(${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  return phone;
}

/**
 * Format call duration in seconds to mm:ss.
 */
export function formatDuration(seconds) {
  if (!seconds) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}
