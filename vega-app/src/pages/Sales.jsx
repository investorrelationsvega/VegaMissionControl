// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Sales Page
// KPI tracking, activity log, prospect pipeline,
// materials shipments, and expense tracking
// ═══════════════════════════════════════════════

import { useState, useMemo, useEffect } from 'react';
import useSalesStore, {
  FUNNEL_STAGES,
  EXPENSE_CATEGORIES,
  MATERIAL_TYPES,
  INVENTORY_ITEMS,
  ACTIVITY_TYPES,
  OUTCOMES,
  getCurrentPeriodKey,
} from '../stores/salesStore';
import useSalesforceStore from '../stores/salesforceStore';
import useUiStore from '../stores/uiStore';
import useInvestorStore, { PIPELINE_STAGES, PIPELINE_STAGE_LABELS, getPipelineStages, STAGE_DATE_KEYS } from '../stores/investorStore';
import useResponsive from '../hooks/useResponsive';
import { fetchAllSalesforceData, mapSalesforceToKPIs } from '../services/salesforceService';
import { startSalesforceAuth } from '../services/salesforceAuth';
import PipelineTracker, { PipelineBadge } from '../components/PipelineTracker';
import useGoogleStore from '../stores/googleStore';
import SalesOpsKpis from '../components/SalesOpsKpis';

const mono = { fontFamily: "'Space Mono', monospace" };
const displayName = (email, currentUserEmail, currentUserName) => {
  if (email === currentUserEmail && currentUserName) return currentUserName;
  if (email === 'system-backfill' || email === 'System') return 'System';
  // For other users, strip domain to get a readable fallback
  return email;
};

// ── Period helpers ──────────────────────────────────────────────────────────────
function getWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() - day);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: fmt(start), end: fmt(end), label: 'This Week' };
}

function getMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: fmt(start), end: fmt(end), label: 'This Month' };
}

function getQuarterRange() {
  const now = new Date();
  const q = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), q * 3, 1);
  const end = new Date(now.getFullYear(), q * 3 + 3, 0);
  return { start: fmt(start), end: fmt(end), label: 'This Quarter' };
}

function fmt(d) {
  return d.toISOString().split('T')[0];
}

function fmtDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtCurrency(n) {
  if (!n && n !== 0) return '-';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtPct(n) {
  if (n === null || n === undefined) return '-';
  return Math.round(n) + '%';
}

function daysAgo(isoStr) {
  if (!isoStr) return 0;
  return Math.round((Date.now() - new Date(isoStr).getTime()) / (1000 * 60 * 60 * 24));
}

const today = fmt(new Date());

// ═══════════════════════════════════════════════
// SALES PAGE COMPONENT
// ═══════════════════════════════════════════════
export default function Sales() {
  const store = useSalesStore();
  const showToast = useUiStore((s) => s.showToast);
  const { isMobile, isTablet } = useResponsive();

  // ── Salesforce state ─────────────────────────────────────────────────────
  const sfAuth = useSalesforceStore((s) => s.isAuthenticated);
  const sfLoading = useSalesforceStore((s) => s.isLoading);
  const sfError = useSalesforceStore((s) => s.error);
  const sfTasks = useSalesforceStore((s) => s.tasks);
  const sfEvents = useSalesforceStore((s) => s.events);
  const sfLastFetched = useSalesforceStore((s) => s.lastFetchedAt);

  // ── Investor store (for subscriptions kanban) ───────────────────────────
  const investors = useInvestorStore((s) => s.investors);
  const positions = useInvestorStore((s) => s.positions);
  const advancePipelineStage = useInvestorStore((s) => s.advancePipelineStage);
  const auditLog = useInvestorStore((s) => s.auditLog);
  const googleUserEmail = useGoogleStore((s) => s.userEmail);
  const googleUserName = useGoogleStore((s) => s.userName);
  const USER = googleUserEmail || 'j@vegarei.com';

  // ── Tab / filter state ───────────────────────────────────────────────────
  const [tab, setTab] = useState('activity');
  const [repFilter, setRepFilter] = useState('All');
  const [periodType, setPeriodType] = useState('weekly');

  const periodRange = useMemo(() => {
    if (periodType === 'weekly') return getWeekRange();
    if (periodType === 'monthly') return getMonthRange();
    return getQuarterRange();
  }, [periodType]);

  const periodKey = useMemo(() => getCurrentPeriodKey(periodType), [periodType]);

  // ── Fetch Salesforce data when authenticated and period changes ──────────
  useEffect(() => {
    if (sfAuth && periodRange.start && periodRange.end) {
      fetchAllSalesforceData(periodRange.start, periodRange.end).catch(() => {});
    }
  }, [sfAuth, periodRange.start, periodRange.end]);

  // ── Salesforce KPI mapping ───────────────────────────────────────────────
  const sfKpis = useMemo(() => {
    if (!sfAuth || sfTasks.length === 0 && sfEvents.length === 0) return null;
    return mapSalesforceToKPIs(sfTasks, sfEvents, {});
  }, [sfAuth, sfTasks, sfEvents]);

  // ── Data selectors ───────────────────────────────────────────────────────
  const kpiSummary = useMemo(() => store.getKpiSummary(periodKey, repFilter), [store.kpiEntries, periodKey, repFilter]);
  const prospects = useMemo(() => {
    const all = store.getProspects();
    if (repFilter === 'All') return all;
    return all.filter((p) => p.assignedTo === repFilter);
  }, [store.prospects, repFilter]);
  const pipelineHealth = useMemo(() => store.getPipelineHealth(), [store.prospects]);
  const callNotes = useMemo(() => {
    let notes = [...store.callNotes].sort((a, b) => b.date.localeCompare(a.date));
    if (repFilter !== 'All') notes = notes.filter((n) => n.rep === repFilter);
    return notes;
  }, [store.callNotes, repFilter]);
  const shipments = useMemo(() =>
    [...store.shipments].sort((a, b) => b.date.localeCompare(a.date)),
    [store.shipments]);
  const expenses = useMemo(() =>
    [...store.expenses].sort((a, b) => b.date.localeCompare(a.date)),
    [store.expenses]);

  // ── Modal state ──────────────────────────────────────────────────────────
  const [showKpiModal, setShowKpiModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [showProspectModal, setShowProspectModal] = useState(false);
  const [showShipmentModal, setShowShipmentModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [selectedSubscription, setSelectedSubscription] = useState(null);

  // ── Subscription pipeline data ─────────────────────────────────────────
  // Dynamic kanban stages — union of both routes, in display order
  const ALL_KANBAN_STAGES = [
    'Pending', 'Webform Sent', 'Webform Done', 'Out for Signatures', 'Signed by LP',
    'Docs to Custodian', 'Delivered to Vega', 'Signed by GP/Vega',
    'Funded', 'Reviewed by Attorney', 'Blue Sky Filing',
  ];
  // Stages that only appear if a subscription actually occupies them
  const ROUTE_SPECIFIC = new Set([
    'Webform Done', 'Out for Signatures', 'Signed by LP',
    'Docs to Custodian', 'Delivered to Vega',
  ]);

  const subscriptions = useMemo(() => {
    const posArr = Array.isArray(positions) ? positions : [];
    return posArr
      .filter((p) => {
        if (!p.pipeline || !p.pipeline.stage) return false;
        const stage = p.pipeline.stage;
        if (stage === 'Fully Accepted' || stage === 'Accepted' || stage === 'Declined' || stage === 'New') return false;
        return true;
      })
      .map((p) => {
        const inv = investors?.[p.invId];
        const routing = p.docRouting || 'direct';
        const displayStage = p.pipeline.stage === 'Webform Sent' ? 'Pending' : p.pipeline.stage;
        const stageKey = STAGE_DATE_KEYS[p.pipeline.stage];
        const enteredDate = stageKey ? p.pipeline[stageKey] : (p.pipeline.enteredDate || p.pipeline.pendingDate || p.pipeline.webformSentDate);
        const signedCount = (p.signers || []).filter((s) => s.signed).length;
        const totalSigners = (p.signers || []).length;
        return {
          positionId: p.id,
          invId: p.invId,
          name: p.name,
          type: p.type || (inv?.types?.[0]) || '',
          entity: p.entity || '',
          stage: displayStage,
          rawStage: p.pipeline.stage,
          amount: p.amt || 0,
          advisor: inv?.advisor || p.advisor || '',
          custodian: inv?.custodian || p.custodian || '',
          docRouting: routing,
          email: inv?.email || p.email || '',
          phone: inv?.phone || p.phone || '',
          pipeline: p.pipeline,
          signers: p.signers || [],
          signedCount,
          totalSigners,
          enteredDate,
          daysInStage: daysAgo(enteredDate),
          fund: p.fund || 'Fund II',
          contacts: inv?.contacts || [],
          subscriptionId: p.subscriptionId || null,
          docusignEnvelopeId: p.docusignEnvelopeId || '',
          state: p.state || inv?.state || '',
        };
      });
  }, [positions, investors]);

  const subsByStage = useMemo(() => {
    const map = {};
    ALL_KANBAN_STAGES.forEach((s) => { map[s] = []; });
    subscriptions.forEach((sub) => {
      if (map[sub.stage]) map[sub.stage].push(sub);
    });
    return map;
  }, [subscriptions]);

  // Dynamic visible columns: shared stages always show; route-specific only when occupied
  const visibleKanbanStages = useMemo(() => {
    return ALL_KANBAN_STAGES.filter((stage) => {
      if (!ROUTE_SPECIFIC.has(stage)) return true; // shared stages always show
      return (subsByStage[stage] || []).length > 0;  // route-specific only if populated
    });
  }, [subsByStage]);

  const subMetrics = useMemo(() => {
    const total = subscriptions.length;
    const totalCapital = subscriptions.reduce((s, sub) => s + sub.amount, 0);
    const stageCounts = {};
    ALL_KANBAN_STAGES.forEach((stage) => {
      stageCounts[stage] = (subsByStage[stage] || []).length;
    });
    const funded = subscriptions.filter((s) => s.stage === 'Funded');
    let avgDaysToFund = 0;
    if (funded.length > 0) {
      const totalDays = funded.reduce((s, f) => {
        const start = f.pipeline.pendingDate || f.pipeline.webformSentDate || f.pipeline.enteredDate;
        const end = f.pipeline.fundedDate;
        if (start && end) return s + Math.round((new Date(end) - new Date(start)) / (1000 * 60 * 60 * 24));
        return s;
      }, 0);
      avgDaysToFund = Math.round(totalDays / funded.length);
    }
    return { total, totalCapital, stageCounts, avgDaysToFund };
  }, [subscriptions, subsByStage]);

  // ── KPI form state ───────────────────────────────────────────────────────
  const [kpiForm, setKpiForm] = useState({
    date: today, rep: 'Alex',
    outboundCallsLogged: '', advisorConversations: '', emailsSent: '',
    materialsSent: '', appointmentsSetForKen: '', newFirmsVisited: '',
    inPersonMeetingsTaken: '', scheduledMeetings: '',
    webinarsHosted: '', webinarAttendees: '', meetingsAdvancing: '',
    materialsRequested: '', factRightViewed: '',
    factRightFollowUpHrs: '', postMeetingFollowUpHrs: '',
    subAgreementsSent: '', subAgreementsCompleted: '', capitalFunded: '',
    notes: '',
  });

  // ── Activity form state ──────────────────────────────────────────────────
  const [actForm, setActForm] = useState({
    date: today, type: 'call', rep: 'Alex',
    contactName: '', contactFirm: '', contactPhone: '',
    duration: '', outcome: '', nextStep: '', notes: '',
  });

  // ── Prospect form state ──────────────────────────────────────────────────
  const [prosForm, setProsForm] = useState({
    name: '', firm: '', phone: '', email: '',
    assignedTo: 'Alex', funnelStage: 'Cold Lead', source: '', notes: '',
  });

  // ── Shipment form state ──────────────────────────────────────────────────
  const [shipForm, setShipForm] = useState({
    date: today, recipient: '', recipientFirm: '', recipientAddress: '',
    materialType: MATERIAL_TYPES[0], quantity: '1',
    trackingNumber: '', carrier: '', cost: '', scheduledDelivery: '', notes: '',
  });

  // ── Inventory / restock state ───────────────────────────────────────────
  const [showRestockModal, setShowRestockModal] = useState(false);
  const [restockForm, setRestockForm] = useState({ materialType: INVENTORY_ITEMS[0], quantity: '' });
  const [editingInventory, setEditingInventory] = useState({}); // { materialType: tempValue }

  // ── Expense form state ───────────────────────────────────────────────────
  const [expForm, setExpForm] = useState({
    date: today, category: 'travel', description: '',
    amount: '', incurredBy: 'Ken', notes: '',
  });

  const [expCatFilter, setExpCatFilter] = useState('All');

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSaveKpi = () => {
    const entry = { ...kpiForm };
    // Convert string numbers to actual numbers
    Object.keys(entry).forEach((k) => {
      if (k !== 'date' && k !== 'rep' && k !== 'notes' && entry[k] !== '' && entry[k] !== null) {
        entry[k] = Number(entry[k]) || 0;
      }
      if (entry[k] === '') entry[k] = 0;
    });
    entry.date = kpiForm.date;
    entry.rep = kpiForm.rep;
    entry.notes = kpiForm.notes;
    store.addKpiEntry(entry, USER);
    setShowKpiModal(false);
    showToast('KPI entry saved');
    setKpiForm((prev) => ({ ...prev, date: today }));
  };

  const handleSaveActivity = () => {
    if (!actForm.contactName.trim()) return;
    store.addCallNote({
      ...actForm,
      duration: actForm.duration ? Number(actForm.duration) : null,
    }, USER);
    setShowActivityModal(false);
    showToast('Activity logged');
    setActForm({ date: today, type: 'call', rep: 'Alex', contactName: '', contactFirm: '', contactPhone: '', duration: '', outcome: '', nextStep: '', notes: '' });
  };

  const handleSaveProspect = () => {
    if (!prosForm.name.trim()) return;
    store.addProspect(prosForm, USER);
    setShowProspectModal(false);
    showToast('Prospect added');
    setProsForm({ name: '', firm: '', phone: '', email: '', assignedTo: 'Alex', funnelStage: 'Cold Lead', source: '', notes: '' });
  };

  const handleSaveShipment = () => {
    if (!shipForm.recipient.trim()) return;
    const shipQty = Number(shipForm.quantity) || 1;
    const shipMt = shipForm.materialType;
    const prevStock = store.inventory?.[shipMt] ?? 0;
    store.addShipment({
      ...shipForm,
      quantity: shipQty,
      cost: Number(shipForm.cost) || 0,
    }, USER);
    setShowShipmentModal(false);
    showToast('Shipment logged');
    // Check if inventory dropped to reorder threshold
    if (INVENTORY_ITEMS.includes(shipMt)) {
      const newStock = Math.max(0, prevStock - shipQty);
      if (newStock <= 20 && prevStock > 20) {
        setTimeout(() => showToast(`⚠ ${shipMt} is at ${newStock} — time to reorder`), 600);
      } else if (newStock <= 20) {
        setTimeout(() => showToast(`⚠ ${shipMt} is low (${newStock}) — reorder needed`), 600);
      }
    }
    setShipForm({ date: today, recipient: '', recipientFirm: '', recipientAddress: '', materialType: MATERIAL_TYPES[0], quantity: '1', trackingNumber: '', carrier: '', cost: '', scheduledDelivery: '', notes: '' });
  };

  const handleRestock = () => {
    const qty = Number(restockForm.quantity) || 0;
    if (qty <= 0) return;
    store.adjustInventory(restockForm.materialType, qty, USER);
    setShowRestockModal(false);
    showToast(`Restocked ${qty} × ${restockForm.materialType}`);
    setRestockForm({ materialType: INVENTORY_ITEMS[0], quantity: '' });
  };

  const handleInventoryInput = (materialType, value) => {
    const qty = Number(value);
    if (isNaN(qty) || qty < 0) return;
    store.setInventoryQty(materialType, qty, USER);
    setEditingInventory((prev) => { const n = { ...prev }; delete n[materialType]; return n; });
    if (qty <= 20 && qty > 0) showToast(`⚠ ${materialType} is at ${qty} — time to reorder`);
    if (qty === 0) showToast(`⚠ ${materialType} is out of stock`);
  };

  const handleSaveExpense = () => {
    if (!expForm.description.trim()) return;
    store.addExpense({
      ...expForm,
      amount: Number(expForm.amount) || 0,
    }, USER);
    setShowExpenseModal(false);
    showToast('Expense logged');
    setExpForm({ date: today, category: 'travel', description: '', amount: '', incurredBy: 'Ken', notes: '' });
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="main">
      {/* ── Page Header ──────────────────────────────────── */}
      <div className="page-header">
        <div className="page-header-dot"><span>Active Module</span></div>
        <h1 className="page-title">Sales Operations</h1>
        <p className="page-subtitle">
          Fund II Capital Raise
          {pipelineHealth.activeProspects > 0 && (
            <span style={{ color: 'var(--blu)' }}> &middot; {pipelineHealth.activeProspects} active prospects</span>
          )}
        </p>
      </div>

      {/* ── Salesforce Connection Banner ──────────────────── */}
      {!sfAuth && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, padding: '12px 16px', background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.2)', borderRadius: 6, marginBottom: 16 }}>
          <div>
            <span style={{ ...mono, fontSize: 11, color: 'var(--blu)', fontWeight: 700 }}>Salesforce Not Connected</span>
            <span style={{ ...mono, fontSize: 10, color: 'var(--t4)', marginLeft: 8 }}>Connect to pull call logs, emails, and meeting data automatically</span>
          </div>
          <button onClick={() => startSalesforceAuth('/pe/sales')} style={{ ...mono, fontSize: 10, fontWeight: 700, padding: '6px 16px', border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.1)', color: 'var(--blu)', borderRadius: 4, cursor: 'pointer' }}>
            Connect Salesforce
          </button>
        </div>
      )}
      {sfAuth && sfLoading && (
        <div style={{ ...mono, fontSize: 10, color: 'var(--t4)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--blu)', animation: 'pulse 1s infinite' }} />
          Loading Salesforce data...
        </div>
      )}
      {sfAuth && sfError && (
        <div style={{ ...mono, fontSize: 10, color: 'var(--red)', marginBottom: 12 }}>
          SF Error: {sfError}
        </div>
      )}
      {sfAuth && !sfLoading && sfLastFetched && (
        <div style={{ ...mono, fontSize: 9, color: 'var(--t5)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--grn)' }} />
          Salesforce connected — last synced {new Date(sfLastFetched).toLocaleTimeString()}
          {sfKpis && <span style={{ color: 'var(--t4)', marginLeft: 8 }}>{sfTasks.length} tasks, {sfEvents.length} events loaded</span>}
        </div>
      )}

      {/* ── Controls Row ─────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        {/* Period selector */}
        <div style={{ display: 'flex', gap: 4 }}>
          {[
            { key: 'weekly', label: 'This Week' },
            { key: 'monthly', label: 'This Month' },
            { key: 'quarterly', label: 'This Quarter' },
          ].map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriodType(p.key)}
              style={{
                ...mono, fontSize: 10, fontWeight: 700, padding: '6px 14px',
                border: '1px solid', borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s',
                borderColor: periodType === p.key ? 'var(--grnB)' : 'var(--bd)',
                background: periodType === p.key ? 'var(--grnM)' : 'transparent',
                color: periodType === p.key ? 'var(--grn)' : 'var(--t4)',
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Rep filter */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['All', 'Alex', 'Ken'].map((r) => (
            <button
              key={r}
              onClick={() => setRepFilter(r)}
              style={{
                ...mono, fontSize: 10, fontWeight: 700, padding: '6px 14px',
                border: '1px solid', borderRadius: 20, cursor: 'pointer', transition: 'all 0.15s',
                borderColor: repFilter === r ? 'var(--bluB, rgba(96,165,250,0.3))' : 'var(--bd)',
                background: repFilter === r ? 'var(--bluM, rgba(96,165,250,0.1))' : 'transparent',
                color: repFilter === r ? 'var(--blu)' : 'var(--t4)',
              }}
            >
              {r === 'All' ? 'All Reps' : r}
            </button>
          ))}
        </div>
      </div>

      {/* ── Main Tabs ────────────────────────────────────── */}
      <div style={{ display: 'flex', flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 24 }}>
        {[
          { key: 'activity', label: `Activity (${callNotes.length})` },
          { key: 'pipeline', label: `Pipeline (${prospects.length})` },
          { key: 'materials', label: `Materials & Shipping (${shipments.length})` },
          { key: 'expenses', label: `Expenses (${expenses.length})` },
          { key: 'subscriptions', label: `Subscriptions (${subscriptions.length})` },
          { key: 'kpis', label: 'National Sales KPIs' },
          { key: 'salesops', label: 'Sales Ops KPIs' },
        ].map((t, i, arr) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              style={{
                ...mono, fontSize: 11, fontWeight: 700, padding: '8px 14px', whiteSpace: 'nowrap',
                border: '1px solid', cursor: 'pointer', transition: 'all 0.15s',
                borderColor: active ? 'var(--grnB)' : 'var(--bd)',
                borderLeft: i > 0 ? 'none' : undefined,
                borderRadius: i === 0 ? '4px 0 0 4px' : i === arr.length - 1 ? '0 4px 4px 0' : '0',
                background: active ? 'var(--grnM)' : 'transparent',
                color: active ? 'var(--grn)' : 'var(--t4)',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ════════════════════════════════════════════════════
          KPIs TAB
          ════════════════════════════════════════════════════ */}
      {tab === 'kpis' && (
        <>
          {/* Log KPIs button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowKpiModal(true)} style={{ ...mono, fontSize: 11, fontWeight: 700, padding: '8px 20px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 6, cursor: 'pointer' }}>
              + Log KPIs
            </button>
          </div>

          {!kpiSummary ? (
            <div style={{ ...mono, fontSize: 12, color: 'var(--t5)', textAlign: 'center', padding: 48 }}>
              No KPI data for {periodRange.label.toLowerCase()}. Click "Log KPIs" to add an entry.
            </div>
          ) : (
            <>
              {/* Stage 1 */}
              <KpiSection title="Stage 1 — Volume & Activity" items={[
                { label: 'Outbound Calls', value: kpiSummary.outboundCallsLogged, owner: 'Alex' },
                { label: 'Advisor Conversations', value: kpiSummary.advisorConversations, owner: 'Alex' },
                { label: 'Call Effectiveness', value: fmtPct(kpiSummary.callEffectivenessRate), owner: 'Alex', isPct: true },
                { label: 'Emails Sent', value: kpiSummary.emailsSent, owner: 'Alex' },
                { label: 'Materials Sent', value: kpiSummary.materialsSent, owner: 'Both' },
                { label: 'Appts Set for Ken', value: kpiSummary.appointmentsSetForKen, owner: 'Alex' },
                { label: 'New Firms Visited', value: kpiSummary.newFirmsVisited, owner: 'Ken' },
                { label: 'In-Person Meetings', value: kpiSummary.inPersonMeetingsTaken, owner: 'Ken' },
                { label: 'Advisor Show Rate', value: fmtPct(kpiSummary.advisorShowRate), owner: 'Ken', isPct: true },
              ]} />

              {/* Stage 2 */}
              <KpiSection title="Stage 2 — Engagement" items={[
                { label: 'Webinars Hosted', value: kpiSummary.webinarsHosted, owner: 'Alex' },
                { label: 'Webinar Attendees', value: kpiSummary.webinarAttendees, owner: 'Alex' },
                { label: 'Meetings Advancing', value: kpiSummary.meetingsAdvancing, owner: 'Ken' },
              ]} />

              {/* Stage 3 */}
              <KpiSection title="Stage 3 — Qualification" items={[
                { label: 'Materials Requested', value: kpiSummary.materialsRequested, owner: 'Both' },
                { label: 'FactRight Viewed', value: kpiSummary.factRightViewed, owner: 'Both' },
                { label: 'FactRight Follow-Up', value: kpiSummary.factRightFollowUpHrs !== null ? `${Math.round(kpiSummary.factRightFollowUpHrs)}h` : '-', owner: 'Alex' },
                { label: 'Post-Meeting Follow-Up', value: kpiSummary.postMeetingFollowUpHrs !== null ? `${Math.round(kpiSummary.postMeetingFollowUpHrs)}h` : '-', owner: 'Alex' },
              ]} />

              {/* Stage 4 */}
              <KpiSection title="Stage 4 — Conversion" items={[
                { label: 'Agreements Sent', value: kpiSummary.subAgreementsSent, owner: 'Both' },
                { label: 'Agreements Completed', value: kpiSummary.subAgreementsCompleted, owner: 'Both' },
                { label: 'Capital Funded', value: fmtCurrency(kpiSummary.capitalFunded), owner: 'Both' },
                { label: 'Avg Commitment', value: fmtCurrency(kpiSummary.averageCommitmentSize), owner: 'Both' },
              ]} />
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════
          ACTIVITY TAB
          ════════════════════════════════════════════════════ */}
      {tab === 'activity' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowActivityModal(true)} style={{ ...mono, fontSize: 11, fontWeight: 700, padding: '8px 20px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 6, cursor: 'pointer' }}>
              + Add Activity
            </button>
          </div>

          {callNotes.length === 0 ? (
            <div style={{ ...mono, fontSize: 12, color: 'var(--t5)', textAlign: 'center', padding: 48 }}>
              No activity logged yet. Click "Add Activity" to log a call, meeting, or other touchpoint.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {callNotes.map((n) => (
                <div key={n.id} style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 6, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ ...mono, fontSize: 10, color: 'var(--t5)' }}>{fmtDate(n.date)}</span>
                    <RepBadge rep={n.rep} />
                    <TypeBadge type={n.type} />
                    {n.duration && <span style={{ ...mono, fontSize: 10, color: 'var(--t4)' }}>{n.duration}min</span>}
                    {n.outcome && (
                      <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: n.outcome === 'Not Interested' ? 'var(--red)' : 'var(--grn)', padding: '2px 6px', borderRadius: 3, background: n.outcome === 'Not Interested' ? 'var(--redM)' : 'var(--grnM)' }}>
                        {n.outcome}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)', marginBottom: 4 }}>
                    {n.contactName}
                    {n.contactFirm && <span style={{ fontWeight: 300, color: 'var(--t4)' }}> — {n.contactFirm}</span>}
                  </div>
                  {n.notes && <div style={{ fontSize: 13, color: 'var(--t3)', marginBottom: 4, lineHeight: 1.5 }}>{n.notes}</div>}
                  {n.nextStep && (
                    <div style={{ ...mono, fontSize: 10, color: 'var(--ylw)', marginTop: 4 }}>
                      Next: {n.nextStep}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════
          PIPELINE TAB
          ════════════════════════════════════════════════════ */}
      {tab === 'pipeline' && (
        <>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            <button onClick={() => setShowProspectModal(true)} style={{ ...mono, fontSize: 11, fontWeight: 700, padding: '8px 20px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 6, cursor: 'pointer' }}>
              + Add Prospect
            </button>
          </div>

          {/* Pipeline columns */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}><div style={{ display: 'grid', gridTemplateColumns: `repeat(${FUNNEL_STAGES.length}, 1fr)`, gap: 8, marginBottom: 32, minWidth: FUNNEL_STAGES.length * 160 }}>
            {FUNNEL_STAGES.map((stage) => {
              const stageProspects = prospects.filter((p) => p.funnelStage === stage);
              const stageColor = stage === 'Closed Won' ? 'var(--grn)' : stage === 'Closed Lost' ? 'var(--red)' : 'var(--t4)';
              return (
                <div key={stage} style={{ minWidth: 140 }}>
                  {/* Column header */}
                  <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: stageColor, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: stageColor, display: 'inline-block' }} />
                    {stage}
                    <span style={{ color: 'var(--t5)' }}>({stageProspects.length})</span>
                  </div>

                  {/* Cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {stageProspects.map((p) => (
                      <div key={p.id} style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 6, padding: '10px 12px', fontSize: 12 }}>
                        <div style={{ fontWeight: 500, color: 'var(--t1)', marginBottom: 3 }}>{p.name}</div>
                        {p.firm && <div style={{ ...mono, fontSize: 10, color: 'var(--t4)', marginBottom: 4 }}>{p.firm}</div>}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <RepBadge rep={p.assignedTo} />
                          <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>{daysAgo(p.enteredStageAt)}d</span>
                          <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>{p.totalTouchpoints} touches</span>
                        </div>
                        {/* Advance button */}
                        {stage !== 'Closed Won' && stage !== 'Closed Lost' && (
                          <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                            <button
                              onClick={() => {
                                const idx = FUNNEL_STAGES.indexOf(stage);
                                if (idx < FUNNEL_STAGES.length - 2) {
                                  store.advanceProspectStage(p.id, FUNNEL_STAGES[idx + 1], USER);
                                  showToast(`${p.name} → ${FUNNEL_STAGES[idx + 1]}`);
                                }
                              }}
                              style={{ ...mono, fontSize: 8, fontWeight: 700, padding: '3px 8px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 3, cursor: 'pointer' }}
                            >
                              Advance ▸
                            </button>
                            <button
                              onClick={() => {
                                store.advanceProspectStage(p.id, 'Closed Lost', USER);
                                showToast(`${p.name} → Closed Lost`);
                              }}
                              style={{ ...mono, fontSize: 8, fontWeight: 700, padding: '3px 8px', border: '1px solid rgba(239,68,68,0.2)', background: 'transparent', color: 'var(--t5)', borderRadius: 3, cursor: 'pointer' }}
                            >
                              Lost
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div></div>

          {/* Pipeline Health */}
          <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 20, marginTop: 8 }}>
            <div style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 16 }}>
              Pipeline Health
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
              <MetricCard label="Total Prospects" value={pipelineHealth.totalProspects} />
              <MetricCard label="Active Prospects" value={pipelineHealth.activeProspects} />
              <MetricCard label="Avg Touchpoints to Close" value={pipelineHealth.avgTouchpointsToClose} />
              <MetricCard label="Closed Won" value={pipelineHealth.prospectsByStage?.['Closed Won'] || 0} color="var(--grn)" />
            </div>

            {/* Stage conversion rates */}
            {pipelineHealth.stageConversions && Object.keys(pipelineHealth.stageConversions).length > 0 && (
              <div style={{ marginTop: 16 }}>
                <div style={{ ...mono, fontSize: 10, fontWeight: 700, color: 'var(--t5)', marginBottom: 8 }}>CONVERSION RATES</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(pipelineHealth.stageConversions).map(([key, val]) => (
                    <div key={key} style={{ ...mono, fontSize: 10, color: 'var(--t4)', padding: '4px 10px', background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 4 }}>
                      {key}: <span style={{ color: 'var(--grn)', fontWeight: 700 }}>{val}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Avg days in stage */}
            {pipelineHealth.avgDaysInStage && (
              <div style={{ marginTop: 16 }}>
                <div style={{ ...mono, fontSize: 10, fontWeight: 700, color: 'var(--t5)', marginBottom: 8 }}>AVG DAYS IN STAGE</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {Object.entries(pipelineHealth.avgDaysInStage).filter(([, v]) => v > 0).map(([stage, days]) => (
                    <div key={stage} style={{ ...mono, fontSize: 10, color: 'var(--t4)', padding: '4px 10px', background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 4 }}>
                      {stage}: <span style={{ color: days > 30 ? 'var(--ylw)' : 'var(--t2)', fontWeight: 700 }}>{days}d</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════
          MATERIALS TAB
          ════════════════════════════════════════════════════ */}
      {tab === 'materials' && (
        <>
          {/* ── Inventory Cards ─────────────────────────── */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ ...mono, fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)' }}>Inventory On Hand</div>
              <button onClick={() => setShowRestockModal(true)} style={{ ...mono, fontSize: 10, fontWeight: 700, padding: '6px 14px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 6, cursor: 'pointer' }}>
                + Restock
              </button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : `repeat(${INVENTORY_ITEMS.length}, 1fr)`, gap: 10 }}>
              {INVENTORY_ITEMS.map((mt) => {
                const qty = store.inventory?.[mt] ?? 0;
                const isEditing = editingInventory[mt] !== undefined;
                const low = qty > 0 && qty <= 20;
                const out = qty === 0;
                return (
                  <div key={mt} style={{ background: 'var(--bg1)', border: `1px solid ${out ? 'rgba(239,68,68,0.3)' : low ? 'rgba(234,179,8,0.3)' : 'var(--bd)'}`, borderRadius: 6, padding: '10px 12px', textAlign: 'center' }}>
                    <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t4)', marginBottom: 6, lineHeight: 1.3 }}>{mt}</div>
                    {isEditing ? (
                      <input
                        type="number" min="0" autoFocus
                        value={editingInventory[mt]}
                        onChange={(e) => setEditingInventory((prev) => ({ ...prev, [mt]: e.target.value }))}
                        onBlur={() => handleInventoryInput(mt, editingInventory[mt])}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleInventoryInput(mt, editingInventory[mt]); if (e.key === 'Escape') setEditingInventory((prev) => { const n = { ...prev }; delete n[mt]; return n; }); }}
                        style={{ ...mono, fontSize: 18, fontWeight: 700, width: 60, textAlign: 'center', background: 'var(--bg0)', border: '1px solid var(--blu)', borderRadius: 4, color: 'var(--t1)', outline: 'none', padding: '2px 4px' }}
                      />
                    ) : (
                      <div
                        onClick={() => setEditingInventory((prev) => ({ ...prev, [mt]: String(qty) }))}
                        style={{ ...mono, fontSize: 18, fontWeight: 700, color: out ? 'var(--red)' : low ? 'var(--ylw)' : 'var(--t1)', cursor: 'pointer', marginBottom: 4 }}
                        title="Click to edit"
                      >
                        {qty}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 4 }}>
                      <button onClick={() => store.adjustInventory(mt, -1, USER)} disabled={qty === 0} style={{ ...mono, fontSize: 12, fontWeight: 700, width: 26, height: 26, border: '1px solid var(--bd)', background: 'var(--bg0)', color: qty === 0 ? 'var(--t5)' : 'var(--t2)', borderRadius: 4, cursor: qty === 0 ? 'default' : 'pointer', opacity: qty === 0 ? 0.4 : 1 }}>-</button>
                      <button onClick={() => store.adjustInventory(mt, 1, USER)} style={{ ...mono, fontSize: 12, fontWeight: 700, width: 26, height: 26, border: '1px solid var(--bd)', background: 'var(--bg0)', color: 'var(--t2)', borderRadius: 4, cursor: 'pointer' }}>+</button>
                    </div>
                    {out && <div style={{ ...mono, fontSize: 8, color: 'var(--red)', marginTop: 4, fontWeight: 700 }}>OUT OF STOCK</div>}
                    {low && !out && <div style={{ ...mono, fontSize: 8, color: 'var(--ylw)', marginTop: 4, fontWeight: 700 }}>REORDER — 20 OR BELOW</div>}
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ ...mono, fontSize: 11, color: 'var(--t4)' }}>
              Total Cost: <span style={{ color: 'var(--t1)', fontWeight: 700 }}>{fmtCurrency(shipments.reduce((s, sh) => s + (sh.cost || 0), 0))}</span>
            </div>
            <button onClick={() => setShowShipmentModal(true)} style={{ ...mono, fontSize: 11, fontWeight: 700, padding: '8px 20px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 6, cursor: 'pointer' }}>
              + Add Shipment
            </button>
          </div>

          {shipments.length === 0 ? (
            <div style={{ ...mono, fontSize: 12, color: 'var(--t5)', textAlign: 'center', padding: 48 }}>
              No shipments logged yet. Click "Add Shipment" to track materials sent.
            </div>
          ) : (
            <div className="r-scroll-table"><div style={{ border: '1px solid var(--bd)', borderRadius: 6, overflow: 'hidden', minWidth: 820 }}>
              {/* Header */}
              <div style={{ display: 'grid', gridTemplateColumns: '80px 1.2fr 1fr 1fr 50px 150px 60px 80px 80px', gap: 0, background: 'var(--bg1)', borderBottom: '1px solid var(--bd)', padding: '10px 14px' }}>
                {['Date', 'Recipient', 'Firm', 'Material', 'Qty', 'Tracking', 'Carrier', 'Delivery', 'Cost'].map((h) => (
                  <div key={h} style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t5)' }}>{h}</div>
                ))}
              </div>
              {/* Rows */}
              {shipments.map((s) => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '80px 1.2fr 1fr 1fr 50px 150px 60px 80px 80px', gap: 0, padding: '10px 14px', borderBottom: '1px solid var(--bdS)', fontSize: 12, color: 'var(--t2)' }}>
                  <div style={{ ...mono, fontSize: 11, color: 'var(--t4)' }}>{fmtDate(s.date)}</div>
                  <div>
                    <div>{s.recipient}</div>
                    {s.recipientAddress && <div style={{ ...mono, fontSize: 9, color: 'var(--t5)', marginTop: 2 }}>{s.recipientAddress}</div>}
                  </div>
                  <div style={{ color: 'var(--t4)' }}>{s.recipientFirm || '-'}</div>
                  <div>{s.materialType}</div>
                  <div style={{ ...mono, fontSize: 11 }}>{s.quantity}</div>
                  <div style={{ ...mono, fontSize: 10 }}>
                    {s.trackingNumber ? (
                      <a href={`https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(s.trackingNumber)}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blu)', textDecoration: 'none' }}>{s.trackingNumber}</a>
                    ) : '-'}
                  </div>
                  <div style={{ ...mono, fontSize: 10, color: 'var(--t4)' }}>{s.carrier || '-'}</div>
                  <div style={{ ...mono, fontSize: 11, color: 'var(--t4)' }}>{s.scheduledDelivery ? fmtDate(s.scheduledDelivery) : '-'}</div>
                  <div style={{ ...mono, fontSize: 11, fontWeight: 700 }}>{fmtCurrency(s.cost)}</div>
                </div>
              ))}
            </div></div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════
          EXPENSES TAB
          ════════════════════════════════════════════════════ */}
      {tab === 'expenses' && (
        <>
          {/* Category summary cards */}
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : isTablet ? 'repeat(3, 1fr)' : 'repeat(5, 1fr)', gap: 12, marginBottom: 20 }}>
            {EXPENSE_CATEGORIES.map((cat) => {
              const total = expenses.filter((e) => e.category === cat).reduce((s, e) => s + (e.amount || 0), 0);
              return (
                <div key={cat} onClick={() => setExpCatFilter(expCatFilter === cat ? 'All' : cat)} style={{ background: expCatFilter === cat ? 'var(--grnM)' : 'var(--bg1)', border: `1px solid ${expCatFilter === cat ? 'var(--grnB)' : 'var(--bd)'}`, borderRadius: 6, padding: '12px 14px', cursor: 'pointer', transition: 'all 0.15s' }}>
                  <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', marginBottom: 4 }}>{cat}</div>
                  <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: total > 0 ? 'var(--t1)' : 'var(--t5)' }}>{fmtCurrency(total)}</div>
                </div>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ ...mono, fontSize: 11, color: 'var(--t4)' }}>
              Total: <span style={{ color: 'var(--t1)', fontWeight: 700 }}>
                {fmtCurrency(
                  (expCatFilter === 'All' ? expenses : expenses.filter((e) => e.category === expCatFilter))
                    .reduce((s, e) => s + (e.amount || 0), 0)
                )}
              </span>
            </div>
            <button onClick={() => setShowExpenseModal(true)} style={{ ...mono, fontSize: 11, fontWeight: 700, padding: '8px 20px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 6, cursor: 'pointer' }}>
              + Add Expense
            </button>
          </div>

          {(() => {
            const filtered = expCatFilter === 'All' ? expenses : expenses.filter((e) => e.category === expCatFilter);
            if (filtered.length === 0) return (
              <div style={{ ...mono, fontSize: 12, color: 'var(--t5)', textAlign: 'center', padding: 48 }}>
                No expenses logged yet. Click "Add Expense" to track costs.
              </div>
            );
            return (
              <div className="r-scroll-table"><div style={{ border: '1px solid var(--bd)', borderRadius: 6, overflow: 'hidden', minWidth: 480 }}>
                <div style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr 100px 80px', gap: 0, background: 'var(--bg1)', borderBottom: '1px solid var(--bd)', padding: '10px 14px' }}>
                  {['Date', 'Category', 'Description', 'Amount', 'By'].map((h) => (
                    <div key={h} style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t5)' }}>{h}</div>
                  ))}
                </div>
                {filtered.map((e) => (
                  <div key={e.id} style={{ display: 'grid', gridTemplateColumns: '80px 100px 1fr 100px 80px', gap: 0, padding: '10px 14px', borderBottom: '1px solid var(--bdS)', fontSize: 12, color: 'var(--t2)' }}>
                    <div style={{ ...mono, fontSize: 11, color: 'var(--t4)' }}>{fmtDate(e.date)}</div>
                    <div style={{ ...mono, fontSize: 10, textTransform: 'capitalize', color: 'var(--t3)' }}>{e.category}</div>
                    <div>{e.description}</div>
                    <div style={{ ...mono, fontSize: 11, fontWeight: 700 }}>{fmtCurrency(e.amount)}</div>
                    <div style={{ ...mono, fontSize: 10, color: 'var(--t4)' }}>{e.incurredBy}</div>
                  </div>
                ))}
              </div></div>
            );
          })()}
        </>
      )}

      {/* ════════════════════════════════════════════════════
          SUBSCRIPTIONS TAB
          ════════════════════════════════════════════════════ */}
      {tab === 'subscriptions' && (
        <>
          {/* Subscription pipeline kanban columns */}
          {subscriptions.length === 0 ? (
            <div style={{ ...mono, fontSize: 12, color: 'var(--t5)', textAlign: 'center', padding: 48 }}>
              No active subscriptions in the pipeline. Subscriptions appear here when investors submit the webform.
            </div>
          ) : (
            <>
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${visibleKanbanStages.length}, 1fr)`, gap: 8, marginBottom: 32, minWidth: visibleKanbanStages.length * 180 }}>
                  {visibleKanbanStages.map((stage) => {
                    const cards = subsByStage[stage] || [];
                    const stageColor =
                      stage === 'Funded' || stage === 'Reviewed by Attorney' ? 'var(--grn)'
                      : stage === 'Signed by GP/Vega' ? '#a855f7'
                      : stage === 'Out for Signatures' || stage === 'Signed by LP' ? '#a855f7'
                      : stage === 'Docs to Custodian' || stage === 'Delivered to Vega' ? '#ec4899'
                      : stage === 'Webform Done' || stage === 'Webform Sent' ? 'var(--blu)'
                      : stage === 'Blue Sky Filing' ? '#f59e0b'
                      : 'var(--ylw)';
                    const stageCapital = cards.reduce((s, c) => s + c.amount, 0);
                    return (
                      <div key={stage} style={{ minWidth: 160 }}>
                        {/* Column header */}
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: stageColor, display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: stageColor, display: 'inline-block' }} />
                            {PIPELINE_STAGE_LABELS[stage] || stage}
                            <span style={{ color: 'var(--t5)' }}>({cards.length})</span>
                          </div>
                          {stageCapital > 0 && (
                            <div style={{ ...mono, fontSize: 9, color: 'var(--t5)', marginTop: 2, marginLeft: 12 }}>
                              {fmtCurrency(stageCapital)}
                            </div>
                          )}
                        </div>

                        {/* Cards */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {cards.map((sub) => (
                            <div
                              key={sub.positionId}
                              onClick={() => setSelectedSubscription(sub)}
                              style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 6, padding: '10px 12px', fontSize: 12, cursor: 'pointer', transition: 'border-color 0.15s' }}
                              onMouseEnter={(e) => { e.currentTarget.style.borderColor = stageColor; }}
                              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--bd)'; }}
                            >
                              {/* Name + type */}
                              <div style={{ fontWeight: 500, color: 'var(--t1)', marginBottom: 3 }}>{sub.name}</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                                {sub.type && <TypeBadge type={sub.type} />}
                                {sub.entity && (
                                  <span style={{ ...mono, fontSize: 9, color: 'var(--t4)', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {sub.entity}
                                  </span>
                                )}
                              </div>

                              {/* Capital commitment */}
                              {sub.amount > 0 && (
                                <div style={{ ...mono, fontSize: 11, fontWeight: 700, color: 'var(--grn)', marginBottom: 4 }}>
                                  {fmtCurrency(sub.amount)}
                                </div>
                              )}

                              {/* Advisor */}
                              {sub.advisor && (
                                <div style={{ ...mono, fontSize: 9, color: 'var(--t4)', marginBottom: 4 }}>
                                  Advisor: {sub.advisor}
                                </div>
                              )}

                              {/* Signer status for signature stages */}
                              {sub.totalSigners > 0 && ['Out for Signatures', 'Signed by LP', 'Signed by GP/Vega', 'Docs to Custodian', 'Delivered to Vega'].includes(sub.stage) && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                  {sub.signers.map((signer, idx) => (
                                    <span
                                      key={idx}
                                      title={`${signer.name}: ${signer.signed ? 'Signed' : 'Pending'}`}
                                      style={{
                                        width: 8, height: 8, borderRadius: '50%',
                                        background: signer.signed ? 'var(--grn)' : 'var(--ylw)',
                                        border: `1px solid ${signer.signed ? 'rgba(52,211,153,0.4)' : 'rgba(251,191,36,0.4)'}`,
                                      }}
                                    />
                                  ))}
                                  <span style={{ ...mono, fontSize: 9, color: sub.signedCount === sub.totalSigners ? 'var(--grn)' : 'var(--ylw)' }}>
                                    {sub.signedCount}/{sub.totalSigners}
                                  </span>
                                </div>
                              )}

                              {/* Custodian badge */}
                              {sub.docRouting === 'custodian' && sub.custodian && (
                                <div style={{ ...mono, fontSize: 9, color: '#ec4899', marginBottom: 4 }}>
                                  Custodian: {sub.custodian}
                                </div>
                              )}

                              {/* Days in stage + advance */}
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
                                <span style={{ ...mono, fontSize: 9, color: sub.daysInStage > 14 ? 'var(--ylw)' : 'var(--t5)' }}>
                                  {sub.daysInStage}d in stage
                                </span>
                                {(() => {
                                  const routeStages = getPipelineStages(sub.docRouting);
                                  const currentIdx = routeStages.indexOf(sub.rawStage);
                                  const nextStage = currentIdx >= 0 && currentIdx < routeStages.length - 1
                                    ? routeStages[currentIdx + 1] : null;
                                  if (sub.rawStage === 'Fully Accepted' || !nextStage) return null;
                                  return (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        if (nextStage) {
                                          advancePipelineStage(sub.positionId, nextStage, USER);
                                          showToast(`${sub.name} → ${PIPELINE_STAGE_LABELS[nextStage] || nextStage}`);
                                        }
                                      }}
                                      style={{ ...mono, fontSize: 8, fontWeight: 700, padding: '3px 8px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 3, cursor: 'pointer' }}
                                    >
                                      {nextStage === 'Fully Accepted' ? 'Accept ✓' : 'Advance ▸'}
                                    </button>
                                  );
                                })()}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Pipeline Summary Metrics */}
              <div style={{ borderTop: '1px solid var(--bd)', paddingTop: 20, marginTop: 8 }}>
                <div style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 16 }}>
                  Subscription Pipeline
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12 }}>
                  <MetricCard label="In-Flight Subscriptions" value={subMetrics.total} />
                  <MetricCard label="Capital in Pipeline" value={fmtCurrency(subMetrics.totalCapital)} color="var(--grn)" />
                  <MetricCard label="Funded" value={subMetrics.stageCounts['Funded'] || 0} color="var(--grn)" />
                  <MetricCard label="Avg Days to Fund" value={subMetrics.avgDaysToFund > 0 ? `${subMetrics.avgDaysToFund}d` : '-'} />
                </div>

                {/* Per-stage counts */}
                <div style={{ marginTop: 16 }}>
                  <div style={{ ...mono, fontSize: 10, fontWeight: 700, color: 'var(--t5)', marginBottom: 8 }}>PER STAGE</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {visibleKanbanStages.map((stage) => (
                      <div key={stage} style={{ ...mono, fontSize: 10, color: 'var(--t4)', padding: '4px 10px', background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 4 }}>
                        {PIPELINE_STAGE_LABELS[stage] || stage}: <span style={{ color: (subMetrics.stageCounts[stage] || 0) > 0 ? 'var(--t1)' : 'var(--t5)', fontWeight: 700 }}>{subMetrics.stageCounts[stage] || 0}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════
          SALES OPS KPI TAB
          ════════════════════════════════════════════════════ */}
      {tab === 'salesops' && <SalesOpsKpis />}

      {/* ════════════════════════════════════════════════════
          MODALS
          ════════════════════════════════════════════════════ */}

      {/* ── KPI Entry Modal ──────────────────────────────── */}
      {showKpiModal && (
        <Modal title="Log KPIs" onClose={() => setShowKpiModal(false)} onSave={handleSaveKpi} saveLabel="Save Entry" wide>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <FormField label="Date" value={kpiForm.date} onChange={(v) => setKpiForm({ ...kpiForm, date: v })} type="date" />
            <FormSelect label="Rep" value={kpiForm.rep} options={['Alex', 'Ken']} onChange={(v) => setKpiForm({ ...kpiForm, rep: v })} />
          </div>
          <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', marginBottom: 8 }}>Stage 1 — Volume & Activity</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            <FormField label="Outbound Calls" value={kpiForm.outboundCallsLogged} onChange={(v) => setKpiForm({ ...kpiForm, outboundCallsLogged: v })} type="number" />
            <FormField label="Advisor Conversations" value={kpiForm.advisorConversations} onChange={(v) => setKpiForm({ ...kpiForm, advisorConversations: v })} type="number" />
            <FormField label="Emails Sent" value={kpiForm.emailsSent} onChange={(v) => setKpiForm({ ...kpiForm, emailsSent: v })} type="number" />
            <FormField label="Materials Sent" value={kpiForm.materialsSent} onChange={(v) => setKpiForm({ ...kpiForm, materialsSent: v })} type="number" />
            <FormField label="Appts Set for Ken" value={kpiForm.appointmentsSetForKen} onChange={(v) => setKpiForm({ ...kpiForm, appointmentsSetForKen: v })} type="number" />
            <FormField label="New Firms Visited" value={kpiForm.newFirmsVisited} onChange={(v) => setKpiForm({ ...kpiForm, newFirmsVisited: v })} type="number" />
            <FormField label="In-Person Meetings" value={kpiForm.inPersonMeetingsTaken} onChange={(v) => setKpiForm({ ...kpiForm, inPersonMeetingsTaken: v })} type="number" />
            <FormField label="Scheduled Meetings" value={kpiForm.scheduledMeetings} onChange={(v) => setKpiForm({ ...kpiForm, scheduledMeetings: v })} type="number" />
          </div>
          <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', marginBottom: 8 }}>Stage 2 — Engagement</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            <FormField label="Webinars Hosted" value={kpiForm.webinarsHosted} onChange={(v) => setKpiForm({ ...kpiForm, webinarsHosted: v })} type="number" />
            <FormField label="Webinar Attendees" value={kpiForm.webinarAttendees} onChange={(v) => setKpiForm({ ...kpiForm, webinarAttendees: v })} type="number" />
            <FormField label="Meetings Advancing" value={kpiForm.meetingsAdvancing} onChange={(v) => setKpiForm({ ...kpiForm, meetingsAdvancing: v })} type="number" />
          </div>
          <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', marginBottom: 8 }}>Stage 3 — Qualification</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            <FormField label="Materials Requested" value={kpiForm.materialsRequested} onChange={(v) => setKpiForm({ ...kpiForm, materialsRequested: v })} type="number" />
            <FormField label="FactRight Viewed" value={kpiForm.factRightViewed} onChange={(v) => setKpiForm({ ...kpiForm, factRightViewed: v })} type="number" />
            <FormField label="FactRight Follow-Up (hrs)" value={kpiForm.factRightFollowUpHrs} onChange={(v) => setKpiForm({ ...kpiForm, factRightFollowUpHrs: v })} type="number" />
            <FormField label="Post-Meeting Follow-Up (hrs)" value={kpiForm.postMeetingFollowUpHrs} onChange={(v) => setKpiForm({ ...kpiForm, postMeetingFollowUpHrs: v })} type="number" />
          </div>
          <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', marginBottom: 8 }}>Stage 4 — Conversion</div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
            <FormField label="Agreements Sent" value={kpiForm.subAgreementsSent} onChange={(v) => setKpiForm({ ...kpiForm, subAgreementsSent: v })} type="number" />
            <FormField label="Agreements Completed" value={kpiForm.subAgreementsCompleted} onChange={(v) => setKpiForm({ ...kpiForm, subAgreementsCompleted: v })} type="number" />
            <FormField label="Capital Funded ($)" value={kpiForm.capitalFunded} onChange={(v) => setKpiForm({ ...kpiForm, capitalFunded: v })} type="number" />
          </div>
          <FormField label="Notes" value={kpiForm.notes} onChange={(v) => setKpiForm({ ...kpiForm, notes: v })} textarea />
        </Modal>
      )}

      {/* ── Activity Modal ───────────────────────────────── */}
      {showActivityModal && (
        <Modal title="Log Activity" onClose={() => setShowActivityModal(false)} onSave={handleSaveActivity} saveLabel="Save Activity" saveDisabled={!actForm.contactName.trim()}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FormField label="Date" value={actForm.date} onChange={(v) => setActForm({ ...actForm, date: v })} type="date" />
            <FormSelect label="Type" value={actForm.type} options={ACTIVITY_TYPES} onChange={(v) => setActForm({ ...actForm, type: v })} />
            <FormSelect label="Rep" value={actForm.rep} options={['Alex', 'Ken']} onChange={(v) => setActForm({ ...actForm, rep: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FormField label="Contact Name *" value={actForm.contactName} onChange={(v) => setActForm({ ...actForm, contactName: v })} />
            <FormField label="Firm" value={actForm.contactFirm} onChange={(v) => setActForm({ ...actForm, contactFirm: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FormField label="Phone" value={actForm.contactPhone} onChange={(v) => setActForm({ ...actForm, contactPhone: v })} />
            <FormField label="Duration (min)" value={actForm.duration} onChange={(v) => setActForm({ ...actForm, duration: v })} type="number" />
            <FormSelect label="Outcome" value={actForm.outcome} options={['', ...OUTCOMES]} onChange={(v) => setActForm({ ...actForm, outcome: v })} />
          </div>
          <FormField label="Next Step" value={actForm.nextStep} onChange={(v) => setActForm({ ...actForm, nextStep: v })} />
          <div style={{ marginTop: 12 }}>
            <FormField label="Notes" value={actForm.notes} onChange={(v) => setActForm({ ...actForm, notes: v })} textarea />
          </div>
        </Modal>
      )}

      {/* ── Prospect Modal ───────────────────────────────── */}
      {showProspectModal && (
        <Modal title="Add Prospect" onClose={() => setShowProspectModal(false)} onSave={handleSaveProspect} saveLabel="Add Prospect" saveDisabled={!prosForm.name.trim()}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FormField label="Name *" value={prosForm.name} onChange={(v) => setProsForm({ ...prosForm, name: v })} />
            <FormField label="Firm" value={prosForm.firm} onChange={(v) => setProsForm({ ...prosForm, firm: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FormField label="Phone" value={prosForm.phone} onChange={(v) => setProsForm({ ...prosForm, phone: v })} />
            <FormField label="Email" value={prosForm.email} onChange={(v) => setProsForm({ ...prosForm, email: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FormSelect label="Assigned To" value={prosForm.assignedTo} options={['Alex', 'Ken']} onChange={(v) => setProsForm({ ...prosForm, assignedTo: v })} />
            <FormSelect label="Stage" value={prosForm.funnelStage} options={FUNNEL_STAGES} onChange={(v) => setProsForm({ ...prosForm, funnelStage: v })} />
            <FormField label="Source" value={prosForm.source} onChange={(v) => setProsForm({ ...prosForm, source: v })} />
          </div>
          <FormField label="Notes" value={prosForm.notes} onChange={(v) => setProsForm({ ...prosForm, notes: v })} textarea />
        </Modal>
      )}

      {/* ── Shipment Modal ───────────────────────────────── */}
      {showShipmentModal && (
        <Modal title="Log Shipment" onClose={() => setShowShipmentModal(false)} onSave={handleSaveShipment} saveLabel="Save Shipment" saveDisabled={!shipForm.recipient.trim()}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FormField label="Date" value={shipForm.date} onChange={(v) => setShipForm({ ...shipForm, date: v })} type="date" />
            <FormSelect label="Material Type" value={shipForm.materialType} options={MATERIAL_TYPES} onChange={(v) => setShipForm({ ...shipForm, materialType: v })} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FormField label="Recipient *" value={shipForm.recipient} onChange={(v) => setShipForm({ ...shipForm, recipient: v })} />
            <FormField label="Recipient Firm" value={shipForm.recipientFirm} onChange={(v) => setShipForm({ ...shipForm, recipientFirm: v })} />
          </div>
          <FormField label="Recipient Address" value={shipForm.recipientAddress} onChange={(v) => setShipForm({ ...shipForm, recipientAddress: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(5, 1fr)', gap: 12, marginBottom: 12, marginTop: 12 }}>
            <FormField label="Quantity" value={shipForm.quantity} onChange={(v) => setShipForm({ ...shipForm, quantity: v })} type="number" />
            <FormField label="Tracking #" value={shipForm.trackingNumber} onChange={(v) => setShipForm({ ...shipForm, trackingNumber: v })} />
            <FormField label="Carrier" value={shipForm.carrier} onChange={(v) => setShipForm({ ...shipForm, carrier: v })} />
            <FormField label="Scheduled Delivery" value={shipForm.scheduledDelivery} onChange={(v) => setShipForm({ ...shipForm, scheduledDelivery: v })} type="date" />
            <FormField label="Cost ($)" value={shipForm.cost} onChange={(v) => setShipForm({ ...shipForm, cost: v })} type="number" />
          </div>
          <FormField label="Notes" value={shipForm.notes} onChange={(v) => setShipForm({ ...shipForm, notes: v })} textarea />
        </Modal>
      )}

      {/* ── Restock Modal ──────────────────────────────── */}
      {showRestockModal && (
        <Modal title="Restock Inventory" onClose={() => setShowRestockModal(false)} onSave={handleRestock} saveLabel="Add Stock" saveDisabled={!restockForm.quantity || Number(restockForm.quantity) <= 0}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FormSelect label="Material Type" value={restockForm.materialType} options={INVENTORY_ITEMS} onChange={(v) => setRestockForm({ ...restockForm, materialType: v })} />
            <FormField label="Quantity to Add" value={restockForm.quantity} onChange={(v) => setRestockForm({ ...restockForm, quantity: v })} type="number" />
          </div>
          <div style={{ ...mono, fontSize: 11, color: 'var(--t4)', marginTop: 8 }}>
            Current stock of <strong style={{ color: 'var(--t2)' }}>{restockForm.materialType}</strong>: <strong style={{ color: 'var(--t1)' }}>{store.inventory?.[restockForm.materialType] ?? 0}</strong>
          </div>
        </Modal>
      )}

      {/* ── Expense Modal ────────────────────────────────── */}
      {showExpenseModal && (
        <Modal title="Log Expense" onClose={() => setShowExpenseModal(false)} onSave={handleSaveExpense} saveLabel="Save Expense" saveDisabled={!expForm.description.trim()}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
            <FormField label="Date" value={expForm.date} onChange={(v) => setExpForm({ ...expForm, date: v })} type="date" />
            <FormSelect label="Category" value={expForm.category} options={EXPENSE_CATEGORIES} onChange={(v) => setExpForm({ ...expForm, category: v })} />
            <FormSelect label="Incurred By" value={expForm.incurredBy} options={['Alex', 'Ken', 'J']} onChange={(v) => setExpForm({ ...expForm, incurredBy: v })} />
          </div>
          <FormField label="Description *" value={expForm.description} onChange={(v) => setExpForm({ ...expForm, description: v })} />
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 12, marginTop: 12 }}>
            <FormField label="Amount ($)" value={expForm.amount} onChange={(v) => setExpForm({ ...expForm, amount: v })} type="number" />
          </div>
          <div style={{ marginTop: 12 }}>
            <FormField label="Notes" value={expForm.notes} onChange={(v) => setExpForm({ ...expForm, notes: v })} textarea />
          </div>
        </Modal>
      )}

      {/* ── Subscription Detail Modal ─────────────────────── */}
      {selectedSubscription && (
        <div onClick={() => setSelectedSubscription(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg1)', border: '1px solid var(--bdH)', borderRadius: 10, width: isMobile ? 'calc(100vw - 32px)' : 540, maxWidth: '100vw', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 16px 64px rgba(0,0,0,0.8)' }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
              <div>
                <span style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--grn)' }}>
                  Subscription Detail
                </span>
                <span style={{ ...mono, fontSize: 9, color: 'var(--t5)', marginLeft: 10 }}>{selectedSubscription.positionId}</span>
              </div>
              <button onClick={() => setSelectedSubscription(null)} style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: 18 }}>✕</button>
            </div>

            {/* Body */}
            <div style={{ padding: 20 }}>
              {/* Investor info */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--t1)', marginBottom: 4 }}>{selectedSubscription.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  {selectedSubscription.type && <TypeBadge type={selectedSubscription.type} />}
                  {selectedSubscription.entity && (
                    <span style={{ ...mono, fontSize: 10, color: 'var(--t3)' }}>{selectedSubscription.entity}</span>
                  )}
                  <span style={{ ...mono, fontSize: 10, color: 'var(--t4)' }}>{selectedSubscription.fund}</span>
                </div>
              </div>

              {/* Key details grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                <div style={{ background: 'var(--bgS)', border: '1px solid var(--bd)', borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t5)', marginBottom: 4 }}>Capital Commitment</div>
                  <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: 'var(--grn)' }}>{fmtCurrency(selectedSubscription.amount)}</div>
                </div>
                <div style={{ background: 'var(--bgS)', border: '1px solid var(--bd)', borderRadius: 6, padding: '10px 12px' }}>
                  <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t5)', marginBottom: 4 }}>Days in Stage</div>
                  <div style={{ ...mono, fontSize: 16, fontWeight: 700, color: selectedSubscription.daysInStage > 14 ? 'var(--ylw)' : 'var(--t1)' }}>{selectedSubscription.daysInStage}d</div>
                </div>
              </div>

              {/* Contact info */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
                {selectedSubscription.email && (
                  <div style={{ ...mono, fontSize: 11, color: 'var(--blu)' }}>
                    {selectedSubscription.email}
                  </div>
                )}
                {selectedSubscription.phone && (
                  <div style={{ ...mono, fontSize: 11, color: 'var(--t3)' }}>
                    {selectedSubscription.phone}
                  </div>
                )}
                {selectedSubscription.advisor && (
                  <div style={{ ...mono, fontSize: 11, color: 'var(--t4)' }}>
                    Advisor: {selectedSubscription.advisor}
                  </div>
                )}
                {selectedSubscription.docRouting === 'custodian' && selectedSubscription.custodian && (
                  <div style={{ ...mono, fontSize: 11, color: '#ec4899' }}>
                    Custodian: {selectedSubscription.custodian}
                  </div>
                )}
                {selectedSubscription.docusignEnvelopeId && (
                  <div style={{ ...mono, fontSize: 10, color: 'var(--t5)', marginTop: 4 }}>
                    DocuSign: {selectedSubscription.docusignEnvelopeId}
                  </div>
                )}
              </div>

              {/* Pipeline tracker */}
              <PipelineTracker
                pipeline={selectedSubscription.pipeline}
                signers={selectedSubscription.signers}
                docRouting={selectedSubscription.docRouting}
                positionId={selectedSubscription.positionId}
                onDateChange={(posId, dateKey, newDate) => {
                  useInvestorStore.getState().updatePipelineDate(posId, dateKey, newDate, USER);
                  // Refresh the selected subscription with updated pipeline
                  const updated = useInvestorStore.getState().positions.find((p) => p.id === posId);
                  if (updated) {
                    setSelectedSubscription((prev) => ({
                      ...prev,
                      pipeline: updated.pipeline,
                    }));
                  }
                  showToast('Date updated');
                }}
              />

              {/* Audit trail */}
              {(() => {
                const entries = auditLog
                  .filter((e) => e.invId === selectedSubscription.invId && (e.action === 'Pipeline Stage Changed' || e.action === 'Pipeline Date Updated' || e.action === 'Declined'))
                  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
                if (entries.length === 0) return null;
                return (
                  <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
                    <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', marginBottom: 10 }}>
                      Audit Trail
                    </div>
                    <div style={{ maxHeight: 160, overflowY: 'auto' }}>
                      {entries.map((e) => (
                        <div key={e.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <div style={{ width: 6, height: 6, borderRadius: '50%', background: e.action === 'Declined' ? 'var(--red)' : 'var(--grn)', marginTop: 4, flexShrink: 0 }} />
                          <div style={{ flex: 1 }}>
                            <div style={{ ...mono, fontSize: 10, color: 'var(--t2)' }}>{e.detail}</div>
                            <div style={{ ...mono, fontSize: 9, color: 'var(--t5)', marginTop: 2 }}>
                              {displayName(e.user, googleUserEmail, googleUserName)} · {new Date(e.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} {new Date(e.timestamp).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Quick actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 16, paddingTop: 16, borderTop: '1px solid var(--bd)' }}>
                {(() => {
                  const routeStages = getPipelineStages(selectedSubscription.docRouting);
                  const currentIdx = routeStages.indexOf(selectedSubscription.rawStage);
                  const nextStage = currentIdx >= 0 && currentIdx < routeStages.length - 1
                    ? routeStages[currentIdx + 1] : null;
                  if (selectedSubscription.rawStage === 'Fully Accepted' || !nextStage) return null;
                  return (
                    <button
                      onClick={() => {
                        advancePipelineStage(selectedSubscription.positionId, nextStage, USER);
                        showToast(`${selectedSubscription.name} → ${PIPELINE_STAGE_LABELS[nextStage] || nextStage}`);
                        setSelectedSubscription(null);
                      }}
                      style={{ ...mono, fontSize: 10, fontWeight: 700, padding: '8px 16px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 4, cursor: 'pointer' }}
                    >
                      {nextStage === 'Fully Accepted' ? 'Accept ✓' : `Advance → ${PIPELINE_STAGE_LABELS[nextStage] || nextStage}`}
                    </button>
                  );
                })()}
                {selectedSubscription.email && (
                  <button
                    onClick={() => {
                      window.open(`mailto:${selectedSubscription.email}`, '_blank');
                    }}
                    style={{ ...mono, fontSize: 10, fontWeight: 700, padding: '8px 16px', border: '1px solid rgba(96,165,250,0.3)', background: 'rgba(96,165,250,0.08)', color: 'var(--blu)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Send Email
                  </button>
                )}
                {selectedSubscription.phone && (
                  <button
                    onClick={() => {
                      window.open(`tel:${selectedSubscription.phone}`, '_blank');
                    }}
                    style={{ ...mono, fontSize: 10, fontWeight: 700, padding: '8px 16px', border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t3)', borderRadius: 4, cursor: 'pointer' }}
                  >
                    Call
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════

function KpiSection({ title, items }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid var(--bd)' }}>
        {title}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        {items.map((item) => (
          <div key={item.label} style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 6, padding: '14px 16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t4)' }}>{item.label}</span>
              <OwnerBadge owner={item.owner} />
            </div>
            <div style={{ ...mono, fontSize: 22, fontWeight: 300, color: 'var(--t1)' }}>
              {item.isPct ? item.value : (typeof item.value === 'number' ? item.value : item.value)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OwnerBadge({ owner }) {
  const color = owner === 'Alex' ? 'var(--blu)' : owner === 'Ken' ? 'var(--ylw)' : 'var(--t4)';
  return (
    <span style={{ ...mono, fontSize: 8, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color, padding: '1px 5px', borderRadius: 3, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
      {owner}
    </span>
  );
}

function RepBadge({ rep }) {
  const color = rep === 'Alex' ? 'var(--blu)' : rep === 'Ken' ? 'var(--ylw)' : 'var(--t4)';
  return (
    <span style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color, padding: '2px 6px', borderRadius: 3, background: `color-mix(in srgb, ${color} 15%, transparent)` }}>
      {rep}
    </span>
  );
}

function TypeBadge({ type }) {
  return (
    <span style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', color: 'var(--t4)', padding: '2px 6px', borderRadius: 3, background: 'var(--bgM3)' }}>
      {type}
    </span>
  );
}

function MetricCard({ label, value, color }) {
  return (
    <div style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 6, padding: '14px 16px' }}>
      <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--t4)', marginBottom: 6 }}>{label}</div>
      <div style={{ ...mono, fontSize: 22, fontWeight: 300, color: color || 'var(--t1)' }}>{value}</div>
    </div>
  );
}

// ── Reusable Form Components ────────────────────────────────────────────────

function Modal({ title, onClose, onSave, saveLabel, saveDisabled, wide, children }) {
  const { isMobile } = useResponsive();
  const modalWidth = isMobile ? 'calc(100vw - 32px)' : wide ? 640 : 480;
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div onClick={(e) => e.stopPropagation()} style={{ background: 'var(--bg1)', border: '1px solid var(--bdH)', borderRadius: 10, width: modalWidth, maxWidth: '100vw', maxHeight: '85vh', overflow: 'auto', boxShadow: '0 16px 64px rgba(0,0,0,0.8)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid var(--bd)' }}>
            <span style={{ ...mono, fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--grn)' }}>{title}</span>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--t4)', cursor: 'pointer', fontSize: 18 }}>✕</button>
          </div>
          {/* Body */}
          <div style={{ padding: 20 }}>{children}</div>
          {/* Footer */}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', padding: '12px 20px', borderTop: '1px solid var(--bd)' }}>
            <button onClick={onClose} style={{ ...mono, fontSize: 11, fontWeight: 700, padding: '10px 20px', border: '1px solid var(--bd)', background: 'transparent', color: 'var(--t3)', borderRadius: 6, cursor: 'pointer' }}>Cancel</button>
            <button onClick={onSave} disabled={saveDisabled} style={{ ...mono, fontSize: 11, fontWeight: 700, padding: '10px 20px', border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)', color: 'var(--grn)', borderRadius: 6, cursor: saveDisabled ? 'not-allowed' : 'pointer', opacity: saveDisabled ? 0.5 : 1 }}>{saveLabel}</button>
          </div>
        </div>
      </div>
    </>
  );
}

function FormField({ label, value, onChange, type, textarea }) {
  const shared = {
    ...mono, fontSize: 12, width: '100%', boxSizing: 'border-box',
    background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4,
    padding: '8px 10px', color: 'var(--t1)', outline: 'none',
  };
  return (
    <div>
      <label style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', display: 'block', marginBottom: 4 }}>{label}</label>
      {textarea ? (
        <textarea value={value} onChange={(e) => onChange(e.target.value)} rows={3} style={{ ...shared, resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
          onFocus={(e) => (e.target.style.borderColor = 'var(--grn)')} onBlur={(e) => (e.target.style.borderColor = 'var(--bd)')} />
      ) : (
        <input type={type || 'text'} value={value} onChange={(e) => onChange(e.target.value)} style={shared}
          onFocus={(e) => (e.target.style.borderColor = 'var(--grn)')} onBlur={(e) => (e.target.style.borderColor = 'var(--bd)')} />
      )}
    </div>
  );
}

function FormSelect({ label, value, options, onChange }) {
  return (
    <div>
      <label style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t4)', display: 'block', marginBottom: 4 }}>{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{
        ...mono, fontSize: 12, width: '100%', boxSizing: 'border-box',
        background: 'var(--bg0)', border: '1px solid var(--bd)', borderRadius: 4,
        padding: '8px 10px', color: 'var(--t1)', outline: 'none',
      }}>
        {options.map((opt) => (
          <option key={opt} value={opt}>{opt || '— Select —'}</option>
        ))}
      </select>
    </div>
  );
}
