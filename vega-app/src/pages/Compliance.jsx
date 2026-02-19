// =============================================
// VEGA MISSION CONTROL - Compliance Page
// Investor-grouped checklist view with full
// audit trail, notes, and resolution tracking
// =============================================

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useComplianceStore from '../stores/complianceStore'
import useUiStore from '../stores/uiStore'
import useBlueskyStore from '../stores/blueskyStore'
import BlueskyFilingModal from '../components/BlueskyFilingModal'

// ── Document type list ──────────────────────────────────────────────────────
const DOC_TYPES = [
  'Investor Questionnaire',
  'Partnership Agreement',
  'W-9',
  'Subscription Agreement',
  'Schedule A',
  'GP Signature',
  'General',
]

const DOC_TYPE_COLORS = {
  'Investor Questionnaire': 'var(--blu)',
  'Partnership Agreement': 'var(--ylw)',
  'W-9': 'var(--t3)',
  'Subscription Agreement': 'var(--grn)',
  'Schedule A': 'var(--red)',
  'GP Signature': '#c084fc',
  'General': 'var(--t4)',
}

// ═══════════════════════════════════════════════
// COMPLIANCE PAGE COMPONENT
// ═══════════════════════════════════════════════
export default function Compliance() {
  const navigate = useNavigate()

  // ── Stores ──────────────────────────────────
  const items = useComplianceStore((s) => s.items)
  const resolve = useComplianceStore((s) => s.resolve)
  const reopen = useComplianceStore((s) => s.reopen)
  const bulkResolve = useComplianceStore((s) => s.bulkResolve)
  const togglePriority = useComplianceStore((s) => s.togglePriority)
  const updateNotes = useComplianceStore((s) => s.updateNotes)
  const auditLog = useComplianceStore((s) => s.auditLog)
  const showToast = useUiStore((s) => s.showToast)

  // ── Bluesky Filings ──────────────────────────
  const blueskyFilings = useBlueskyStore((s) => s.filings)
  const pendingFilings = useMemo(() => blueskyFilings.filter((f) => f.status === 'Pending'), [blueskyFilings])
  const filedFilings = useMemo(() => blueskyFilings.filter((f) => f.status === 'Filed'), [blueskyFilings])
  const [blueskyModalFilingId, setBlueskyModalFilingId] = useState(null)
  const [expandedFilings, setExpandedFilings] = useState({})

  // ── Local state ─────────────────────────────
  const [search, setSearch] = useState('')
  const [docFilter, setDocFilter] = useState('All')
  const [statusFilter, setStatusFilter] = useState('Open')
  const [expandedInvestors, setExpandedInvestors] = useState({})
  const [resolveNotes, setResolveNotes] = useState({})
  const [showAuditFor, setShowAuditFor] = useState(null)
  const [confirmBulk, setConfirmBulk] = useState(null)
  const [noteErrors, setNoteErrors] = useState({}) // Track items missing required notes
  const [reopenNotes, setReopenNotes] = useState({}) // Notes when reopening
  const [showReopenInput, setShowReopenInput] = useState({}) // Toggle reopen note input
  const [bulkNote, setBulkNote] = useState('') // Note for bulk resolve

  // ── Derived stats ───────────────────────────
  const totalItems = items.length
  const openCount = useMemo(() => items.filter((i) => i.status === 'Open').length, [items])
  const resolvedCount = useMemo(() => items.filter((i) => i.status === 'Resolved').length, [items])

  // ── Doc type breakdown ──────────────────────
  const docTypeCounts = useMemo(() => {
    const counts = {}
    DOC_TYPES.forEach((dt) => {
      counts[dt] = items.filter((i) => i.doc === dt && i.status === 'Open').length
    })
    return counts
  }, [items])

  const maxDocCount = useMemo(
    () => Math.max(1, ...Object.values(docTypeCounts)),
    [docTypeCounts]
  )

  // ── Filtered items ──────────────────────────
  const filtered = useMemo(() => {
    let list = items
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter((i) => i.name.toLowerCase().includes(q))
    }
    if (docFilter !== 'All') {
      list = list.filter((i) => i.doc === docFilter)
    }
    if (statusFilter !== 'All') {
      list = list.filter((i) => i.status === statusFilter)
    }
    return list
  }, [items, search, docFilter, statusFilter])

  // ── Group by investor ───────────────────────
  const investorGroups = useMemo(() => {
    const groups = {}
    filtered.forEach((item) => {
      if (!groups[item.invId]) {
        groups[item.invId] = {
          invId: item.invId,
          name: item.name,
          entity: item.entity,
          fund: item.fund,
          items: [],
        }
      }
      groups[item.invId].items.push(item)
    })
    // Sort by open count descending so biggest issues first
    return Object.values(groups).sort((a, b) => {
      const aOpen = a.items.filter((i) => i.status === 'Open').length
      const bOpen = b.items.filter((i) => i.status === 'Open').length
      return bOpen - aOpen
    })
  }, [filtered])

  // ── Handlers ────────────────────────────────
  const handleResolve = (id) => {
    const notes = (resolveNotes[id] || '').trim()
    if (!notes) {
      // Notes are REQUIRED
      setNoteErrors((prev) => ({ ...prev, [id]: true }))
      showToast('Notes are required to resolve an item')
      return
    }
    setNoteErrors((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    resolve(id, 'j@vegarei.com', notes)
    setResolveNotes((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    showToast('Issue marked as resolved')
  }

  const handleReopen = (id) => {
    const notes = (reopenNotes[id] || '').trim()
    reopen(id, 'j@vegarei.com', notes || 'Reopened for further review')
    setReopenNotes((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setShowReopenInput((prev) => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    showToast('Issue reopened')
  }

  const handleBulkResolve = (invId) => {
    if (!bulkNote.trim()) {
      showToast('Notes are required for bulk resolve')
      return
    }
    bulkResolve(invId, 'j@vegarei.com', bulkNote.trim())
    setConfirmBulk(null)
    setBulkNote('')
    const inv = investorGroups.find((g) => g.invId === invId)
    showToast(`All open issues resolved for ${inv?.name || 'investor'}`)
  }

  const toggleInvestor = (invId) => {
    setExpandedInvestors((prev) => ({ ...prev, [invId]: !prev[invId] }))
  }

  // Get audit log for an investor
  const getInvestorAudit = (invId) => {
    return auditLog.filter((e) => e.invId === invId).sort((a, b) =>
      new Date(b.timestamp) - new Date(a.timestamp)
    )
  }

  const formatTimestamp = (ts) => {
    const d = new Date(ts)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  return (
    <div className="main">
      {/* ── Page Header ───────────────────────── */}
      <div className="page-header">
        <div className="page-header-dot"><span>Active Module</span></div>
        <h1 className="page-title">Compliance</h1>
        <p className="page-subtitle">Subscription Document Tracker</p>
      </div>

      {/* ── Stats Row ─────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Items', value: totalItems },
          { label: 'Open', value: openCount, color: openCount > 0 ? 'var(--ylw)' : 'var(--grn)' },
          { label: 'Resolved', value: resolvedCount, color: 'var(--grn)' },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              background: 'rgba(30,58,64,0.5)',
              border: '1px solid var(--bd)',
              borderRadius: 6,
              padding: '14px 18px',
            }}
          >
            <div
              className="mono"
              style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.15em',
                color: 'var(--t4)',
                marginBottom: 4,
              }}
            >
              {stat.label}
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 300,
                color: stat.color || 'var(--t1)',
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Bluesky Filings Section ──────────── */}
      {blueskyFilings.length > 0 && (
        <div
          style={{
            background: 'var(--bg-card-half)',
            border: '1px solid rgba(192,132,252,0.2)',
            borderRadius: 6,
            padding: 20,
            marginBottom: 24,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <span
              style={{
                width: 8,
                height: 8,
                background: '#c084fc',
                borderRadius: '50%',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span className="section-label">Blue Sky Filings</span>
            <span className="mono" style={{ fontSize: 10, color: 'var(--t5)', marginLeft: 'auto' }}>
              {pendingFilings.length} pending &middot; {filedFilings.length} filed
            </span>
          </div>

          {/* Pending filings */}
          {pendingFilings.length > 0 && (
            <div style={{ marginBottom: filedFilings.length > 0 ? 16 : 0 }}>
              <div className="mono" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--t4)', marginBottom: 8 }}>
                Pending
              </div>
              {pendingFilings.map((filing) => {
                const daysLeft = Math.ceil((new Date(filing.deadlineDate) - new Date()) / (1000 * 60 * 60 * 24))
                const urgencyColor = daysLeft < 0 ? 'var(--red)' : daysLeft <= 7 ? 'var(--ylw)' : 'var(--t4)'
                const isExpanded = expandedFilings[filing.id]

                return (
                  <div
                    key={filing.id}
                    style={{
                      background: 'rgba(30,58,64,0.5)',
                      border: `1px solid ${daysLeft < 0 ? 'var(--red)' : daysLeft <= 7 ? 'var(--ylwB)' : 'var(--bd)'}`,
                      borderRadius: 4,
                      marginBottom: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        cursor: 'pointer',
                      }}
                      onClick={() => setExpandedFilings((prev) => ({ ...prev, [filing.id]: !prev[filing.id] }))}
                    >
                      <span style={{ fontSize: 10, color: 'var(--t5)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)' }}>
                        &#9654;
                      </span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>
                          {filing.name}
                          <span className="mono" style={{ fontSize: 10, color: 'var(--t4)', marginLeft: 8 }}>
                            {filing.state} &middot; {filing.fund}
                          </span>
                        </div>
                      </div>
                      <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: urgencyColor }}>
                        {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft}d remaining`}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setBlueskyModalFilingId(filing.id)
                        }}
                        className="mono"
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '4px 12px',
                          border: '1px solid rgba(192,132,252,0.3)',
                          borderRadius: 3,
                          background: 'rgba(192,132,252,0.1)',
                          color: '#c084fc',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                        }}
                      >
                        Review
                      </button>
                    </div>

                    {/* Expanded: audit trail */}
                    {isExpanded && (
                      <div style={{ padding: '8px 14px 12px', borderTop: '1px solid var(--bd)' }}>
                        <div className="mono" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--t5)', marginBottom: 6 }}>
                          Trigger: {new Date(filing.triggerDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {' '}&middot; Deadline: {new Date(filing.deadlineDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </div>
                        {filing.auditLog.map((entry) => (
                          <div key={entry.id} style={{ padding: '4px 0', fontSize: 11, color: 'var(--t4)' }}>
                            <span className="mono" style={{ fontSize: 9, color: 'var(--t5)' }}>
                              {new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {' '}<span style={{ color: '#c084fc', fontWeight: 600 }}>{entry.action}</span> — {entry.detail}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {/* Filed filings */}
          {filedFilings.length > 0 && (
            <div>
              <div className="mono" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--t4)', marginBottom: 8 }}>
                Filed
              </div>
              {filedFilings.map((filing) => {
                const isExpanded = expandedFilings[filing.id]

                return (
                  <div
                    key={filing.id}
                    style={{
                      background: 'rgba(30,58,64,0.5)',
                      border: '1px solid var(--bd)',
                      borderRadius: 4,
                      marginBottom: 8,
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '10px 14px',
                        cursor: 'pointer',
                      }}
                      onClick={() => setExpandedFilings((prev) => ({ ...prev, [filing.id]: !prev[filing.id] }))}
                    >
                      <span style={{ fontSize: 10, color: 'var(--t5)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)' }}>
                        &#9654;
                      </span>
                      <span style={{ color: 'var(--grn)', fontSize: 14, fontWeight: 700 }}>&#10003;</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t3)' }}>
                          {filing.name}
                          <span className="mono" style={{ fontSize: 10, color: 'var(--t5)', marginLeft: 8 }}>
                            {filing.state} &middot; {filing.fund}
                          </span>
                        </div>
                      </div>
                      <span className="mono" style={{ fontSize: 10, color: 'var(--grn)' }}>
                        Filed {new Date(filing.filedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setBlueskyModalFilingId(filing.id)
                        }}
                        className="mono"
                        style={{
                          fontSize: 9,
                          fontWeight: 700,
                          padding: '4px 12px',
                          border: '1px solid var(--bd)',
                          borderRadius: 3,
                          background: 'transparent',
                          color: 'var(--t4)',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                        }}
                      >
                        View
                      </button>
                    </div>

                    {/* Expanded: resolution + audit trail */}
                    {isExpanded && (
                      <div style={{ padding: '8px 14px 12px', borderTop: '1px solid var(--bd)' }}>
                        {filing.notes && (
                          <div style={{
                            padding: '6px 10px',
                            background: 'rgba(52,211,153,0.04)',
                            borderLeft: '2px solid var(--grn)',
                            borderRadius: '0 4px 4px 0',
                            fontSize: 12,
                            color: 'var(--t4)',
                            fontStyle: 'italic',
                            marginBottom: 8,
                          }}>
                            {filing.notes}
                          </div>
                        )}
                        {filing.attachedEmails.length > 0 && (
                          <div style={{ marginBottom: 8 }}>
                            <div className="mono" style={{ fontSize: 9, color: 'var(--t5)', marginBottom: 4 }}>
                              ATTACHED EMAILS ({filing.attachedEmails.length})
                            </div>
                            {filing.attachedEmails.map((email) => (
                              <div key={email.messageId} style={{ fontSize: 11, color: 'var(--t4)', padding: '2px 0' }}>
                                {email.subject} — <span className="mono" style={{ fontSize: 9 }}>{email.from}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {filing.auditLog.map((entry) => (
                          <div key={entry.id} style={{ padding: '4px 0', fontSize: 11, color: 'var(--t4)' }}>
                            <span className="mono" style={{ fontSize: 9, color: 'var(--t5)' }}>
                              {new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {' '}<span style={{ color: entry.action === 'Filing Resolved' ? 'var(--grn)' : '#c084fc', fontWeight: 600 }}>{entry.action}</span> — {entry.detail}
                            {entry.notes && (
                              <div style={{ marginLeft: 16, fontSize: 10, color: 'var(--t5)', fontStyle: 'italic' }}>
                                {entry.notes}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Document Type Breakdown ───────────── */}
      <div
        style={{
          background: 'var(--bg-card-half)',
          border: '1px solid var(--bd)',
          borderRadius: 6,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span
            style={{
              width: 8,
              height: 8,
              background: 'var(--ylw)',
              borderRadius: '50%',
              display: 'inline-block',
              flexShrink: 0,
            }}
          />
          <span className="section-label">Open Issues by Document Type</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {DOC_TYPES.map((dt) => {
            const count = docTypeCounts[dt]
            const pct = (count / maxDocCount) * 100
            return (
              <div key={dt} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: 'var(--t3)',
                    width: 180,
                    flexShrink: 0,
                    textAlign: 'right',
                  }}
                >
                  {dt}
                </div>
                <div
                  style={{
                    flex: 1,
                    height: 20,
                    background: 'var(--bgI)',
                    borderRadius: 3,
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: `${pct}%`,
                      background: DOC_TYPE_COLORS[dt] || 'var(--t4)',
                      borderRadius: 3,
                      transition: 'width 0.3s ease',
                      minWidth: count > 0 ? 4 : 0,
                      opacity: 0.7,
                    }}
                  />
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: count > 0 ? 'var(--t1)' : 'var(--t5)',
                    width: 28,
                    textAlign: 'right',
                    flexShrink: 0,
                  }}
                >
                  {count}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Filter Bar ────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 20,
          flexWrap: 'wrap',
        }}
      >
        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg1)',
            border: '1px solid var(--bd)',
            borderRadius: 4,
            padding: '8px 14px',
            flex: '1 1 220px',
            maxWidth: 320,
          }}
        >
          <span style={{ color: 'var(--t5)', fontSize: 14 }}>{'\u2315'}</span>
          <input
            type="text"
            placeholder="Search by investor name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: 14,
              color: 'var(--t1)',
              fontFamily: 'inherit',
              width: '100%',
            }}
          />
        </div>

        {/* Doc Type Filter */}
        <select
          className="form-select"
          value={docFilter}
          onChange={(e) => setDocFilter(e.target.value)}
          style={{ minWidth: 180 }}
        >
          <option value="All">All Doc Types</option>
          {DOC_TYPES.map((dt) => (
            <option key={dt} value={dt}>{dt}</option>
          ))}
        </select>

        {/* Status Filter */}
        <select
          className="form-select"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{ minWidth: 120 }}
        >
          <option value="All">All Status</option>
          <option value="Open">Open</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      {/* ── Results Count ─────────────────────── */}
      <div
        className="mono"
        style={{ fontSize: 11, color: 'var(--t5)', marginBottom: 12 }}
      >
        {investorGroups.length} investor{investorGroups.length !== 1 ? 's' : ''} &middot; {filtered.length} issue{filtered.length !== 1 ? 's' : ''}
      </div>

      {/* ── Investor-Grouped Issue List ────────── */}
      {investorGroups.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 0',
            color: 'var(--t4)',
            fontSize: 14,
          }}
        >
          No compliance issues match filters
        </div>
      ) : (
        investorGroups.map((group) => {
          const openItems = group.items.filter((i) => i.status === 'Open')
          const resolvedItems = group.items.filter((i) => i.status === 'Resolved')
          const hasBlocking = openItems.some((i) => i.priority === 'blocking')
          const isExpanded = expandedInvestors[group.invId] !== false // default expanded
          const investorAudit = getInvestorAudit(group.invId)

          return (
            <div
              key={group.invId}
              style={{
                background: 'var(--bg-card-half)',
                border: `1px solid ${hasBlocking ? 'var(--red)' : openItems.length > 0 ? 'var(--ylwB)' : 'var(--bd)'}`,
                borderRadius: 6,
                marginBottom: 12,
                overflow: 'hidden',
              }}
            >
              {/* Investor Header */}
              <div
                onClick={() => toggleInvestor(group.invId)}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '14px 20px',
                  cursor: 'pointer',
                  borderBottom: isExpanded ? '1px solid var(--bd)' : 'none',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bgH)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontSize: 12, color: 'var(--t5)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0)' }}>
                    &#9654;
                  </span>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--t1)' }}>
                      {group.name}
                      {group.entity && (
                        <span style={{ color: 'var(--t4)', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
                          {group.entity}
                        </span>
                      )}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--t4)', marginTop: 2 }}>
                      {group.fund}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {openItems.length > 0 && (
                    <span className="badge badge-yellow">{openItems.length} open</span>
                  )}
                  {resolvedItems.length > 0 && (
                    <span className="badge badge-green">{resolvedItems.length} resolved</span>
                  )}
                  {hasBlocking && (
                    <span className="badge badge-red">Has Blocking</span>
                  )}
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div style={{ padding: '12px 20px 16px' }}>
                  {/* Checklist */}
                  {group.items.map((item) => {
                    const isOpen = item.status === 'Open'
                    const isBlocking = item.priority === 'blocking'
                    const hasNoteError = noteErrors[item.id]
                    const isReopening = showReopenInput[item.id]

                    return (
                      <div
                        key={item.id}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 12,
                          padding: '10px 0',
                          borderBottom: '1px solid rgba(52,92,99,0.3)',
                        }}
                      >
                        {/* Checkbox */}
                        <div
                          onClick={() => {
                            if (isOpen) {
                              handleResolve(item.id)
                            }
                            // For resolved items, don't auto-reopen on checkbox click
                          }}
                          style={{
                            width: 20,
                            height: 20,
                            borderRadius: 4,
                            border: `2px solid ${hasNoteError ? 'var(--red)' : isOpen ? 'var(--t5)' : 'var(--grn)'}`,
                            background: isOpen ? 'transparent' : 'var(--grnM)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: isOpen ? 'pointer' : 'default',
                            flexShrink: 0,
                            marginTop: 2,
                            transition: 'all 0.15s',
                          }}
                          title={isOpen ? 'Mark as resolved (notes required)' : 'Resolved'}
                        >
                          {!isOpen && (
                            <span style={{ color: 'var(--grn)', fontSize: 14, fontWeight: 700 }}>&#10003;</span>
                          )}
                        </div>

                        {/* Issue content */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <span
                              className="mono"
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                color: DOC_TYPE_COLORS[item.doc] || 'var(--t4)',
                                padding: '2px 6px',
                                borderRadius: 3,
                                background: `color-mix(in srgb, ${DOC_TYPE_COLORS[item.doc] || 'var(--t4)'} 15%, transparent)`,
                              }}
                            >
                              {item.doc}
                            </span>
                            {isBlocking && isOpen && (
                              <span className="badge badge-red" style={{ fontSize: 9, padding: '1px 6px' }}>Blocking</span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: 13,
                              color: isOpen ? 'var(--t2)' : 'var(--t5)',
                              lineHeight: 1.5,
                              textDecoration: isOpen ? 'none' : 'line-through',
                            }}
                          >
                            {item.issue}
                          </div>
                          {/* Resolved info with notes and reopen */}
                          {!isOpen && (
                            <div style={{ marginTop: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                {item.resolvedBy && (
                                  <span className="mono" style={{ fontSize: 10, color: 'var(--t5)' }}>
                                    Resolved by {item.resolvedBy}
                                    {item.resolvedDate && ` on ${new Date(item.resolvedDate).toLocaleDateString()}`}
                                  </span>
                                )}
                                <button
                                  onClick={() => setShowReopenInput((prev) => ({ ...prev, [item.id]: !prev[item.id] }))}
                                  className="mono"
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    border: '1px solid rgba(251,191,36,0.3)',
                                    borderRadius: 3,
                                    background: 'transparent',
                                    color: 'var(--ylw)',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                  }}
                                >
                                  Reopen
                                </button>
                              </div>
                              {item.notes && (
                                <div style={{
                                  marginTop: 4,
                                  padding: '4px 8px',
                                  background: 'rgba(52,211,153,0.04)',
                                  borderLeft: '2px solid var(--grn)',
                                  borderRadius: '0 4px 4px 0',
                                  fontSize: 12,
                                  color: 'var(--t4)',
                                  fontStyle: 'italic',
                                }}>
                                  {item.notes}
                                </div>
                              )}
                              {/* Reopen input */}
                              {isReopening && (
                                <div style={{ display: 'flex', gap: 8, marginTop: 6, alignItems: 'center' }}>
                                  <input
                                    type="text"
                                    placeholder="Reason for reopening (optional)..."
                                    value={reopenNotes[item.id] || ''}
                                    onChange={(e) => setReopenNotes((prev) => ({ ...prev, [item.id]: e.target.value }))}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') handleReopen(item.id)
                                    }}
                                    style={{
                                      background: 'var(--bg1)',
                                      border: '1px solid var(--ylwB)',
                                      borderRadius: 4,
                                      padding: '4px 8px',
                                      fontSize: 12,
                                      color: 'var(--t3)',
                                      fontFamily: 'inherit',
                                      flex: 1,
                                      maxWidth: 300,
                                      outline: 'none',
                                    }}
                                  />
                                  <button
                                    onClick={() => handleReopen(item.id)}
                                    className="mono"
                                    style={{
                                      fontSize: 9,
                                      fontWeight: 700,
                                      padding: '4px 10px',
                                      border: '1px solid var(--ylwB)',
                                      borderRadius: 3,
                                      background: 'var(--ylwM)',
                                      color: 'var(--ylw)',
                                      cursor: 'pointer',
                                      textTransform: 'uppercase',
                                    }}
                                  >
                                    Confirm Reopen
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                          {/* Notes input for open items — REQUIRED */}
                          {isOpen && (
                            <div style={{ marginTop: 6 }}>
                              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                                <input
                                  type="text"
                                  placeholder="Resolution note (required)..."
                                  value={resolveNotes[item.id] || ''}
                                  onChange={(e) => {
                                    setResolveNotes((prev) => ({ ...prev, [item.id]: e.target.value }))
                                    if (hasNoteError && e.target.value.trim()) {
                                      setNoteErrors((prev) => {
                                        const next = { ...prev }
                                        delete next[item.id]
                                        return next
                                      })
                                    }
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleResolve(item.id)
                                  }}
                                  style={{
                                    background: 'var(--bg1)',
                                    border: `1px solid ${hasNoteError ? 'var(--red)' : 'var(--bd)'}`,
                                    borderRadius: 4,
                                    padding: '4px 8px',
                                    fontSize: 12,
                                    color: 'var(--t3)',
                                    fontFamily: 'inherit',
                                    flex: 1,
                                    maxWidth: 350,
                                    outline: 'none',
                                  }}
                                />
                                <button
                                  onClick={() => handleResolve(item.id)}
                                  className="mono"
                                  style={{
                                    fontSize: 9,
                                    fontWeight: 700,
                                    padding: '4px 10px',
                                    border: '1px solid var(--grnB)',
                                    borderRadius: 3,
                                    background: (resolveNotes[item.id] || '').trim() ? 'var(--grnM)' : 'transparent',
                                    color: (resolveNotes[item.id] || '').trim() ? 'var(--grn)' : 'var(--t5)',
                                    cursor: 'pointer',
                                    textTransform: 'uppercase',
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  Resolve
                                </button>
                              </div>
                              {hasNoteError && (
                                <div className="mono" style={{ fontSize: 10, color: 'var(--red)', marginTop: 3 }}>
                                  Notes are required to resolve this item
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}

                  {/* Actions Row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                    {openItems.length > 1 && (
                      <>
                        {confirmBulk === group.invId ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <span className="mono" style={{ fontSize: 11, color: 'var(--ylw)' }}>
                              Resolve all {openItems.length} open issues?
                            </span>
                            <input
                              type="text"
                              placeholder="Bulk resolution note (required)..."
                              value={bulkNote}
                              onChange={(e) => setBulkNote(e.target.value)}
                              style={{
                                background: 'var(--bg1)',
                                border: '1px solid var(--bd)',
                                borderRadius: 4,
                                padding: '4px 8px',
                                fontSize: 12,
                                color: 'var(--t3)',
                                fontFamily: 'inherit',
                                width: 250,
                                outline: 'none',
                              }}
                            />
                            <button className="btn btn-primary" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => handleBulkResolve(group.invId)}>
                              Confirm
                            </button>
                            <button className="btn btn-secondary" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => { setConfirmBulk(null); setBulkNote('') }}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 10, padding: '5px 14px' }}
                            onClick={() => setConfirmBulk(group.invId)}
                          >
                            Resolve All ({openItems.length})
                          </button>
                        )}
                      </>
                    )}

                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 10, padding: '5px 14px' }}
                      onClick={() => setShowAuditFor(showAuditFor === group.invId ? null : group.invId)}
                    >
                      {showAuditFor === group.invId ? 'Hide' : 'Show'} Audit Log
                    </button>

                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 10, padding: '5px 14px' }}
                      onClick={() => navigate('/pe/directory')}
                    >
                      View in Directory &rarr;
                    </button>
                  </div>

                  {/* Audit Log */}
                  {showAuditFor === group.invId && (
                    <div style={{ marginTop: 16, borderTop: '1px solid var(--bd)', paddingTop: 12 }}>
                      <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 10 }}>
                        Audit Log
                      </div>
                      {investorAudit.length === 0 ? (
                        <div style={{ fontSize: 12, color: 'var(--t5)', fontStyle: 'italic' }}>
                          No audit entries yet. Actions will be logged here.
                        </div>
                      ) : (
                        investorAudit.map((entry) => (
                          <div
                            key={entry.id}
                            style={{
                              padding: '8px 0',
                              borderBottom: '1px solid rgba(52,92,99,0.2)',
                              fontSize: 12,
                            }}
                          >
                            <div style={{ display: 'flex', gap: 12 }}>
                              <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', width: 140, flexShrink: 0 }}>
                                {formatTimestamp(entry.timestamp)}
                              </div>
                              <div style={{ flex: 1 }}>
                                <span style={{
                                  fontWeight: 600,
                                  color: entry.action === 'Resolved' || entry.action === 'Resolved (Bulk)' ? 'var(--grn)'
                                    : entry.action === 'Reopened' ? 'var(--ylw)'
                                    : 'var(--t3)',
                                }}>
                                  {entry.action}
                                </span>
                                <span style={{ color: 'var(--t4)', marginLeft: 8 }}>{entry.detail}</span>
                              </div>
                              <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', flexShrink: 0 }}>
                                {entry.user}
                              </div>
                            </div>
                            {entry.notes && (
                              <div style={{
                                marginTop: 4,
                                marginLeft: 152,
                                padding: '3px 8px',
                                background: 'rgba(52,211,153,0.04)',
                                borderLeft: '2px solid var(--grn)',
                                borderRadius: '0 3px 3px 0',
                                fontSize: 11,
                                color: 'var(--t4)',
                                fontStyle: 'italic',
                              }}>
                                {entry.notes}
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })
      )}

      {/* Bluesky Filing Modal */}
      {blueskyModalFilingId && (
        <BlueskyFilingModal
          filingId={blueskyModalFilingId}
          onClose={() => setBlueskyModalFilingId(null)}
        />
      )}
    </div>
  )
}
