// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Chat Panel
// Slide-out Google Chat panel (spaces + messages)
// ═══════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from 'react';
import useChatStore from '../stores/chatStore';
import useGoogleStore from '../stores/googleStore';
import { listSpaces, listMessages, sendMessage, findDirectMessage, listDirectoryPeople } from '../services/chatService';
import useResponsive from '../hooks/useResponsive';

const mono = { fontFamily: "'Space Mono', monospace" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function timeAgo(ts) {
  if (!ts) return '';
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  return new Date(ts).toLocaleDateString();
}

function fmtTime(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  if (sameDay) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  return (
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  );
}

// Avatar colors by first letter
const AVATAR_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
];

function avatarColor(name) {
  const code = (name || 'X').charCodeAt(0);
  return AVATAR_COLORS[code % AVATAR_COLORS.length];
}

// Type badge labels
const TYPE_LABELS = { DM: 'DM', GROUP: 'Group', SPACE: 'Space' };


// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function PanelHeader({ title, showBack, onBack, onClose }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px',
        borderBottom: '1px solid var(--bd)',
        minHeight: 48,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {showBack && (
          <button
            onClick={onBack}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--t3)',
              cursor: 'pointer',
              fontSize: 16,
              padding: '0 4px',
              ...mono,
            }}
            title="Back to spaces"
          >
            ←
          </button>
        )}
        <span
          style={{
            ...mono,
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
            color: 'var(--t4)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: 240,
          }}
        >
          {title}
        </span>
      </div>
      <button
        onClick={onClose}
        style={{
          background: 'none',
          border: 'none',
          color: 'var(--t4)',
          cursor: 'pointer',
          fontSize: 18,
          padding: '0 4px',
          lineHeight: 1,
        }}
        title="Close chat"
      >
        ×
      </button>
    </div>
  );
}

function SpaceItem({ space, isUnread, onClick, hovered, onHover, onLeave }) {
  const initial = (space.displayName || '?')[0].toUpperCase();
  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        display: 'flex',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--bgM3)',
        cursor: 'pointer',
        background: hovered ? 'rgba(52,211,153,0.04)' : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: '50%',
          background: avatarColor(space.displayName),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          color: '#fff',
          fontSize: 14,
          fontWeight: 700,
          ...mono,
        }}
      >
        {initial}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
          <span
            style={{
              ...mono,
              fontSize: 12,
              color: 'var(--t1)',
              fontWeight: isUnread ? 700 : 400,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              flex: 1,
            }}
          >
            {space.displayName}
          </span>
          <span
            style={{
              ...mono,
              fontSize: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              color: 'var(--t5)',
              border: '1px solid var(--bd)',
              borderRadius: 3,
              padding: '1px 4px',
              flexShrink: 0,
            }}
          >
            {TYPE_LABELS[space.type] || space.type}
          </span>
        </div>
        {space.lastMessageTime && (
          <span style={{ ...mono, fontSize: 10, color: 'var(--t5)' }}>
            {timeAgo(space.lastMessageTime)}
          </span>
        )}
      </div>

      {/* Unread dot */}
      {isUnread && (
        <div
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--grn)',
            flexShrink: 0,
            alignSelf: 'center',
          }}
        />
      )}
    </div>
  );
}

function TeamContactItem({ member, onClick, hovered, onHover, onLeave, isSelf, loading }) {
  const initial = (member.name || '?')[0].toUpperCase();
  return (
    <div
      onClick={isSelf ? undefined : onClick}
      onMouseEnter={onHover}
      onMouseLeave={onLeave}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 16px',
        cursor: isSelf ? 'default' : 'pointer',
        background: hovered && !isSelf ? 'rgba(52,211,153,0.04)' : 'transparent',
        transition: 'background 0.1s',
        opacity: isSelf ? 0.5 : 1,
      }}
    >
      {/* Avatar — use Google photo if available */}
      {member.photoUrl ? (
        <img
          src={member.photoUrl}
          alt={member.name}
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            flexShrink: 0,
            objectFit: 'cover',
          }}
        />
      ) : (
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: avatarColor(member.name),
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: '#fff',
            fontSize: 12,
            fontWeight: 700,
            ...mono,
          }}
        >
          {initial}
        </div>
      )}
      <span
        style={{
          ...mono,
          fontSize: 12,
          color: 'var(--t1)',
          flex: 1,
        }}
      >
        {member.name}{isSelf ? ' (you)' : ''}
      </span>
      {loading && (
        <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>…</span>
      )}
    </div>
  );
}

