// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Upcoming Detail Modal
// Click-through detail view for Team Upcoming items
// with notes, documents, audit log, and navigation
// ═══════════════════════════════════════════════

import { useState, useRef } from 'react';
import useUiStore from '../stores/uiStore';

const mono = { fontFamily: "'Space Mono', monospace" };

const CATEGORY_CONFIG = {
  distributions: { label: 'Distributions', color: 'var(--grn)', bg: 'var(--grnM)', route: '/pe/distributions' },
  compliance:    { label: 'Compliance',    color: 'var(--ylw)', bg: 'var(--ylwM)', route: '/pe/compliance' },
  operations:    { label: 'Operations',    color: 'var(--blu)', bg: 'var(--bluM)', route: '/pe' },
  reporting:     { label: 'Reporting',     color: '#a78bfa',    bg: 'rgba(167,139,250,0.08)', route: '/pe' },
};

function formatTimestamp(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now - d;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatFileSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const AUDIT_ICONS = {
  edit: '✏️',
  note: '📝',
  upload: '📎',
  remove_doc: '🗑️',
};

export default function UpcomingDetailModal({ item, onClose }) {
  const updateUpcomingItem = useUiStore((s) => s.updateUpcomingItem);
  const addUpcomingNote = useUiStore((s) => s.addUpcomingNote);
  const addUpcomingDocument = useUiStore((s) => s.addUpcomingDocument);
  const removeUpcomingDocument = useUiStore((s) => s.removeUpcomingDocument);
  const upcomingAuditLog = useUiStore((s) => s.upcomingAuditLog);

  // Re-read the item from store to get latest data
  const liveItem = useUiStore((s) => s.upcomingDates.find((d) => d.id === item?.id)) || item;

  const [activeTab, setActiveTab] = useState('notes');
  const [noteText, setNoteText] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [editingDesc, setEditingDesc] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [dateDraft, setDateDraft] = useState('');
  const [descDraft, setDescDraft] = useState('');
  const fileInputRef = useRef(null);

  if (!liveItem) return null;

  const catConfig = CATEGORY_CONFIG[liveItem.category] || CATEGORY_CONFIG.operations;
  const itemAuditLog = upcomingAuditLog.filter((e) => e.itemId === liveItem.id);
  const notes = liveItem.notes || [];
  const documents = liveItem.documents || [];

  // ── Navigation ──────────────────────────────────────────────────────
  const navigateToPage = () => {
    const link = liveItem.link || catConfig.route;
    if (link) {
      onClose();
      window.history.pushState({}, '', link);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  };

  // ── Inline edit handlers ───────────────────────────────────────────
  const startEditTitle = () => {
    setTitleDraft(liveItem.title);
    setEditingTitle(true);
  };
  const saveTitle = () => {
    if (titleDraft.trim() && titleDraft.trim() !== liveItem.title) {
      updateUpcomingItem(liveItem.id, { title: titleDraft.trim() });
    }
    setEditingTitle(false);
  };

  const startEditDate = () => {
    setDateDraft(liveItem.date);
    setEditingDate(true);
  };
  const saveDate = () => {
    if (dateDraft.trim() && dateDraft.trim() !== liveItem.date) {
      updateUpcomingItem(liveItem.id, { date: dateDraft.trim() });
    }
    setEditingDate(false);
  };

  const startEditDesc = () => {
    setDescDraft(liveItem.description || '');
    setEditingDesc(true);
  };
  const saveDesc = () => {
    if (descDraft.trim() !== (liveItem.description || '')) {
      updateUpcomingItem(liveItem.id, { description: descDraft.trim() });
    }
    setEditingDesc(false);
  };

  // ── Notes ──────────────────────────────────────────────────────────
  const handleAddNote = () => {
    if (!noteText.trim()) return;
    addUpcomingNote(liveItem.id, noteText.trim());
    setNoteText('');
  };

  // ── Documents ─────────────────────────────────────────────────────
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      alert('File size must be under 2 MB');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      addUpcomingDocument(liveItem.id, {
        name: file.name,
        size: file.size,
        type: file.type,
        content: reader.result,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDownloadDoc = (doc) => {
    if (!doc.content) return;
    const a = document.createElement('a');
    a.href = doc.content;
    a.download = doc.name;
    a.click();
  };

  const tabs = [
    { key: 'notes', label: 'Notes', count: notes.length },
    { key: 'documents', label: 'Documents', count: documents.length },
    { key: 'audit', label: 'Audit Log', count: itemAuditLog.length },
  ];

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.6)',
          zIndex: 500,
        }}
      />

      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: 580,
          maxWidth: '94vw',
          maxHeight: '90vh',
          background: 'var(--bg1)',
          border: '1px solid var(--bd)',
          borderRadius: 12,
          zIndex: 501,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* ── Header ────────────────────────────────────────── */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid var(--bd)',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}
        >
          <div style={{ flex: 1 }}>
            {/* Category badge */}
            <span
              style={{
                ...mono,
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                padding: '3px 8px',
                borderRadius: 4,
                background: catConfig.bg,
                color: catConfig.color,
                display: 'inline-block',
                marginBottom: 8,
              }}
            >
              {catConfig.label}
            </span>

            {/* Title */}
            {editingTitle ? (
              <input
                autoFocus
                type="text"
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => e.key === 'Enter' && saveTitle()}
                style={{
                  ...mono,
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--t1)',
                  background: 'var(--bg2)',
                  border: '1px solid var(--grn)',
                  borderRadius: 4,
                  padding: '4px 8px',
                  width: '100%',
                  outline: 'none',
                }}
              />
            ) : (
              <div
                onClick={startEditTitle}
                style={{
                  ...mono,
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--t1)',
                  cursor: 'pointer',
                  padding: '2px 0',
                }}
                title="Click to edit title"
              >
                {liveItem.title}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, marginTop: 4 }}>
            {/* Go to page button */}
            <button
              onClick={navigateToPage}
              style={{
                ...mono,
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
                color: catConfig.color,
                background: catConfig.bg,
                border: `1px solid ${catConfig.color}`,
                borderRadius: 4,
                padding: '5px 10px',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              Go to {catConfig.label}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--t4)',
                fontSize: 22,
                cursor: 'pointer',
                lineHeight: 1,
                padding: 0,
              }}
            >
              &times;
            </button>
          </div>
        </div>

        {/* ── Summary Bar ──────────────────────────────────── */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--bd)',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            background: 'var(--bgM3)',
          }}
        >
          {/* Due date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'var(--t4)' }}>
              <path d="M19 3h-1V2c0-.55-.45-1-1-1s-1 .45-1 1v1H8V2c0-.55-.45-1-1-1s-1 .45-1 1v1H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z" />
            </svg>
            {editingDate ? (
              <input
                autoFocus
                type="text"
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                onBlur={saveDate}
                onKeyDown={(e) => e.key === 'Enter' && saveDate()}
                style={{
                  ...mono,
                  fontSize: 11,
                  color: 'var(--t1)',
                  background: 'var(--bg2)',
                  border: '1px solid var(--grn)',
                  borderRadius: 3,
                  padding: '2px 6px',
                  width: 110,
                  outline: 'none',
                }}
              />
            ) : (
              <span
                onClick={startEditDate}
                className="mono"
                style={{
                  fontSize: 11,
                  color: 'var(--t2)',
                  cursor: 'pointer',
                  borderBottom: '1px dashed var(--t5)',
                  paddingBottom: 1,
                }}
                title="Click to edit date"
              >
                {liveItem.date}
              </span>
            )}
          </div>

          {/* Badge */}
          <span className={`badge ${liveItem.badgeClass}`}>{liveItem.badgeText}</span>

          {/* Assignees */}
          {liveItem.primary && (
            <span
              className="mono"
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: 3,
                background: 'var(--bluM)',
                color: 'var(--blu)',
              }}
            >
              {liveItem.primary.split('@')[0]}
            </span>
          )}
          {liveItem.secondary && (
            <span
              className="mono"
              style={{
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                padding: '2px 6px',
                borderRadius: 3,
                background: 'var(--bgM)',
                color: 'var(--t4)',
              }}
            >
              {liveItem.secondary.split('@')[0]}
            </span>
          )}
        </div>

        {/* ── Scrollable body ──────────────────────────────── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 24px 24px' }}>
          {/* Description */}
          <div style={{ padding: '16px 0', borderBottom: '1px solid var(--bd)' }}>
            <div
              style={{
                ...mono,
                fontSize: 9,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
                color: 'var(--t4)',
                marginBottom: 8,
              }}
            >
              Description
            </div>
            {editingDesc ? (
              <textarea
                autoFocus
                value={descDraft}
                onChange={(e) => setDescDraft(e.target.value)}
                onBlur={saveDesc}
                rows={3}
                style={{
                  ...mono,
                  fontSize: 12,
                  color: 'var(--t2)',
                  background: 'var(--bg2)',
                  border: '1px solid var(--grn)',
                  borderRadius: 4,
                  padding: '8px 10px',
                  width: '100%',
                  resize: 'vertical',
                  outline: 'none',
                  lineHeight: 1.5,
                }}
              />
            ) : (
              <div
                onClick={startEditDesc}
                style={{
                  ...mono,
                  fontSize: 12,
                  color: liveItem.description ? 'var(--t2)' : 'var(--t5)',
                  lineHeight: 1.5,
                  cursor: 'pointer',
                  padding: '4px 0',
                }}
                title="Click to edit description"
              >
                {liveItem.description || 'Click to add a description...'}
              </div>
            )}
          </div>

          {/* ── Tab bar ───────────────────────────────────── */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              borderBottom: '1px solid var(--bd)',
              marginTop: 4,
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                style={{
                  ...mono,
                  fontSize: 10,
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  padding: '10px 16px',
                  background: 'none',
                  border: 'none',
                  borderBottom: activeTab === tab.key ? '2px solid var(--grn)' : '2px solid transparent',
                  color: activeTab === tab.key ? 'var(--t1)' : 'var(--t4)',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    style={{
                      ...mono,
                      fontSize: 8,
                      fontWeight: 700,
                      padding: '1px 5px',
                      borderRadius: 8,
                      background: activeTab === tab.key ? 'var(--grnM)' : 'var(--bgM)',
                      color: activeTab === tab.key ? 'var(--grn)' : 'var(--t5)',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* ── Tab content ────────────────────────────────── */}
          <div style={{ paddingTop: 16, minHeight: 160 }}>
            {/* Notes Tab */}
            {activeTab === 'notes' && (
              <div>
                {/* Add note */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                  <input
                    type="text"
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                    placeholder="Add a note..."
                    style={{
                      ...mono,
                      flex: 1,
                      fontSize: 12,
                      color: 'var(--t1)',
                      background: 'var(--bg2)',
                      border: '1px solid var(--bd)',
                      borderRadius: 4,
                      padding: '8px 12px',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={handleAddNote}
                    disabled={!noteText.trim()}
                    style={{
                      ...mono,
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      padding: '8px 14px',
                      borderRadius: 4,
                      border: 'none',
                      background: noteText.trim() ? 'var(--grn)' : 'var(--bgM)',
                      color: noteText.trim() ? '#fff' : 'var(--t5)',
                      cursor: noteText.trim() ? 'pointer' : 'default',
                      transition: 'all 0.15s',
                    }}
                  >
                    Add
                  </button>
                </div>

                {/* Notes list */}
                {notes.length === 0 ? (
                  <div style={{ ...mono, fontSize: 11, color: 'var(--t5)', textAlign: 'center', padding: '24px 0' }}>
                    No notes yet
                  </div>
                ) : (
                  [...notes].reverse().map((note) => (
                    <div
                      key={note.id}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--bgM3)',
                        borderRadius: 6,
                        marginBottom: 8,
                        borderLeft: '3px solid var(--grn)',
                      }}
                    >
                      <div style={{ ...mono, fontSize: 12, color: 'var(--t2)', lineHeight: 1.5, marginBottom: 6 }}>
                        {note.text}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ ...mono, fontSize: 9, color: 'var(--t5)', textTransform: 'uppercase' }}>
                          {note.user?.split('@')[0] || 'Unknown'}
                        </span>
                        <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>
                          {formatTimestamp(note.timestamp)}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              <div>
                {/* Upload button */}
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileUpload}
                  style={{ display: 'none' }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    ...mono,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    padding: '8px 14px',
                    borderRadius: 4,
                    border: '1px dashed var(--bd)',
                    background: 'var(--bgM3)',
                    color: 'var(--t3)',
                    cursor: 'pointer',
                    width: '100%',
                    marginBottom: 16,
                    transition: 'all 0.15s',
                  }}
                >
                  + Upload Document (max 2 MB)
                </button>

                {/* Document list */}
                {documents.length === 0 ? (
                  <div style={{ ...mono, fontSize: 11, color: 'var(--t5)', textAlign: 'center', padding: '24px 0' }}>
                    No documents attached
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 12px',
                        background: 'var(--bgM3)',
                        borderRadius: 6,
                        marginBottom: 8,
                      }}
                    >
                      {/* File icon */}
                      <svg viewBox="0 0 24 24" style={{ width: 18, height: 18, fill: 'var(--t4)', flexShrink: 0 }}>
                        <path d="M14 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V8l-6-6zM6 20V4h7v5h5v11H6z" />
                      </svg>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          onClick={() => handleDownloadDoc(doc)}
                          style={{
                            ...mono,
                            fontSize: 12,
                            color: 'var(--blu)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                          title={`Download ${doc.name}`}
                        >
                          {doc.name}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                          <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>
                            {formatFileSize(doc.size)}
                          </span>
                          <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>
                            {doc.uploadedBy?.split('@')[0] || ''}
                          </span>
                          <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>
                            {formatTimestamp(doc.uploadedAt)}
                          </span>
                        </div>
                      </div>
                      {/* Remove button */}
                      <button
                        onClick={() => removeUpcomingDocument(liveItem.id, doc.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--t5)',
                          fontSize: 16,
                          cursor: 'pointer',
                          padding: '0 4px',
                          lineHeight: 1,
                          flexShrink: 0,
                        }}
                        title="Remove document"
                      >
                        &times;
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Audit Log Tab */}
            {activeTab === 'audit' && (
              <div>
                {itemAuditLog.length === 0 ? (
                  <div style={{ ...mono, fontSize: 11, color: 'var(--t5)', textAlign: 'center', padding: '24px 0' }}>
                    No activity recorded yet
                  </div>
                ) : (
                  itemAuditLog.map((entry) => (
                    <div
                      key={entry.id}
                      style={{
                        display: 'flex',
                        gap: 10,
                        padding: '8px 0',
                        borderBottom: '1px solid var(--bgM)',
                      }}
                    >
                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                        {AUDIT_ICONS[entry.action] || '📋'}
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ ...mono, fontSize: 11, color: 'var(--t2)', lineHeight: 1.4 }}>
                          {entry.detail}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 3 }}>
                          <span style={{ ...mono, fontSize: 9, color: 'var(--t5)', textTransform: 'uppercase' }}>
                            {entry.user?.split('@')[0] || 'system'}
                          </span>
                          <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>
                            {formatTimestamp(entry.timestamp)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ────────────────────────────────────────── */}
        <div
          style={{
            padding: '10px 24px',
            borderTop: '1px solid var(--bd)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>
            ID: {liveItem.id}
          </span>
          <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>
            {itemAuditLog.length > 0
              ? `Last updated: ${formatTimestamp(itemAuditLog[0]?.timestamp)}`
              : 'No changes'}
          </span>
        </div>
      </div>
    </>
  );
}
