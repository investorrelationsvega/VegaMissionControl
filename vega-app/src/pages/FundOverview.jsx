// =============================================
// VEGA MISSION CONTROL - Fund Overview Page
// Fund-level dashboards with position breakdown,
// committed pipeline, audit trail, key dates,
// and documents
// =============================================

import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import useFundStore from '../stores/fundStore'
import useInvestorStore from '../stores/investorStore'
import useDistributionStore from '../stores/distributionStore'
import useUiStore from '../stores/uiStore'
import { fmt, fmtK } from '../utils/format'
import DriveDocuments from '../components/DriveDocuments'
import { PipelineBadge } from '../components/PipelineTracker'

// ── Inline style helpers ─────────────────────────────────────────────────────
const mono = { fontFamily: "'Space Mono', monospace" }

// ── Badge components ─────────────────────────────────────────────────────────
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

const formatTimestamp = (ts) => {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// ═══════════════════════════════════════════════
// FUND OVERVIEW PAGE COMPONENT
// ═══════════════════════════════════════════════
export default function FundOverview() {
  const navigate = useNavigate()

  // ── Stores ──────────────────────────────────
  const funds = useFundStore((s) => s.funds)
  const updateFund = useFundStore((s) => s.updateFund)
  const logCommitmentAction = useFundStore((s) => s.logCommitmentAction)
  const commitmentAuditLog = useFundStore((s) => s.commitmentAuditLog)
  const investorStore = useInvestorStore()
  const distributionStore = useDistributionStore()
  const showToast = useUiStore((s) => s.showToast)

  // ── State ───────────────────────────────────
  const [selectedFundIdx, setSelectedFundIdx] = useState(null)
  const [showCommittedModal, setShowCommittedModal] = useState(false)
  const [showActionModal, setShowActionModal] = useState(null) // { invId, name, amt, action: 'invest'|'close' }
  const [actionNotes, setActionNotes] = useState('')
  const [showAuditLog, setShowAuditLog] = useState(false)
  const [editingAmtId, setEditingAmtId] = useState(null) // position id being edited
  const [editingAmtValue, setEditingAmtValue] = useState('')

  // ── Derived data ────────────────────────────
  const selectedFund = selectedFundIdx !== null ? funds[selectedFundIdx] : null

  const getFundAmountText = (fund) => {
    if (fund.target === 0) return 'Target: TBD'
    return `${fmtK(fund.committed)} of ${fmtK(fund.target)}`
  }

  const getFundProgress = (fund) => {
    if (fund.target === 0) return 0
    return Math.min(100, (fund.committed / fund.target) * 100)
  }

  const getFundFooter = (fund) => {
    if (fund.status === 'Closed')
      return { left: `Closed ${fund.closeDate}`, right: `${fund.positionCount} positions` }
    if (fund.status === 'Open')
      return { left: `Aug 1, 2025 \u2014 Open`, right: `${fund.positionCount} positions` }
    return { left: 'Launch: TBD', right: 'Prospects only' }
  }

  const getBadgeClass = (status) => {
    if (status === 'Closed') return 'badge badge-closed'
    if (status === 'Open') return 'badge badge-open'
    return 'badge badge-pending'
  }

  // Fund-specific positions
  const fundPositions = useMemo(() => {
    if (!selectedFund) return []
    return investorStore.positions.filter(
      (p) => p.fund === selectedFund.shortName
    )
  }, [investorStore, selectedFund])

  // Fund investors
  const fundInvestors = useMemo(() => {
    if (!selectedFund) return []
    return investorStore.getByFund(selectedFund.shortName)
  }, [investorStore, selectedFund])

  // Committed investors (with amounts and contact info)
  const committedInvestors = useMemo(() => {
    if (!selectedFund) return []
    const map = {}
    fundPositions.forEach((p) => {
      if (!map[p.invId]) {
        const inv = investorStore.getInvestor(p.invId)
        map[p.invId] = {
          invId: p.invId,
          name: p.name,
          entity: p.entity || '',
          type: p.type,
          totalCommitted: 0,
          status: p.status,
          advisor: inv?.advisor || p.advisor || '',
          custodian: inv?.custodian || p.custodian || '',
          email: '', // placeholder
          phone: '', // placeholder
          positions: [],
        }
      }
      map[p.invId].totalCommitted += p.amt
      map[p.invId].positions.push(p)
    })
    return Object.values(map).sort((a, b) => b.totalCommitted - a.totalCommitted)
  }, [selectedFund, fundPositions, investorStore])

  // Overview stats
  const overviewStats = useMemo(() => {
    if (!selectedFund) return { raised: 0, target: 0, investorCount: 0, avgInvestment: 0, committed: 0, committedCount: 0 }
    const raised = selectedFund.committed
    const target = selectedFund.target
    const investorCount = fundInvestors.length
    const avgInvestment = investorCount > 0 ? raised / investorCount : 0
    const committed = committedInvestors.reduce((s, inv) => s + inv.totalCommitted, 0)
    return { raised, target, investorCount, avgInvestment, committed, committedCount: committedInvestors.length }
  }, [selectedFund, fundInvestors, committedInvestors])

  // Top investors by commitment (top 10)
  const topInvestors = useMemo(() => {
    if (!selectedFund) return []
    const map = {}
    fundPositions.forEach((p) => {
      if (!map[p.invId]) {
        map[p.invId] = { name: p.name, total: 0 }
      }
      map[p.invId].total += p.amt
    })
    return Object.values(map)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10)
  }, [selectedFund, fundPositions])

  const maxCommitment = useMemo(
    () => (topInvestors.length > 0 ? topInvestors[0].total : 1),
    [topInvestors]
  )

  // Key dates for selected fund
  const keyDates = useMemo(() => {
    if (!selectedFund) return []
    const dates = []
    if (selectedFund.closeDate) {
      dates.push({ label: 'Close Date', value: selectedFund.closeDate })
    } else if (selectedFund.status === 'Open') {
      dates.push({ label: 'Close Date', value: 'TBD' })
    }
    if (selectedFund.status === 'Closed' || selectedFund.status === 'Open') {
      dates.push({ label: 'Next Distribution', value: 'Feb 2026' })
    }
    if (selectedFund.status !== 'Pending') {
      dates.push({ label: 'Reporting Deadline', value: 'K-1s by Mar 15' })
    }
    if (selectedFund.vintage) {
      dates.push({ label: 'Vintage', value: selectedFund.vintage })
    }
    return dates
  }, [selectedFund])

  // Fund-specific audit log
  const fundAuditEntries = useMemo(() => {
    if (!selectedFund) return []
    return commitmentAuditLog
      .filter((e) => e.fundId === selectedFund.id)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
  }, [selectedFund, commitmentAuditLog])

  // Fund-specific activity feed
  const fundActivityFeed = useMemo(() => {
    if (!selectedFund) return []
    return investorStore.activityFeed
      .filter((a) => a.fund === selectedFund.shortName)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 15)
  }, [selectedFund, investorStore.activityFeed])

  // ── Handlers ────────────────────────────────
  const handleCommitmentAction = () => {
    if (!showActionModal || !actionNotes.trim()) {
      showToast('Notes are required')
      return
    }

    const actionLabel = showActionModal.action === 'invest' ? 'Moved to Invested' : 'Closed Out'

    logCommitmentAction({
      fundId: selectedFund.id,
      invId: showActionModal.invId,
      invName: showActionModal.name,
      action: actionLabel,
      detail: `${showActionModal.name}: ${fmt(showActionModal.amt)} — ${actionNotes.trim()}`,
      user: 'j@vegarei.com',
      notes: actionNotes.trim(),
    })

    showToast(`${showActionModal.name} ${actionLabel.toLowerCase()}`)
    setShowActionModal(null)
    setActionNotes('')
  }

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
        <h1 className="page-title">Fund Overview</h1>
        <p className="page-subtitle">Fund-Level Dashboards</p>
      </div>

      {/* ── Fund Cards ────────────────────────── */}
      <div className="section-label" style={{ marginBottom: 16 }}>Select Fund</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        {funds.map((fund, idx) => {
          const isActive = idx === selectedFundIdx
          const footer = getFundFooter(fund)
          return (
            <div
              key={fund.id}
              onClick={() => setSelectedFundIdx(idx)}
              style={{
                background: isActive ? 'rgba(52,211,153,0.03)' : 'var(--bg-card-half)',
                border: `1px solid ${isActive ? 'var(--grn)' : 'var(--bd)'}`,
                borderRadius: 6,
                padding: 20,
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = 'var(--grn)'
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.borderColor = 'var(--bd)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <span className={getBadgeClass(fund.status)}>{fund.status}</span>
                <span className="mono" style={{ fontSize: 11, color: 'var(--t5)' }}>{fund.shortName}</span>
              </div>
              <div style={{ fontSize: 16, fontWeight: 300, color: 'var(--t1)', marginBottom: 6, lineHeight: 1.3 }}>
                {fund.name}
              </div>
              <div className="mono" style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 12 }}>
                {getFundAmountText(fund)}
              </div>
              {fund.target > 0 && (
                <div style={{ width: '100%', height: 5, background: 'var(--bd)', borderRadius: 3, marginBottom: 12, overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      background: 'var(--grn)',
                      borderRadius: 3,
                      width: `${getFundProgress(fund)}%`,
                      transition: 'width 0.4s ease',
                    }}
                  />
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--t4)' }}>
                <span>{footer.left}</span>
                <span>{footer.right}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Fund Detail View ──────────────────── */}
      {selectedFund && (
        <>
          {/* Overview Row */}
          <div className="section-label" style={{ marginBottom: 16 }}>
            {selectedFund.shortName} Overview
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 24 }}>
            {[
              { label: 'Total Raised', value: fmtK(overviewStats.raised) },
              { label: 'Target', value: overviewStats.target > 0 ? fmtK(overviewStats.target) : 'TBD' },
              {
                label: 'Committed',
                value: fmt(overviewStats.committed),
                clickable: true,
                sub: `${overviewStats.committedCount} investors`,
                color: 'var(--blu)',
              },
              { label: 'Investor Count', value: overviewStats.investorCount },
              { label: 'Avg Investment', value: overviewStats.avgInvestment > 0 ? fmtK(overviewStats.avgInvestment) : '--' },
            ].map((stat, i) => (
              <div
                key={i}
                onClick={stat.clickable ? () => setShowCommittedModal(true) : undefined}
                style={{
                  background: 'rgba(30,58,64,0.5)',
                  border: `1px solid ${stat.clickable ? 'var(--bluM)' : 'var(--bd)'}`,
                  borderRadius: 6,
                  padding: '14px 18px',
                  cursor: stat.clickable ? 'pointer' : 'default',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  if (stat.clickable) e.currentTarget.style.borderColor = 'var(--blu)'
                }}
                onMouseLeave={(e) => {
                  if (stat.clickable) e.currentTarget.style.borderColor = 'var(--bluM)'
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
                  {stat.clickable && <span style={{ color: 'var(--blu)', marginLeft: 4 }}>&#9654;</span>}
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
                {stat.sub && (
                  <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', marginTop: 2 }}>
                    {stat.sub}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Content Grid (2fr + 1fr) */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 32 }}>

            {/* LEFT COLUMN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Position Breakdown Table */}
              <div
                style={{
                  background: 'var(--bg-card-half)',
                  border: '1px solid var(--bd)',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--bd)',
                  }}
                >
                  <span className="section-label">Position Breakdown</span>
                  <span className="mono" style={{ fontSize: 11, color: 'var(--t5)' }}>
                    {fundPositions.length} positions
                  </span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        <th>Investor</th>
                        <th>Entity</th>
                        <th>Type</th>
                        <th>Class</th>
                        <th className="right">Amount</th>
                        <th>Status</th>
                        <th>Funded Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {fundPositions.length === 0 ? (
                        <tr>
                          <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t4)' }}>
                            <span className="mono" style={{ fontSize: 13 }}>No positions</span>
                          </td>
                        </tr>
                      ) : (
                        fundPositions.map((p) => (
                          <tr key={p.id}>
                            <td
                              onClick={() => navigate('/pe/directory')}
                              style={{
                                color: 'var(--grn)',
                                cursor: 'pointer',
                                fontSize: 14,
                                fontWeight: 500,
                              }}
                            >
                              {p.name}
                            </td>
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
                              style={{ fontWeight: 700, color: 'var(--t1)' }}
                            >
                              {editingAmtId === p.id ? (
                                <input
                                  autoFocus
                                  type="text"
                                  value={editingAmtValue}
                                  onChange={(e) => {
                                    // Allow only numbers and commas
                                    const raw = e.target.value.replace(/[^0-9.,]/g, '')
                                    setEditingAmtValue(raw)
                                  }}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      const parsed = parseFloat(editingAmtValue.replace(/,/g, ''))
                                      if (!isNaN(parsed) && parsed > 0) {
                                        investorStore.updatePositionAmount(p.id, parsed, 'J. Jones')
                                        // Also update fund-level committed total
                                        if (selectedFund) {
                                          const diff = parsed - p.amt
                                          updateFund(selectedFund.id, { committed: selectedFund.committed + diff })
                                        }
                                        showToast(`Updated ${p.name} commitment to ${fmt(parsed)}`)
                                      }
                                      setEditingAmtId(null)
                                      setEditingAmtValue('')
                                    } else if (e.key === 'Escape') {
                                      setEditingAmtId(null)
                                      setEditingAmtValue('')
                                    }
                                  }}
                                  onBlur={() => {
                                    const parsed = parseFloat(editingAmtValue.replace(/,/g, ''))
                                    if (!isNaN(parsed) && parsed > 0 && parsed !== p.amt) {
                                      investorStore.updatePositionAmount(p.id, parsed, 'J. Jones')
                                      if (selectedFund) {
                                        const diff = parsed - p.amt
                                        updateFund(selectedFund.id, { committed: selectedFund.committed + diff })
                                      }
                                      showToast(`Updated ${p.name} commitment to ${fmt(parsed)}`)
                                    }
                                    setEditingAmtId(null)
                                    setEditingAmtValue('')
                                  }}
                                  style={{
                                    ...mono,
                                    fontSize: 13,
                                    fontWeight: 700,
                                    color: 'var(--t1)',
                                    background: 'rgba(52,211,153,0.08)',
                                    border: '1px solid var(--grn)',
                                    borderRadius: 4,
                                    padding: '4px 8px',
                                    width: 110,
                                    textAlign: 'right',
                                    outline: 'none',
                                    boxSizing: 'border-box',
                                  }}
                                />
                              ) : (
                                <span
                                  onClick={() => {
                                    setEditingAmtId(p.id)
                                    setEditingAmtValue(p.amt.toString())
                                  }}
                                  title="Click to edit"
                                  style={{
                                    cursor: 'pointer',
                                    padding: '4px 8px',
                                    borderRadius: 4,
                                    transition: 'background 0.15s',
                                  }}
                                  onMouseEnter={(e) => (e.target.style.background = 'rgba(52,211,153,0.08)')}
                                  onMouseLeave={(e) => (e.target.style.background = 'transparent')}
                                >
                                  {fmt(p.amt)}
                                </span>
                              )}
                            </td>
                            <td>
                              {p.pipeline ? (
                                <PipelineBadge stage={p.pipeline.stage} />
                              ) : (
                                <StatusBadge status={p.status} />
                              )}
                            </td>
                            <td
                              className="mono"
                              style={{ fontSize: 12, color: 'var(--t3)' }}
                            >
                              {p.funded || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Top Investors by Commitment */}
              <div
                style={{
                  background: 'var(--bg-card-half)',
                  border: '1px solid var(--bd)',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    padding: '16px 20px',
                    borderBottom: '1px solid var(--bd)',
                  }}
                >
                  <span className="section-label">Top Investors by Commitment</span>
                </div>
                <div style={{ padding: 20 }}>
                  {topInvestors.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: 20, color: 'var(--t4)' }}>
                      <span className="mono" style={{ fontSize: 13 }}>No investors</span>
                    </div>
                  ) : (
                    topInvestors.map((inv, idx) => (
                      <div
                        key={idx}
                        style={{ marginBottom: idx < topInvestors.length - 1 ? 12 : 0 }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: 4,
                          }}
                        >
                          <span style={{ fontSize: 13, color: 'var(--t2)' }}>
                            {inv.name}
                          </span>
                          <span
                            className="mono"
                            style={{ fontSize: 12, color: 'var(--t3)', fontWeight: 700 }}
                          >
                            {fmtK(inv.total)}
                          </span>
                        </div>
                        <div
                          style={{
                            width: '100%',
                            height: 6,
                            background: 'var(--bd)',
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}
                        >
                          <div
                            style={{
                              height: '100%',
                              background: 'var(--grn)',
                              borderRadius: 3,
                              width: `${(inv.total / maxCommitment) * 100}%`,
                              transition: 'width 0.3s ease',
                            }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Commitment Audit Log */}
              <div
                style={{
                  background: 'var(--bg-card-half)',
                  border: '1px solid var(--bd)',
                  borderRadius: 6,
                  overflow: 'hidden',
                }}
              >
                <div
                  onClick={() => setShowAuditLog(!showAuditLog)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px 20px',
                    borderBottom: showAuditLog ? '1px solid var(--bd)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span className="section-label">Commitment Activity Log</span>
                  <span style={{ fontSize: 12, color: 'var(--t5)', transition: 'transform 0.2s', transform: showAuditLog ? 'rotate(90deg)' : 'rotate(0)' }}>
                    &#9654;
                  </span>
                </div>
                {showAuditLog && (
                  <div style={{ padding: 20 }}>
                    {fundAuditEntries.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 20, color: 'var(--t5)', fontSize: 13, fontStyle: 'italic' }}>
                        No commitment activity logged yet. Actions will appear here when investors are moved to invested or closed out.
                      </div>
                    ) : (
                      fundAuditEntries.map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            padding: '10px 0',
                            borderBottom: '1px solid rgba(52,92,99,0.2)',
                          }}
                        >
                          <div style={{ display: 'flex', gap: 12 }}>
                            <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', width: 140, flexShrink: 0 }}>
                              {formatTimestamp(entry.timestamp)}
                            </div>
                            <div style={{ flex: 1 }}>
                              <span style={{
                                fontWeight: 600,
                                fontSize: 12,
                                color: entry.action === 'Moved to Invested' ? 'var(--grn)' : 'var(--red)',
                              }}>
                                {entry.action}
                              </span>
                              <span style={{ color: 'var(--t4)', marginLeft: 8, fontSize: 12 }}>{entry.invName}</span>
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
            </div>

            {/* RIGHT COLUMN (Sidebar) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

              {/* Key Dates */}
              <div className="sidebar-box">
                <div className="sidebar-title">Key Dates</div>
                {keyDates.length === 0 ? (
                  <div className="mono" style={{ fontSize: 12, color: 'var(--t5)', padding: '10px 0' }}>
                    No dates set
                  </div>
                ) : (
                  keyDates.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        background: 'rgba(52,92,99,0.3)',
                        borderRadius: 6,
                        padding: '12px 14px',
                        marginBottom: idx < keyDates.length - 1 ? 8 : 0,
                      }}
                    >
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
                        {item.label}
                      </div>
                      <div style={{ fontSize: 14, color: 'var(--t1)', fontWeight: 500 }}>
                        {item.value}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Fund Stats */}
              <div className="sidebar-box">
                <div className="sidebar-title">{selectedFund.shortName} Stats</div>
                <div className="stat-row">
                  <div className="stat-row-label">Total Raised</div>
                  <div className="stat-row-value">{fmtK(selectedFund.committed)}</div>
                </div>
                <div className="stat-row">
                  <div className="stat-row-label">Target</div>
                  <div className="stat-row-value small">
                    {selectedFund.target > 0 ? fmtK(selectedFund.target) : 'TBD'}
                  </div>
                </div>
                <div className="stat-row">
                  <div className="stat-row-label">Positions</div>
                  <div className="stat-row-value small">{fundPositions.length}</div>
                </div>
                <div className="stat-row">
                  <div className="stat-row-label">Investor Class</div>
                  <div className="stat-row-value small">{selectedFund.investorClass || '--'}</div>
                </div>
                <div className="stat-row">
                  <div className="stat-row-label">Vintage</div>
                  <div className="stat-row-value small">{selectedFund.vintage || '--'}</div>
                </div>
                {selectedFund.target > 0 && (
                  <div className="stat-row">
                    <div className="stat-row-label">% Funded</div>
                    <div className="stat-row-value small">
                      {getFundProgress(selectedFund).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>

              {/* Recent Activity Feed */}
              <div className="sidebar-box">
                <div className="sidebar-title">Recent Activity</div>
                {fundActivityFeed.length === 0 ? (
                  <div className="mono" style={{ fontSize: 12, color: 'var(--t5)', padding: '10px 0' }}>
                    No recent activity
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {fundActivityFeed.map((activity) => {
                      const typeConfig = {
                        new_investor: { icon: '●', color: 'var(--ylw)', label: 'NEW' },
                        webform_sent: { icon: '➤', color: 'var(--blu)', label: 'WEBFORM' },
                        webform_complete: { icon: '✓', color: 'var(--blu)', label: 'WEBFORM' },
                        docusign_signed: { icon: '✎', color: '#a855f7', label: 'DOCUSIGN' },
                        status_change: { icon: '→', color: 'var(--grn)', label: 'UPDATE' },
                        funded: { icon: '$', color: 'var(--grn)', label: 'FUNDED' },
                        declined: { icon: '✕', color: 'var(--red)', label: 'DECLINED' },
                      }
                      const config = typeConfig[activity.type] || typeConfig.status_change
                      const date = new Date(activity.date)
                      const isNew = !activity.read

                      return (
                        <div
                          key={activity.id}
                          style={{
                            padding: '10px 12px',
                            background: isNew ? 'rgba(251,191,36,0.04)' : 'rgba(52,92,99,0.3)',
                            border: `1px solid ${isNew ? 'rgba(251,191,36,0.15)' : 'transparent'}`,
                            borderRadius: 6,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{
                              ...mono,
                              fontSize: 9,
                              fontWeight: 700,
                              color: config.color,
                              background: `${config.color}15`,
                              padding: '2px 6px',
                              borderRadius: 3,
                              flexShrink: 0,
                              marginTop: 1,
                            }}>
                              {config.label}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12, color: 'var(--t2)', lineHeight: 1.4 }}>
                                {activity.message}
                              </div>
                              <div style={{ ...mono, fontSize: 9, color: 'var(--t5)', marginTop: 3 }}>
                                {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                {' '}
                                {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            {isNew && (
                              <span style={{
                                width: 6,
                                height: 6,
                                borderRadius: '50%',
                                background: 'var(--ylw)',
                                flexShrink: 0,
                                marginTop: 4,
                              }} />
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fund Documents — Google Drive Integration */}
          <div style={{ marginBottom: 32 }}>
            <DriveDocuments fundId={selectedFund.id} fundShortName={selectedFund.shortName} />
          </div>
        </>
      )}

      {/* Empty state when no fund selected */}
      {!selectedFund && (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 0',
            color: 'var(--t4)',
          }}
        >
          <svg viewBox="0 0 200 200" style={{ width: 48, height: 48, opacity: 0.15, marginBottom: 16 }}>
            <path
              d="M100 20 L180 180 H20 Z"
              fill="none"
              stroke="var(--t5)"
              strokeWidth="4"
            />
            <circle cx="100" cy="80" r="6" fill="var(--t5)" />
          </svg>
          <div className="mono" style={{ fontSize: 13 }}>
            Select a fund above to view details
          </div>
        </div>
      )}

      {/* ── Committed Investors Modal ───────────── */}
      {showCommittedModal && selectedFund && (
        <div
          className="modal-overlay active"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCommittedModal(false)
          }}
        >
          <div className="modal" style={{ maxWidth: 800 }}>
            <div className="modal-header">
              <div className="modal-title">
                {selectedFund.shortName} — Committed Investors ({committedInvestors.length})
              </div>
              <button
                className="modal-close"
                onClick={() => setShowCommittedModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto', padding: 0 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th>Investor</th>
                    <th>Entity</th>
                    <th>Type</th>
                    <th className="right">Committed</th>
                    <th>Advisor</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {committedInvestors.map((inv) => (
                    <tr
                      key={inv.invId}
                      style={{ transition: 'background 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bgH)')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td
                        onClick={() => {
                          setShowCommittedModal(false)
                          navigate('/pe/directory')
                        }}
                        style={{
                          color: 'var(--grn)',
                          cursor: 'pointer',
                          fontSize: 14,
                          fontWeight: 500,
                        }}
                      >
                        {inv.name}
                      </td>
                      <td style={{ color: 'var(--t3)', fontSize: 12 }}>{inv.entity || '-'}</td>
                      <td>
                        <span className="mono" style={{
                          fontSize: 9,
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          background: 'rgba(52,92,99,0.5)',
                          color: 'var(--t2)',
                          padding: '2px 6px',
                          borderRadius: 3,
                        }}>
                          {inv.type}
                        </span>
                      </td>
                      <td className="right" style={{ fontWeight: 700, color: 'var(--t1)' }}>
                        {fmt(inv.totalCommitted)}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--t4)' }}>{inv.advisor || '-'}</td>
                      <td><StatusBadge status={inv.status} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            onClick={() => setShowActionModal({ invId: inv.invId, name: inv.name, amt: inv.totalCommitted, action: 'invest' })}
                            className="mono"
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '3px 8px',
                              border: '1px solid var(--grnB)',
                              background: 'transparent',
                              color: 'var(--grn)',
                              borderRadius: 3,
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                            }}
                          >
                            Invest
                          </button>
                          <button
                            onClick={() => setShowActionModal({ invId: inv.invId, name: inv.name, amt: inv.totalCommitted, action: 'close' })}
                            className="mono"
                            style={{
                              fontSize: 9,
                              fontWeight: 700,
                              padding: '3px 8px',
                              border: '1px solid rgba(248,113,113,0.3)',
                              background: 'transparent',
                              color: 'var(--red)',
                              borderRadius: 3,
                              cursor: 'pointer',
                              textTransform: 'uppercase',
                            }}
                          >
                            Close Out
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{ padding: '16px 20px', borderTop: '1px solid var(--bd)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span className="mono" style={{ fontSize: 12, color: 'var(--t4)' }}>
                    Total Committed
                  </span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--t1)' }}>
                    {fmt(overviewStats.committed)}
                  </span>
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCommittedModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Move to Invested / Close Out Modal ──── */}
      {showActionModal && (
        <div
          className="modal-overlay active"
          style={{ display: 'flex', zIndex: 150 }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowActionModal(null)
              setActionNotes('')
            }
          }}
        >
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title">
                {showActionModal.action === 'invest' ? 'Move to Invested' : 'Close Out Commitment'}
              </div>
              <button
                className="modal-close"
                onClick={() => { setShowActionModal(null); setActionNotes('') }}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 500, color: 'var(--t1)', marginBottom: 4 }}>
                  {showActionModal.name}
                </div>
                <div className="mono" style={{ fontSize: 12, color: 'var(--t3)' }}>
                  Committed: {fmt(showActionModal.amt)}
                </div>
              </div>

              <div style={{
                padding: '12px 14px',
                background: showActionModal.action === 'invest' ? 'rgba(52,211,153,0.06)' : 'rgba(248,113,113,0.06)',
                border: `1px solid ${showActionModal.action === 'invest' ? 'var(--grnB)' : 'rgba(248,113,113,0.3)'}`,
                borderRadius: 6,
                marginBottom: 16,
              }}>
                <div className="mono" style={{ fontSize: 10, color: showActionModal.action === 'invest' ? 'var(--grn)' : 'var(--red)', marginBottom: 4 }}>
                  {showActionModal.action === 'invest'
                    ? 'This will log this investor as having moved from committed to invested status.'
                    : 'This will log this commitment as closed out. The investor will not be moved to invested.'}
                </div>
              </div>

              <div>
                <label className="form-label">Notes (Required)</label>
                <textarea
                  className="form-textarea"
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  placeholder={showActionModal.action === 'invest'
                    ? 'e.g. Funding received, wired on Jan 15...'
                    : 'e.g. Investor withdrew interest, could not meet minimum...'}
                  rows={3}
                  style={{ fontSize: 13 }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => { setShowActionModal(null); setActionNotes('') }}
              >
                Cancel
              </button>
              <button
                className={`btn ${showActionModal.action === 'invest' ? 'btn-primary' : 'btn-danger'}`}
                onClick={handleCommitmentAction}
              >
                {showActionModal.action === 'invest' ? 'Move to Invested' : 'Close Out'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
