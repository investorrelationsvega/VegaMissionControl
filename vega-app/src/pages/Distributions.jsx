// =============================================
// VEGA MISSION CONTROL - Distributions Page
// Payment management with period filtering,
// CSV import/export, notes, and audit trail
// =============================================

import { useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import useResponsive from '../hooks/useResponsive'
import useDistributionStore from '../stores/distributionStore'
import useInvestorStore from '../stores/investorStore'
import useFundStore from '../stores/fundStore'
import useTicStore from '../stores/ticStore'
import useUiStore from '../stores/uiStore'
import { fmt, fmtK } from '../utils/format'
import DistributionKpis from '../components/DistributionKpis'

// ── Inline style helpers ─────────────────────────────────────────────────────
const mono = { fontFamily: "'Space Mono', monospace" }

// ── Badge components ─────────────────────────────────────────────────────────
function MethodBadge({ method }) {
  let bg, color
  if (method === 'Wire') {
    bg = 'var(--bluM)'
    color = 'var(--blu)'
  } else if (method === 'Check') {
    bg = 'var(--ylwM)'
    color = 'var(--ylw)'
  } else {
    bg = 'var(--bgM)'
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

function StatusBadge({ status }) {
  let cls = 'badge badge-muted'
  if (status === 'Sent') cls = 'badge badge-green'
  else if (status === 'Prep') cls = 'badge badge-yellow'
  return <span className={cls}>{status}</span>
}

function ReconciliationBadge({ value }) {
  let cls = 'badge badge-yellow'
  if (value === 'Matched') cls = 'badge badge-green'
  else if (value === 'Unmatched') cls = 'badge badge-red'
  return <span className={cls}>{value || 'Pending'}</span>
}

function PortalBadge({ value }) {
  if (value === 'Yes') return <span className="badge badge-green">Yes</span>
  if (value === 'No') return <span className="badge badge-red">No</span>
  return <span className="badge badge-muted">{value || 'Pending'}</span>
}

// ── Date formatting for Syndication Pro ──────────────────────────────────────
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function toSyndicationDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) {
    const parts = dateStr.replace(',', '').split(' ')
    if (parts.length >= 2) {
      const monthIdx = MONTHS.findIndex(m => dateStr.startsWith(m))
      if (monthIdx >= 0) {
        const day = parts[1] ? parts[1].padStart(2, '0') : '01'
        const year = parts[2] || String(new Date().getFullYear())
        return `${MONTHS[monthIdx]}-${day}-${year}`
      }
    }
    return dateStr
  }
  const month = MONTHS[d.getMonth()]
  const day = String(d.getDate()).padStart(2, '0')
  const year = d.getFullYear()
  return `${month}-${day}-${year}`
}

// ── CSV Helper ───────────────────────────────────────────────────────────────
function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function escapeCSV(val) {
  const str = String(val ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

function quoteCSV(val) {
  const str = String(val ?? '')
  return `"${str.replace(/"/g, '""')}"`
}

const formatTimestamp = (ts) => {
  const d = new Date(ts)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
    ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
}

// ═══════════════════════════════════════════════
// DISTRIBUTIONS PAGE COMPONENT
// ═══════════════════════════════════════════════
export default function Distributions() {
  const { isMobile, isTablet } = useResponsive()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  // ── Stores ──────────────────────────────────
  const distributionStore = useDistributionStore()
  const investorStore = useInvestorStore()
  const fundStore = useFundStore()
  const ticStore = useTicStore()
  const showToast = useUiStore((s) => s.showToast)

  // ── State ───────────────────────────────────
  const [distTab, setDistTab] = useState('distributions')
  const [selectedPeriod, setSelectedPeriod] = useState(null)
  const [showPaymentModal, setShowPaymentModal] = useState(false)
  const [editingPayment, setEditingPayment] = useState(null)
  const [showImportModal, setShowImportModal] = useState(false)
  const [importMatches, setImportMatches] = useState([])
  const [showAddPeriodModal, setShowAddPeriodModal] = useState(false)
  const [newPeriodName, setNewPeriodName] = useState('')
  const [showCalcModal, setShowCalcModal] = useState(false)
  const [calcPercent, setCalcPercent] = useState('')
  const [calcFund, setCalcFund] = useState('Fund II')
  const [expandedId, setExpandedId] = useState(null)
  const [inlineEdit, setInlineEdit] = useState(null) // { id, field, value }

  // ACH Batch state
  const [showBatchPanel, setShowBatchPanel] = useState(false)
  const [showBatchModal, setShowBatchModal] = useState(false)
  const [editingBatch, setEditingBatch] = useState(null)
  const [batchForm, setBatchForm] = useState({
    batchId: '',
    fundingAccount: 'VEGA FUND II CHK',
    deliverBy: '',
    status: 'Submitted',
    submittedDate: '',
    succeededDate: '',
  })

  // Payment form state
  const [formData, setFormData] = useState({
    invId: '',
    entity: '',
    amt: '',
    method: 'ACH',
    status: 'Prep',
    date: '',
    trackingRef: '',
    reportedInPortal: 'Pending',
    reconciliation: 'Pending',
    fund: 'Fund II',
    period: '',
    notes: '',
  })

  // ── Derived data ────────────────────────────
  const periods = useMemo(() => distributionStore.getPeriods(), [distributionStore])
  const activePeriod = selectedPeriod || (periods.length > 0 ? periods[0] : null)

  const periodPayments = useMemo(
    () => (activePeriod ? distributionStore.getByPeriod(activePeriod) : []),
    [distributionStore, activePeriod]
  )

  const investors = useMemo(() => investorStore.getAll(), [investorStore])
  const funds = useMemo(() => fundStore.getAllFunds(), [fundStore])
  const positions = investorStore.positions

  // New investor flags
  const newInvestorFlags = distributionStore.newInvestorFlags || []

  // TIC property income for current period (Fund II only)
  const ticPropertyIncome = useMemo(() => {
    if (!activePeriod) return null
    const properties = ticStore.getProperties()
    if (properties.length === 0) return null
    const items = properties.map((prop) => {
      const fundIIOwner = prop.owners.find((o) => o.isFundII)
      return {
        name: prop.name,
        ownership: prop.fundIIOwnership,
        distribution: fundIIOwner?.distributions[activePeriod] || 0,
      }
    }).filter((p) => p.distribution > 0)
    if (items.length === 0) return null
    const total = items.reduce((s, p) => s + p.distribution, 0)
    return { items, total }
  }, [activePeriod, ticStore.ticProperties])
  const pendingFlags = newInvestorFlags.filter((f) => f.status === 'Pending Review')

  // Stats
  const totalAmount = useMemo(
    () => periodPayments.reduce((s, d) => s + d.amt, 0),
    [periodPayments]
  )
  const paymentCount = periodPayments.length
  const achCount = useMemo(
    () => periodPayments.filter((d) => d.method === 'ACH').length,
    [periodPayments]
  )
  const wireCount = useMemo(
    () => periodPayments.filter((d) => d.method === 'Wire').length,
    [periodPayments]
  )
  const checkCount = useMemo(
    () => periodPayments.filter((d) => d.method === 'Check').length,
    [periodPayments]
  )

  // ACH batches for current period
  const periodBatches = useMemo(
    () => (activePeriod ? distributionStore.getAchBatchesByPeriod(activePeriod) : []),
    [distributionStore, activePeriod]
  )

  // ── ACH Batch Handlers ────────────────────────
  const openAddBatch = () => {
    setEditingBatch(null)
    setBatchForm({
      batchId: '',
      fundingAccount: 'VEGA FUND II CHK',
      deliverBy: '',
      status: 'Submitted',
      submittedDate: '',
      succeededDate: '',
    })
    setShowBatchModal(true)
  }

  const openEditBatch = (batch) => {
    setEditingBatch(batch)
    setBatchForm({
      batchId: batch.batchId || '',
      fundingAccount: batch.fundingAccount || 'VEGA FUND II CHK',
      deliverBy: batch.deliverBy || '',
      status: batch.status || 'Submitted',
      submittedDate: batch.submittedDate || '',
      succeededDate: batch.succeededDate || '',
    })
    setShowBatchModal(true)
  }

  const handleSaveBatch = () => {
    if (!batchForm.batchId.trim()) return
    const payload = {
      ...batchForm,
      period: activePeriod,
    }
    // Auto-set submitted date if status is Submitted and no date set
    if (payload.status === 'Submitted' && !payload.submittedDate) {
      payload.submittedDate = new Date().toISOString().split('T')[0]
    }

    if (editingBatch) {
      distributionStore.updateAchBatch(editingBatch.id, payload)
      showToast('Batch updated')
    } else {
      distributionStore.addAchBatch(payload)
      showToast('ACH batch created')
    }
    setShowBatchModal(false)
  }

  const handleAssignBatch = (batchId) => {
    // Assign all unassigned ACH payments in current period to this batch
    const unassigned = periodPayments
      .filter((d) => d.method === 'ACH' && !d.achBatchId && d.status !== 'Skipped')
      .map((d) => d.id)
    if (unassigned.length === 0) {
      showToast('No unassigned ACH payments')
      return
    }
    distributionStore.assignToBatch(unassigned, batchId)
    showToast(`${unassigned.length} payment${unassigned.length > 1 ? 's' : ''} assigned to batch`)
  }

  // ── Handlers ────────────────────────────────
  const openAddPayment = () => {
    setEditingPayment(null)
    setFormData({
      invId: '',
      entity: '',
      amt: '',
      method: 'ACH',
      status: 'Prep',
      date: '',
      trackingRef: '',
      reportedInPortal: 'Pending',
      reconciliation: 'Pending',
      fund: 'Fund II',
      period: activePeriod || '',
      notes: '',
    })
    setShowPaymentModal(true)
  }

  const openEditPayment = (payment) => {
    setEditingPayment(payment)
    setFormData({
      invId: payment.invId,
      entity: payment.entity || '',
      amt: String(payment.amt),
      method: payment.method,
      status: payment.status,
      date: payment.date || '',
      trackingRef: payment.trackingRef || '',
      reportedInPortal: payment.reportedInPortal || 'Pending',
      reconciliation: payment.reconciliation || 'Pending',
      fund: payment.fund || 'Fund II',
      period: payment.period,
      notes: payment.notes || '',
    })
    setShowPaymentModal(true)
  }

  const handleSavePayment = () => {
    const inv = investors.find((i) => i.id === formData.invId)
    const payload = {
      invId: formData.invId,
      name: inv ? inv.name : '',
      entity: formData.entity,
      amt: parseFloat(formData.amt) || 0,
      method: formData.method,
      status: formData.status,
      date: formData.date,
      trackingRef: formData.trackingRef,
      reportedInPortal: formData.reportedInPortal,
      reconciliation: formData.reconciliation,
      fund: formData.fund,
      period: formData.period || activePeriod,
      notes: formData.notes,
    }

    if (editingPayment) {
      distributionStore.updatePayment(editingPayment.id, payload)
      showToast('Payment updated')
    } else {
      distributionStore.addPayment(payload)
      showToast('Payment added')
    }
    setShowPaymentModal(false)
  }

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  // ── Inline edit helpers ──────────────────────
  const startInlineEdit = (id, field, currentValue) => {
    setInlineEdit({ id, field, value: String(currentValue ?? '') })
  }

  const saveInlineEdit = () => {
    if (!inlineEdit) return
    const { id, field, value } = inlineEdit
    const current = distributionStore.getById(id)
    if (!current) { setInlineEdit(null); return }

    let parsedValue = value
    if (field === 'amt') parsedValue = parseFloat(value) || 0

    if (String(current[field] ?? '') !== String(parsedValue)) {
      distributionStore.updatePayment(id, { [field]: parsedValue })
      showToast(`${field === 'amt' ? 'Amount' : field === 'date' ? 'Date' : field === 'notes' ? 'Notes' : field} updated`)
    }
    setInlineEdit(null)
  }

  const cancelInlineEdit = () => setInlineEdit(null)

  const handleInlineKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); saveInlineEdit() }
    if (e.key === 'Escape') cancelInlineEdit()
  }

  // ── Add Period ──────────────────────────────
  const handleAddPeriod = () => {
    if (!newPeriodName.trim()) return
    setSelectedPeriod(newPeriodName.trim())
    setShowAddPeriodModal(false)
    setNewPeriodName('')
    showToast(`Period "${newPeriodName.trim()}" created`)
  }

  // ── Export Syndication Pro CSV ──────────────
  const handleExportSyndicationPro = () => {
    const headers = [
      'First Name', 'Last Name', 'Profile Name', 'Investor Class',
      'Funded Amount', 'Committed Amount', 'Funded Date', 'Start Date',
      'End Date', 'Payment Date', 'Memo', 'Amount', 'Distribution Type',
      '% Funded', '% Ownership',
    ]

    // Calculate total funded for % Funded column
    const totalFunded = periodPayments.reduce((sum, payment) => {
      const pos = positions.find(
        (p) => p.invId === payment.invId && p.fund === payment.fund
      )
      return sum + (pos?.amt || 0)
    }, 0)

    // SynPro uses today's date for Start/End/Payment Date
    const todayFormatted = toSyndicationDate(new Date().toISOString())

    const rows = periodPayments.map((payment) => {
      const inv = investors.find((i) => i.id === payment.invId)
      const pos = positions.find(
        (p) => p.invId === payment.invId && p.fund === payment.fund
      )

      const nameParts = (inv?.name || payment.name || '').split(' ')
      const firstName = nameParts[0] || ''
      const lastName = nameParts.slice(1).join(' ') || ''

      const fundedAmt = pos?.amt || 0
      const committedAmt = pos?.amt || 0
      const investorClass = pos?.cls ? `Class ${pos.cls}` : ''
      const pctFunded = totalFunded > 0 ? (fundedAmt / totalFunded) : 0

      return [
        firstName, lastName, payment.entity || inv?.name || '', investorClass,
        fundedAmt ? fundedAmt.toFixed(2) : '', committedAmt ? committedAmt.toFixed(2) : '',
        toSyndicationDate(pos?.funded || ''),
        todayFormatted, todayFormatted, todayFormatted,
        '', payment.amt ? Number(payment.amt).toFixed(2) : '', '',
        pctFunded ? pctFunded.toFixed(8) : '', '0',
      ].map(quoteCSV).join(',')
    })

    const csv = [headers.map(quoteCSV).join(','), ...rows].join('\n')
    const periodSlug = (activePeriod || 'export').replace(/\s+/g, '-')
    downloadCSV(`syndication-pro-${periodSlug}.csv`, csv)
    showToast('Syndication Pro CSV exported')
  }

  // ── Export Distribution Report ─────────────
  const handleExportReport = () => {
    const headers = [
      'Investor', 'Entity', 'Fund', 'Amount', 'Method',
      'Status', 'Sent Date', 'Tracking Ref', 'Reported In Portal', 'Reconciliation',
    ]

    const rows = periodPayments.map((d) =>
      [
        d.name, d.entity, d.fund, d.amt, d.method,
        d.status, d.date, d.trackingRef, d.reportedInPortal, d.reconciliation,
      ].map(escapeCSV).join(',')
    )

    const csv = [headers.join(','), ...rows].join('\n')
    const periodSlug = (activePeriod || 'report').replace(/\s+/g, '-')
    downloadCSV(`distribution-report-${periodSlug}.csv`, csv)
    showToast('Distribution report exported')
  }

  // ── Import MACU CSV ────────────────────────
  const handleImportMACV = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      const lines = text.split('\n').filter((l) => l.trim())
      if (lines.length < 2) {
        showToast('CSV file is empty or invalid')
        return
      }

      const headerLine = lines[0]
      const headers = headerLine.split(',').map((h) => h.trim().toLowerCase())
      const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('payee'))
      const amtIdx = headers.findIndex((h) => h.includes('amount') || h.includes('amt'))
      const refIdx = headers.findIndex((h) => h.includes('ref') || h.includes('confirmation') || h.includes('tracking'))

      const matches = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''))
        const csvName = nameIdx >= 0 ? cols[nameIdx] : ''
        const csvAmt = amtIdx >= 0 ? parseFloat(cols[amtIdx]) || 0 : 0
        const csvRef = refIdx >= 0 ? cols[refIdx] : ''

        const matched = periodPayments.find((p) => {
          const nameMatch =
            csvName &&
            (p.name.toLowerCase().includes(csvName.toLowerCase()) ||
              csvName.toLowerCase().includes(p.name.toLowerCase()) ||
              (p.entity && p.entity.toLowerCase().includes(csvName.toLowerCase())))
          const amtMatch = csvAmt > 0 && Math.abs(p.amt - csvAmt) < 1
          return nameMatch || amtMatch
        })

        matches.push({
          csvRow: i,
          csvName,
          csvAmt,
          csvRef,
          matchedPayment: matched || null,
          confirmed: !!matched,
        })
      }

      setImportMatches(matches)
      setShowImportModal(true)
    }
    reader.readAsText(file)

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleConfirmImport = () => {
    let updated = 0
    importMatches
      .filter((m) => m.confirmed && m.matchedPayment)
      .forEach((m) => {
        const updates = {}
        if (m.csvRef) updates.trackingRef = m.csvRef
        if (Object.keys(updates).length > 0) {
          distributionStore.updatePayment(m.matchedPayment.id, updates)
          updated++
        }
      })
    setShowImportModal(false)
    showToast(`${updated} payment${updated !== 1 ? 's' : ''} updated from import`)
  }

  // ── Flag handlers ───────────────────────────
  const handleDismissFlag = (flagId) => {
    distributionStore.dismissFlag(flagId)
    showToast('Flag dismissed')
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
        <h1 className="page-title">Distributions</h1>
        <p className="page-subtitle">Payment Management</p>
      </div>

      {/* ── Section Tabs ─────────────────────────── */}
      <div style={{ display: 'flex', marginBottom: 24 }}>
        {[
          { key: 'distributions', label: 'Distributions', radius: '4px 0 0 4px' },
          { key: 'kpis', label: 'KPIs', radius: '0 4px 4px 0' },
        ].map((tab) => {
          const active = distTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setDistTab(tab.key)}
              style={{
                ...mono,
                fontSize: 12,
                fontWeight: 700,
                padding: '10px 24px',
                border: '1px solid',
                borderColor: active ? 'rgba(52,211,153,0.5)' : 'var(--bd)',
                borderLeft: tab.key === 'kpis' ? 'none' : undefined,
                borderRadius: tab.radius,
                background: active ? 'rgba(52,211,153,0.1)' : 'transparent',
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

      {/* ── KPI Tab ──────────────────────────────── */}
      {distTab === 'kpis' && <DistributionKpis />}

      {/* ── Distributions Tab ────────────────────── */}
      {distTab === 'distributions' && (<>

      {/* ── New Investor Flags ─────────────────── */}
      {pendingFlags.length > 0 && (
        <div
          style={{
            background: 'rgba(251,191,36,0.06)',
            border: '1px solid var(--ylwB)',
            borderRadius: 6,
            padding: 16,
            marginBottom: 20,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
            <span style={{ width: 8, height: 8, background: 'var(--ylw)', borderRadius: '50%', display: 'inline-block' }} />
            <span className="section-label">
              {pendingFlags.length} Investor{pendingFlags.length !== 1 ? 's' : ''} Need Distribution Review
            </span>
          </div>
          {pendingFlags.map((flag) => {
            const inv = investors.find((i) => i.id === flag.invId)
            return (
              <div
                key={flag.id}
                style={{
                  background: 'var(--bgI)',
                  borderRadius: 6,
                  padding: '14px 16px',
                  marginBottom: 8,
                  borderLeft: '3px solid var(--ylw)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 15, color: 'var(--t1)', fontWeight: 500 }}>
                      {flag.invName}
                    </div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>
                      Added to {flag.fundName}
                      {inv ? ` \u2022 Committed: ${fmt(inv.totalCommitted)}` : ''}
                      {inv?.advisor ? ` \u2022 Advisor: ${inv.advisor}` : ''}
                    </div>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', marginTop: 2 }}>
                      Flagged {new Date(flag.flaggedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <span className="badge badge-yellow">Needs Review</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: 10, padding: '5px 12px' }}
                    onClick={() => {
                      distributionStore.resolveFlag(flag.id, 'Add to Current Period', 'Added to current period distribution')
                      showToast(`${flag.invName} added to current period distribution`)
                    }}
                  >
                    Add to Current Period
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 10, padding: '5px 12px' }}
                    onClick={() => {
                      distributionStore.resolveFlag(flag.id, 'Add to Next Period', 'Deferred to next period')
                      showToast(`${flag.invName} deferred to next period`)
                    }}
                  >
                    Add to Next Period
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 10, padding: '5px 12px', color: 'var(--ylw)', borderColor: 'var(--ylwB)' }}
                    onClick={() => {
                      distributionStore.resolveFlag(flag.id, 'Pay Back Distribution', 'Scheduled for back distribution payment')
                      showToast(`${flag.invName} scheduled for back distribution`)
                    }}
                  >
                    Pay Back Distribution
                  </button>
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: 10, padding: '5px 12px', opacity: 0.6 }}
                    onClick={() => {
                      distributionStore.dismissFlag(flag.id)
                      showToast(`${flag.invName} flag dismissed`)
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Period Selector ───────────────────── */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 8,
          marginBottom: 24,
          alignItems: 'center',
        }}
      >
        {periods.map((period) => {
          const isActive = period === activePeriod
          return (
            <button
              key={period}
              onClick={() => setSelectedPeriod(period)}
              className="mono"
              style={{
                fontSize: 12,
                fontWeight: 700,
                padding: '8px 20px',
                border: '1px solid',
                borderColor: isActive ? 'var(--grnB)' : 'var(--bd)',
                borderRadius: 20,
                background: isActive ? 'var(--grnM)' : 'transparent',
                color: isActive ? 'var(--grn)' : 'var(--t4)',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {period}
            </button>
          )
        })}
        <button
          onClick={() => setShowAddPeriodModal(true)}
          className="mono"
          style={{
            fontSize: 12,
            fontWeight: 700,
            padding: '8px 20px',
            border: '1px dashed var(--bd)',
            borderRadius: 20,
            background: 'transparent',
            color: 'var(--t5)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
        >
          + Add Period
        </button>
      </div>

      {/* ── TIC Property Income Card ────────────── */}
      {ticPropertyIncome && (
        <div
          style={{
            background: 'rgba(52,211,153,0.03)',
            border: '1px solid var(--grnB)',
            borderRadius: 6,
            padding: '14px 20px',
            marginBottom: 16,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="mono" style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--grn)' }}>
                TIC Property Income
              </span>
              <span className="mono" style={{ fontSize: 10, color: 'var(--t5)' }}>
                {activePeriod}
              </span>
            </div>
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--grn)' }}>
              {fmt(ticPropertyIncome.total)}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {ticPropertyIncome.items.map((prop) => (
              <div
                key={prop.name}
                style={{
                  background: 'var(--bgM3)',
                  borderRadius: 4,
                  padding: '8px 12px',
                  minWidth: 120,
                }}
              >
                <div style={{ fontSize: 12, color: 'var(--t2)', fontWeight: 500, marginBottom: 2 }}>
                  {prop.name}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                  <span className="mono" style={{ fontSize: 10, color: 'var(--t4)' }}>
                    {prop.ownership > 0 ? `${prop.ownership}%` : 'TBD'}
                  </span>
                  <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--t1)' }}>
                    {fmt(prop.distribution)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Summary Stats ─────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Total Amount', value: fmt(totalAmount) },
          { label: 'Payment Count', value: paymentCount },
          { label: 'ACH', value: achCount },
          { label: 'Wire / Check', value: `${wireCount} / ${checkCount}` },
        ].map((stat, i) => (
          <div
            key={i}
            style={{
              background: 'var(--bgS)',
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
                color: 'var(--t1)',
              }}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── ACH Batch Manager ────────────────── */}
      <div style={{ marginBottom: 20 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            marginBottom: showBatchPanel ? 12 : 0,
            cursor: 'pointer',
          }}
          onClick={() => setShowBatchPanel(!showBatchPanel)}
        >
          <div
            className="mono"
            style={{
              fontSize: 10,
              textTransform: 'uppercase',
              letterSpacing: '0.15em',
              color: 'var(--t4)',
              fontWeight: 700,
            }}
          >
            ACH Batches {periodBatches.length > 0 && `(${periodBatches.length})`}
          </div>
          <span style={{ fontSize: 10, color: 'var(--t5)' }}>
            {showBatchPanel ? '\u25B2' : '\u25BC'}
          </span>
        </div>

        {showBatchPanel && (
          <div
            style={{
              background: 'var(--bgS)',
              border: '1px solid var(--bd)',
              borderRadius: 6,
              padding: 16,
            }}
          >
            {periodBatches.length === 0 ? (
              <div style={{ color: 'var(--t4)', fontSize: 13, marginBottom: 12 }}>
                No ACH batches for this period yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                {periodBatches.map((batch) => {
                  const assignedPayments = periodPayments.filter((d) => d.achBatchId === batch.id)
                  const batchTotal = assignedPayments.reduce((s, d) => s + d.amt, 0)
                  const isSucceeded = batch.status === 'Succeeded'
                  return (
                    <div
                      key={batch.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr auto',
                        gap: 12,
                        alignItems: 'center',
                        padding: '12px 14px',
                        background: 'var(--bg-card-half)',
                        border: `1px solid ${isSucceeded ? 'var(--grnB)' : 'var(--bd)'}`,
                        borderRadius: 6,
                      }}
                    >
                      <div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                          Batch ID
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>
                          {batch.batchId}
                        </div>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>
                          {batch.fundingAccount}
                        </div>
                      </div>

                      <div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                          Status
                        </div>
                        <span
                          className="mono"
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            textTransform: 'uppercase',
                            padding: '3px 8px',
                            borderRadius: 3,
                            background: isSucceeded ? 'var(--grnM)' : 'var(--bluM)',
                            color: isSucceeded ? 'var(--grn)' : 'var(--blu)',
                          }}
                        >
                          {batch.status}
                        </span>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--t4)', marginTop: 4 }}>
                          {batch.submittedDate && (
                            <span>Submitted: {batch.submittedDate}</span>
                          )}
                          {batch.succeededDate && (
                            <span style={{ marginLeft: batch.submittedDate ? 10 : 0 }}>
                              Succeeded: {batch.succeededDate}
                            </span>
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 2 }}>
                          Payments / Total
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--t1)' }}>
                          {assignedPayments.length} payments &mdash; {fmt(batchTotal)}
                        </div>
                        {batch.deliverBy && (
                          <div className="mono" style={{ fontSize: 11, color: 'var(--t4)', marginTop: 2 }}>
                            Deliver by: {batch.deliverBy}
                          </div>
                        )}
                      </div>

                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 10, padding: '4px 10px' }}
                          onClick={() => handleAssignBatch(batch.id)}
                          title="Assign all unassigned ACH payments to this batch"
                        >
                          Assign ACH
                        </button>
                        <button
                          className="btn btn-secondary"
                          style={{ fontSize: 10, padding: '4px 10px' }}
                          onClick={() => openEditBatch(batch)}
                        >
                          Edit
                        </button>
                        <button
                          className="mono"
                          style={{
                            fontSize: 10, fontWeight: 700, padding: '4px 10px',
                            border: '1px solid rgba(248,113,113,0.3)', background: 'transparent',
                            color: 'var(--red)', borderRadius: 4, cursor: 'pointer',
                          }}
                          onClick={() => {
                            distributionStore.removeAchBatch(batch.id)
                            showToast('Batch removed')
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            <button
              className="btn btn-primary"
              style={{ fontSize: 11, padding: '6px 14px' }}
              onClick={openAddBatch}
            >
              + New Batch
            </button>
          </div>
        )}
      </div>

      {/* ── Payment Table ─────────────────────── */}
      <div
        style={{
          background: 'var(--bg-card-half)',
          border: '1px solid var(--bd)',
          borderRadius: 6,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        <div className="r-scroll-table">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ minWidth: 180 }}>Entity / Investor</th>
                <th className="right" style={{ minWidth: 100 }}>Amount</th>
                <th style={{ minWidth: 70 }}>Method</th>
                <th style={{ minWidth: 70 }}>Status</th>
                <th style={{ minWidth: 90 }}>Paid Date</th>
                <th>Portal</th>
                <th>Recon</th>
                <th style={{ minWidth: 40 }}></th>
              </tr>
            </thead>
            <tbody>
              {periodPayments.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t4)' }}>
                    <span className="mono" style={{ fontSize: 13 }}>
                      No payments for this period
                    </span>
                  </td>
                </tr>
              ) : (
                periodPayments.map((d) => {
                  const isSkipped = d.status === 'Skipped'
                  const isExpanded = expandedId === d.id
                  const editingThis = inlineEdit?.id === d.id
                  const committed = positions
                    .filter((p) => p.invId === d.invId && p.fund === d.fund)
                    .reduce((s, p) => s + p.amt, 0)

                  return [
                    /* ── Main Row ───────────────────────────── */
                    <tr
                      key={d.id}
                      style={{
                        transition: 'background 0.1s',
                        opacity: isSkipped ? 0.45 : 1,
                        borderBottom: isExpanded ? 'none' : undefined,
                        background: isExpanded ? 'var(--bgH)' : undefined,
                      }}
                      onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--bgH)' }}
                      onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                    >
                      {/* ── Entity / Investor ──────────── */}
                      <td
                        style={{ cursor: 'pointer', padding: '10px 14px' }}
                        onClick={() => setExpandedId(isExpanded ? null : d.id)}
                      >
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                          <span style={{
                            fontSize: 14,
                            fontWeight: 600,
                            color: isSkipped ? 'var(--t5)' : 'var(--t1)',
                            textDecoration: isSkipped ? 'line-through' : 'none',
                            lineHeight: 1.3,
                          }}>
                            {d.entity || d.name}
                          </span>
                          {committed > 0 && (
                            <span className="mono" style={{ fontSize: 10, color: 'var(--t5)', fontWeight: 400 }}>
                              {fmt(committed)}
                            </span>
                          )}
                        </div>
                        {d.entity && (
                          <div
                            className="mono"
                            style={{ fontSize: 11, color: 'var(--t4)', marginTop: 1, cursor: 'pointer' }}
                            onClick={(e) => { e.stopPropagation(); navigate('/pe/directory') }}
                          >
                            {d.name}
                          </div>
                        )}
                        {!d.entity && (
                          <div
                            className="mono"
                            style={{ fontSize: 11, color: 'var(--t5)', marginTop: 1 }}
                          >
                            Individual
                          </div>
                        )}
                        {d.notes && (
                          <div style={{
                            display: 'inline-block',
                            width: 6, height: 6,
                            borderRadius: '50%',
                            background: 'var(--ylw)',
                            marginLeft: 6,
                            verticalAlign: 'middle',
                          }} title={d.notes} />
                        )}
                      </td>

                      {/* ── Amount (click to edit) ─────── */}
                      <td
                        className="right"
                        style={{
                          fontWeight: 700,
                          color: isSkipped ? 'var(--t5)' : 'var(--t1)',
                          cursor: 'pointer',
                          padding: '10px 14px',
                        }}
                        onClick={() => !isSkipped && startInlineEdit(d.id, 'amt', d.amt)}
                      >
                        {editingThis && inlineEdit.field === 'amt' ? (
                          <input
                            type="number"
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(e) => setInlineEdit(prev => ({ ...prev, value: e.target.value }))}
                            onBlur={saveInlineEdit}
                            onKeyDown={handleInlineKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: 90,
                              fontSize: 14,
                              fontWeight: 700,
                              textAlign: 'right',
                              background: 'var(--bgI)',
                              border: '1px solid var(--grnB)',
                              borderRadius: 3,
                              padding: '2px 6px',
                              color: 'var(--t1)',
                              outline: 'none',
                            }}
                          />
                        ) : (
                          <span title="Click to edit amount">{fmt(d.amt)}</span>
                        )}
                      </td>

                      {/* ── Method (click to cycle) ────── */}
                      <td>
                        <span
                          onClick={() => {
                            if (isSkipped) return
                            const methods = ['ACH', 'Wire', 'Check']
                            const next = methods[(methods.indexOf(d.method) + 1) % methods.length]
                            distributionStore.updatePayment(d.id, { method: next })
                            showToast(`Method → ${next}`)
                          }}
                          style={{ cursor: isSkipped ? 'default' : 'pointer' }}
                          title="Click to cycle method"
                        >
                          <MethodBadge method={d.method} />
                        </span>
                        {d.method === 'ACH' && d.achBatchId && (() => {
                          const batch = periodBatches.find((b) => b.id === d.achBatchId)
                          return batch ? (
                            <div
                              className="mono"
                              style={{
                                fontSize: 9,
                                color: batch.status === 'Succeeded' ? 'var(--grn)' : 'var(--blu)',
                                marginTop: 2,
                                cursor: 'pointer',
                              }}
                              title={`Batch ${batch.batchId} — ${batch.status}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                setShowBatchPanel(true)
                              }}
                            >
                              #{batch.batchId}
                            </div>
                          ) : null
                        })()}
                      </td>

                      {/* ── Status (click to cycle) ────── */}
                      <td>
                        <span
                          onClick={() => {
                            const statuses = ['Prep', 'Sent', 'Skipped']
                            const next = statuses[(statuses.indexOf(d.status) + 1) % statuses.length]
                            distributionStore.updatePayment(d.id, { status: next })
                            showToast(`Status → ${next}`)
                          }}
                          style={{ cursor: 'pointer' }}
                          title="Click to cycle status"
                        >
                          {isSkipped ? (
                            <span className="badge badge-muted" style={{ textDecoration: 'line-through' }}>Skipped</span>
                          ) : (
                            <StatusBadge status={d.status} />
                          )}
                        </span>
                      </td>

                      {/* ── Paid Date (click to edit) ──── */}
                      <td
                        className="mono"
                        style={{ fontSize: 12, color: 'var(--t3)', cursor: 'pointer', padding: '10px 14px' }}
                        onClick={() => !isSkipped && startInlineEdit(d.id, 'date', d.date || '')}
                      >
                        {editingThis && inlineEdit.field === 'date' ? (
                          <input
                            type="date"
                            autoFocus
                            value={inlineEdit.value}
                            onChange={(e) => {
                              setInlineEdit(prev => ({ ...prev, value: e.target.value }))
                            }}
                            onBlur={saveInlineEdit}
                            onKeyDown={handleInlineKeyDown}
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              width: 130,
                              fontSize: 12,
                              background: 'var(--bgI)',
                              border: '1px solid var(--grnB)',
                              borderRadius: 3,
                              padding: '2px 6px',
                              color: 'var(--t1)',
                              outline: 'none',
                              fontFamily: "'Space Mono', monospace",
                            }}
                          />
                        ) : (
                          <span title="Click to edit date">{d.date || '-'}</span>
                        )}
                      </td>

                      {/* ── Portal (click to toggle) ──── */}
                      <td>
                        <span
                          onClick={() => {
                            const next = d.reportedInPortal === 'Yes' ? 'No' : 'Yes'
                            distributionStore.updatePayment(d.id, { reportedInPortal: next })
                          }}
                          style={{ cursor: 'pointer' }}
                          title="Click to toggle"
                        >
                          <PortalBadge value={d.reportedInPortal} />
                        </span>
                      </td>

                      {/* ── Reconciliation (click to toggle) */}
                      <td>
                        <span
                          onClick={() => {
                            const vals = ['Pending', 'Matched', 'Unmatched']
                            const next = vals[(vals.indexOf(d.reconciliation) + 1) % vals.length]
                            distributionStore.updatePayment(d.id, { reconciliation: next })
                          }}
                          style={{ cursor: 'pointer' }}
                          title="Click to cycle"
                        >
                          <ReconciliationBadge value={d.reconciliation} />
                        </span>
                      </td>

                      {/* ── Expand toggle ──────────────── */}
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : d.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: isExpanded ? 'var(--grn)' : 'var(--t5)',
                            fontSize: 16,
                            padding: '2px 6px',
                            borderRadius: 3,
                            transition: 'color 0.15s',
                          }}
                          title={isExpanded ? 'Collapse' : 'Expand for notes & audit trail'}
                        >
                          {isExpanded ? '\u25B2' : '\u25BC'}
                        </button>
                      </td>
                    </tr>,

                    /* ── Expanded Detail Row ────────────── */
                    isExpanded && (
                      <tr key={`${d.id}-detail`} style={{ background: 'var(--bgH)' }}>
                        <td colSpan={8} style={{ padding: '0 14px 16px 14px', borderBottom: '2px solid var(--bd)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
                            {/* ── Left: Notes + Quick Fields ───── */}
                            <div>
                              <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 6 }}>
                                Notes
                              </div>
                              <textarea
                                value={editingThis && inlineEdit.field === 'notes' ? inlineEdit.value : (d.notes || '')}
                                onFocus={() => startInlineEdit(d.id, 'notes', d.notes || '')}
                                onChange={(e) => setInlineEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                onBlur={saveInlineEdit}
                                placeholder="Add notes..."
                                rows={3}
                                style={{
                                  width: '100%',
                                  resize: 'vertical',
                                  fontSize: 13,
                                  background: 'var(--bgI)',
                                  border: '1px solid var(--bd)',
                                  borderRadius: 4,
                                  padding: '8px 10px',
                                  color: 'var(--t2)',
                                  outline: 'none',
                                  lineHeight: 1.5,
                                  transition: 'border-color 0.15s',
                                }}
                                onKeyDown={(e) => { if (e.key === 'Escape') cancelInlineEdit() }}
                              />

                              {/* Quick-edit row for tracking ref */}
                              <div style={{ marginTop: 10, display: 'flex', gap: 10, alignItems: 'center' }}>
                                <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', whiteSpace: 'nowrap' }}>Tracking Ref</div>
                                <input
                                  type="text"
                                  value={editingThis && inlineEdit.field === 'trackingRef' ? inlineEdit.value : (d.trackingRef || '')}
                                  onFocus={() => startInlineEdit(d.id, 'trackingRef', d.trackingRef || '')}
                                  onChange={(e) => setInlineEdit(prev => prev ? { ...prev, value: e.target.value } : null)}
                                  onBlur={saveInlineEdit}
                                  onKeyDown={handleInlineKeyDown}
                                  placeholder="Reference #"
                                  style={{
                                    flex: 1,
                                    fontSize: 12,
                                    background: 'var(--bgI)',
                                    border: '1px solid var(--bd)',
                                    borderRadius: 3,
                                    padding: '4px 8px',
                                    color: 'var(--t2)',
                                    outline: 'none',
                                    fontFamily: "'Space Mono', monospace",
                                  }}
                                />
                              </div>

                              {/* Action buttons */}
                              <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
                                <button
                                  className="btn btn-secondary"
                                  style={{ fontSize: 10, padding: '5px 12px' }}
                                  onClick={() => openEditPayment(d)}
                                >
                                  Full Edit
                                </button>
                                {!isSkipped && d.status === 'Prep' && (
                                  <button
                                    className="mono"
                                    style={{
                                      fontSize: 10, fontWeight: 700, padding: '5px 12px',
                                      border: '1px solid rgba(248,113,113,0.3)', background: 'transparent',
                                      color: 'var(--red)', borderRadius: 4, cursor: 'pointer',
                                    }}
                                    onClick={() => {
                                      distributionStore.updatePayment(d.id, { status: 'Skipped' })
                                      showToast(`${d.entity || d.name} skipped`)
                                    }}
                                  >
                                    Skip
                                  </button>
                                )}
                                {isSkipped && (
                                  <button
                                    className="mono"
                                    style={{
                                      fontSize: 10, fontWeight: 700, padding: '5px 12px',
                                      border: '1px solid var(--grnB)', background: 'transparent',
                                      color: 'var(--grn)', borderRadius: 4, cursor: 'pointer',
                                    }}
                                    onClick={() => {
                                      distributionStore.updatePayment(d.id, { status: 'Prep' })
                                      showToast(`${d.entity || d.name} restored`)
                                    }}
                                  >
                                    Restore
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* ── Right: Audit Trail ───────────── */}
                            <div>
                              <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 6 }}>
                                Audit Trail
                              </div>
                              {(!d.auditLog || d.auditLog.length === 0) ? (
                                <div className="mono" style={{ fontSize: 11, color: 'var(--t5)', padding: '8px 0' }}>
                                  No changes recorded yet
                                </div>
                              ) : (
                                <div style={{
                                  maxHeight: 200, overflowY: 'auto',
                                  border: '1px solid var(--bd)', borderRadius: 4,
                                  background: 'var(--bgS)',
                                }}>
                                  {[...(d.auditLog || [])].reverse().map((entry) => (
                                    <div
                                      key={entry.id}
                                      style={{
                                        padding: '6px 10px',
                                        borderBottom: '1px solid var(--bdS)',
                                        fontSize: 11,
                                      }}
                                    >
                                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                                        <span style={{ fontWeight: 600, color: 'var(--t3)' }}>{entry.action}</span>
                                        <span className="mono" style={{ fontSize: 9, color: 'var(--t5)' }}>
                                          {formatTimestamp(entry.timestamp)}
                                        </span>
                                      </div>
                                      {entry.detail && (
                                        <div style={{ color: 'var(--t4)', fontSize: 11 }}>{entry.detail}</div>
                                      )}
                                      <div className="mono" style={{ fontSize: 9, color: 'var(--t5)', marginTop: 1 }}>
                                        {entry.user}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ),
                  ]
                }).flat().filter(Boolean)
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Actions Row ───────────────────────── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 40 }}>
        <button className="btn btn-primary" onClick={openAddPayment}>
          Add Payment
        </button>
        <button
          className="btn btn-primary"
          style={{ background: 'var(--blu)', borderColor: 'var(--blu)' }}
          onClick={() => setShowCalcModal(true)}
        >
          Calculate from %
        </button>
        <button className="btn btn-secondary" onClick={handleExportSyndicationPro}>
          Export Syndication Pro CSV
        </button>
        <button className="btn btn-secondary" onClick={handleExportReport}>
          Export Distribution Report
        </button>
        <button
          className="btn btn-secondary"
          onClick={() => fileInputRef.current?.click()}
        >
          Import MACU CSV
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          style={{ display: 'none' }}
          onChange={handleImportMACV}
        />
      </div>

      {/* ── Add/Edit Payment Modal ────────────── */}
      {showPaymentModal && (
        <div
          className="modal-overlay active"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowPaymentModal(false)
          }}
        >
          <div className="modal" style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <div className="modal-title">
                {editingPayment ? 'Edit Payment' : 'Add Payment'}
              </div>
              <button
                className="modal-close"
                onClick={() => setShowPaymentModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {/* Investor select */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Investor</label>
                <select
                  className="form-select"
                  value={formData.invId}
                  onChange={(e) => {
                    const inv = investors.find((i) => i.id === e.target.value)
                    handleFormChange('invId', e.target.value)
                    if (inv) {
                      // Build position list for this investor in the active fund
                      const invPositions = positions.filter(
                        (p) => p.invId === inv.id && p.fund === formData.fund
                      )
                      const firstEntity = invPositions.length > 0
                        ? (invPositions[0].entity || inv.name)
                        : (inv.entities.length > 0 ? inv.entities[0] : '')
                      handleFormChange('entity', firstEntity)
                      // Auto-fill amount from most recent distribution for this entity
                      const allDists = distributionStore.getAll()
                      const lastDist = allDists
                        .filter((d) => d.invId === inv.id && d.entity === firstEntity)
                        .slice(-1)[0]
                      if (lastDist) handleFormChange('amt', String(lastDist.amt))
                    }
                  }}
                >
                  <option value="">Select investor...</option>
                  {investors.map((inv) => (
                    <option key={inv.id} value={inv.id}>
                      {inv.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Entity / Amount row */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Entity</label>
                  {(() => {
                    const selectedInv = investors.find((i) => i.id === formData.invId);
                    // Build entity options from positions (includes funded amount)
                    const invPositions = positions.filter(
                      (p) => p.invId === formData.invId && p.fund === formData.fund
                    );
                    // Use positions as entity source — shows entity + funded amount
                    if (invPositions.length > 1) {
                      return (
                        <select
                          className="form-select"
                          value={formData.entity}
                          onChange={(e) => {
                            handleFormChange('entity', e.target.value)
                            // Auto-fill amount from most recent distribution for this entity
                            const allDists = distributionStore.getAll()
                            const lastDist = allDists
                              .filter((d) => d.invId === formData.invId && d.entity === e.target.value)
                              .slice(-1)[0]
                            if (lastDist) handleFormChange('amt', String(lastDist.amt))
                          }}
                        >
                          {invPositions.map((pos) => {
                            const label = pos.entity || selectedInv?.name || ''
                            return (
                              <option key={pos.id} value={pos.entity || ''}>
                                {label} (${fmt(pos.amt)})
                              </option>
                            )
                          })}
                        </select>
                      );
                    }
                    if (invPositions.length === 1) {
                      const pos = invPositions[0];
                      return (
                        <input
                          type="text"
                          className="form-input"
                          value={formData.entity}
                          onChange={(e) => handleFormChange('entity', e.target.value)}
                          placeholder={pos.entity || selectedInv?.name || 'Entity name'}
                        />
                      );
                    }
                    return (
                      <input
                        type="text"
                        className="form-input"
                        value={formData.entity}
                        onChange={(e) => handleFormChange('entity', e.target.value)}
                        placeholder="Entity name"
                      />
                    );
                  })()}
                </div>
                <div>
                  <label className="form-label">Amount</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.amt}
                    onChange={(e) => handleFormChange('amt', e.target.value)}
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Method / Status row */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Method</label>
                  <select
                    className="form-select"
                    value={formData.method}
                    onChange={(e) => handleFormChange('method', e.target.value)}
                  >
                    <option value="ACH">ACH</option>
                    <option value="Wire">Wire</option>
                    <option value="Check">Check</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={formData.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                  >
                    <option value="Prep">Prep</option>
                    <option value="Sent">Sent</option>
                    <option value="Logged">Logged</option>
                  </select>
                </div>
              </div>

              {/* Sent Date */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Sent Date</label>
                <input
                  type="date"
                  className="form-input"
                  value={formData.date}
                  onChange={(e) => handleFormChange('date', e.target.value)}
                />
              </div>

              {/* Tracking Ref (Wire/Check only) / Reported In Portal */}
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : (formData.method === 'Wire' || formData.method === 'Check' ? '1fr 1fr' : '1fr'), gap: 12, marginBottom: 14 }}>
                {(formData.method === 'Wire' || formData.method === 'Check') && (
                  <div>
                    <label className="form-label">{formData.method === 'Wire' ? 'Tracking Ref' : 'Check Reference'}</label>
                    <input
                      type="text"
                      className="form-input"
                      value={formData.trackingRef}
                      onChange={(e) => handleFormChange('trackingRef', e.target.value)}
                      placeholder={formData.method === 'Wire' ? 'Wire tracking #' : 'Check #'}
                    />
                  </div>
                )}
                <div>
                  <label className="form-label">Reported In Investor Portal</label>
                  <select
                    className="form-select"
                    value={formData.reportedInPortal}
                    onChange={(e) => handleFormChange('reportedInPortal', e.target.value)}
                  >
                    <option value="Pending">Pending</option>
                    <option value="Yes">Yes</option>
                    <option value="No">No</option>
                  </select>
                </div>
              </div>

              {/* Reconciliation */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Reconciliation</label>
                <select
                  className="form-select"
                  value={formData.reconciliation}
                  onChange={(e) => handleFormChange('reconciliation', e.target.value)}
                >
                  <option value="Pending">Pending</option>
                  <option value="Matched">Matched</option>
                  <option value="Unmatched">Unmatched</option>
                </select>
              </div>

              {/* Notes */}
              <div style={{ marginBottom: 14 }}>
                <label className="form-label">Notes</label>
                <textarea
                  className="form-textarea"
                  value={formData.notes}
                  onChange={(e) => handleFormChange('notes', e.target.value)}
                  placeholder="Add notes about this payment, investor issues, or attach email references..."
                  rows={3}
                  style={{
                    width: '100%',
                    resize: 'vertical',
                    fontSize: 13,
                  }}
                />
              </div>

              {/* Audit Log (edit only) */}
              {editingPayment && editingPayment.auditLog && editingPayment.auditLog.length > 0 && (
                <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 14 }}>
                  <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 10 }}>
                    Audit Log
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {[...(editingPayment.auditLog || [])].reverse().map((entry) => (
                      <div
                        key={entry.id}
                        style={{
                          display: 'flex',
                          gap: 12,
                          padding: '6px 0',
                          borderBottom: '1px solid var(--bdS)',
                          fontSize: 12,
                        }}
                      >
                        <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', width: 130, flexShrink: 0 }}>
                          {formatTimestamp(entry.timestamp)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontWeight: 600, color: 'var(--t3)' }}>{entry.action}</span>
                          {entry.detail && <span style={{ color: 'var(--t4)', marginLeft: 8 }}>{entry.detail}</span>}
                        </div>
                        <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', flexShrink: 0 }}>
                          {entry.user}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleSavePayment}>
                {editingPayment ? 'Save Changes' : 'Add Payment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── ACH Batch Modal ─────────────────── */}
      {showBatchModal && (
        <div
          className="modal-overlay active"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowBatchModal(false)
          }}
        >
          <div className="modal" style={{ maxWidth: 480 }}>
            <div className="modal-header">
              <div className="modal-title">
                {editingBatch ? 'Edit ACH Batch' : 'New ACH Batch'}
              </div>
              <button className="modal-close" onClick={() => setShowBatchModal(false)}>
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Batch ID</label>
                  <input
                    type="text"
                    className="form-input"
                    value={batchForm.batchId}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, batchId: e.target.value }))}
                    placeholder="e.g. 512054"
                  />
                </div>
                <div>
                  <label className="form-label">Funding Account</label>
                  <input
                    type="text"
                    className="form-input"
                    value={batchForm.fundingAccount}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, fundingAccount: e.target.value }))}
                    placeholder="VEGA FUND II CHK"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Deliver By</label>
                  <input
                    type="date"
                    className="form-input"
                    value={batchForm.deliverBy}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, deliverBy: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Status</label>
                  <select
                    className="form-select"
                    value={batchForm.status}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, status: e.target.value }))}
                  >
                    <option value="Submitted">Submitted</option>
                    <option value="Succeeded">Succeeded</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
                <div>
                  <label className="form-label">Submitted Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={batchForm.submittedDate}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, submittedDate: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="form-label">Succeeded Date</label>
                  <input
                    type="date"
                    className="form-input"
                    value={batchForm.succeededDate}
                    onChange={(e) => setBatchForm((prev) => ({ ...prev, succeededDate: e.target.value }))}
                  />
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => setShowBatchModal(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveBatch}
                disabled={!batchForm.batchId.trim()}
              >
                {editingBatch ? 'Update Batch' : 'Create Batch'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Period Modal ──────────────────── */}
      {showAddPeriodModal && (
        <div
          className="modal-overlay active"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowAddPeriodModal(false)
          }}
        >
          <div className="modal">
            <div className="modal-header">
              <div className="modal-title">Add Period</div>
              <button
                className="modal-close"
                onClick={() => setShowAddPeriodModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div>
                <label className="form-label">Period Name</label>
                <input
                  type="text"
                  className="form-input"
                  value={newPeriodName}
                  onChange={(e) => setNewPeriodName(e.target.value)}
                  placeholder='e.g. "Feb 2026"'
                />
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowAddPeriodModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleAddPeriod}>
                Create Period
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import MACU Modal ─────────────────── */}
      {showImportModal && (
        <div
          className="modal-overlay active"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowImportModal(false)
          }}
        >
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <div className="modal-title">Import MACU CSV</div>
              <button
                className="modal-close"
                onClick={() => setShowImportModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body">
              <div className="mono" style={{ fontSize: 11, color: 'var(--t4)', marginBottom: 16 }}>
                {importMatches.filter((m) => m.matchedPayment).length} matched,{' '}
                {importMatches.filter((m) => !m.matchedPayment).length} unmatched of{' '}
                {importMatches.length} transactions
              </div>

              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {importMatches.map((match, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 12px',
                      background: match.matchedPayment ? 'rgba(52,211,153,0.04)' : 'rgba(248,113,113,0.04)',
                      borderLeft: `2px solid ${match.matchedPayment ? 'var(--grn)' : 'var(--red)'}`,
                      borderRadius: '0 4px 4px 0',
                      marginBottom: 6,
                    }}
                  >
                    <div>
                      <div style={{ fontSize: 14, color: 'var(--t1)' }}>
                        {match.csvName || `Row ${match.csvRow}`}
                      </div>
                      <div className="mono" style={{ fontSize: 11, color: 'var(--t4)' }}>
                        {match.csvAmt > 0 ? fmt(match.csvAmt) : 'No amount'}
                        {match.csvRef ? ` -- Ref: ${match.csvRef}` : ''}
                      </div>
                      {match.matchedPayment && (
                        <div className="mono" style={{ fontSize: 11, color: 'var(--grn)', marginTop: 2 }}>
                          Matched: {match.matchedPayment.name} ({fmt(match.matchedPayment.amt)})
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {match.matchedPayment ? (
                        <>
                          <span className="badge badge-green">Matched</span>
                          <input
                            type="checkbox"
                            checked={match.confirmed}
                            onChange={() => {
                              setImportMatches((prev) =>
                                prev.map((m, i) =>
                                  i === idx ? { ...m, confirmed: !m.confirmed } : m
                                )
                              )
                            }}
                            style={{ width: 16, height: 16, cursor: 'pointer' }}
                          />
                        </>
                      ) : (
                        <span className="badge badge-red">Unmatched</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowImportModal(false)}
              >
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleConfirmImport}>
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Distribution Calculator Modal ──────── */}
      {showCalcModal && (
        <div
          className="modal-overlay active"
          style={{ display: 'flex' }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCalcModal(false)
          }}
        >
          <div className="modal" style={{ maxWidth: 680 }}>
            <div className="modal-header">
              <div className="modal-title">Distribution Calculator</div>
              <button
                className="modal-close"
                onClick={() => setShowCalcModal(false)}
              >
                &times;
              </button>
            </div>
            <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div>
                  <label className="form-label">Annual Distribution %</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="number"
                      className="form-input"
                      value={calcPercent}
                      onChange={(e) => setCalcPercent(e.target.value)}
                      placeholder="e.g. 8"
                      step="0.01"
                      min="0"
                      style={{ flex: 1 }}
                    />
                    <span style={{ fontSize: 18, color: 'var(--t3)', fontWeight: 500 }}>%</span>
                  </div>
                </div>
                <div>
                  <label className="form-label">Fund</label>
                  <select
                    className="form-select"
                    value={calcFund}
                    onChange={(e) => setCalcFund(e.target.value)}
                  >
                    {funds.map((f) => (
                      <option key={f.id} value={f.shortName}>{f.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Monthly explanation */}
              {parseFloat(calcPercent) > 0 && (
                <div style={{
                  padding: '10px 14px',
                  background: 'rgba(52,211,153,0.04)',
                  border: '1px solid var(--grnB)',
                  borderRadius: 6,
                  marginBottom: 16,
                }}>
                  <div className="mono" style={{ fontSize: 11, color: 'var(--grn)' }}>
                    {calcPercent}% annual &divide; 12 months = {(parseFloat(calcPercent) / 12).toFixed(4)}% monthly per investor
                  </div>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--t5)', marginTop: 2 }}>
                    Each payment below is the monthly amount (annual distribution spread over 12 months)
                  </div>
                </div>
              )}

              {/* Preview table */}
              {parseFloat(calcPercent) > 0 && (
                <>
                  <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 10 }}>
                    Monthly Amounts ({calcPercent}% annual &divide; 12)
                  </div>
                  <div className="r-scroll-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Investor</th>
                        <th>Entity</th>
                        <th className="right">Committed</th>
                        <th className="right">Annual ({calcPercent}%)</th>
                        <th className="right">Monthly</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const pct = parseFloat(calcPercent) / 100
                        const fundInvestors = investors.filter((inv) => inv.funds.includes(calcFund))
                        let grandTotalAnnual = 0
                        let grandTotalMonthly = 0

                        const rows = fundInvestors.map((inv) => {
                          const fundPositions = inv.positions.filter((p) => p.fund === calcFund)
                          const committed = fundPositions.reduce((s, p) => s + p.amt, 0)
                          const annualAmt = Math.round(committed * pct)
                          const monthlyAmt = Math.round(annualAmt / 12)
                          grandTotalAnnual += annualAmt
                          grandTotalMonthly += monthlyAmt

                          return (
                            <tr key={inv.id}>
                              <td style={{ fontSize: 13, fontWeight: 500 }}>{inv.name}</td>
                              <td style={{ fontSize: 12, color: 'var(--t4)' }}>
                                {inv.entities[0] || '-'}
                              </td>
                              <td className="right" style={{ fontSize: 13, color: 'var(--t3)' }}>{fmt(committed)}</td>
                              <td className="right" style={{ fontSize: 12, color: 'var(--t5)' }}>{fmt(annualAmt)}</td>
                              <td className="right" style={{ fontSize: 14, fontWeight: 700, color: 'var(--grn)' }}>{fmt(monthlyAmt)}</td>
                            </tr>
                          )
                        })

                        return (
                          <>
                            {rows}
                            <tr style={{ borderTop: '2px solid var(--bd)' }}>
                              <td colSpan={3} style={{ fontWeight: 700, fontSize: 13 }}>Total</td>
                              <td className="right" style={{ fontSize: 13, fontWeight: 600, color: 'var(--t4)' }}>
                                {fmt(grandTotalAnnual)}/yr
                              </td>
                              <td className="right" style={{ fontSize: 16, fontWeight: 700, color: 'var(--grn)' }}>
                                {fmt(grandTotalMonthly)}/mo
                              </td>
                            </tr>
                          </>
                        )
                      })()}
                    </tbody>
                  </table>
                  </div>
                </>
              )}
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setShowCalcModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const pct = parseFloat(calcPercent) / 100
                  if (!pct || pct <= 0) {
                    showToast('Enter a valid percentage')
                    return
                  }
                  const fundInvestors = investors.filter((inv) => inv.funds.includes(calcFund))
                  let created = 0
                  fundInvestors.forEach((inv) => {
                    const fundPositions = inv.positions.filter((p) => p.fund === calcFund)
                    const committed = fundPositions.reduce((s, p) => s + p.amt, 0)
                    const annualAmt = Math.round(committed * pct)
                    const monthlyAmt = Math.round(annualAmt / 12)
                    if (monthlyAmt > 0) {
                      // Check if payment already exists for this investor in this period
                      const existing = periodPayments.find((p) => p.invId === inv.id)
                      if (!existing) {
                        distributionStore.addPayment({
                          invId: inv.id,
                          name: inv.name,
                          entity: inv.entities[0] || '',
                          amt: monthlyAmt,
                          method: 'ACH',
                          status: 'Prep',
                          date: '',
                          trackingRef: '',
                          reportedInPortal: 'Pending',
                          reconciliation: 'Pending',
                          fund: calcFund,
                          period: activePeriod || 'New Period',
                          notes: `Monthly: ${calcPercent}% annual \u00F7 12 = ${fmt(monthlyAmt)}/mo (${fmt(annualAmt)}/yr on ${fmt(committed)})`,
                        })
                        created++
                      }
                    }
                  })
                  setShowCalcModal(false)
                  setCalcPercent('')
                  showToast(`${created} monthly payment${created !== 1 ? 's' : ''} created (${calcPercent}% annual \u00F7 12)`)
                }}
              >
                Create Monthly Payments
              </button>
            </div>
          </div>
        </div>
      )}

      </>)}
    </div>
  )
}
