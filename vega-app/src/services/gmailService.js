// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Gmail Service
// Search and retrieve email details via Gmail API
// Uses existing Google auth token
// ═══════════════════════════════════════════════

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

/**
 * Search Gmail messages by query string.
 * Returns an array of message summaries (id, threadId).
 */
export async function searchMessages(query, accessToken, maxResults = 10) {
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });

  const res = await fetch(`${GMAIL_API}/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail search failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  if (!data.messages || data.messages.length === 0) return [];

  // Fetch details for each message
  const details = await Promise.all(
    data.messages.map((m) => getMessageDetails(m.id, accessToken)),
  );

  return details.filter(Boolean);
}

/**
 * Get message details: subject, from, date, snippet.
 */
export async function getMessageDetails(messageId, accessToken) {
  const res = await fetch(
    `${GMAIL_API}/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) return null;

  const data = await res.json();
  const headers = data.payload?.headers || [];

  const getHeader = (name) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';

  return {
    messageId: data.id,
    threadId: data.threadId,
    subject: getHeader('Subject') || '(no subject)',
    from: getHeader('From'),
    date: getHeader('Date'),
    snippet: data.snippet || '',
  };
}
