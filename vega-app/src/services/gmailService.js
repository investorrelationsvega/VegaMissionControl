// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Gmail Service
// Search and retrieve email details via Gmail API
// Uses existing Google auth token
// ═══════════════════════════════════════════════

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getHeader(headers, name) {
  return headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
}

/** Base64url encode a string for Gmail raw email format */
function base64UrlEncode(str) {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Extract plain text body from a Gmail message payload.
 * Handles both simple and multipart messages.
 */
function extractTextBody(payload) {
  if (!payload) return '';

  // Simple message with body directly
  if (payload.mimeType === 'text/plain' && payload.body?.data) {
    return decodeURIComponent(escape(atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))));
  }

  // Multipart — search parts recursively
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        return decodeURIComponent(escape(atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))));
      }
      // Recurse into nested multipart
      if (part.parts) {
        const nested = extractTextBody(part);
        if (nested) return nested;
      }
    }
  }

  return '';
}

// ---------------------------------------------------------------------------
// Existing functions (preserved)
// ---------------------------------------------------------------------------

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

  return {
    messageId: data.id,
    threadId: data.threadId,
    subject: getHeader(headers, 'Subject') || '(no subject)',
    from: getHeader(headers, 'From'),
    date: getHeader(headers, 'Date'),
    snippet: data.snippet || '',
  };
}

// ---------------------------------------------------------------------------
// Thread-based functions
// ---------------------------------------------------------------------------

/**
 * Get email threads involving a contact.
 * Returns array of thread summaries: { threadId, subject, snippet, lastDate, messageCount, lastFrom }
 */
export async function getThreadsForContact(accessToken, contactEmail, maxResults = 20) {
  const query = `from:${contactEmail} OR to:${contactEmail}`;
  const params = new URLSearchParams({
    q: query,
    maxResults: String(maxResults),
  });

  const res = await fetch(`${GMAIL_API}/threads?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail thread search failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  if (!data.threads || data.threads.length === 0) return [];

  // Fetch summary details for each thread (metadata only for speed)
  const threads = await Promise.all(
    data.threads.map(async (t) => {
      const detail = await getThreadSummary(accessToken, t.id);
      return detail;
    }),
  );

  return threads.filter(Boolean);
}

/**
 * Get thread summary (metadata for the thread overview list).
 */
async function getThreadSummary(accessToken, threadId) {
  const res = await fetch(
    `${GMAIL_API}/threads/${threadId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=To&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) return null;

  const data = await res.json();
  const messages = data.messages || [];
  if (messages.length === 0) return null;

  const firstMsg = messages[0];
  const lastMsg = messages[messages.length - 1];
  const firstHeaders = firstMsg.payload?.headers || [];
  const lastHeaders = lastMsg.payload?.headers || [];

  return {
    threadId: data.id,
    subject: getHeader(firstHeaders, 'Subject') || '(no subject)',
    snippet: lastMsg.snippet || '',
    lastDate: getHeader(lastHeaders, 'Date'),
    lastFrom: getHeader(lastHeaders, 'From'),
    messageCount: messages.length,
  };
}

/**
 * Get full thread details — all messages with their bodies.
 * Returns { threadId, subject, messages: [{ messageId, from, to, date, body, snippet }] }
 */
export async function getThreadDetails(accessToken, threadId) {
  const res = await fetch(
    `${GMAIL_API}/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );

  if (!res.ok) {
    throw new Error(`Failed to fetch thread: ${res.status}`);
  }

  const data = await res.json();
  const messages = (data.messages || []).map((msg) => {
    const headers = msg.payload?.headers || [];
    return {
      messageId: msg.id,
      threadId: data.id,
      from: getHeader(headers, 'From'),
      to: getHeader(headers, 'To'),
      date: getHeader(headers, 'Date'),
      subject: getHeader(headers, 'Subject') || '(no subject)',
      body: extractTextBody(msg.payload),
      snippet: msg.snippet || '',
      messageIdHeader: getHeader(headers, 'Message-ID'),
    };
  });

  return {
    threadId: data.id,
    subject: messages[0]?.subject || '(no subject)',
    messages,
  };
}

/**
 * Send a reply within an existing thread.
 */
export async function sendReply(accessToken, { threadId, inReplyTo, to, subject, body, from = 'j@vegarei.com' }) {
  const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
  const lines = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${replySubject}`,
    'Content-Type: text/plain; charset=utf-8',
  ];
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`);
    lines.push(`References: ${inReplyTo}`);
  }
  lines.push('', body);

  const raw = base64UrlEncode(lines.join('\r\n'));

  const resp = await fetch(`${GMAIL_API}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw, threadId }),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gmail reply failed (${resp.status})`);
  }

  return resp.json();
}

/**
 * Check for unanswered inbound emails older than a threshold.
 * Returns threads where the last message is FROM a contact and older than hoursThreshold.
 */
export async function checkUnansweredEmails(accessToken, contactEmails, hoursThreshold = 48) {
  const unanswered = [];

  for (const email of contactEmails) {
    const query = `from:${email}`;
    const params = new URLSearchParams({ q: query, maxResults: '10' });

    let res;
    try {
      res = await fetch(`${GMAIL_API}/threads?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
    } catch {
      continue;
    }

    if (!res.ok) continue;

    const data = await res.json();
    if (!data.threads) continue;

    // Check each thread's last message
    for (const t of data.threads.slice(0, 5)) {
      const summary = await getThreadSummary(accessToken, t.id);
      if (!summary) continue;

      // Check if last message is from the contact (not from us)
      const lastFromLower = summary.lastFrom.toLowerCase();
      if (!lastFromLower.includes(email.toLowerCase())) continue;

      // Check if older than threshold
      const lastDate = new Date(summary.lastDate);
      const hoursAgo = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60);
      if (hoursAgo >= hoursThreshold) {
        unanswered.push({
          threadId: summary.threadId,
          subject: summary.subject,
          from: summary.lastFrom,
          lastDate: summary.lastDate,
          contactEmail: email,
          hoursAgo: Math.round(hoursAgo),
        });
      }
    }
  }

  return unanswered;
}
