// =============================================
// VEGA MISSION CONTROL - Directory Page
// Investor / Advisor / Custodian directory with
// detail split-view, compliance, distributions,
// positions, and notes management
// =============================================

import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import useInvestorStore from '../stores/investorStore'
import useComplianceStore from '../stores/complianceStore'
import useDistributionStore from '../stores/distributionStore'
import useFundStore from '../stores/fundStore'
import useRingCentralStore from '../stores/ringcentralStore'
import { fmt, fmtK } from '../utils/format'
import { getCallLog, sendSMS, formatPhoneForRC, formatPhoneForDisplay, formatDuration } from '../services/ringcentralService'
import RingOutDialog from '../components/RingOutDialog'
import EmailComposeDialog from '../components/EmailComposeDialog'
import { PipelineBadge, NewBadge } from '../components/PipelineTracker'
import PipelineTracker from '../components/PipelineTracker'
import { PIPELINE_STAGES } from '../stores/investorStore'

// ── Inline style helpers ─────────────────────────────────────────────────────
const mono = { fontFamily: "'Space Mono', monospace" }

const vegaIconSvg = (
  <svg viewBox="0 0 200 200" style={{ width: 48, height: 48, opacity: 0.15 }}>
    <path
      d="M100 20 L180 180 H20 Z"
      fill="none"
      stroke="var(--t5)"
      strokeWidth="4"
    />
    <circle cx="100" cy="80" r="6" fill="var(--t5)" />
  </svg>
)

// ── Badge components ─────────────────────────────────────────────────────────
function FundBadge({ fund }) {
  return (
    <span
      style={{
        ...mono,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 3,
        background: 'var(--grnM)',
        color: 'var(--grn)',
        marginRight: 4,
      }}
    >
      {fund}
    </span>
  )
}

function ComplianceBadge({ count }) {
  if (!count) return null
  return (
    <span
      style={{
        ...mono,
        fontSize: 10,
        fontWeight: 700,
        padding: '3px 8px',
        borderRadius: 3,
        background: 'var(--redM)',
        color: 'var(--red)',
        marginLeft: 4,
      }}
    >
      {count} issue{count > 1 ? 's' : ''}
    </span>
  )
}

function PendingBadge() {
  return (
    <span
      style={{
        ...mono,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 3,
        background: 'var(--ylwM)',
        color: 'var(--ylw)',
        marginLeft: 4,
      }}
    >
      Pending
    </span>
  )
}

function StatusBadge({ status }) {
  const isApproved = status === 'Approved'
  return (
    <span
      style={{
        ...mono,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 3,
        background: isApproved ? 'var(--grnM)' : 'var(--ylwM)',
        color: isApproved ? 'var(--grn)' : 'var(--ylw)',
      }}
    >
      {status}
    </span>
  )
}

function MethodBadge({ method }) {
  let bg, color
  if (method === 'Wire') {
    bg = 'var(--bluM)'
    color = 'var(--blu)'
  } else if (method === 'Check') {
    bg = 'var(--ylwM)'
    color = 'var(--ylw)'
  } else {
    bg = 'rgba(52,92,99,0.5)'
    color = 'var(--t3)'
  }
  return (
    <span
      style={{
        ...mono,
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        padding: '3px 8px',
        borderRadius: 3,
        background: bg,
        color,
      }}
    >
      {method}
    </span>
  )
}