function MessageBubble({ msg }) {
  return (
    <div
      style={{
        padding: '10px 12px',
        marginBottom: 6,
        background: msg.isOwn ? 'rgba(52,211,153,0.04)' : 'var(--bgI)',
        borderRadius: 5,
        borderLeft: `2px solid ${msg.isOwn ? 'var(--grn)' : 'var(--blu)'}`,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: 4,
        }}
      >
        <span
          style={{
            ...mono,
            fontSize: 10,
            fontWeight: 700,
            color: msg.isOwn ? 'var(--grn)' : 'var(--blu)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          {msg.isOwn ? 'You' : msg.senderName}
        </span>
        <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>
          {fmtTime(msg.timestamp)}
        </span>
      </div>
      <div
        style={{
          ...mono,
          fontSize: 12,
          color: 'var(--t2)',
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {msg.text}
      </div>
    </div>
  );
}

function ComposeBar({ value, onChange, onSend, sending, disabled }) {
  const handleKeyDown = (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div
      style={{
        padding: '10px 12px',
        borderTop: '1px solid var(--bd)',
        display: 'flex',
        gap: 8,
        alignItems: 'flex-end',
      }}
    >
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a message…"
        disabled={disabled || sending}
        rows={1}
        style={{
          flex: 1,
          boxSizing: 'border-box',
          ...mono,
          fontSize: 12,
          background: 'var(--bg0)',
          border: '1px solid var(--bd)',
          borderRadius: 4,
          padding: '8px 10px',
          color: 'var(--t1)',
          outline: 'none',
          resize: 'none',
          minHeight: 38,
          maxHeight: 120,
          lineHeight: 1.5,
        }}
      />
      <button
        onClick={onSend}
        disabled={disabled || sending || !value.trim()}
        style={{
          ...mono,
          fontSize: 10,
          fontWeight: 700,
          padding: '8px 14px',
          border: '1px solid rgba(52,211,153,0.3)',
          background: value.trim() ? 'rgba(52,211,153,0.12)' : 'transparent',
          color: value.trim() ? 'var(--grn)' : 'var(--t5)',
          borderRadius: 4,
          cursor: value.trim() ? 'pointer' : 'default',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          whiteSpace: 'nowrap',
        }}
      >
        {sending ? '…' : 'Send'}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function ChatPanel() {
  const { isMobile } = useResponsive();

  // Store selectors
  const panelOpen = useChatStore((s) => s.panelOpen);
  const spaces = useChatStore((s) => s.spaces);
  const spacesLoading = useChatStore((s) => s.spacesLoading);
  const spacesFetchedAt = useChatStore((s) => s.spacesFetchedAt);
  const selectedSpaceId = useChatStore((s) => s.selectedSpaceId);
  const messages = useChatStore((s) => s.messages);
  const messagesLoading = useChatStore((s) => s.messagesLoading);
  const nextPageToken = useChatStore((s) => s.nextPageToken);
  const composeText = useChatStore((s) => s.composeText);
  const sending = useChatStore((s) => s.sending);

  const directoryPeople = useChatStore((s) => s.directoryPeople);
  const directoryFetchedAt = useChatStore((s) => s.directoryFetchedAt);

  const accessToken = useGoogleStore((s) => s.accessToken);
  const userEmail = useGoogleStore((s) => s.userEmail);

  // Local UI state
  const [searchFilter, setSearchFilter] = useState('');
  const [hoveredSpace, setHoveredSpace] = useState(null);
  const [hoveredContact, setHoveredContact] = useState(null);
  const [contactLoading, setContactLoading] = useState(null); // email of contact being looked up
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);

  // Selected space info
  const selectedSpace = spaces.find((s) => s.id === selectedSpaceId);

  // ── Fetch spaces when panel opens ───────────────────────────────────────
  const fetchSpaces = useCallback(async () => {
    if (!accessToken) return;
    useChatStore.getState().setSpacesLoading(true);
    try {
      const result = await listSpaces(accessToken, userEmail);
      useChatStore.getState().setSpaces(result);
    } catch (err) {
      console.error('Chat: failed to load spaces', err);
      useChatStore.getState().setSpacesLoading(false);
    }
  }, [accessToken, userEmail]);

  useEffect(() => {
    if (!panelOpen || !accessToken) return;
    // Fetch if stale (>5 min) or never fetched
    const stale = !spacesFetchedAt || Date.now() - spacesFetchedAt > 5 * 60 * 1000;
    if (stale) fetchSpaces();
  }, [panelOpen, accessToken, fetchSpaces, spacesFetchedAt]);

  // ── Fetch directory people when panel opens ─────────────────────────────
  useEffect(() => {
    if (!panelOpen || !accessToken) return;
    const stale = !directoryFetchedAt || Date.now() - directoryFetchedAt > 30 * 60 * 1000; // 30-min TTL
    if (stale && directoryPeople.length === 0) {
      useChatStore.getState().setDirectoryLoading(true);
      listDirectoryPeople(accessToken)
        .then((people) => useChatStore.getState().setDirectoryPeople(people))
        .catch((err) => {
          console.error('Chat: failed to load directory', err);
          useChatStore.getState().setDirectoryLoading(false);
        });
    }
  }, [panelOpen, accessToken, directoryFetchedAt, directoryPeople.length]);

  // ── Poll spaces every 60s while panel is open ──────────────────────────
  useEffect(() => {
    if (!panelOpen || !accessToken) return;
    const poll = setInterval(fetchSpaces, 60000);
    return () => clearInterval(poll);
  }, [panelOpen, accessToken, fetchSpaces]);

  // ── Fetch messages when space is selected ──────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!accessToken || !selectedSpaceId) return;
    useChatStore.getState().setMessagesLoading(true);
    try {
      const result = await listMessages(accessToken, selectedSpaceId, userEmail);
      useChatStore.getState().setMessages(result.messages, result.nextPageToken);
      // Mark as read
      useChatStore.getState().markSpaceRead(selectedSpaceId);
    } catch (err) {
      console.error('Chat: failed to load messages', err);
      useChatStore.getState().setMessagesLoading(false);
    }
  }, [accessToken, selectedSpaceId, userEmail]);

  useEffect(() => {
    if (panelOpen && selectedSpaceId) fetchMessages();
  }, [panelOpen, selectedSpaceId, fetchMessages]);

  // ── Poll messages every 15s while in conversation ─────────────────────
  useEffect(() => {
    if (!panelOpen || !selectedSpaceId || !accessToken) return;
    const poll = setInterval(async () => {
      try {
        const result = await listMessages(accessToken, selectedSpaceId, userEmail, 10);
        const existing = new Set(useChatStore.getState().messages.map((m) => m.id));
        const newMsgs = result.messages.filter((m) => !existing.has(m.id));
        if (newMsgs.length > 0) {
          newMsgs.forEach((msg) => useChatStore.getState().appendMessage(msg));
          useChatStore.getState().markSpaceRead(selectedSpaceId);
        }
      } catch {
        // Silent fail on poll
      }
    }, 15000);
    return () => clearInterval(poll);
  }, [panelOpen, selectedSpaceId, accessToken, userEmail]);

  // ── Auto-scroll to bottom on new messages ─────────────────────────────
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages.length]);

  // ── Load older messages ───────────────────────────────────────────────
  const loadOlder = async () => {
    if (!nextPageToken || !accessToken || !selectedSpaceId) return;
    useChatStore.getState().setMessagesLoading(true);
    try {
      const result = await listMessages(
        accessToken,
        selectedSpaceId,
        userEmail,
        25,
        nextPageToken,
      );
      useChatStore.getState().prependMessages(result.messages, result.nextPageToken);
    } catch (err) {
      console.error('Chat: failed to load older messages', err);
      useChatStore.getState().setMessagesLoading(false);
    }
  };

  // ── Send message ──────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = composeText.trim();
    if (!text || !accessToken || !selectedSpaceId) return;
    useChatStore.getState().setSending(true);
    try {
      const sent = await sendMessage(accessToken, selectedSpaceId, text, userEmail);
      useChatStore.getState().appendMessage(sent);
      useChatStore.getState().setComposeText('');
      useChatStore.getState().markSpaceRead(selectedSpaceId);
    } catch (err) {
      console.error('Chat: failed to send message', err);
    } finally {
      useChatStore.getState().setSending(false);
    }
  };

  // ── Open DM with a team contact ─────────────────────────────────────
  const handleContactClick = async (member) => {
    if (!accessToken || member.email === userEmail) return;
    setContactLoading(member.email);
    try {
      // Try to find an existing DM space with this user
      // The Chat API uses `users/{email}` as the user resource name
      const dm = await findDirectMessage(accessToken, `users/${member.email}`);
      if (dm && dm.name) {
        useChatStore.getState().selectSpace(dm.name);
      } else {
        // No existing DM found — check if any loaded space matches this person
        const match = spaces.find(
          (s) =>
            s.type === 'DM' &&
            s.displayName &&
            s.displayName.toLowerCase().includes(member.name.toLowerCase()),
        );
        if (match) {
          useChatStore.getState().selectSpace(match.id);
        } else {
          console.log('Chat: No DM found with', member.name);
        }
      }
    } catch (err) {
      console.error('Chat: failed to find DM for', member.name, err);
    } finally {
      setContactLoading(null);
    }
  };

  // ── Filter spaces + contacts ────────────────────────────────────────
  const filteredSpaces = searchFilter
    ? spaces.filter((s) =>
        (s.displayName || '').toLowerCase().includes(searchFilter.toLowerCase()),
      )
    : spaces;

  const filteredTeam = searchFilter
    ? directoryPeople.filter((m) =>
        m.name.toLowerCase().includes(searchFilter.toLowerCase()),
      )
    : directoryPeople;

  // ── Don't render anything if panel is closed (keep lightweight) ──────
  // We still render the container for CSS transition
  if (!panelOpen) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: isMobile ? '100%' : 380,
          background: 'var(--bg1)',
          borderLeft: '1px solid var(--bdH)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          zIndex: 500,
          display: 'flex',
          flexDirection: 'column',
          transform: 'translateX(100%)',
          transition: 'transform 0.25s ease',
          pointerEvents: 'none',
        }}
      />
    );
  }

  return (
    <>
      {/* Backdrop (mobile) */}
      {isMobile && (
        <div
          onClick={() => useChatStore.getState().closePanel()}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            zIndex: 499,
          }}
        />
      )}

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: isMobile ? '100%' : 380,
          background: 'var(--bg1)',
          borderLeft: '1px solid var(--bdH)',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          zIndex: 500,
          display: 'flex',
          flexDirection: 'column',
          transform: 'translateX(0)',
          transition: 'transform 0.25s ease',
        }}
      >
        {/* Header */}
        <PanelHeader
          title={selectedSpace ? selectedSpace.displayName : 'Chat'}
          showBack={!!selectedSpace}
          onBack={() => useChatStore.getState().selectSpace(null)}
          onClose={() => useChatStore.getState().closePanel()}
        />

        {/* ═══ SPACE LIST VIEW ═══ */}
        {!selectedSpaceId && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Search */}
            <div style={{ padding: '10px 16px' }}>
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filter conversations…"
                style={{
                  width: '100%',
                  boxSizing: 'border-box',
                  ...mono,
                  fontSize: 11,
                  background: 'var(--bg0)',
                  border: '1px solid var(--bd)',
                  borderRadius: 4,
                  padding: '7px 10px',
                  color: 'var(--t1)',
                  outline: 'none',
                }}
              />
            </div>

            {/* Space list */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {/* ── Team Contacts ── */}
              {filteredTeam.length > 0 && accessToken && (
                <div>
                  <div
                    style={{
                      ...mono,
                      fontSize: 9,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: 'var(--t5)',
                      padding: '10px 16px 4px',
                    }}
                  >
                    Team
                  </div>
                  {filteredTeam.map((member) => (
                    <TeamContactItem
                      key={member.email}
                      member={member}
                      isSelf={userEmail && member.email.toLowerCase() === userEmail.toLowerCase()}
                      onClick={() => handleContactClick(member)}
                      hovered={hoveredContact === member.email}
                      onHover={() => setHoveredContact(member.email)}
                      onLeave={() => setHoveredContact(null)}
                      loading={contactLoading === member.email}
                    />
                  ))}
                  {/* Divider between team and conversations */}
                  {spaces.length > 0 && (
                    <div
                      style={{
                        ...mono,
                        fontSize: 9,
                        textTransform: 'uppercase',
                        letterSpacing: '0.15em',
                        color: 'var(--t5)',
                        padding: '12px 16px 4px',
                        borderTop: '1px solid var(--bd)',
                        marginTop: 4,
                      }}
                    >
                      Conversations
                    </div>
                  )}
                </div>
              )}

              {spacesLoading && spaces.length === 0 && (
                <div
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    ...mono,
                    fontSize: 11,
                    color: 'var(--t5)',
                  }}
                >
                  Loading conversations…
                </div>
              )}

              {!spacesLoading && spaces.length === 0 && !accessToken && (
                <div
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    ...mono,
                    fontSize: 11,
                    color: 'var(--t5)',
                  }}
                >
                  Sign in with Google to view chats
                </div>
              )}

              {!spacesLoading && spaces.length === 0 && accessToken && (
                <div
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    ...mono,
                    fontSize: 11,
                    color: 'var(--t5)',
                  }}
                >
                  No conversations found
                </div>
              )}

              {filteredSpaces.map((space) => (
                <SpaceItem
                  key={space.id}
                  space={space}
                  isUnread={useChatStore.getState().isSpaceUnread(space.id)}
                  onClick={() => useChatStore.getState().selectSpace(space.id)}
                  hovered={hoveredSpace === space.id}
                  onHover={() => setHoveredSpace(space.id)}
                  onLeave={() => setHoveredSpace(null)}
                />
              ))}

              {filteredSpaces.length === 0 && spaces.length > 0 && (
                <div
                  style={{
                    padding: '20px 16px',
                    textAlign: 'center',
                    ...mono,
                    fontSize: 11,
                    color: 'var(--t5)',
                  }}
                >
                  No matches for "{searchFilter}"
                </div>
              )}
            </div>

            {/* Refresh button */}
            {accessToken && (
              <div
                style={{
                  padding: '8px 16px',
                  borderTop: '1px solid var(--bd)',
                  textAlign: 'center',
                }}
              >
                <button
                  onClick={fetchSpaces}
                  disabled={spacesLoading}
                  style={{
                    ...mono,
                    fontSize: 9,
                    color: 'var(--t5)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    opacity: spacesLoading ? 0.5 : 1,
                  }}
                >
                  {spacesLoading ? 'Refreshing…' : '↻ Refresh'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══ CONVERSATION VIEW ═══ */}
        {selectedSpaceId && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {/* Messages area */}
            <div
              ref={messagesContainerRef}
              style={{
                flex: 1,
                overflowY: 'auto',
                padding: '12px 12px 4px',
              }}
            >
              {/* Load older */}
              {nextPageToken && (
                <div style={{ textAlign: 'center', marginBottom: 8 }}>
                  <button
                    onClick={loadOlder}
                    disabled={messagesLoading}
                    style={{
                      ...mono,
                      fontSize: 9,
                      color: 'var(--blu)',
                      background: 'none',
                      border: '1px solid rgba(59,130,246,0.3)',
                      borderRadius: 4,
                      padding: '4px 12px',
                      cursor: 'pointer',
                      textTransform: 'uppercase',
                      letterSpacing: '0.1em',
                      opacity: messagesLoading ? 0.5 : 1,
                    }}
                  >
                    {messagesLoading ? 'Loading…' : '↑ Load Older'}
                  </button>
                </div>
              )}

              {/* Loading state */}
              {messagesLoading && messages.length === 0 && (
                <div
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    ...mono,
                    fontSize: 11,
                    color: 'var(--t5)',
                  }}
                >
                  Loading messages…
                </div>
              )}

              {/* Empty state */}
              {!messagesLoading && messages.length === 0 && (
                <div
                  style={{
                    padding: '40px 16px',
                    textAlign: 'center',
                    ...mono,
                    fontSize: 11,
                    color: 'var(--t5)',
                  }}
                >
                  No messages yet — start the conversation!
                </div>
              )}

              {/* Messages */}
              {messages.map((msg) => (
                <MessageBubble key={msg.id} msg={msg} />
              ))}

              <div ref={messagesEndRef} />
            </div>

            {/* Compose */}
            <ComposeBar
              value={composeText}
              onChange={(text) => useChatStore.getState().setComposeText(text)}
              onSend={handleSend}
              sending={sending}
              disabled={!accessToken}
            />
          </div>
        )}
      </div>
    </>
  );
}
