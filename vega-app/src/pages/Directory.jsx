// =============================================
// VEGA MISSION CONTROL - Directory Page
// Investor / Advisor / Custodian directory with
// detail split-view, compliance, distributions,
// positions, and notes management
// =============================================

import { useState, useMemo, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import useInvestorStore from '../stores/investorStore'
import useComplianceStore from '../stores/complianceStore'
import useDistributionStore from '../stores/distributionStore'
import useFundStore from '../stores/fundStore'
import useRingCentralStore from '../stores/ringcentralStore'
import useGoogleStore from '../stores/googleStore'
import useUiStore from '../stores/uiStore'
import { fmt, fmtK } from '../utils/format'
import { getCallLog, getMessageStore, sendSMS, formatPhoneForRC, formatPhoneForDisplay, formatDuration } from '../services/ringcentralService'
import { getThreadsForContact, getThreadDetails, sendReply } from '../services/gmailService'
import { requestAccessToken } from '../services/googleAuth'
import RingOutDialog from '../components/RingOutDialog'
import ContactActionDialog from '../components/ContactActionDialog'
import EmailComposeDialog from '../components/EmailComposeDialog'
import { PipelineBadge, NewBadge } from '../components/PipelineTracker'
import PipelineTracker from '../components/PipelineTracker'
import { PIPELINE_STAGES } from '../stores/investorStore'
import DirectoryKpis from '../components/DirectoryKpis'
import useResponsive from '../hooks/useResponsive'

// ── Inline style helpers ─────────────────────────────────────────────────────
const mono = { fontFamily: "'Space Mono', monospace" }

const displayName = (email, currentUserEmail, currentUserName) => {
  if (email === currentUserEmail && currentUserName) return currentUserName
  if (email === 'system-backfill' || email === 'System') return 'System'
  return email
}

// Auto-format phone number as user types: 801-664-7803
function formatPhone(value) {
  const digits = value.replace(/\D/g, '').slice(0, 10)
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
}

// Vega 4-pointed star — matches the Performance · Partnership · Prosperity icon
const VegaStar = ({ size = 12, color = 'var(--grn)', title = 'Primary Contact', style = {} }) => (
  <svg viewBox="0 0 200 266" style={{ width: size, height: size * 1.33, flexShrink: 0, ...style }} title={title}>
    <path d="M100,0c-8.8,61.66-27.56,110.27-51.34,133.09,23.79,22.82,42.54,71.43,51.34,133.09,8.8-61.66,27.56-110.27,51.34-133.09C127.55,110.27,108.8,61.66,100,0Z" fill={color} opacity="0.6" />
  </svg>
)

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

// ═══════════════════════════════════════════════
// DIRECTORY PAGE COMPONENT
// ═══════════════════════════════════════════════
export default function Directory() {
  const navigate = useNavigate()
  const location = useLocation()
  const { isMobile, isTablet } = useResponsive()

  // ── Stores ──────────────────────────────────
  const investorStore = useInvestorStore()
  const complianceStore = useComplianceStore()
  const distributionStore = useDistributionStore()
  const fundStore = useFundStore()
  const showToast = useUiStore((s) => s.showToast)

  // ── State ───────────────────────────────────
  const [dirTab, setDirTab] = useState('investors')
  const [sel, setSel] = useState(null)
  const [mobileShowDetail, setMobileShowDetail] = useState(false)
  const [search, setSearch] = useState('')
  const [detailTab, setDetailTab] = useState('overview')
  const [noteText, setNoteText] = useState('')
  const [editField, setEditField] = useState(null) // which investor field is being edited
  const [editValue, setEditValue] = useState('')   // current edit value
  const [editingAdvisor, setEditingAdvisor] = useState(null) // advisor id being edited
  const [editingAdvisorFields, setEditingAdvisorFields] = useState({})
  const [editingCustodian, setEditingCustodian] = useState(null) // custodian id being edited
  const [editingCustodianFields, setEditingCustodianFields] = useState({})
  const [fundFilter, setFundFilter] = useState('All')
  const [showContactAction, setShowContactAction] = useState(null) // { phone, name, invId }
  const [showRingOut, setShowRingOut] = useState(null) // { phone, name, invId }
  const [showEmailCompose, setShowEmailCompose] = useState(null) // { email, name }
  const [smsText, setSmsText] = useState('')
  const [smsSending, setSmsSending] = useState(false)
  const [smsApiMessages, setSmsApiMessages] = useState([])
  const [smsApiLoading, setSmsApiLoading] = useState(false)
  const [callLogData, setCallLogData] = useState([])
  const [callLogLoading, setCallLogLoading] = useState(false)
  const [showDeclineDialog, setShowDeclineDialog] = useState(null) // { positionId, name }
  const [declineReason, setDeclineReason] = useState('')
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(null) // { positionId, name, currentStage }
  const [editingContact, setEditingContact] = useState(null) // index or 'new'
  const [contactForm, setContactForm] = useState({ name: '', phone: '', email: '', role: '', notes: '' })
  const [resolveNotes, setResolveNotes] = useState({}) // { [complianceId]: string }
  const [resolveErrors, setResolveErrors] = useState({}) // { [complianceId]: true }
  const [reopenNotes, setReopenNotes] = useState({}) // { [complianceId]: string }
  const [showReopenInput, setShowReopenInput] = useState({}) // { [complianceId]: true }
  const [showComplianceAudit, setShowComplianceAudit] = useState({}) // { [complianceId]: true }
  const [showAddCompliance, setShowAddCompliance] = useState(false)
  const [addEntityValue, setAddEntityValue] = useState('')
  const [showAddEntity, setShowAddEntity] = useState(false)
  const [newComplianceForm, setNewComplianceForm] = useState({ doc: '', issue: '', entity: '' })
  const [editingPosDate, setEditingPosDate] = useState(null) // { posId, field } for inline date editing
  const [editingDateValue, setEditingDateValue] = useState('') // controlled value for the date input
  const savedRef = useRef(false) // prevents double-save on Enter + blur

  // ── RingCentral Store ─────────────────────────
  const rcAuth = useRingCentralStore((s) => s.isAuthenticated)
  const rcAccessToken = useRingCentralStore((s) => s.accessToken)
  const rcUserPhone = useRingCentralStore((s) => s.userPhoneNumber)
  const rcSmsHistory = useRingCentralStore((s) => s.smsHistory)
  const rcAddSms = useRingCentralStore((s) => s.addSmsToHistory)

  // ── Google / Email Store ────────────────────────
  const googleAuth = useGoogleStore((s) => s.isAuthenticated)
  const googleToken = useGoogleStore((s) => s.accessToken)
  const googleUserEmail = useGoogleStore((s) => s.userEmail)
  const googleUserName = useGoogleStore((s) => s.userName)
  const setGoogleToken = useGoogleStore((s) => s.setToken)

  // ── Email thread state ──────────────────────────
  const [emailThreads, setEmailThreads] = useState([])
  const [emailLoading, setEmailLoading] = useState(false)
  const [expandedThread, setExpandedThread] = useState(null) // { threadId, subject, messages }
  const [threadLoading, setThreadLoading] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)

  // ── Handle navigation state (e.g. from Compliance page) ───
  useEffect(() => {
    if (location.state?.selectInvestor) {
      setSel(location.state.selectInvestor)
      if (location.state.tab) setDetailTab(location.state.tab)
      if (isMobile) setMobileShowDetail(true)
      // Clear the state so it doesn't re-trigger on re-renders
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location.state])

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
    // Sort alphabetically by display name (entity name for entities, investor name otherwise)
    list.sort((a, b) => {
      const aIsEntity = a.entities.length > 0 && a.types.some((t) => ['Entity', 'Revocable Trust', 'Irrevocable Trust', 'Trust', 'Joint', 'Joint Individual'].includes(t))
      const bIsEntity = b.entities.length > 0 && b.types.some((t) => ['Entity', 'Revocable Trust', 'Irrevocable Trust', 'Trust', 'Joint', 'Joint Individual'].includes(t))
      const aName = (aIsEntity ? a.entities[0] : a.name).toLowerCase()
      const bName = (bIsEntity ? b.entities[0] : b.name).toLowerCase()
      return aName.localeCompare(bName)
    })
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

  // Stats — reflect the active fund filter
  const statsInvestors = fundFilter !== 'All' ? filteredInvestors : investors
  const totalCommitted = useMemo(
    () => statsInvestors.reduce((s, i) => s + i.totalCommitted, 0),
    [statsInvestors]
  )
  const totalOpenCompliance = useMemo(
    () => {
      if (fundFilter !== 'All') {
        const invIds = new Set(statsInvestors.map((i) => i.id))
        return allCompliance.filter((c) => c.status === 'Open' && (invIds.has(c.invId) || c.fund === fundFilter)).length
      }
      return allCompliance.filter((c) => c.status === 'Open').length
    },
    [allCompliance, statsInvestors, fundFilter]
  )
  const avgCommitment = useMemo(
    () => (statsInvestors.length ? totalCommitted / statsInvestors.length : 0),
    [statsInvestors, totalCommitted]
  )

  // Pipeline counts
  const newCount = useMemo(
    () => investors.filter((inv) => inv.pipeline?.stage === 'New').length,
    [investors]
  )
  const pendingPipelineCount = useMemo(
    () => investors.filter((inv) => inv.pipeline && !['Fully Accepted', 'Accepted', 'Declined', 'New'].includes(inv.pipeline.stage)).length,
    [investors]
  )
  const declinedCount = useMemo(
    () => investors.filter((inv) => inv.pipeline?.stage === 'Declined').length,
    [investors]
  )
  const acceptedCount = useMemo(
    () => investors.filter((inv) => inv.pipeline?.stage === 'Fully Accepted' || inv.pipeline?.stage === 'Accepted' || (!inv.pipeline && inv.status === 'Approved')).length,
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
    if (isMobile) setMobileShowDetail(true)
  }

  const handleAddNote = () => {
    if (!noteText.trim() || !sel) return
    investorStore.addNote(sel, noteText.trim(), 'j@vegarei.com')
    setNoteText('')
  }

  const handleResolve = (id) => {
    const notes = resolveNotes[id]?.trim()
    if (!notes) {
      setResolveErrors((prev) => ({ ...prev, [id]: true }))
      return
    }
    complianceStore.resolve(id, 'j@vegarei.com', notes)
    setResolveNotes((prev) => { const n = { ...prev }; delete n[id]; return n })
    setResolveErrors((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  const handleReopen = (id) => {
    const notes = reopenNotes[id]?.trim() || ''
    complianceStore.reopen(id, 'j@vegarei.com', notes)
    setReopenNotes((prev) => { const n = { ...prev }; delete n[id]; return n })
    setShowReopenInput((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  const handleTogglePriority = (id) => {
    complianceStore.togglePriority(id, 'j@vegarei.com')
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
      // Optimistic UI: add to API messages list immediately
      setSmsApiMessages((prev) => [{
        id: `local-${Date.now()}`,
        direction: 'outbound',
        text: smsText.trim(),
        timestamp: new Date().toISOString(),
      }, ...prev])
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

  // ── Email handlers ─────────────────────────────
  const handleFetchEmailThreads = async () => {
    if (!selectedInvestor?.email) return
    setEmailLoading(true)
    setEmailThreads([])
    setExpandedThread(null)
    try {
      let token = googleToken
      if (!token) {
        const tokenResp = await requestAccessToken()
        setGoogleToken(tokenResp)
        token = tokenResp.access_token
      }
      const threads = await getThreadsForContact(token, selectedInvestor.email, 20)
      setEmailThreads(threads)
    } catch (err) {
      console.error('Email thread fetch failed:', err)
    }
    setEmailLoading(false)
  }

  const handleExpandThread = async (threadSummary) => {
    if (expandedThread?.threadId === threadSummary.threadId) {
      setExpandedThread(null)
      return
    }
    setThreadLoading(true)
    setReplyText('')
    try {
      let token = googleToken
      if (!token) {
        const tokenResp = await requestAccessToken()
        setGoogleToken(tokenResp)
        token = tokenResp.access_token
      }
      const details = await getThreadDetails(token, threadSummary.threadId)
      setExpandedThread(details)
    } catch (err) {
      console.error('Thread detail fetch failed:', err)
      setExpandedThread(null)
    }
    setThreadLoading(false)
  }

  const handleSendReply = async () => {
    if (!replyText.trim() || !expandedThread) return
    setReplySending(true)
    try {
      let token = googleToken
      if (!token) {
        const tokenResp = await requestAccessToken()
        setGoogleToken(tokenResp)
        token = tokenResp.access_token
      }
      const lastMsg = expandedThread.messages[expandedThread.messages.length - 1]
      // Determine reply-to address: if last message was from us, reply to investor; otherwise reply to sender
      const replyTo = lastMsg.from.toLowerCase().includes('vegarei.com')
        ? selectedInvestor.email
        : lastMsg.from
      await sendReply(token, {
        threadId: expandedThread.threadId,
        inReplyTo: lastMsg.messageIdHeader,
        to: replyTo,
        subject: expandedThread.subject,
        body: replyText.trim(),
        from: googleUserEmail || 'j@vegarei.com',
      })
      setReplyText('')
      // Refresh the thread to show the new message
      const updated = await getThreadDetails(token, expandedThread.threadId)
      setExpandedThread(updated)
    } catch (err) {
      console.error('Reply failed:', err)
    }
    setReplySending(false)
  }

  // Fetch email threads when switching to communications tab
  useEffect(() => {
    if (detailTab === 'communications' && selectedInvestor?.email && googleAuth) {
      handleFetchEmailThreads()
    }
  }, [detailTab, sel, googleAuth])

  // ── SMS API fetch handler ─────────────────────────
  const handleFetchSmsApi = async () => {
    if (!rcAccessToken || !selectedInvestor?.phone) return
    setSmsApiLoading(true)
    try {
      const messages = await getMessageStore(rcAccessToken, selectedInvestor.phone, 50)
      setSmsApiMessages(messages)
    } catch (err) {
      console.error('SMS API fetch failed:', err)
      setSmsApiMessages([])
    }
    setSmsApiLoading(false)
  }

  // Auto-fetch SMS and call log when opening Communications tab
  useEffect(() => {
    if (detailTab === 'communications' && rcAuth && selectedInvestor?.phone) {
      handleFetchSmsApi()
      handleFetchCallLog()
    }
  }, [detailTab, sel, rcAuth])

  // Reset contact/compliance state when investor changes
  useEffect(() => {
    setEditingContact(null)
    setContactForm({ name: '', phone: '', email: '', role: '', notes: '' })
    setResolveNotes({})
    setResolveErrors({})
    setReopenNotes({})
    setShowReopenInput({})
    setShowComplianceAudit({})
  }, [sel])

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
      <div style={{ display: 'flex', marginBottom: 24, overflowX: 'auto', flexWrap: isMobile ? 'nowrap' : 'wrap', whiteSpace: 'nowrap' }}>
        {[
          { key: 'investors', label: `Investors (${investors.length})`, radius: '4px 0 0 4px', noBorderLeft: false },
          { key: 'advisors', label: `Advisors (${advisors.length})`, radius: '0', noBorderLeft: true },
          { key: 'custodians', label: `Custodians (${custodians.length})`, radius: '0', noBorderLeft: true },
          { key: 'kpis', label: 'KPIs', radius: '0 4px 4px 0', noBorderLeft: true },
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
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
            {[
              { label: 'Total Committed', value: fmtK(totalCommitted) },
              { label: 'Investors', value: statsInvestors.length },
              {
                label: 'Open Compliance',
                value: totalOpenCompliance,
                color: totalOpenCompliance > 0 ? 'var(--red)' : 'var(--grn)',
                onClick: () => navigate('/pe/compliance'),
              },
              { label: 'Avg Commitment', value: fmtK(avgCommitment) },
            ].map((stat, i) => (
              <div
                key={i}
                onClick={stat.onClick}
                style={{
                  flex: 1,
                  background: 'var(--bgS)',
                  border: '1px solid var(--bd)',
                  borderRadius: 6,
                  padding: '14px 18px',
                  cursor: stat.onClick ? 'pointer' : 'default',
                  transition: 'border-color 0.15s',
                }}
                onMouseEnter={(e) => { if (stat.onClick) e.currentTarget.style.borderColor = 'var(--grn)' }}
                onMouseLeave={(e) => { if (stat.onClick) e.currentTarget.style.borderColor = 'var(--bd)' }}
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
              display: isMobile ? 'block' : 'grid',
              gridTemplateColumns: isMobile ? '1fr' : isTablet ? '300px 1fr' : '400px 1fr',
              border: '1px solid var(--bd)',
              borderRadius: 6,
              overflow: 'hidden',
              minHeight: isMobile ? 0 : 600,
              background: 'var(--bg2)',
            }}
          >
            {/* Left Panel - Investor List */}
            {(!isMobile || !mobileShowDetail) && <div
              style={{
                borderRight: isMobile ? 'none' : '1px solid var(--bd)',
                overflowY: 'auto',
                maxHeight: isMobile ? 'none' : 700,
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
                      borderBottom: '1px solid var(--bgM3)',
                      cursor: 'pointer',
                      background: isSelected ? 'rgba(52,211,153,0.04)' : 'transparent',
                      borderLeft: isSelected
                        ? '3px solid var(--grn)'
                        : '3px solid transparent',
                      transition: 'background 0.1s',
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      {(() => {
                        const entCount = inv.entities.length
                        const entityLabel = entCount > 1 ? `${entCount} entities` : entCount === 1 ? inv.entities[0] : null
                        const typeLabel = inv.types[0] || ''
                        return (
                          <>
                            <div style={{ fontSize: 14, color: 'var(--t1)', fontWeight: 500 }}>
                              {inv.name}
                            </div>
                            {(typeLabel || entityLabel) && (
                              <div style={{ fontSize: 11, color: 'var(--t3)', marginTop: 1 }}>
                                {typeLabel}{entityLabel ? ` · ${entityLabel}` : ''}
                              </div>
                            )}
                          </>
                        )
                      })()}
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
                        {inv.funds.map((f) => (
                          <FundBadge key={f} fund={f} />
                        ))}
                        {inv.pipeline && <PipelineBadge stage={inv.pipeline.stage} />}
                        {inv.pipeline?.stage === 'New' && <NewBadge />}
                        {cCount > 0 && (
                          <span onClick={(e) => { e.stopPropagation(); setSel(inv.id); setDetailTab('compliance'); if (isMobile) setMobileShowDetail(true) }} style={{ cursor: 'pointer' }}>
                            <ComplianceBadge count={cCount} />
                          </span>
                        )}
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
            </div>}

            {/* Right Panel - Detail */}
            {(!isMobile || mobileShowDetail) && <div style={{ padding: isMobile ? 16 : 24, overflowY: 'auto', maxHeight: isMobile ? 'none' : 700 }}>
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
                  {/* Mobile Back Button */}
                  {isMobile && (
                    <button
                      onClick={() => setMobileShowDetail(false)}
                      style={{
                        ...mono,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 11,
                        fontWeight: 700,
                        padding: '8px 0',
                        marginBottom: 12,
                        border: 'none',
                        background: 'none',
                        color: 'var(--grn)',
                        cursor: 'pointer',
                      }}
                    >
                      <span style={{ fontSize: 16, lineHeight: 1 }}>&larr;</span> Back to list
                    </button>
                  )}
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
                      {(() => {
                        const primaryContact = (selectedInvestor.contacts || []).find((c) => c.role === 'Primary Signer')
                        const entCount = selectedInvestor.entities.length
                        const entityLabel = entCount > 1 ? `${entCount} entities` : entCount === 1 ? selectedInvestor.entities[0] : null
                        const typeLabel = selectedInvestor.types[0] || ''
                        return (
                          <>
                            <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--t1)', letterSpacing: '-0.01em', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {selectedInvestor.name}
                            </div>
                            {(typeLabel || entityLabel) && (
                              <div style={{ fontSize: 13, color: 'var(--t3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                                {primaryContact && <VegaStar size={10} />}
                                {typeLabel}{entityLabel ? ` · ${entityLabel}` : ''}
                              </div>
                            )}
                          </>
                        )
                      })()}
                      <div
                        style={{
                          ...mono,
                          fontSize: 11,
                          color: 'var(--t4)',
                          marginTop: 4,
                        }}
                      >
                        {selectedInvestor.id}
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
                        <span onClick={() => setDetailTab('compliance')} style={{ cursor: 'pointer' }} title="View compliance issues">
                          <ComplianceBadge count={openComplianceCount} />
                        </span>
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
                      {selectedInvestor.pipeline && !['New', 'Fully Accepted', 'Accepted', 'Declined'].includes(selectedInvestor.pipeline.stage) && selectedInvestor.positions.length > 0 && (
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
                            onClick={() => setShowContactAction({ phone: selectedInvestor.phone, name: selectedInvestor.name, invId: selectedInvestor.id })}
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
                      gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
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
                        onClick: () => setDetailTab('compliance'),
                      },
                    ].map((stat, i) => (
                      <div
                        key={i}
                        onClick={stat.onClick}
                        style={{
                          background: 'var(--bgI)',
                          borderRadius: 5,
                          padding: 12,
                          cursor: stat.onClick ? 'pointer' : 'default',
                          transition: 'border-color 0.15s',
                          border: stat.onClick ? '1px solid transparent' : 'none',
                        }}
                        onMouseEnter={(e) => { if (stat.onClick) e.currentTarget.style.borderColor = 'var(--bd)' }}
                        onMouseLeave={(e) => { if (stat.onClick) e.currentTarget.style.borderColor = 'transparent' }}
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
                      overflowX: 'auto',
                      flexWrap: 'nowrap',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {['overview', 'positions', 'compliance', 'distributions', 'communications', 'notes', 'activity'].map(
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
                              padding: '9px 10px',
                              fontSize: 10,
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
                              flexShrink: 0,
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
                        gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                        gap: 14,
                      }}
                    >
                      {(() => {
                        const isJointType = selectedInvestor.types.some((t) => t === 'Joint' || t === 'Joint Individual' || t === 'Individual or Joint Individuals');
                        return [
                        { label: 'Profile Type', value: selectedInvestor.types[0] || '-', key: 'profileType', editable: true, isSelect: true, options: ['Individual', 'Joint Individual', 'Revocable Trust', 'Irrevocable Trust', 'IRA', 'Entity'] },
                        { label: 'Profile Name', value: selectedInvestor.name || '-', key: 'name', editable: true },
                        { label: 'Funds', value: selectedInvestor.funds.join(', ') || '-', key: 'funds' },
                        { label: 'Phone', value: selectedInvestor.phone || '', key: 'phone', editable: true, isPhone: true },
                        { label: 'Email', value: selectedInvestor.email || '', key: 'email', editable: true, isEmail: true },
                        { label: 'State', value: selectedInvestor.state || '', key: 'state', editable: true },
                        { label: 'Advisor', value: selectedInvestor.advisor || '', key: 'advisor', editable: true, isSelect: true, options: advisors.map((a) => a.name) },
                        { label: 'Custodian', value: selectedInvestor.custodian || '', key: 'custodian', editable: true, isSelect: true, options: custodians.map((c) => c.name) },
                        { label: 'Total Committed', value: fmtK(selectedInvestor.totalCommitted), key: 'totalCommitted' },
                        { label: 'Status', value: selectedInvestor.pipeline?.stage || selectedInvestor.status || '-', key: 'status', editable: true, isSelect: true, options: ['Approved', 'Pending', 'Declined', 'Redeemed'] },
                        { label: 'Date Entered', value: selectedInvestor.pipeline?.enteredDate || '-', key: 'dateEntered', editable: true },
                      ]})().map((field) => (
                        <div key={field.key}>
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
                              cursor: field.editable ? 'pointer' : 'default',
                              transition: 'border-color 0.15s',
                              border: editField === field.key ? '1px solid var(--grn)' : '1px solid transparent',
                            }}
                            onClick={() => {
                              if (field.editable && editField !== field.key) {
                                setEditField(field.key)
                                setEditValue(field.value)
                              }
                            }}
                          >
                            {editField === field.key && field.editable ? (
                              field.isSelect ? (
                                <select
                                  value={editValue}
                                  onChange={(e) => {
                                    const newVal = e.target.value
                                    setEditValue(newVal)
                                    if (field.key === 'profileType') {
                                      investorStore.updateProfileType(selectedInvestor.id, newVal, googleUserEmail)
                                    } else if (field.key === 'status') {
                                      investorStore.updateInvestorStatus(selectedInvestor.id, newVal, googleUserEmail)
                                    } else {
                                      investorStore.updateInvestorContact(selectedInvestor.id, { [field.key]: newVal }, googleUserEmail)
                                    }
                                    setEditField(null)
                                  }}
                                  onBlur={() => setEditField(null)}
                                  autoFocus
                                  style={{
                                    ...mono, fontSize: 13, width: '100%', background: 'var(--bg0)',
                                    border: 'none', color: 'var(--t1)', outline: 'none', padding: 0,
                                  }}
                                >
                                  <option value="">— None —</option>
                                  {field.options.map((opt) => (
                                    <option key={opt} value={opt}>{opt}</option>
                                  ))}
                                </select>
                              ) : (
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      if (field.key === 'name') {
                                        investorStore.updateInvestorName(selectedInvestor.id, editValue, googleUserEmail)
                                      } else if (field.key === 'entityName') {
                                        investorStore.updateEntityName(selectedInvestor.id, editValue, googleUserEmail)
                                      } else if (field.key === 'dateEntered') {
                                        investorStore.updateDateEntered(selectedInvestor.id, editValue, googleUserEmail)
                                      } else {
                                        investorStore.updateInvestorContact(selectedInvestor.id, { [field.key]: editValue }, googleUserEmail)
                                      }
                                      setEditField(null)
                                    }
                                    if (e.key === 'Escape') setEditField(null)
                                  }}
                                  onBlur={() => {
                                    if (editValue !== field.value) {
                                      if (field.key === 'name') {
                                        investorStore.updateInvestorName(selectedInvestor.id, editValue, googleUserEmail)
                                      } else if (field.key === 'entityName') {
                                        investorStore.updateEntityName(selectedInvestor.id, editValue, googleUserEmail)
                                      } else if (field.key === 'dateEntered') {
                                        investorStore.updateDateEntered(selectedInvestor.id, editValue, googleUserEmail)
                                      } else {
                                        investorStore.updateInvestorContact(selectedInvestor.id, { [field.key]: editValue }, googleUserEmail)
                                      }
                                    }
                                    setEditField(null)
                                  }}
                                  autoFocus
                                  style={{
                                    ...mono, fontSize: 13, width: '100%', background: 'transparent',
                                    border: 'none', color: 'var(--t1)', outline: 'none', padding: 0,
                                  }}
                                />
                              )
                            ) : field.isPhone && field.value ? (
                              <>
                                <a href={`tel:${field.value}`} style={{ color: 'var(--grn)', textDecoration: 'none' }}>{field.value}</a>
                                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                                  {rcAuth && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setShowContactAction({ phone: field.value, name: selectedInvestor.name, invId: selectedInvestor.id }) }}
                                      title="Call via RingCentral"
                                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' }}
                                    >
                                      <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'var(--grn)' }}>
                                        <path d="M6.62 10.79c1.44 2.83 3.76 5.15 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                                      </svg>
                                    </button>
                                  )}
                                  <svg onClick={(e) => { e.stopPropagation(); setEditField(field.key); setEditValue(field.value) }} viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'var(--t5)', cursor: 'pointer' }} title="Edit">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                  </svg>
                                </div>
                              </>
                            ) : field.isEmail && field.value ? (
                              <>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setShowEmailCompose({ email: field.value, name: selectedInvestor.name }) }}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--grn)', padding: 0, font: 'inherit', fontSize: 'inherit', textDecoration: 'none' }}
                                >
                                  {field.value}
                                </button>
                                <svg onClick={(e) => { e.stopPropagation(); setEditField(field.key); setEditValue(field.value) }} viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'var(--t5)', cursor: 'pointer' }} title="Edit">
                                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                </svg>
                              </>
                            ) : (
                              <>
                                <span>{field.value || '-'}</span>
                                {field.editable && (
                                  <svg onClick={(e) => { e.stopPropagation(); setEditField(field.key); setEditValue(field.value) }} viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'var(--t5)', cursor: 'pointer' }} title="Edit">
                                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                  </svg>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Entities Section */}
                    <div style={{ marginTop: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)' }}>
                          Entities{selectedInvestor.entities.length > 0 ? ` (${selectedInvestor.entities.length})` : ''}
                        </span>
                        {!showAddEntity && (
                          <button
                            onClick={() => setShowAddEntity(true)}
                            style={{ ...mono, fontSize: 9, fontWeight: 700, padding: '4px 10px', border: '1px solid rgba(96,165,250,0.3)', background: 'var(--bluM)', color: 'var(--blu)', borderRadius: 4, cursor: 'pointer' }}
                          >
                            + Add Entity
                          </button>
                        )}
                      </div>
                      {selectedInvestor.entities.length === 0 && !showAddEntity && (
                        <div style={{ fontSize: 12, color: 'var(--t4)', fontStyle: 'italic', marginBottom: 8 }}>No entities</div>
                      )}
                      {selectedInvestor.entities.map((ent) => (
                        <div
                          key={ent}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            background: 'var(--bgI)', borderRadius: 5, padding: '8px 12px', marginBottom: 6,
                          }}
                        >
                          <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{ent}</span>
                          <button
                            onClick={() => investorStore.removeEntity(selectedInvestor.id, ent, googleUserEmail || 'j@vegarei.com')}
                            title="Remove entity"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                          >
                            <svg viewBox="0 0 24 24" style={{ width: 14, height: 14, fill: 'var(--t5)' }}>
                              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {showAddEntity && (
                        <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
                          <input
                            type="text"
                            value={addEntityValue}
                            onChange={(e) => setAddEntityValue(e.target.value)}
                            placeholder="Entity name..."
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && addEntityValue.trim()) {
                                investorStore.addEntity(selectedInvestor.id, addEntityValue.trim(), googleUserEmail || 'j@vegarei.com')
                                setAddEntityValue('')
                                setShowAddEntity(false)
                              }
                              if (e.key === 'Escape') { setShowAddEntity(false); setAddEntityValue('') }
                            }}
                            style={{
                              flex: 1, ...mono, fontSize: 12, background: 'var(--bg0)',
                              border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px',
                              color: 'var(--t1)', outline: 'none',
                            }}
                          />
                          <button
                            onClick={() => {
                              if (!addEntityValue.trim()) return
                              investorStore.addEntity(selectedInvestor.id, addEntityValue.trim(), googleUserEmail || 'j@vegarei.com')
                              setAddEntityValue('')
                              setShowAddEntity(false)
                            }}
                            disabled={!addEntityValue.trim()}
                            style={{
                              ...mono, fontSize: 10, fontWeight: 700, padding: '6px 12px',
                              border: '1px solid rgba(96,165,250,0.3)', background: 'var(--bluM)',
                              color: 'var(--blu)', borderRadius: 4, cursor: 'pointer',
                              opacity: addEntityValue.trim() ? 1 : 0.4,
                            }}
                          >
                            Add
                          </button>
                          <button
                            onClick={() => { setShowAddEntity(false); setAddEntityValue('') }}
                            style={{ ...mono, fontSize: 10, fontWeight: 700, padding: '6px 8px', border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t4)', borderRadius: 4, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Contacts / Owners Section */}
                    <div style={{ marginTop: 20 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                        <span style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)' }}>
                          Contacts / Owners
                        </span>
                        {editingContact === null && (
                          <button
                            onClick={() => { setEditingContact('new'); setContactForm({ name: '', phone: '', email: '', role: '', notes: '' }) }}
                            style={{ ...mono, fontSize: 9, fontWeight: 700, padding: '4px 10px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 4, cursor: 'pointer' }}
                          >
                            + Add Contact
                          </button>
                        )}
                      </div>

                      {/* Profile Name for Joint types (moved from overview grid) */}
                      {selectedInvestor.types.some((t) => t === 'Joint' || t === 'Individual or Joint Individuals') && (
                        <div style={{ background: 'var(--bgI)', borderRadius: 5, padding: '10px 12px', marginBottom: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <div style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', marginBottom: 3 }}>Profile Name</div>
                            <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>{selectedInvestor.name || '-'}</div>
                          </div>
                          <svg
                            onClick={(e) => { e.stopPropagation(); setEditField('name'); setEditValue(selectedInvestor.name || '') }}
                            viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'var(--t5)', cursor: 'pointer' }} title="Edit"
                          >
                            <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                          </svg>
                        </div>
                      )}

                      {/* Contact cards — primary contacts first, then secondary owners */}
                      {(() => {
                        const contacts = selectedInvestor.contacts || []
                        const primaryRoles = ['Primary Signer']
                        const primaryContacts = contacts.map((c, i) => ({ ...c, _idx: i })).filter((c) => primaryRoles.includes(c.role))
                        const secondaryContacts = contacts.map((c, i) => ({ ...c, _idx: i })).filter((c) => !primaryRoles.includes(c.role))

                        const renderContactCard = ({ _idx: idx, ...contact }) => (
                          editingContact === idx ? (
                            <div key={idx} style={{ background: 'var(--bgI)', borderRadius: 5, padding: 12, marginBottom: 8, border: '1px solid var(--grn)' }}>
                              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                                <input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Name" style={{ ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none' }} autoFocus />
                                <select value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} style={{ ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none' }}>
                                  <option value="">Role...</option>
                                  <option value="Primary Signer">Primary Signer</option>
                                  <option value="Owner">Owner</option>
                                  <option value="Trustee">Trustee</option>
                                  <option value="Authorized Signer">Authorized Signer</option>
                                  <option value="Beneficiary">Beneficiary</option>
                                  <option value="Contact">Contact</option>
                                </select>
                                <input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: formatPhone(e.target.value) })} placeholder="801-555-1234" maxLength={12} style={{ ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none' }} />
                                <input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} placeholder="Email" style={{ ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none' }} />
                              </div>
                              <textarea value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} placeholder="Notes (optional)" rows={2} style={{ ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none', width: '100%', marginTop: 8, resize: 'vertical', boxSizing: 'border-box' }} />
                              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                                <button onClick={() => setEditingContact(null)} style={{ ...mono, fontSize: 9, fontWeight: 700, padding: '4px 10px', border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t4)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                                <button
                                  onClick={() => {
                                    if (!contactForm.name.trim()) return
                                    const updated = [...(selectedInvestor.contacts || [])]
                                    updated[idx] = { ...contactForm }
                                    investorStore.updateInvestorContacts(selectedInvestor.id, updated, 'j@vegarei.com')
                                    setEditingContact(null)
                                  }}
                                  style={{ ...mono, fontSize: 9, fontWeight: 700, padding: '4px 10px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 4, cursor: 'pointer' }}
                                >Save</button>
                              </div>
                            </div>
                          ) : (
                            <div key={idx} style={{ background: 'var(--bgI)', borderRadius: 5, padding: '10px 12px', marginBottom: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--t1)' }}>
                                    {contact.role === 'Primary Signer' && (
                                      <VegaStar size={11} style={{ marginRight: 4 }} />
                                    )}
                                    {contact.name}
                                  </span>
                                  {contact.role && (
                                    <span style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3, background: contact.role === 'Primary Signer' ? 'var(--ylwM)' : 'var(--bgM)', color: contact.role === 'Primary Signer' ? 'var(--ylw)' : 'var(--t3)' }}>
                                      {contact.role}
                                    </span>
                                  )}
                                </div>
                                <div style={{ ...mono, fontSize: 11, color: 'var(--t4)', marginTop: 3, display: 'flex', gap: 12 }}>
                                  {contact.phone && <span>{contact.phone}</span>}
                                  {contact.email && <span>{contact.email}</span>}
                                </div>
                                {contact.notes && (
                                  <div style={{ ...mono, fontSize: 10, color: 'var(--t4)', marginTop: 4, fontStyle: 'italic', lineHeight: 1.4 }}>
                                    {contact.notes}
                                  </div>
                                )}
                              </div>
                              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                                <svg
                                  onClick={() => { setEditingContact(idx); setContactForm({ name: contact.name || '', phone: contact.phone || '', email: contact.email || '', role: contact.role || '', notes: contact.notes || '' }) }}
                                  viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'var(--t5)', cursor: 'pointer' }} title="Edit"
                                >
                                  <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                                </svg>
                                <svg
                                  onClick={() => {
                                    const updated = (selectedInvestor.contacts || []).filter((_, i) => i !== idx)
                                    investorStore.updateInvestorContacts(selectedInvestor.id, updated, 'j@vegarei.com')
                                  }}
                                  viewBox="0 0 24 24" style={{ width: 12, height: 12, fill: 'var(--red)', cursor: 'pointer', opacity: 0.6 }} title="Remove"
                                >
                                  <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
                                </svg>
                              </div>
                            </div>
                          )
                        )

                        return (
                          <>
                            {primaryContacts.map(renderContactCard)}
                            {secondaryContacts.length > 0 && primaryContacts.length > 0 && (
                              <div style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t5)', padding: '8px 0 4px', marginTop: 4 }}>
                                Secondary Owners / Contacts
                              </div>
                            )}
                            {secondaryContacts.map(renderContactCard)}
                          </>
                        )
                      })()}

                      {/* Add new contact form */}
                      {editingContact === 'new' && (
                        <div style={{ background: 'var(--bgI)', borderRadius: 5, padding: 12, marginBottom: 8, border: '1px solid var(--grn)' }}>
                          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 8 }}>
                            <input value={contactForm.name} onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })} placeholder="Name" style={{ ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none' }} autoFocus />
                            <select value={contactForm.role} onChange={(e) => setContactForm({ ...contactForm, role: e.target.value })} style={{ ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none' }}>
                              <option value="">Role...</option>
                              <option value="Owner">Owner</option>
                              <option value="Trustee">Trustee</option>
                              <option value="Authorized Signer">Authorized Signer</option>
                              <option value="Beneficiary">Beneficiary</option>
                              <option value="Contact">Contact</option>
                            </select>
                            <input value={contactForm.phone} onChange={(e) => setContactForm({ ...contactForm, phone: formatPhone(e.target.value) })} placeholder="801-555-1234" maxLength={12} style={{ ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none' }} />
                            <input value={contactForm.email} onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })} placeholder="Email" style={{ ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none' }} />
                          </div>
                          <textarea value={contactForm.notes} onChange={(e) => setContactForm({ ...contactForm, notes: e.target.value })} placeholder="Notes (optional)" rows={2} style={{ ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none', width: '100%', marginTop: 8, resize: 'vertical', boxSizing: 'border-box' }} />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                            <button onClick={() => setEditingContact(null)} style={{ ...mono, fontSize: 9, fontWeight: 700, padding: '4px 10px', border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t4)', borderRadius: 4, cursor: 'pointer' }}>Cancel</button>
                            <button
                              onClick={() => {
                                if (!contactForm.name.trim()) return
                                const updated = [...(selectedInvestor.contacts || []), { ...contactForm }]
                                investorStore.updateInvestorContacts(selectedInvestor.id, updated, 'j@vegarei.com')
                                setEditingContact(null)
                              }}
                              style={{ ...mono, fontSize: 9, fontWeight: 700, padding: '4px 10px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 4, cursor: 'pointer' }}
                            >Save</button>
                          </div>
                        </div>
                      )}

                      {/* Empty state */}
                      {(!selectedInvestor.contacts || selectedInvestor.contacts.length === 0) && editingContact === null && (
                        <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--t5)', ...mono, fontSize: 11 }}>
                          No contacts added yet
                        </div>
                      )}
                    </div>

                    {/* Pipeline Tracker */}
                    {selectedInvestor.positions.filter((p) => p.pipeline).length > 0 && (
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
                        {selectedInvestor.positions.filter((p) => p.pipeline).map((pos) => (
                          <div key={pos.id} style={{ marginBottom: 14 }}>
                            {selectedInvestor.positions.filter((p) => p.pipeline).length > 1 && (
                              <div style={{
                                ...mono,
                                fontSize: 9,
                                fontWeight: 600,
                                color: 'var(--t3)',
                                marginBottom: 4,
                              }}>
                                {pos.fund}{pos.entity ? ` · ${pos.entity}` : ''}
                              </div>
                            )}
                            <PipelineTracker
                              pipeline={pos.pipeline}
                              signers={pos.signers}
                              docRouting={pos.docRouting || 'direct'}
                              positionId={pos.id}
                              onDateChange={(posId, dateKey, newDate) => {
                                useInvestorStore.getState().updatePipelineDate(posId, dateKey, newDate, 'J. Jones')
                                showToast('Date updated')
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                  )}

                  {/* ── Tab 2: Positions ─────────── */}
                  {detailTab === 'positions' && (
                    <div className="r-scroll-table">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr>
                            <th>Fund</th>
                            <th>Entity</th>
                            <th>Type</th>
                            <th>Class</th>
                            <th className="right">Amount</th>
                            <th>Status</th>
                            <th>Signed</th>
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
                                    background: 'var(--bgM)',
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
                                    background: 'var(--bgM)',
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
                                  cursor: 'pointer',
                                  minWidth: 90,
                                }}
                                onClick={() => {
                                  if (editingPosDate?.posId === p.id && editingPosDate?.field === 'signed') return
                                  savedRef.current = false
                                  setEditingDateValue(p.signed || '')
                                  setEditingPosDate({ posId: p.id, field: 'signed' })
                                }}
                              >
                                {editingPosDate?.posId === p.id && editingPosDate?.field === 'signed' ? (
                                  <input
                                    type="text"
                                    value={editingDateValue}
                                    onChange={(e) => setEditingDateValue(e.target.value)}
                                    placeholder="e.g. Jan 7, 2025"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        savedRef.current = true
                                        useInvestorStore.getState().updatePositionDates(p.id, { signed: e.target.value }, 'j@vegarei.com')
                                        setEditingPosDate(null)
                                      }
                                      if (e.key === 'Escape') setEditingPosDate(null)
                                    }}
                                    onBlur={(e) => {
                                      if (!savedRef.current && e.target.value !== (p.signed || '')) {
                                        useInvestorStore.getState().updatePositionDates(p.id, { signed: e.target.value }, 'j@vegarei.com')
                                      }
                                      setEditingPosDate(null)
                                    }}
                                    style={{
                                      ...mono,
                                      fontSize: 12,
                                      width: '100%',
                                      background: 'var(--bg0)',
                                      border: '1px solid var(--grn)',
                                      borderRadius: 3,
                                      color: 'var(--t1)',
                                      padding: '2px 4px',
                                      outline: 'none',
                                    }}
                                  />
                                ) : (
                                  <span style={{ borderBottom: '1px dashed var(--t5)' }}>
                                    {p.signed || '-'}
                                  </span>
                                )}
                              </td>
                              <td
                                style={{
                                  ...mono,
                                  fontSize: 12,
                                  color: 'var(--t3)',
                                  cursor: 'pointer',
                                  minWidth: 90,
                                }}
                                onClick={() => {
                                  if (editingPosDate?.posId === p.id && editingPosDate?.field === 'funded') return
                                  savedRef.current = false
                                  setEditingDateValue(p.funded || '')
                                  setEditingPosDate({ posId: p.id, field: 'funded' })
                                }}
                              >
                                {editingPosDate?.posId === p.id && editingPosDate?.field === 'funded' ? (
                                  <input
                                    type="text"
                                    value={editingDateValue}
                                    onChange={(e) => setEditingDateValue(e.target.value)}
                                    placeholder="e.g. Jan 7, 2025"
                                    autoFocus
                                    onClick={(e) => e.stopPropagation()}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        savedRef.current = true
                                        useInvestorStore.getState().updatePositionDates(p.id, { funded: e.target.value }, 'j@vegarei.com')
                                        setEditingPosDate(null)
                                      }
                                      if (e.key === 'Escape') setEditingPosDate(null)
                                    }}
                                    onBlur={(e) => {
                                      if (!savedRef.current && e.target.value !== (p.funded || '')) {
                                        useInvestorStore.getState().updatePositionDates(p.id, { funded: e.target.value }, 'j@vegarei.com')
                                      }
                                      setEditingPosDate(null)
                                    }}
                                    style={{
                                      ...mono,
                                      fontSize: 12,
                                      width: '100%',
                                      background: 'var(--bg0)',
                                      border: '1px solid var(--grn)',
                                      borderRadius: 3,
                                      color: 'var(--t1)',
                                      padding: '2px 4px',
                                      outline: 'none',
                                    }}
                                  />
                                ) : (
                                  <span style={{ borderBottom: '1px dashed var(--t5)' }}>
                                    {p.funded || '-'}
                                  </span>
                                )}
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
                      {/* Add compliance item button / form */}
                      <div style={{ marginBottom: 12 }}>
                        {!showAddCompliance ? (
                          <button
                            onClick={() => setShowAddCompliance(true)}
                            style={{
                              ...mono, fontSize: 10, fontWeight: 700, padding: '5px 12px',
                              border: '1px solid var(--bd)', background: 'var(--bgI)',
                              color: 'var(--t3)', borderRadius: 4, cursor: 'pointer',
                            }}
                          >
                            + Add Item
                          </button>
                        ) : (
                          <div style={{ padding: 14, background: 'var(--bgI)', borderLeft: '3px solid var(--blu)', borderRadius: '0 5px 5px 0' }}>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                              <input
                                type="text"
                                value={newComplianceForm.entity}
                                onChange={(e) => setNewComplianceForm((f) => ({ ...f, entity: e.target.value }))}
                                placeholder={selectedInvestor.entities.length > 0 ? `Entity (${selectedInvestor.entities.join(', ')})` : 'Entity...'}
                                style={{ width: 200, ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none' }}
                              />
                              <input
                                type="text"
                                value={newComplianceForm.doc}
                                onChange={(e) => setNewComplianceForm((f) => ({ ...f, doc: e.target.value }))}
                                placeholder="Doc type (e.g. W-9, Sub Doc)..."
                                style={{ width: 180, ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none' }}
                              />
                              <input
                                type="text"
                                value={newComplianceForm.issue}
                                onChange={(e) => setNewComplianceForm((f) => ({ ...f, issue: e.target.value }))}
                                placeholder="Describe the issue..."
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' && newComplianceForm.issue.trim()) {
                                    complianceStore.addItem({
                                      invId: selectedInvestor.id,
                                      name: selectedInvestor.name,
                                      entity: newComplianceForm.entity.trim() || selectedInvestor.entities[0] || '',
                                      fund: selectedInvestor.funds[0] || '',
                                      doc: newComplianceForm.doc.trim() || 'General',
                                      issue: newComplianceForm.issue.trim(),
                                    }, googleUserEmail || 'j@vegarei.com')
                                    setNewComplianceForm({ doc: '', issue: '', entity: '' })
                                    setShowAddCompliance(false)
                                  }
                                  if (e.key === 'Escape') { setShowAddCompliance(false); setNewComplianceForm({ doc: '', issue: '', entity: '' }) }
                                }}
                                style={{
                                  flex: 1, minWidth: 150, ...mono, fontSize: 12, background: 'var(--bg0)',
                                  border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px',
                                  color: 'var(--t1)', outline: 'none',
                                }}
                              />
                              <button
                                onClick={() => {
                                  if (!newComplianceForm.issue.trim()) return
                                  complianceStore.addItem({
                                    invId: selectedInvestor.id,
                                    name: selectedInvestor.name,
                                    entity: newComplianceForm.entity.trim() || selectedInvestor.entities[0] || '',
                                    fund: selectedInvestor.funds[0] || '',
                                    doc: newComplianceForm.doc.trim() || 'General',
                                    issue: newComplianceForm.issue.trim(),
                                  }, googleUserEmail || 'j@vegarei.com')
                                  setNewComplianceForm({ doc: '', issue: '', entity: '' })
                                  setShowAddCompliance(false)
                                }}
                                disabled={!newComplianceForm.issue.trim()}
                                style={{
                                  ...mono, fontSize: 10, fontWeight: 700, padding: '6px 14px',
                                  border: '1px solid rgba(96,165,250,0.3)', background: 'var(--bluM)',
                                  color: 'var(--blu)', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
                                  opacity: newComplianceForm.issue.trim() ? 1 : 0.4,
                                }}
                              >
                                Add
                              </button>
                              <button
                                onClick={() => { setShowAddCompliance(false); setNewComplianceForm({ doc: '', issue: '', entity: '' }) }}
                                style={{
                                  ...mono, fontSize: 10, fontWeight: 700, padding: '6px 10px',
                                  border: '1px solid var(--bd)', background: 'transparent',
                                  color: 'var(--t4)', borderRadius: 4, cursor: 'pointer',
                                }}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {invCompliance.length === 0 && !showAddCompliance ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--t4)', ...mono, fontSize: 13 }}>
                          No compliance issues -- all clear {'\u2713'}
                        </div>
                      ) : (
                        invCompliance.map((c) => {
                          const resolved = c.status === 'Resolved'
                          const isBlocking = c.priority === 'blocking'
                          const borderColor = !resolved && isBlocking ? 'var(--red)' : !resolved ? 'var(--ylw)' : 'var(--t5)'
                          const auditLog = complianceStore.getAuditLog(c.id)
                          return (
                            <div
                              key={c.id}
                              style={{
                                padding: 14,
                                borderLeft: `3px solid ${borderColor}`,
                                background: 'var(--bgI)',
                                borderRadius: '0 5px 5px 0',
                                marginBottom: 10,
                              }}
                            >
                              {/* Header row */}
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                                <div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <span style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3, background: 'var(--bgM)', color: 'var(--t3)' }}>
                                      {c.doc}
                                    </span>
                                    {!resolved && isBlocking && (
                                      <span style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', padding: '2px 6px', borderRadius: 3, background: 'var(--redM)', color: 'var(--red)' }}>
                                        Blocking
                                      </span>
                                    )}
                                    <StatusBadge status={c.status} />
                                  </div>
                                  <div style={{ fontSize: 14, color: 'var(--t2)', lineHeight: 1.5 }}>
                                    {c.issue}
                                  </div>
                                </div>
                                {/* Priority toggle for open items */}
                                {!resolved && (
                                  <button
                                    onClick={() => handleTogglePriority(c.id)}
                                    style={{
                                      ...mono, fontSize: 9, fontWeight: 700, padding: '3px 8px',
                                      border: `1px solid ${isBlocking ? 'rgba(239,68,68,0.3)' : 'var(--bd)'}`,
                                      background: isBlocking ? 'var(--redM)' : 'transparent',
                                      color: isBlocking ? 'var(--red)' : 'var(--t4)',
                                      borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
                                    }}
                                  >
                                    {isBlocking ? 'Blocking' : 'Standard'}
                                  </button>
                                )}
                              </div>

                              {/* Open item: resolve notes + button */}
                              {!resolved && (
                                <div style={{ marginTop: 8 }}>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <input
                                      type="text"
                                      value={resolveNotes[c.id] || ''}
                                      onChange={(e) => {
                                        setResolveNotes((prev) => ({ ...prev, [c.id]: e.target.value }))
                                        if (e.target.value.trim()) setResolveErrors((prev) => { const n = { ...prev }; delete n[c.id]; return n })
                                      }}
                                      placeholder="Resolution notes (required)..."
                                      onKeyDown={(e) => { if (e.key === 'Enter') handleResolve(c.id) }}
                                      style={{
                                        flex: 1, ...mono, fontSize: 12, background: 'var(--bg0)',
                                        border: `1px solid ${resolveErrors[c.id] ? 'var(--red)' : 'var(--bd)'}`,
                                        borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none',
                                      }}
                                    />
                                    <button
                                      onClick={() => handleResolve(c.id)}
                                      style={{
                                        ...mono, fontSize: 10, fontWeight: 700, padding: '6px 14px',
                                        border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)',
                                        color: 'var(--grn)', borderRadius: 4, cursor: 'pointer', whiteSpace: 'nowrap',
                                      }}
                                    >
                                      Resolve
                                    </button>
                                  </div>
                                  {resolveErrors[c.id] && (
                                    <div style={{ ...mono, fontSize: 10, color: 'var(--red)', marginTop: 4 }}>
                                      Notes are required to resolve
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Resolved item: info + reopen */}
                              {resolved && (
                                <div style={{ marginTop: 8, opacity: 0.7 }}>
                                  <div style={{ ...mono, fontSize: 10, color: 'var(--t5)', marginBottom: 4 }}>
                                    Resolved by {c.resolvedBy || 'j@vegarei.com'}
                                    {c.resolvedDate && ` on ${new Date(c.resolvedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                                  </div>
                                  {c.notes && (
                                    <div style={{ fontSize: 12, color: 'var(--t4)', marginBottom: 6, fontStyle: 'italic' }}>
                                      {c.notes}
                                    </div>
                                  )}
                                  {showReopenInput[c.id] ? (
                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                      <input
                                        type="text"
                                        value={reopenNotes[c.id] || ''}
                                        onChange={(e) => setReopenNotes((prev) => ({ ...prev, [c.id]: e.target.value }))}
                                        placeholder="Reopen reason (optional)..."
                                        onKeyDown={(e) => { if (e.key === 'Enter') handleReopen(c.id) }}
                                        autoFocus
                                        style={{ flex: 1, ...mono, fontSize: 12, background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4, padding: '6px 8px', color: 'var(--t1)', outline: 'none' }}
                                      />
                                      <button onClick={() => handleReopen(c.id)} style={{ ...mono, fontSize: 10, fontWeight: 700, padding: '6px 10px', border: '1px solid rgba(251,191,36,0.3)', background: 'var(--ylwM)', color: 'var(--ylw)', borderRadius: 4, cursor: 'pointer' }}>
                                        Reopen
                                      </button>
                                      <button onClick={() => setShowReopenInput((prev) => { const n = { ...prev }; delete n[c.id]; return n })} style={{ ...mono, fontSize: 10, fontWeight: 700, padding: '6px 10px', border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t4)', borderRadius: 4, cursor: 'pointer' }}>
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      onClick={() => setShowReopenInput((prev) => ({ ...prev, [c.id]: true }))}
                                      style={{ ...mono, fontSize: 9, fontWeight: 700, padding: '3px 8px', border: '1px solid rgba(251,191,36,0.3)', background: 'var(--ylwM)', color: 'var(--ylw)', borderRadius: 4, cursor: 'pointer' }}
                                    >
                                      Reopen
                                    </button>
                                  )}
                                </div>
                              )}

                              {/* Audit trail toggle */}
                              <div style={{ marginTop: 8, borderTop: '1px solid var(--bdS)', paddingTop: 6 }}>
                                <button
                                  onClick={() => setShowComplianceAudit((prev) => ({ ...prev, [c.id]: !prev[c.id] }))}
                                  style={{ ...mono, fontSize: 9, color: 'var(--t5)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                  {showComplianceAudit[c.id] ? '\u25BE Hide History' : '\u25B8 Show History'}
                                  {auditLog.length > 0 && ` (${auditLog.length})`}
                                </button>
                                {showComplianceAudit[c.id] && auditLog.length > 0 && (
                                  <div style={{ marginTop: 6 }}>
                                    {auditLog.map((entry) => (
                                      <div key={entry.id} style={{ display: 'flex', gap: 8, padding: '4px 0', fontSize: 11, borderBottom: '1px solid var(--bdS2)' }}>
                                        <span style={{ ...mono, fontSize: 9, color: 'var(--t5)', width: 120, flexShrink: 0 }}>
                                          {new Date(entry.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} {new Date(entry.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span style={{ fontWeight: 600, color: entry.action === 'Resolved' ? 'var(--grn)' : entry.action === 'Reopened' ? 'var(--ylw)' : 'var(--t3)' }}>
                                          {entry.action}
                                        </span>
                                        <span style={{ color: 'var(--t4)', flex: 1 }}>{entry.notes || ''}</span>
                                        <span style={{ ...mono, fontSize: 9, color: 'var(--t5)', flexShrink: 0 }}>{displayName(entry.user, googleUserEmail, googleUserName)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {showComplianceAudit[c.id] && auditLog.length === 0 && (
                                  <div style={{ ...mono, fontSize: 10, color: 'var(--t5)', padding: '4px 0' }}>No history</div>
                                )}
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
                        <div className="r-scroll-table">
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
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Tab 5: Communications ────── */}
                  {detailTab === 'communications' && (
                    <div>
                      {/* ── Email Section ──────────────────────────── */}
                      <div style={{ marginBottom: 28 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                          <span style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)' }}>
                            Email
                          </span>
                          <div style={{ display: 'flex', gap: 8 }}>
                            <button
                              onClick={handleFetchEmailThreads}
                              disabled={emailLoading}
                              style={{ ...mono, fontSize: 9, fontWeight: 700, padding: '4px 10px', border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t4)', borderRadius: 4, cursor: emailLoading ? 'not-allowed' : 'pointer' }}
                            >
                              {emailLoading ? 'Loading...' : 'Refresh'}
                            </button>
                            {selectedInvestor.email && (
                              <button
                                onClick={() => setShowEmailCompose({ email: selectedInvestor.email, name: selectedInvestor.name })}
                                style={{ ...mono, fontSize: 9, fontWeight: 700, padding: '4px 10px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 4, cursor: 'pointer' }}
                              >
                                + Compose
                              </button>
                            )}
                          </div>
                        </div>

                        {!googleAuth ? (
                          <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--t4)' }}>
                            <svg viewBox="0 0 24 24" style={{ width: 28, height: 28, fill: 'var(--t5)', marginBottom: 10 }}>
                              <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                            </svg>
                            <div style={{ ...mono, fontSize: 12 }}>Connect Google to view email history</div>
                          </div>
                        ) : !selectedInvestor.email ? (
                          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--t5)', ...mono, fontSize: 12 }}>
                            No email address on file
                          </div>
                        ) : emailLoading ? (
                          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--t5)', ...mono, fontSize: 12 }}>
                            Loading email threads...
                          </div>
                        ) : emailThreads.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--t5)', ...mono, fontSize: 12 }}>
                            No email conversations found with {selectedInvestor.email}
                          </div>
                        ) : (
                          <div>
                            {emailThreads.map((thread) => {
                              const isExpanded = expandedThread?.threadId === thread.threadId
                              const isOutbound = thread.lastFrom.toLowerCase().includes('vegarei.com')
                              return (
                                <div key={thread.threadId} style={{ marginBottom: 4 }}>
                                  {/* Thread summary row */}
                                  <div
                                    onClick={() => handleExpandThread(thread)}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                                      background: isExpanded ? 'var(--bgH)' : 'transparent',
                                      borderLeft: `2px solid ${isOutbound ? 'var(--grn)' : 'var(--blu)'}`,
                                      borderRadius: '0 5px 5px 0', cursor: 'pointer',
                                      transition: 'background 0.1s',
                                    }}
                                    onMouseEnter={(e) => { if (!isExpanded) e.currentTarget.style.background = 'var(--bgH)' }}
                                    onMouseLeave={(e) => { if (!isExpanded) e.currentTarget.style.background = 'transparent' }}
                                  >
                                    <span style={{ ...mono, fontSize: 10, color: 'var(--t5)', flexShrink: 0 }}>
                                      {isExpanded ? '\u25BE' : '\u25B8'}
                                    </span>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                      <div style={{ fontSize: 13, color: 'var(--t1)', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {thread.subject}
                                      </div>
                                      <div style={{ ...mono, fontSize: 10, color: 'var(--t4)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                        {thread.snippet}
                                      </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                      <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>
                                        {thread.messageCount} msg{thread.messageCount !== 1 ? 's' : ''}
                                      </span>
                                      <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>
                                        {new Date(thread.lastDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Expanded thread messages */}
                                  {isExpanded && (
                                    <div style={{ marginLeft: 14, borderLeft: '1px solid var(--bd)', paddingLeft: 12, marginTop: 4, marginBottom: 8 }}>
                                      {threadLoading ? (
                                        <div style={{ padding: '16px 0', ...mono, fontSize: 11, color: 'var(--t5)' }}>Loading thread...</div>
                                      ) : (
                                        <>
                                          {expandedThread.messages.map((msg, idx) => {
                                            const isSent = msg.from.toLowerCase().includes('vegarei.com')
                                            return (
                                              <div
                                                key={msg.messageId}
                                                style={{
                                                  padding: '10px 12px', marginBottom: 6,
                                                  background: isSent ? 'rgba(52,211,153,0.04)' : 'var(--bgI)',
                                                  borderRadius: 5,
                                                  borderLeft: `2px solid ${isSent ? 'var(--grn)' : 'var(--blu)'}`,
                                                }}
                                              >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                                  <span style={{ ...mono, fontSize: 10, color: isSent ? 'var(--grn)' : 'var(--blu)', fontWeight: 700 }}>
                                                    {msg.from.split('<')[0].trim() || msg.from}
                                                  </span>
                                                  <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>
                                                    {new Date(msg.date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                  </span>
                                                </div>
                                                {msg.to && (
                                                  <div style={{ ...mono, fontSize: 9, color: 'var(--t5)', marginBottom: 6 }}>
                                                    To: {msg.to.split('<')[0].trim() || msg.to}
                                                  </div>
                                                )}
                                                <div style={{ fontSize: 13, color: 'var(--t2)', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                                  {msg.body || msg.snippet}
                                                </div>
                                              </div>
                                            )
                                          })}

                                          {/* Inline reply */}
                                          <div style={{ marginTop: 8 }}>
                                            <textarea
                                              value={replyText}
                                              onChange={(e) => setReplyText(e.target.value)}
                                              placeholder="Write a reply..."
                                              rows={3}
                                              onKeyDown={(e) => {
                                                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                                                  e.preventDefault()
                                                  handleSendReply()
                                                }
                                              }}
                                              style={{
                                                width: '100%', boxSizing: 'border-box', ...mono, fontSize: 12,
                                                background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4,
                                                padding: '8px 10px', color: 'var(--t1)', outline: 'none', resize: 'vertical',
                                                minHeight: 60, lineHeight: 1.5,
                                              }}
                                              onFocus={(e) => (e.target.style.borderColor = 'var(--grn)')}
                                              onBlur={(e) => (e.target.style.borderColor = 'var(--bd)')}
                                            />
                                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 6 }}>
                                              <span style={{ ...mono, fontSize: 9, color: 'var(--t5)', alignSelf: 'center' }}>
                                                {navigator.platform.includes('Mac') ? '\u2318' : 'Ctrl'}+Enter to send
                                              </span>
                                              <button
                                                onClick={handleSendReply}
                                                disabled={replySending || !replyText.trim()}
                                                style={{
                                                  ...mono, fontSize: 10, fontWeight: 700, padding: '6px 14px',
                                                  border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)',
                                                  color: 'var(--grn)', borderRadius: 4,
                                                  cursor: replySending || !replyText.trim() ? 'not-allowed' : 'pointer',
                                                  opacity: replySending || !replyText.trim() ? 0.5 : 1,
                                                }}
                                              >
                                                {replySending ? 'Sending...' : 'Reply'}
                                              </button>
                                            </div>
                                          </div>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>

                      {/* ── Divider ──────────────────────────────── */}
                      <div style={{ height: 1, background: 'var(--bd)', margin: '20px 0' }} />

                      {/* ── SMS Section (RC auth required) ─────── */}
                      {rcAuth ? (
                        <>
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
                                    flex: 1, background: 'var(--bg0)', border: '1px solid var(--bd)',
                                    borderRadius: 4, padding: '8px 12px', fontSize: 14,
                                    color: 'var(--t1)', fontFamily: 'inherit', outline: 'none',
                                  }}
                                />
                                <button
                                  onClick={handleSendSms}
                                  disabled={smsSending || !smsText.trim()}
                                  style={{
                                    ...mono, fontSize: 11, fontWeight: 700, background: 'var(--grn)',
                                    color: 'var(--bg0)', border: 'none', borderRadius: 4, padding: '8px 16px',
                                    cursor: smsSending || !smsText.trim() ? 'not-allowed' : 'pointer',
                                    opacity: smsSending || !smsText.trim() ? 0.5 : 1,
                                  }}
                                >
                                  {smsSending ? 'Sending...' : 'Send'}
                                </button>
                              </div>
                            </div>
                          )}

                          {/* SMS History (from RC API — includes phone app messages) */}
                          {selectedInvestor.phone && (
                            <div style={{ marginBottom: 24 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span style={{ ...mono, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)' }}>
                                  SMS History
                                </span>
                                <button
                                  onClick={handleFetchSmsApi}
                                  disabled={smsApiLoading}
                                  style={{ ...mono, fontSize: 9, fontWeight: 700, padding: '4px 10px', border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t4)', borderRadius: 4, cursor: smsApiLoading ? 'not-allowed' : 'pointer' }}
                                >
                                  {smsApiLoading ? 'Loading...' : 'Refresh'}
                                </button>
                              </div>
                              {smsApiMessages.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--t5)', ...mono, fontSize: 11 }}>
                                  {smsApiLoading ? 'Loading SMS...' : 'No SMS history'}
                                </div>
                              ) : (
                                smsApiMessages.map((msg) => (
                                  <div
                                    key={msg.id}
                                    style={{
                                      background: msg.direction === 'outbound' ? 'rgba(52,211,153,0.06)' : 'var(--bgI)',
                                      borderLeft: `2px solid ${msg.direction === 'outbound' ? 'var(--grn)' : 'var(--blu)'}`,
                                      borderRadius: '0 5px 5px 0', padding: '10px 12px', marginBottom: 6,
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
                                ))
                              )}
                            </div>
                          )}

                          {/* Divider before call log */}
                          <div style={{ height: 1, background: 'var(--bd)', margin: '20px 0' }} />

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
                                  ...mono, fontSize: 9, fontWeight: 700, padding: '4px 10px',
                                  border: '1px solid var(--bd)', background: 'transparent',
                                  color: 'var(--t4)', borderRadius: 4,
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
                              <div className="r-scroll-table">
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
                                          ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
                                          padding: '3px 8px', borderRadius: 3,
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
                                          ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
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
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t5)', ...mono, fontSize: 11 }}>
                          Connect RingCentral to view SMS and call history
                        </div>
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

                  {/* ── Tab 7: Activity Log ───────────── */}
                  {detailTab === 'activity' && (() => {
                    const entries = investorStore.getAuditLog(selectedInvestor.id)
                    const sorted = [...entries].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
                    const ACTION_COLORS = {
                      'Field Updated': 'var(--grn)',
                      'Pipeline Stage Changed': 'var(--ylw)',
                      'Pipeline Date Updated': 'var(--blu)',
                      'Status Changed': 'var(--ylw)',
                      'Declined': 'var(--red)',
                      'Amount Changed': 'var(--blu)',
                    }
                    return (
                      <div>
                        {sorted.length === 0 ? (
                          <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--t4)', ...mono, fontSize: 13 }}>
                            No activity recorded yet
                          </div>
                        ) : (
                          sorted.map((entry) => (
                            <div
                              key={entry.id}
                              style={{
                                display: 'flex',
                                gap: 12,
                                padding: '8px 0',
                                borderBottom: '1px solid var(--bdS)',
                                fontSize: 12,
                                alignItems: 'flex-start',
                              }}
                            >
                              <div style={{ ...mono, fontSize: 10, color: 'var(--t5)', width: 140, flexShrink: 0 }}>
                                {new Date(entry.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div style={{ flex: 1 }}>
                                <span style={{ fontWeight: 600, color: ACTION_COLORS[entry.action] || 'var(--t3)' }}>
                                  {entry.action}
                                </span>
                                {entry.detail && (
                                  <span style={{ color: 'var(--t4)', marginLeft: 8 }}>
                                    {entry.detail}
                                  </span>
                                )}
                              </div>
                              <div style={{ ...mono, fontSize: 10, color: 'var(--t5)', flexShrink: 0 }}>
                                {displayName(entry.user, googleUserEmail, googleUserName)}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    )
                  })()}
                </>
              )}
            </div>}
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
            gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)',
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
                  background: 'var(--bgS)',
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
                      flex: 1,
                    }}
                  >
                    Advisor
                  </span>
                  <svg
                    onClick={(e) => {
                      e.stopPropagation()
                      if (editingAdvisor === adv.id) {
                        setEditingAdvisor(null)
                        setEditingAdvisorFields({})
                      } else {
                        setEditingAdvisor(adv.id)
                        setEditingAdvisorFields({ name: adv.name, firm: adv.firm || '', phone: adv.phone || '', email: adv.email || '', territory: adv.territory || '', crd: adv.crd || '' })
                      }
                    }}
                    viewBox="0 0 24 24"
                    style={{ width: 13, height: 13, fill: editingAdvisor === adv.id ? 'var(--grn)' : 'var(--t5)', cursor: 'pointer' }}
                    title="Edit advisor"
                  >
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </div>

                {editingAdvisor === adv.id ? (
                  <>
                    {[
                      { label: 'Name', key: 'name' },
                      { label: 'Firm', key: 'firm' },
                      { label: 'Phone', key: 'phone' },
                      { label: 'Email', key: 'email' },
                      { label: 'Territory', key: 'territory' },
                      { label: 'CRD', key: 'crd' },
                    ].map((f) => (
                      <div key={f.key} style={{ marginBottom: 8 }}>
                        <div style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', marginBottom: 3 }}>{f.label}</div>
                        <input
                          type="text"
                          value={editingAdvisorFields[f.key] || ''}
                          onChange={(e) => setEditingAdvisorFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          style={{
                            ...mono, fontSize: 12, width: '100%', boxSizing: 'border-box',
                            background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4,
                            padding: '6px 8px', color: 'var(--t1)', outline: 'none',
                          }}
                          onFocus={(e) => (e.target.style.borderColor = 'var(--grn)')}
                          onBlur={(e) => (e.target.style.borderColor = 'var(--bd)')}
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingAdvisor(null); setEditingAdvisorFields({}) }}
                        style={{ ...mono, fontSize: 10, color: 'var(--t5)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          fundStore.updateAdvisor(adv.id, editingAdvisorFields, 'j@vegarei.com')
                          setEditingAdvisor(null)
                          setEditingAdvisorFields({})
                        }}
                        style={{
                          ...mono, fontSize: 10, fontWeight: 700, padding: '6px 16px',
                          border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)',
                          color: 'var(--grn)', borderRadius: 4, cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const removed = { ...adv }
                          fundStore.removeAdvisor(adv.id)
                          setEditingAdvisor(null)
                          setEditingAdvisorFields({})
                          showToast(`${adv.name} removed`, {
                            onUndo: () => fundStore.restoreAdvisor(removed),
                          })
                        }}
                        style={{
                          ...mono, fontSize: 10, fontWeight: 700, padding: '6px 16px',
                          border: '1px solid rgba(248,113,113,0.3)', background: 'transparent',
                          color: 'var(--red)', borderRadius: 4, cursor: 'pointer',
                          marginLeft: 'auto',
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <>
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
                    {adv.firm && (
                      <div style={{ ...mono, fontSize: 11, color: 'var(--t4)', marginBottom: 4 }}>{adv.firm}</div>
                    )}

                    {/* Contact Info */}
                    {adv.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                        <a href={`tel:${adv.phone}`} style={{ ...mono, fontSize: 11, color: 'var(--t3)', textDecoration: 'none' }}>
                          {adv.phone}
                        </a>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setShowContactAction({ phone: adv.phone, name: adv.name })
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
                  </>
                )}

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
                      borderBottom: '1px solid var(--bgM3)',
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
            gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)',
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
                  background: 'var(--bgS)',
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
                      flex: 1,
                    }}
                  >
                    Custodian
                  </span>
                  <svg
                    onClick={(e) => {
                      e.stopPropagation()
                      if (editingCustodian === cust.id) {
                        setEditingCustodian(null)
                        setEditingCustodianFields({})
                      } else {
                        setEditingCustodian(cust.id)
                        setEditingCustodianFields({ name: cust.name, address: cust.address || '', phone: cust.phone || '', email: cust.email || '', reportingFrequency: cust.reportingFrequency || '', nextReportingDate: cust.nextReportingDate || '' })
                      }
                    }}
                    viewBox="0 0 24 24"
                    style={{ width: 13, height: 13, fill: editingCustodian === cust.id ? 'var(--blu)' : 'var(--t5)', cursor: 'pointer' }}
                    title="Edit custodian"
                  >
                    <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" />
                  </svg>
                </div>

                {editingCustodian === cust.id ? (
                  <>
                    {[
                      { label: 'Name', key: 'name' },
                      { label: 'Address', key: 'address' },
                      { label: 'Phone', key: 'phone' },
                      { label: 'Email', key: 'email' },
                      { label: 'Reporting Frequency', key: 'reportingFrequency' },
                      { label: 'Next Reporting Date', key: 'nextReportingDate' },
                    ].map((f) => (
                      <div key={f.key} style={{ marginBottom: 8 }}>
                        <div style={{ ...mono, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', marginBottom: 3 }}>{f.label}</div>
                        <input
                          type="text"
                          value={editingCustodianFields[f.key] || ''}
                          onChange={(e) => setEditingCustodianFields((prev) => ({ ...prev, [f.key]: e.target.value }))}
                          style={{
                            ...mono, fontSize: 12, width: '100%', boxSizing: 'border-box',
                            background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4,
                            padding: '6px 8px', color: 'var(--t1)', outline: 'none',
                          }}
                          onFocus={(e) => (e.target.style.borderColor = 'var(--blu)')}
                          onBlur={(e) => (e.target.style.borderColor = 'var(--bd)')}
                        />
                      </div>
                    ))}
                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditingCustodian(null); setEditingCustodianFields({}) }}
                        style={{ ...mono, fontSize: 10, color: 'var(--t5)', background: 'none', border: 'none', cursor: 'pointer', padding: '6px 12px' }}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          fundStore.updateCustodian(cust.id, editingCustodianFields, 'j@vegarei.com')
                          setEditingCustodian(null)
                          setEditingCustodianFields({})
                        }}
                        style={{
                          ...mono, fontSize: 10, fontWeight: 700, padding: '6px 16px',
                          border: '1px solid rgba(96,165,250,0.3)', background: 'var(--bluM)',
                          color: 'var(--blu)', borderRadius: 4, cursor: 'pointer',
                        }}
                      >
                        Save
                      </button>
                    </div>
                  </>
                ) : (
                  <>
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
                      <div className="r-scroll-table">
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
                      </div>
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
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* ── Contact Action Dialog (Call or Text choice) ── */}
      {showContactAction && (
        <ContactActionDialog
          phone={showContactAction.phone}
          name={showContactAction.name}
          onCall={() => {
            const action = showContactAction
            setShowContactAction(null)
            setShowRingOut(action)
          }}
          onText={() => {
            setShowContactAction(null)
            setDetailTab('communications')
          }}
          onClose={() => setShowContactAction(null)}
        />
      )}

      {/* ── RingOut Call Dialog ──────────────────── */}
      {showRingOut && (
        rcAuth ? (
          <RingOutDialog
            to={showRingOut.phone}
            toName={showRingOut.name}
            invId={showRingOut.invId}
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
                      background: 'var(--bgS)',
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

      {/* ═══════════════════════════════════════ */}
      {/* KPIs TAB                              */}
      {/* ═══════════════════════════════════════ */}
      {dirTab === 'kpis' && <DirectoryKpis />}

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
                          background: 'var(--bgS)',
                          color: 'var(--t2)',
                          borderRadius: 6,
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'all 0.15s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--grn)'; e.currentTarget.style.background = 'rgba(52,211,153,0.04)' }}
                        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bd)'; e.currentTarget.style.background = 'var(--bgS)' }}
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
