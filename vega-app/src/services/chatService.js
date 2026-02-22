// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Google Chat Service
// List spaces, read/send messages via Google Chat API
// Uses existing Google auth token
// ═══════════════════════════════════════════════

const CHAT_API = 'https://chat.googleapis.com/v1';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authHeaders(accessToken) {
  return { Authorization: `Bearer ${accessToken}` };
}

/**
 * Normalize a Chat API space into a simpler object.
 * For DMs, resolve display name from members list.
 */
function normalizeSpace(space, members, userEmail) {
  let displayName = space.displayName || '';
  let type = 'SPACE';

  if (space.spaceType === 'DIRECT_MESSAGE' || space.type === 'DM') {
    type = 'DM';
    // For DMs, use the other person's display name
    if (members && members.length > 0) {
      const other = members.find((m) => {
        const email = m.member?.user?.email || '';
        return email && email.toLowerCase() !== (userEmail || '').toLowerCase();
      });
      if (other) {
        displayName = other.member?.user?.displayName || other.member?.user?.email || 'Direct Message';
      }
    }
    if (!displayName) displayName = 'Direct Message';
  } else if (space.spaceType === 'GROUP_CHAT') {
    type = 'GROUP';
    if (!displayName) displayName = 'Group Chat';
  }

  return {
    id: space.name,
    displayName,
    type,
    memberCount: members ? members.length : 0,
    lastMessageTime: null, // filled in by caller if available
  };
}

/**
 * Normalize a Chat API message into a simpler object.
 */
function normalizeMessage(msg, userEmail) {
  const senderName = msg.sender?.displayName || '';
  const senderEmail = msg.sender?.name || '';
  const senderType = msg.sender?.type || 'HUMAN';
  const isOwn = senderType === 'HUMAN' &&
    (msg.sender?.email || '').toLowerCase() === (userEmail || '').toLowerCase();

  return {
    id: msg.name,
    senderName: senderName || (isOwn ? 'You' : 'Unknown'),
    senderEmail: msg.sender?.email || '',
    text: msg.text || '',
    formattedText: msg.formattedText || '',
    timestamp: msg.createTime,
    isOwn,
  };
}

// ---------------------------------------------------------------------------
// API Functions
// ---------------------------------------------------------------------------

/**
 * List all spaces the authenticated user is a member of.
 * Resolves DM display names by fetching members for each DM space.
 * Returns normalized array sorted by type (DMs first) then name.
 */
export async function listSpaces(accessToken, userEmail) {
  const spaces = [];
  let pageToken = null;

  // Paginate through all spaces
  do {
    const params = new URLSearchParams({ pageSize: '200' });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${CHAT_API}/spaces?${params}`, {
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Chat API spaces error ${res.status}: ${err}`);
    }
    const data = await res.json();
    if (data.spaces) spaces.push(...data.spaces);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  // For DM spaces, resolve display names via members
  const normalized = await Promise.all(
    spaces.map(async (space) => {
      let members = [];
      if (space.spaceType === 'DIRECT_MESSAGE' || space.type === 'DM') {
        try {
          members = await listMembers(accessToken, space.name);
        } catch {
          // Silently handle — display name will fall back to 'Direct Message'
        }
      }
      return normalizeSpace(space, members, userEmail);
    }),
  );

  // Sort: DMs first, then groups, then spaces — alphabetically within each
  const typeOrder = { DM: 0, GROUP: 1, SPACE: 2 };
  normalized.sort((a, b) => {
    const ta = typeOrder[a.type] ?? 9;
    const tb = typeOrder[b.type] ?? 9;
    if (ta !== tb) return ta - tb;
    return (a.displayName || '').localeCompare(b.displayName || '');
  });

  return normalized;
}

/**
 * List members of a space.
 * Returns raw member objects with nested user info.
 */
export async function listMembers(accessToken, spaceName) {
  const members = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({ pageSize: '100' });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${CHAT_API}/${spaceName}/members?${params}`, {
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Chat API members error ${res.status}: ${err}`);
    }
    const data = await res.json();
    if (data.memberships) members.push(...data.memberships);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  return members;
}

/**
 * List messages in a space (newest first).
 * Returns { messages: [...normalized], nextPageToken }.
 */
export async function listMessages(accessToken, spaceName, userEmail, pageSize = 25, pageToken = null) {
  const params = new URLSearchParams({
    pageSize: String(pageSize),
    orderBy: 'createTime desc',
  });
  if (pageToken) params.set('pageToken', pageToken);

  const res = await fetch(`${CHAT_API}/${spaceName}/messages?${params}`, {
    headers: authHeaders(accessToken),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chat API messages error ${res.status}: ${err}`);
  }
  const data = await res.json();

  const messages = (data.messages || []).map((m) => normalizeMessage(m, userEmail));
  // API returns newest first; reverse so oldest is at top for display
  messages.reverse();

  return {
    messages,
    nextPageToken: data.nextPageToken || null,
  };
}

/**
 * Send a text message to a space.
 * Returns the normalized created message.
 */
export async function sendMessage(accessToken, spaceName, text, userEmail) {
  const res = await fetch(`${CHAT_API}/${spaceName}/messages`, {
    method: 'POST',
    headers: {
      ...authHeaders(accessToken),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Chat API send error ${res.status}: ${err}`);
  }
  const msg = await res.json();
  return normalizeMessage(msg, userEmail);
}

/**
 * Find a direct message space with a specific user.
 * Returns the normalized space object or null if no DM exists.
 */
export async function findDirectMessage(accessToken, userResourceName) {
  try {
    const params = new URLSearchParams({ name: userResourceName });
    const res = await fetch(`${CHAT_API}/spaces:findDirectMessage?${params}`, {
      headers: authHeaders(accessToken),
    });
    if (!res.ok) return null;
    const space = await res.json();
    return space?.name ? space : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Google Workspace Directory
// ---------------------------------------------------------------------------

const PEOPLE_API = 'https://people.googleapis.com/v1';

/**
 * List all people in the Google Workspace domain directory.
 * Returns [{ name, email, photoUrl }] for each domain user.
 * Requires scope: directory.readonly
 */
export async function listDirectoryPeople(accessToken) {
  const people = [];
  let pageToken = null;

  do {
    const params = new URLSearchParams({
      readMask: 'names,emailAddresses,photos',
      sources: 'DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE',
      pageSize: '200',
    });
    if (pageToken) params.set('pageToken', pageToken);

    const res = await fetch(`${PEOPLE_API}/people:listDirectoryPeople?${params}`, {
      headers: authHeaders(accessToken),
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`People API directory error ${res.status}: ${err}`);
    }
    const data = await res.json();
    if (data.people) people.push(...data.people);
    pageToken = data.nextPageToken || null;
  } while (pageToken);

  // Normalize to simple objects
  return people
    .map((p) => {
      const nameObj = (p.names || [])[0] || {};
      const emailObj = (p.emailAddresses || [])[0] || {};
      const photoObj = (p.photos || [])[0] || {};
      return {
        name: nameObj.displayName || emailObj.value || 'Unknown',
        email: emailObj.value || '',
        photoUrl: photoObj.url || null,
      };
    })
    .filter((p) => p.email) // Only include entries with an email
    .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
}