// ═══════════════════════════════════════════════
// DIRECTORY PAGE COMPONENT
// ═══════════════════════════════════════════════
export default function Directory() {
  const navigate = useNavigate()

  // ── Stores ──────────────────────────────────
  const investorStore = useInvestorStore()
  const complianceStore = useComplianceStore()
  const distributionStore = useDistributionStore()
  const fundStore = useFundStore()

  // ── State ───────────────────────────────────
  const [dirTab, setDirTab] = useState('investors')
  const [sel, setSel] = useState(null)
  const [search, setSearch] = useState('')
  const [detailTab, setDetailTab] = useState('overview')
  const [noteText, setNoteText] = useState('')
  const [editField, setEditField] = useState(null)
  const [fundFilter, setFundFilter] = useState('All')
  const [showRingOut, setShowRingOut] = useState(null) // { phone, name }
  const [showEmailCompose, setShowEmailCompose] = useState(null) // { email, name }
  const [smsText, setSmsText] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [callLogData, setCallLogData] = useState([])
  const [callLogLoading, setCallLogLoading] = useState(false)
  const [showDeclineDialog, setShowDeclineDialog] = useState(null) // { positionId, name }
  const [declineReason, setDeclineReason] = useState('')
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(null) // { positionId, name, currentStage }

  // ── RingCentral Store ─────────────────────────
  const rcAuth = useRingCentralStore((s) => s.isAuthenticated)
  const rcAccessToken = useRingCentralStore((s) => s.accessToken)
  const rcUserPhone = useRingCentralStore((s) => s.userPhoneNumber)
  const rcSmsHistory = useRingCentralStore((s) => s.smsHistory)
  const rcAddSms = useRingCentralStore((s) => s.addSmsToHistory)

  // ── Derived data ────────────────────────────
  const investors = useMemo(() => investorStore.getAll(), [investorStore])
  const advisors = fundStore.advisors
  const custodians = fundStore.custodians
  const allCompliance = complianceStore.items
  const allDistributions = distributionStore.distributions

  const filteredInvestors = useMemo(() => {
    let list = investors
    if (fundFilter !== 'All') {
      list = list.filter((inv) => inv.funds.includes(fundFilter))
    }
    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(
        (inv) =>
          inv.name.toLowerCase().includes(q) ||
          inv.entities.some((e) => e.toLowerCase().includes(q))
      )
    }
    return list
  }, [investors, search, fundFilter])

  const selectedInvestor = useMemo(
    () => investors.find((inv) => inv.id === sel) || null,
    [investors, sel]
  )

  const invCompliance = useMemo(
    () => (sel ? allCompliance.filter((c) => c.invId === sel) : []),
    [allCompliance, sel]
  )
  const openComplianceCount = useMemo(
    () => invCompliance.filter((c) => c.status === 'Open').length,
    [invCompliance]
  )

  const invDistributions = useMemo(
    () => (sel ? allDistributions.filter((d) => d.invId === sel) : []),
    [allDistributions, sel]
  )

  const invNotes = useMemo(
    () => (sel ? investorStore.getNotes(sel) : []),
    [investorStore, sel]
  )

  // Stats
  const totalCommitted = useMemo(
    () => investors.reduce((s, i) => s + i.totalCommitted, 0),
    [investors]
  )
  const totalOpenCompliance = useMemo(
    () => allCompliance.filter((c) => c.status === 'Open').length,
    [allCompliance]
  )
  const avgCommitment = useMemo(
    () => (investors.length ? totalCommitted / investors.length : 0),
    [investors, totalCommitted]
  )

  // Pipeline counts
  const newCount = useMemo(
    () => investors.filter((inv) => inv.pipeline?.stage === 'New').length,
    [investors]
  )
  const pendingPipelineCount = useMemo(
    () => investors.filter((inv) => inv.pipeline && !['Accepted', 'Declined', 'New'].includes(inv.pipeline.stage)).length,
    [investors]
  )
  const declinedCount = useMemo(
    () => investors.filter((inv) => inv.pipeline?.stage === 'Declined').length,
    [investors]
  )
  const acceptedCount = useMemo(
    () => investors.filter((inv) => inv.pipeline?.stage === 'Accepted' || (!inv.pipeline && inv.status === 'Approved')).length,
    [investors]
  )

  // Advisor helper: investors linked to an advisor
  const investorsByAdvisor = useMemo(() => {
    const map = {}
    advisors.forEach((a) => {
      map[a.name] = investors.filter((inv) => inv.advisor === a.name)
    })
    return map
  }, [advisors, investors])

  // Advisor AUM
  const advisorAum = useMemo(() => {
    const map = {}
    advisors.forEach((a) => {
      const linked = investorsByAdvisor[a.name] || []
      map[a.name] = linked.reduce((s, inv) => s + inv.totalCommitted, 0)
    })
    return map
  }, [advisors, investorsByAdvisor])

  // Custodian helpers
  const investorsByCustodian = useMemo(() => {
    const map = {}
    custodians.forEach((c) => {
      map[c.name] = investors.filter((inv) => inv.custodian === c.name)
    })
    return map
  }, [custodians, investors])

  const custodianAum = useMemo(() => {
    const map = {}
    custodians.forEach((c) => {
      const linked = investorsByCustodian[c.name] || []
      map[c.name] = linked.reduce((s, inv) => s + inv.totalCommitted, 0)
    })
    return map
  }, [custodians, investorsByCustodian])

  // Compliance count per investor (for list badges)
  const complianceCountMap = useMemo(() => {
    const map = {}
    allCompliance.forEach((c) => {
      if (c.status === 'Open') {
        map[c.invId] = (map[c.invId] || 0) + 1
      }
    })
    return map
  }, [allCompliance])

  // ── Handlers ────────────────────────────────
  const handleSelectInvestor = (id) => {
    setSel(id)
    setDetailTab('overview')
  }

  const handleAddNote = () => {
    if (!noteText.trim() || !sel) return
    investorStore.addNote(sel, noteText.trim(), 'j@vegarei.com')
    setNoteText('')
  }

  const handleResolve = (id) => {
    complianceStore.resolve(id, 'j@vegarei.com')
  }

  const handleDecline = () => {
    if (!showDeclineDialog || !declineReason.trim()) return
    investorStore.declineInvestor(showDeclineDialog.positionId, declineReason.trim(), 'J. Jones')
    setShowDeclineDialog(null)
    setDeclineReason('')
  }

  const handleAdvanceStage = (positionId, newStage) => {
    investorStore.advancePipelineStage(positionId, newStage, 'J. Jones')
    setShowAdvanceDialog(null)
  }

  const handleSendSms = async () => {
    if (!smsText.trim() || !selectedInvestor?.phone || !rcAccessToken) return
    setSmsSending(true)
    try {
      await sendSMS(rcAccessToken, {
        to: selectedInvestor.phone,
        from: rcUserPhone,
        text: smsText.trim(),
      })
      rcAddSms(formatPhoneForRC(selectedInvestor.phone), {
        direction: 'outbound',
        text: smsText.trim(),
        timestamp: new Date().toISOString(),
      })
      setSmsText('')
    } catch (err) {
      console.error('SMS failed:', err)
    }
    setSmsSending(false)
  }

  const handleFetchCallLog = async () => {
    if (!rcAccessToken || !selectedInvestor?.phone) return
    setCallLogLoading(true)
    try {
      const data = await getCallLog(rcAccessToken, {
        phoneNumber: formatPhoneForRC(selectedInvestor.phone),
        perPage: 25,
      })
      setCallLogData(data.records || [])
    } catch (err) {
      console.error('Call log fetch failed:', err)
      setCallLogData([])
    }
    setCallLogLoading(false)
  }

  // Distributed total for selected investor
  const totalDistributed = useMemo(
    () => invDistributions.reduce((s, d) => s + d.amt, 0),
    [invDistributions]
  )

  // ═══════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════
  return (
    <div className="main">
      {/* ── Page Header ───────────────────────── */}
      <div className="page-header">
        <div className="page-header-dot">
          <span>Active Module</span>
        </div>
        <h1 className="page-title">Directory</h1>
        <p className="page-subtitle">
          {investors.length} investors
          {newCount > 0 && <span style={{ color: 'var(--ylw)' }}> &middot; {newCount} new</span>}
          {pendingPipelineCount > 0 && <span style={{ color: 'var(--blu)' }}> &middot; {pendingPipelineCount} in review</span>}
          {acceptedCount > 0 && <span> &middot; {acceptedCount} accepted</span>}
          {declinedCount > 0 && <span style={{ color: 'var(--red)' }}> &middot; {declinedCount} declined</span>}
        </p>
      </div>

      {/* ── Directory Tabs ────────────────────── */}
      <div style={{ display: 'flex', marginBottom: 24 }}>
        {[
          { key: 'investors', label: `Investors (${investors.length})`, radius: '4px 0 0 4px', noBorderLeft: false },
          { key: 'advisors', label: `Advisors (${advisors.length})`, radius: '0', noBorderLeft: true },
          { key: 'custodians', label: `Custodians (${custodians.length})`, radius: '0 4px 4px 0', noBorderLeft: true },
        ].map((tab) => {
          const active = dirTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setDirTab(tab.key)}
              style={{
                ...mono,
                fontSize: 12,
                fontWeight: 700,
                padding: '10px 24px',
                border: '1px solid',
                borderColor: active ? 'var(--grnB)' : 'var(--bd)',
                borderLeft: tab.noBorderLeft ? 'none' : undefined,
                borderRadius: tab.radius,
                background: active ? 'var(--grnM)' : 'transparent',
                color: active ? 'var(--grn)' : 'var(--t4)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ═══════════════════════════════════════ */}
      {/* INVESTORS TAB                          */}
      {/* ═══════════════════════════════════════ */}
      {dirTab === 'investors' && (
        <>
          {/* Stats Row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Committed', value: fmtK(totalCommitted) },
              { label: 'Investors', value: investors.length },
              {
                label: 'Open Compliance',
                value: totalOpenCompliance,
                color: totalOpenCompliance > 0 ? 'var(--red)' : 'var(--grn)',
              },
              { label: 'Avg Commitment', value: fmtK(avgCommitment) },
            ].map((stat, i) => (
              <div
                key={i}
                style={{
                  flex: 1,
                  background: 'rgba(30,58,64,0.5)',
                  border: '1px solid var(--bd)',
                  borderRadius: 6,
                  padding: '14px 18px',
                }}
              >
                <div
                  style={{
                    ...mono,
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

          {/* Filter Bar */}
          <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search Input */}
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
                placeholder="Search investors..."
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

            {/* Fund Filter */}
            <div style={{ display: 'flex', gap: 4 }}>
              {['All', 'Fund I', 'Fund II', 'Fund III'].map((f) => {
                const isActive = fundFilter === f
                return (
                  <button
                    key={f}
                    onClick={() => setFundFilter(f)}
                    className="mono"
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '6px 14px',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--grnB)' : 'var(--bd)',
                      borderRadius: 20,
                      background: isActive ? 'var(--grnM)' : 'transparent',
                      color: isActive ? 'var(--grn)' : 'var(--t4)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {f}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Split View */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '400px 1fr',
              border: '1px solid var(--bd)',
              borderRadius: 6,
              overflow: 'hidden',
              minHeight: 600,
              background: 'var(--bg2)',
            }}
          >
            {/* Left Panel - Investor List */}
            <div
              style={{
                borderRight: '1px solid var(--bd)',
                overflowY: 'auto',
                maxHeight: 700,
              }}
            >
              {/* List Header */}
              <div
                style={{
                  ...mono,
                  display: 'flex',
                  justifyContent: 'space-between',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--bd)',
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.15em',
                  color: 'var(--t5)',
                }}
              >
                <span>Name</span>
                <span>Committed</span>
              </div>

              {/* Investor Rows */}
              {filteredInvestors.map((inv) => {
                const isSelected = sel === inv.id
                const cCount = complianceCountMap[inv.id] || 0
                return (
                  <div
                    key={inv.id}
                    onClick={() => handleSelectInvestor(inv.id)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      padding: '12px 16px',
                      borderBottom: '1px solid rgba(52,92,99,0.3)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(52,211,153,0.04)' : 'transparent',
                      borderLeft: isSelected
                        ? '3px solid var(--grn)'
                        : '3px solid transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 14,
                          color: 'var(--t1)',
                          fontWeight: 500,
                        }}
                      >
                        {inv.name}
                      </div>
                      <div
                        style={{
                          ...mono,
                          fontSize: 10,
                          color: 'var(--t3)',
                          marginTop: 3,
                          display: 'flex',
                          flexWrap: 'wrap',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        {inv.types.map((t) => (
                          <span key={t} style={{ marginRight: 2 }}>
                            {t}
                          </span>
                        ))}
                        <span style={{ color: 'var(--t5)' }}>&middot;</span>
                        {inv.funds.map((f) => (
                          <FundBadge key={f} fund={f} />
                        ))}
                        {inv.pipeline && <PipelineBadge stage={inv.pipeline.stage} />}
                        {inv.pipeline?.stage === 'New' && <NewBadge />}
                        {cCount > 0 && <ComplianceBadge count={cCount} />}
                      </div>
                    </div>
                    <div
                      style={{
                        ...mono,
                        fontSize: 12,
                        color: 'var(--t2)',
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        paddingLeft: 12,
                      }}
                    >
                      {fmtK(inv.totalCommitted)}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right Panel - Detail */}
            <div style={{ padding: 24, overflowY: 'auto', maxHeight: 700 }}>
              {!selectedInvestor ? (
                /* Empty State */
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: 16,
                    opacity: 0.6,
                  }}
                >
                  {vegaIconSvg}
                  <span
                    style={{
                      ...mono,
                      fontSize: 12,
                      color: 'var(--t4)',
                    }}
                  >
                    Select an investor to view details
                  </span>
                </div>
              ) : (
                /* Investor Detail */
                <>
                  {/* Detail Header */}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 20,
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: 22,
                          fontWeight: 300,
                          color: 'var(--t1)',
                          letterSpacing: '-0.01em',
                        }}
                      >
                        {selectedInvestor.name}
                      </div>
                      <div
                        style={{
                          ...mono,
                          fontSize: 11,
                          color: 'var(--t4)',
                          marginTop: 4,
                        }}
                      >
                        {selectedInvestor.id}
                        {selectedInvestor.types.length > 0 &&
                          ` \u00b7 ${selectedInvestor.types.join(', ')}`}
                        {selectedInvestor.advisor &&
                          ` \u00b7 ${selectedInvestor.advisor}`}
                        {selectedInvestor.custodian &&
                          ` \u00b7 ${selectedInvestor.custodian}`}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, flexWrap: 'wrap' }}>
                      {selectedInvestor.funds.map((f) => (
                        <FundBadge key={f} fund={f} />
                      ))}
                      {openComplianceCount > 0 && (
                        <ComplianceBadge count={openComplianceCount} />
                      )}
                      {selectedInvestor.pipeline && <PipelineBadge stage={selectedInvestor.pipeline.stage} />}
                      {selectedInvestor.pipeline?.stage === 'New' && <NewBadge />}

                      {/* Pipeline action buttons (New investors) */}
                      {selectedInvestor.pipeline?.stage === 'New' && selectedInvestor.positions.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                          <button
                            onClick={() => {
                              const pos = selectedInvestor.positions[0]
                              handleAdvanceStage(pos.id, 'Pending')
                            }}
                            style={{
                              ...mono,
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '4px 10px',
                              border: '1px solid rgba(52,211,153,0.3)',
                              background: 'var(--grnM)',
                              color: 'var(--grn)',
                              borderRadius: 4,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              textTransform: 'uppercase',
                            }}
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, fill: 'var(--grn)' }}>
                              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                            </svg>
                            Start Subscription
                          </button>
                          <button
                            onClick={() => {
                              const pos = selectedInvestor.positions[0]
                              setShowDeclineDialog({ positionId: pos.id, name: selectedInvestor.name })
                            }}
                            style={{
                              ...mono,
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '4px 10px',
                              border: '1px solid rgba(239,68,68,0.3)',
                              background: 'var(--redM)',
                              color: 'var(--red)',
                              borderRadius: 4,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              textTransform: 'uppercase',
                            }}
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, fill: 'var(--red)' }}>
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                            Decline
                          </button>
                        </div>
                      )}
                      {/* Advance stage button (non-New, non-Accepted, non-Declined) */}
                      {selectedInvestor.pipeline && !['New', 'Accepted', 'Declined'].includes(selectedInvestor.pipeline.stage) && selectedInvestor.positions.length > 0 && (
                        <div style={{ marginLeft: 8 }}>
                          <button
                            onClick={() => {
                              const pos = selectedInvestor.positions[0]
                              setShowAdvanceDialog({ positionId: pos.id, name: selectedInvestor.name, currentStage: selectedInvestor.pipeline.stage })
                            }}
                            style={{
                              ...mono,
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '4px 10px',
                              border: '1px solid rgba(96,165,250,0.3)',
                              background: 'var(--bluM)',
                              color: 'var(--blu)',
                              borderRadius: 4,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              textTransform: 'uppercase',
                            }}
                          >
                            &#9654; Advance Stage
                          </button>
                        </div>
                      )}

                      {/* Contact action buttons */}
                      <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                        {selectedInvestor.phone && (
                          <button
                            onClick={() => setShowRingOut({ phone: selectedInvestor.phone, name: selectedInvestor.name })}
                            title={rcAuth ? 'Call via RingCentral' : 'Call'}
                            style={{
                              ...mono,
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '4px 8px',
                              border: '1px solid rgba(52,211,153,0.25)',
                              background: 'var(--grnM)',
                              color: 'var(--grn)',
                              borderRadius: 4,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, fill: 'var(--grn)' }}>
                              <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                            </svg>
                            CALL
                          </button>
                        )}
                        {rcAuth && selectedInvestor.phone && (
                          <button
                            onClick={() => setDetailTab('communications')}
                            title="Send SMS"
                            style={{
                              ...mono,
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '4px 8px',
                              border: '1px solid rgba(96,165,250,0.25)',
                              background: 'var(--bluM)',
                              color: 'var(--blu)',
                              borderRadius: 4,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, fill: 'var(--blu)' }}>
                              <path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z" />
                            </svg>
                            SMS
                          </button>
                        )}
                        {selectedInvestor.email && (
                          <button
                            onClick={() => setShowEmailCompose({ email: selectedInvestor.email, name: selectedInvestor.name })}
                            title="Send email"
                            style={{
                              ...mono,
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '4px 8px',
                              border: '1px solid rgba(251,191,36,0.25)',
                              background: 'var(--ylwM)',
                              color: 'var(--ylw)',
                              borderRadius: 4,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                            }}
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 10, height: 10, fill: 'var(--ylw)' }}>
                              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                            </svg>
                            EMAIL
                          </button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Mini Stats */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(4, 1fr)',
                      gap: 10,
                      marginBottom: 20,
                    }}
                  >
                    {[
                      { label: 'Committed', value: fmtK(selectedInvestor.totalCommitted) },
                      { label: 'Distributed', value: fmt(totalDistributed) },
                      { label: 'Positions', value: selectedInvestor.positions.length },
                      {
                        label: 'Compliance',
                        value: openComplianceCount === 0 ? 'Clear' : `${openComplianceCount} Open`,
                        color: openComplianceCount > 0 ? 'var(--red)' : 'var(--grn)',
                      },
                    ].map((stat, i) => (
                      <div
                        key={i}
                        style={{
                          background: 'var(--bgI)',
                          borderRadius: 5,
                          padding: 12,
                        }}
                      >
                        <div
                          style={{
                            ...mono,
                            fontSize: 9,
                            textTransform: 'uppercase',
                            letterSpacing: '0.15em',
                            color: 'var(--t4)',
                          }}
                        >
                          {stat.label}
                        </div>
                        <div
                          style={{
                            fontSize: 16,
                            fontWeight: 300,
                            color: stat.color || 'var(--t1)',
                            marginTop: 2,
                          }}
                        >
                          {stat.value}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Detail Sub-tabs */}
                  <div
                    style={{
                      display: 'flex',
                      borderBottom: '1px solid var(--bd)',
                      marginBottom: 16,
                    }}
                  >
                    {['overview', 'positions', 'compliance', 'distributions', 'communications', 'notes'].map(
                      (tab) => {
                        const active = detailTab === tab
                        const hasComplianceDot =
                          tab === 'compliance' && openComplianceCount > 0
                        return (
                          <button
                            key={tab}
                            onClick={() => setDetailTab(tab)}
                            style={{
                              ...mono,
                              padding: '9px 16px',
                              fontSize: 11,
                              fontWeight: 700,
                              border: 'none',
                              background: 'none',
                              cursor: 'pointer',
                              color: active ? 'var(--grn)' : 'var(--t4)',
                              borderBottom: active
                                ? '2px solid var(--grn)'
                                : '2px solid transparent',
                              position: 'relative',
                              textTransform: 'capitalize',
                            }}
                          >
                            {tab}
                            {hasComplianceDot && (
                              <span
                                style={{
                                  position: 'absolute',
                                  top: 6,
                                  right: 4,
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: 'var(--red)',
                                }}
                              />
                            )}
                          </button>
                        )
                      }
                    )}
                  </div>

                  {/* ── Tab 1: Overview ──────────── */}
                  {detailTab === 'overview' && (
                    <>
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        gap: 14,
                      }}
                    >
                      {[
                        {
                          label: 'Investor Type',
                          value: selectedInvestor.types.join(', ') || '-',
                        },
                        {
                          label: 'Funds',
                          value: selectedInvestor.funds.join(', ') || '-',
                        },
                        {
                          label: 'Phone',
                          value: selectedInvestor.phone || '-',
                          isPhone: true,
                        },
                        {
                          label: 'Email',
                          value: selectedInvestor.email || '-',
                          isEmail: true,
                        },
                        {
                          label: 'Entities',
                          value: selectedInvestor.entities.join(', ') || '-',
                        },
                        {
                          label: 'Advisor',
                          value: selectedInvestor.advisor || '-',
                        },
                        {
                          label: 'Custodian',
                          value: selectedInvestor.custodian || '-',
                        },
                        {
                          label: 'Total Committed',
                          value: fmtK(selectedInvestor.totalCommitted),
                        },
                        {
                          label: 'Status',
                          value: selectedInvestor.pipeline?.stage || selectedInvestor.status || '-',
                        },
                        {
                          label: 'Date Entered',
                          value: selectedInvestor.pipeline?.enteredDate || '-',
                        },
                      ].map((field, i) => (
                        <div key={i}>
                          <div
                            style={{
                              ...mono,
                              fontSize: 9,
                              textTransform: 'uppercase',
                              letterSpacing: '0.15em',
                              color: 'var(--t4)',
                              marginBottom: 4,
                            }}
                          >
                            {field.label}
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              background: 'var(--bgI)',
                              borderRadius: 4,
                              padding: '8px 10px',
                              fontWeight: 500,
                              color: 'var(--t1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            {field.isPhone && field.value !== '-' ? (
                              <>
                                <a href={`tel:${field.value}`} style={{ color: 'var(--grn)', textDecoration: 'none' }}>{field.value}</a>
                                {rcAuth && (
                                  <button
                                    onClick={() => setShowRingOut({ phone: field.value, name: selectedInvestor.name })}
                                    title="Call via RingCentral"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
                                  >
                                    <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'var(--grn)' }}>
                                      <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                    </svg>
                                  </button>
                                )}
                              </>
                            ) : field.isEmail && field.value !== '-' ? (
                              <button
                                onClick={() => setShowEmailCompose({ email: field.value, name: selectedInvestor.name })}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grn)', padding: 0, font: 'inherit', fontSize: 'inherit', textDecoration: 'none' }}
                              >
                                {field.value}
                              </button>
                            ) : (
                              field.value
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Pipeline Tracker */}
                    {selectedInvestor.pipeline && (
                      <div style={{ marginTop: 20 }}>
                        <div
                          style={{
                            ...mono,
                            fontSize: 10,
                            textTransform: 'uppercase',
                            letterSpacing: '0.15em',
                            color: 'var(--t4)',
                            marginBottom: 10,
                          }}
                        >
                          Subscription Pipeline
                        </div>
                        <PipelineTracker
                          pipeline={selectedInvestor.pipeline}
                          signers={selectedInvestor.signers}
                        />
                      </div>
                    )}
                  </>
                  )}

                  {/* ── Tab 2: Positions ─────────── */}
                  {detailTab === 'positions' && (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th>Fund</th>
                            <th>Entity</th>
                            <th>Type</th>
                            <th>Class</th>
                            <th className="right">Amount</th>
                            <th>Status</th>
                            <th>Funded</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedInvestor.positions.map((p) => (
                            <tr key={p.id}>
                              <td style={{ color: 'var(--t2)' }}>{p.fund}</td>
                              <td style={{ color: 'var(--t3)', fontSize: 13 }}>
                                {p.entity || '-'}
                              </td>
                              <td>
                                <span
                                  style={{
                                    ...mono,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    background: 'rgba(52,92,99,0.5)',
                                    color: 'var(--t2)',
                                    padding: '3px 8px',
                                    borderRadius: 3,
                                  }}
                                >
                                  {p.type}
                                </span>
                              </td>
                              <td>
                                <span
                                  style={{
                                    ...mono,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    textTransform: 'uppercase',
                                    background: 'rgba(52,92,99,0.5)',
                                    color: 'var(--t2)',
                                    padding: '3px 8px',
                                    borderRadius: 3,
                                  }}
                                >
                                  {p.cls}
                                </span>
                              </td>
                              <td
                                className="right"
                                style={{
                                  fontWeight: 700,
                                  color: 'var(--t1)',
                                }}
                              >
                                {fmt(p.amt)}
                              </td>
                              <td>
                                <StatusBadge status={p.status} />
                              </td>
                              <td
                                style={{
                                  ...mono,
                                  fontSize: 12,
                                  color: 'var(--t3)',
                                }}
                              >
                                {p.funded || '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* ── Tab 3: Compliance ────────── */}
                  {detailTab === 'compliance' && (
                    <div>
                      {invCompliance.length === 0 ? (
                        <div
                          style={{
                            textAlign: 'center',
                            padding: '40px 0',
                            color: 'var(--t4)',
                            ...mono,
                            fontSize: 13,
                          }}
                        >
                          No compliance issues -- all clear {'\u2713'}
                        </div>
                      ) : (
                        invCompliance.map((c) => {
                          const resolved = c.status === 'Resolved'
                          return (
                            <div
                              key={c.id}
                              style={{
                                padding: 14,
                                borderLeft: `2px solid ${resolved ? 'var(--t5)' : 'var(--ylw)'}`,
                                background: 'var(--bgI)',
                                borderRadius: '0 5px 5px 0',
                                marginBottom: 8,
                                opacity: resolved ? 0.4 : 1,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'flex-start',
                                }}
                              >
                                <div>
                                  <div
                                    style={{
                                      ...mono,
                                      fontSize: 10,
                                      fontWeight: 700,
                                      textTransform: 'uppercase',
                                      color: 'var(--t4)',
                                      marginBottom: 4,
                                    }}
                                  >
                                    {c.doc}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 14,
                                      color: 'var(--t2)',
                                      lineHeight: 1.5,
                                    }}
                                  >
                                    {c.issue}
                                  </div>
                                </div>
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 8,
                                    flexShrink: 0,
                                    marginLeft: 12,
                                  }}
                                >
                                  <StatusBadge status={c.status} />
                                  {!resolved && (
                                    <button
                                      onClick={() => handleResolve(c.id)}
                                      style={{
                                        ...mono,
                                        fontSize: 10,
                                        fontWeight: 700,
                                        padding: '4px 10px',
                                        border: '1px solid rgba(52,211,153,0.3)',
                                        background: 'var(--grnM)',
                                        color: 'var(--grn)',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      Mark Resolved
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          )
                        })
                      )}
                    </div>
                  )}

                  {/* ── Tab 4: Distributions ─────── */}
                  {detailTab === 'distributions' && (
                    <div>
                      {invDistributions.length === 0 ? (
                        <div
                          style={{
                            textAlign: 'center',
                            padding: '40px 0',
                            color: 'var(--t4)',
                            ...mono,
                            fontSize: 13,
                          }}
                        >
                          No distributions recorded
                        </div>
                      ) : (
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr>
                              <th>Period</th>
                              <th>Entity</th>
                              <th className="right">Amount</th>
                              <th>Method</th>
                              <th>Sent</th>
                            </tr>
                          </thead>
                          <tbody>
                            {invDistributions.map((d) => (
                              <tr key={d.id}>
                                <td
                                  style={{
                                    ...mono,
                                    fontSize: 12,
                                    color: 'var(--t2)',
                                  }}
                                >
                                  {d.period}
                                </td>
                                <td style={{ color: 'var(--t3)', fontSize: 13 }}>
                                  {d.entity || '-'}
                                </td>
                                <td
                                  className="right"
                                  style={{
                                    fontWeight: 700,
                                    color: 'var(--t1)',
                                  }}
                                >
                                  {fmt(d.amt)}
                                </td>
                                <td>
                                  <MethodBadge method={d.method} />
                                </td>
                                <td
                                  style={{
                                    ...mono,
                                    fontSize: 12,
                                    color: 'var(--t3)',
                                  }}
                                >
                                  {d.date || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  )}

                  {/* ── Tab 5: Communications ────── */}
                  {detailTab === 'communications' && (
                    <div>
                      {!rcAuth ? (
                        <div
                          style={{
                            textAlign: 'center',
                            padding: '40px 0',
                            color: 'var(--t4)',
                          }}
                        >
                          <svg viewBox="0 0 24 24" style={{ width: 32, height: 32, fill: 'var(--t5)', marginBottom: 12 }}>
                            <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                          </svg>
                          <div style={{ ...mono, fontSize: 13, marginBottom: 8 }}>
                            Connect RingCentral to view communications
                          </div>
                          <div style={{ fontSize: 12, color: 'var(--t5)' }}>
                            Click the RC indicator in the header to connect your account
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* SMS Compose */}
                          {selectedInvestor.phone && (
                            <div style={{ marginBottom: 20 }}>
                              <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 8 }}>
                                Send SMS to {selectedInvestor.name}
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <input
                                  type="text"
                                  value={smsText}
                                  onChange={(e) => setSmsText(e.target.value)}
                                  placeholder={`Message to ${selectedInvestor.phone}...`}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault()
                                      handleSendSms()
                                    }
                                  }}
                                  style={{
                                    flex: 1,
                                    background: 'var(--bg0)',
                                    border: '1px solid var(--bd)',
                                    borderRadius: 4,
                                    padding: '8px 12px',
                                    fontSize: 14,
                                    color: 'var(--t1)',
                                    fontFamily: 'inherit',
                                    outline: 'none',
                                  }}
                                />
                                <button
                                  onClick={handleSendSms}
                                  disabled={smsSending || !smsText.trim()}
                                  style={{
                                    ...mono,
                                    fontSize: 11,
                                    fontWeight: 700,
                                    background: 'var(--grn)',
                                    color: 'var(--bg0)',
                                    border: 'none',
                                    borderRadius: 4,
                                    padding: '8px 16px',
                                    cursor: smsSending || !smsText.trim() ? 'not-allowed' : 'pointer',
                                    opacity: smsSending || !smsText.trim() ? 0.5 : 1,
                                  }}
                                >
                                  {smsSending ? 'Sending...' : 'Send'}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* SMS History */}
                          {selectedInvestor.phone && (rcSmsHistory[formatPhoneForRC(selectedInvestor.phone)] || []).length > 0 && (
                            <div style={{ marginBottom: 24 }}>
                              <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 8 }}>
                                SMS History
                              </div>
                              {(rcSmsHistory[formatPhoneForRC(selectedInvestor.phone)] || []).map((msg, idx) => (
                                <div
                                  key={idx}
                                  style={{
                                    background: msg.direction === 'outbound' ? 'rgba(52,211,153,0.06)' : 'var(--bgI)',
                                    borderLeft: `2px solid ${msg.direction === 'outbound' ? 'var(--grn)' : 'var(--blu)'}`,
                                    borderRadius: '0 5px 5px 0',
                                    padding: '10px 12px',
                                    marginBottom: 6,
                                  }}
                                >
                                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                                    <span style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: msg.direction === 'outbound' ? 'var(--grn)' : 'var(--blu)' }}>
                                      {msg.direction === 'outbound' ? 'Sent' : 'Received'}
                                    </span>
                                    <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>
                                      {new Date(msg.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.5 }}>
                                    {msg.text}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Call Log */}
                          <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                              <span style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)' }}>
                                Call Log
                              </span>
                              <button
                                onClick={handleFetchCallLog}
                                disabled={callLogLoading}
                                style={{
                                  ...mono,
                                  fontSize: 9,
                                  fontWeight: 700,
                                  padding: '4px 10px',
                                  border: '1px solid var(--bd)',
                                  background: 'transparent',
                                  color: 'var(--t4)',
                                  borderRadius: 4,
                                  cursor: callLogLoading ? 'not-allowed' : 'pointer',
                                }}
                              >
                                {callLogLoading ? 'Loading...' : 'Refresh'}
                              </button>
                            </div>

                            {callLogData.length === 0 ? (
                              <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--t5)', ...mono, fontSize: 12 }}>
                                {callLogLoading ? 'Loading call log...' : 'No calls recorded — click Refresh to fetch'}
                              </div>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                  <tr>
                                    <th>Direction</th>
                                    <th>From / To</th>
                                    <th>Duration</th>
                                    <th>Result</th>
                                    <th>Date</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {callLogData.map((call) => (
                                    <tr key={call.id}>
                                      <td>
                                        <span style={{
                                          ...mono,
                                          fontSize: 10,
                                          fontWeight: 700,
                                          textTransform: 'uppercase',
                                          padding: '3px 8px',
                                          borderRadius: 3,
                                          background: call.direction === 'Outbound' ? 'var(--grnM)' : 'var(--bluM)',
                                          color: call.direction === 'Outbound' ? 'var(--grn)' : 'var(--blu)',
                                        }}>
                                          {call.direction === 'Outbound' ? 'Out' : 'In'}
                                        </span>
                                      </td>
                                      <td style={{ ...mono, fontSize: 12, color: 'var(--t3)' }}>
                                        {call.direction === 'Outbound'
                                          ? formatPhoneForDisplay(call.to?.phoneNumber || '')
                                          : formatPhoneForDisplay(call.from?.phoneNumber || '')}
                                      </td>
                                      <td style={{ ...mono, fontSize: 12, color: 'var(--t3)' }}>
                                        {formatDuration(call.duration || 0)}
                                      </td>
                                      <td>
                                        <span style={{
                                          ...mono,
                                          fontSize: 10,
                                          fontWeight: 700,
                                          textTransform: 'uppercase',
                                          color: call.result === 'Call connected' ? 'var(--grn)' : 'var(--ylw)',
                                        }}>
                                          {call.result || '-'}
                                        </span>
                                      </td>
                                      <td style={{ ...mono, fontSize: 11, color: 'var(--t4)' }}>
                                        {new Date(call.startTime).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* ── Tab 6: Notes ──────────────── */}
                  {detailTab === 'notes' && (
                    <div>
                      {/* Add Note */}
                      <div style={{ marginBottom: 16 }}>
                        <textarea
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          placeholder="Add a note..."
                          rows={3}
                          style={{
                            width: '100%',
                            background: 'var(--bg0)',
                            border: '1px solid var(--bd)',
                            borderRadius: 4,
                            padding: 10,
                            fontSize: 14,
                            color: 'var(--t1)',
                            fontFamily: 'inherit',
                            resize: 'vertical',
                            outline: 'none',
                          }}
                        />
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            marginTop: 8,
                          }}
                        >
                          <button
                            onClick={handleAddNote}
                            style={{
                              ...mono,
                              fontSize: 11,
                              fontWeight: 700,
                              background: 'var(--grn)',
                              color: 'var(--bg0)',
                              border: 'none',
                              borderRadius: 4,
                              padding: '8px 16px',
                              cursor: 'pointer',
                            }}
                          >
                            Add Note
                          </button>
                        </div>
                      </div>

                      {/* Notes Thread */}
                      {invNotes.length === 0 ? (
                        <div
                          style={{
                            textAlign: 'center',
                            padding: '20px 0',
                            color: 'var(--t4)',
                            ...mono,
                            fontSize: 13,
                          }}
                        >
                          No notes yet
                        </div>
                      ) : (
                        [...invNotes].reverse().map((note) => (
                          <div
                            key={note.id}
                            style={{
                              background: 'var(--bgI)',
                              borderRadius: 5,
                              padding: 12,
                              marginBottom: 8,
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                              <span className="mono" style={{ fontSize: 10, color: 'var(--grn)', fontWeight: 600 }}>
                                {note.by || 'j@vegarei.com'}
                              </span>
                              <span className="mono" style={{ fontSize: 10, color: 'var(--t5)' }}>
                                {new Date(note.date).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                            </div>
                            <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                              {note.text}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* ADVISORS TAB                           */}
      {/* ═══════════════════════════════════════ */}
      {dirTab === 'advisors' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}
        >
          {advisors.map((adv) => {
            const linked = investorsByAdvisor[adv.name] || []
            const aum = advisorAum[adv.name] || 0
            return (
              <div
                key={adv.id}
                style={{
                  background: 'rgba(30,58,64,0.5)',
                  border: '1px solid var(--bd)',
                  borderRadius: 6,
                  padding: 20,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--grnB)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--bd)')
                }
              >
                {/* Top row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--grn)',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      ...mono,
                      fontSize: 11,
                      color: 'var(--t5)',
                    }}
                  >
                    Advisor
                  </span>
                </div>

                {/* Name */}
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 300,
                    color: 'var(--t1)',
                    marginBottom: 4,
                  }}
                >
                  {adv.name}
                </div>

                {/* Contact Info */}
                {adv.phone && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                    <a href={`tel:${adv.phone}`} style={{ ...mono, fontSize: 11, color: 'var(--t3)', textDecoration: 'none' }}>
                      {adv.phone}
                    </a>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowRingOut({ phone: adv.phone, name: adv.name })
                      }}
                      title="Call via RingCentral"
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
                    >
                      <svg viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'var(--grn)' }}>
                        <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                      </svg>
                    </button>
                  </div>
                )}
                {adv.email && (
                  <div style={{ marginBottom: 4 }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        setShowEmailCompose({ email: adv.email, name: adv.name })
                      }}
                      style={{ ...mono, fontSize: 11, color: 'var(--t3)', textDecoration: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {adv.email}
                    </button>
                  </div>
                )}

                {/* AUM */}
                <div
                  style={{
                    ...mono,
                    fontSize: 12,
                    color: 'var(--t3)',
                    marginBottom: 12,
                  }}
                >
                  {fmt(aum)} AUM
                </div>

                {/* Investors label */}
                <div
                  style={{
                    ...mono,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    color: 'var(--t4)',
                    marginBottom: 8,
                  }}
                >
                  Investors ({linked.length})
                </div>

                {/* Linked investors */}
                {linked.map((inv) => (
                  <div
                    key={inv.id}
                    onClick={(e) => {
                      e.stopPropagation()
                      setDirTab('investors')
                      handleSelectInvestor(inv.id)
                    }}
                    style={{
                      padding: '6px 0',
                      fontSize: 14,
                      color: 'var(--t2)',
                      borderBottom: '1px solid rgba(52,92,99,0.3)',
                      cursor: 'pointer',
                    }}
                  >
                    {inv.name}
                  </div>
                ))}
                {linked.length === 0 && (
                  <div
                    style={{
                      ...mono,
                      fontSize: 11,
                      color: 'var(--t5)',
                      padding: '6px 0',
                    }}
                  >
                    No linked investors
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ═══════════════════════════════════════ */}
      {/* CUSTODIANS TAB                         */}
      {/* ═══════════════════════════════════════ */}
      {dirTab === 'custodians' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: 16,
          }}
        >
          {custodians.map((cust) => {
            const linked = investorsByCustodian[cust.name] || []
            const aum = custodianAum[cust.name] || 0
            return (
              <div
                key={cust.id}
                style={{
                  background: 'rgba(30,58,64,0.5)',
                  border: '1px solid var(--bd)',
                  borderRadius: 6,
                  padding: 20,
                  cursor: 'pointer',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--grnB)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = 'var(--bd)')
                }
              >
                {/* Top row */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: 'var(--blu)',
                      display: 'inline-block',
                    }}
                  />
                  <span
                    style={{
                      ...mono,
                      fontSize: 11,
                      color: 'var(--t5)',
                    }}
                  >
                    Custodian
                  </span>
                </div>

                {/* Name */}
                <div
                  style={{
                    fontSize: 20,
                    fontWeight: 300,
                    color: 'var(--t1)',
                    marginBottom: 4,
                  }}
                >
                  {cust.name}
                </div>

                {/* Stats */}
                <div
                  style={{
                    ...mono,
                    fontSize: 12,
                    color: 'var(--t3)',
                    marginBottom: 16,
                  }}
                >
                  {fmt(aum)} AUM &middot; {linked.length} investor
                  {linked.length !== 1 ? 's' : ''}
                </div>

                {/* Table */}
                {linked.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th>Investor</th>
                        <th>Advisor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linked.map((inv) => (
                        <tr key={inv.id}>
                          <td
                            onClick={() => {
                              setDirTab('investors')
                              handleSelectInvestor(inv.id)
                            }}
                            style={{
                              color: 'var(--grn)',
                              cursor: 'pointer',
                              fontSize: 13,
                            }}
                          >
                            {inv.name}
                          </td>
                          <td style={{ color: 'var(--t3)', fontSize: 13 }}>
                            {inv.advisor || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div
                    style={{
                      ...mono,
                      fontSize: 11,
                      color: 'var(--t5)',
                      padding: '6px 0',
                    }}
                  >
                    No linked investors
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── RingOut Call Dialog ──────────────────── */}
      {showRingOut && (
        rcAuth ? (
          <RingOutDialog
            to={showRingOut.phone}
            toName={showRingOut.name}
            onClose={() => setShowRingOut(null)}
          />
        ) : (
          // Fallback: open native tel: link when RC not connected
          (() => {
            window.open(`tel:${showRingOut.phone}`, '_self')
            setShowRingOut(null)
            return null
          })()
        )
      )}
      {/* ── Email Compose Dialog ───────────────── */}
      {showEmailCompose && (
        <EmailComposeDialog
          to={showEmailCompose.email}
          toName={showEmailCompose.name}
          onClose={() => setShowEmailCompose(null)}
        />
      )}

      {/* ── Decline Dialog ─────────────────────── */}
      {showDeclineDialog && (
        <>
          <div
            onClick={() => { setShowDeclineDialog(null); setDeclineReason('') }}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.6)',
              zIndex: 1000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'var(--bg1)',
                border: '1px solid var(--bdH)',
                borderRadius: 10,
                width: 420,
                boxShadow: '0 16px 64px rgba(0,0,0,0.8)',
              }}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '16px 20px',
                borderBottom: '1px solid var(--bd)',
              }}>
                <span style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--red)' }}>
                  Decline Investor
                </span>
                <button
                  onClick={() => { setShowDeclineDialog(null); setDeclineReason('') }}
                  style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: 18 }}
                >
                  ✕
                </button>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--t1)', marginBottom: 12 }}>
                  {showDeclineDialog.name}
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', display: 'block', marginBottom: 6 }}>
                    Reason for Decline
                  </label>
                  <textarea
                    value={declineReason}
                    onChange={(e) => setDeclineReason(e.target.value)}
                    placeholder="e.g. Did not meet accreditation requirements..."
                    rows={3}
                    style={{
                      ...mono,
                      fontSize: 12,
                      width: '100%',
                      padding: '8px 10px',
                      background: 'rgba(30,58,64,0.5)',
                      border: '1px solid var(--bd)',
                      borderRadius: 4,
                      color: 'var(--t1)',
                      resize: 'vertical',
                      outline: 'none',
                      boxSizing: 'border-box',
                    }}
                    onFocus={(e) => (e.target.style.borderColor = 'var(--red)')}
                    onBlur={(e) => (e.target.style.borderColor = 'var(--bd)')}
                  />
                </div>
              </div>
              <div style={{
                display: 'flex',
                gap: 10,
                justifyContent: 'flex-end',
                padding: '12px 20px',
                borderTop: '1px solid var(--bd)',
              }}>
                <button
                  onClick={() => { setShowDeclineDialog(null); setDeclineReason('') }}
                  style={{ ...mono, fontSize: 11, fontWeight: 700, padding: '10px 20px', border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t3)', borderRadius: 6, cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDecline}
                  disabled={!declineReason.trim()}
                  style={{
                    ...mono,
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '10px 20px',
                    border: '1px solid rgba(239,68,68,0.3)',
                    background: 'var(--redM)',
                    color: 'var(--red)',
                    borderRadius: 6,
                    cursor: declineReason.trim() ? 'pointer' : 'not-allowed',
                    opacity: declineReason.trim() ? 1 : 0.5,
                  }}
                >
                  Decline Investor
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── Advance Stage Dialog ───────────────── */}
      {showAdvanceDialog && (() => {
        const currentIdx = PIPELINE_STAGES.indexOf(showAdvanceDialog.currentStage)
        const nextStages = PIPELINE_STAGES.slice(currentIdx + 1)
        return (
          <>
            <div
              onClick={() => setShowAdvanceDialog(null)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: 'var(--bg1)',
                  border: '1px solid var(--bdH)',
                  borderRadius: 10,
                  width: 380,
                  boxShadow: '0 16px 64px rgba(0,0,0,0.8)',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '16px 20px',
                  borderBottom: '1px solid var(--bd)',
                }}>
                  <span style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--blu)' }}>
                    Advance Pipeline
                  </span>
                  <button
                    onClick={() => setShowAdvanceDialog(null)}
                    style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: 18 }}
                  >
                    ✕
                  </button>
                </div>
                <div style={{ padding: 20 }}>
                  <div style={{ fontSize: 14, color: 'var(--t2)', marginBottom: 4 }}>
                    {showAdvanceDialog.name}
                  </div>
                  <div style={{ ...mono, fontSize: 11, color: 'var(--t4)', marginBottom: 16 }}>
                    Current: <span style={{ color: 'var(--blu)' }}>{showAdvanceDialog.currentStage}</span>
                  </div>
                  <div style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 8 }}>
                    Move to:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {nextStages.map((stage) => (
                      <button
                        key={stage}
                        onClick={() => handleAdvanceStage(showAdvanceDialog.positionId, stage)}
                        style={{
                          ...mono,
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '10px 14px',
                          border: '1px solid var(--bd)',
                          background: 'rgba(30,58,64,0.5)',
                          color: 'var(--t2)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--grn)'; e.currentTarget.style.background = 'rgba(52,211,153,0.04)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.background = 'rgba(30,58,64,0.5)' }}
                      >
                        &#9654; {stage}
                      </button>
                    ))}
                    <button
                      onClick={() => {
                        setShowAdvanceDialog(null)
                        setShowDeclineDialog({ positionId: showAdvanceDialog.positionId, name: showAdvanceDialog.name })
                      }}
                      style={{
                        ...mono,
                        fontSize: 11,
                        fontWeight: 600,
                        padding: '10px 14px',
                        border: '1px solid rgba(239,68,68,0.3)',
                        background: 'var(--redM)',
                        color: 'var(--red)',
                        borderRadius: 6,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      ✕ Decline
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )
      })()}
    </div>
  )
}
