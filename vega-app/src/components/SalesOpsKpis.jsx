// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Sales Operations KPI Tab
// Operations/logistics metrics:
// 1. Monthly Materials Spend
// 2. Cost Per Kit
// 3. Monthly Shipping/FedEx Spend
// 4. Marketing Materials Created
// 5. Quantity of Materials Sent
// 6. Kits Assembled & Shipped
// 7. Materials Fulfillment Turnaround Time
// 8. Ad Hoc Requests Log
// 9. Ad Hoc Request Volume
// ═══════════════════════════════════════════════

import { useState, useMemo } from 'react';
import useKpiStore, { MATERIAL_CREATE_TYPES, RECIPIENT_TYPES, REQUESTERS } from '../stores/kpiStore';
import useUiStore from '../stores/uiStore';
import useResponsive from '../hooks/useResponsive';
import {
  DateRangeFilter, getThisMonthRange, fmtDate, fmtCurrency,
  KpiStatusCard, KpiDetailTable, KpiEntryModal,
  StatusBadge, KpiSectionHeader, EmptyState, ExportButton,
} from './KpiComponents';

const mono = { fontFamily: "'Space Mono', monospace" };
const USER = 'j@vegarei.com';
const today = new Date().toISOString().split('T')[0];
const currentMonth = new Date().getMonth() + 1;
const currentYear = new Date().getFullYear();

export default function SalesOpsKpis() {
  const store = useKpiStore();
  const showToast = useUiStore((s) => s.showToast);
  const { isMobile } = useResponsive();
  const [range, setRange] = useState(getThisMonthRange);
  const [expanded, setExpanded] = useState(null);

  // Modals
  const [showSpendModal, setShowSpendModal] = useState(false);
  const [showMaterialModal, setShowMaterialModal] = useState(false);
  const [showSentModal, setShowSentModal] = useState(false);
  const [showKitModal, setShowKitModal] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);

  // Forms
  const [spendForm, setSpendForm] = useState({ month: String(currentMonth), year: String(currentYear), amount: '', category: 'materials', notes: '' });
  const [materialForm, setMaterialForm] = useState({ date: today, materialType: MATERIAL_CREATE_TYPES[0], title: '', quantity: '1', notes: '' });
  const [sentForm, setSentForm] = useState({ date: today, recipientType: RECIPIENT_TYPES[0], recipientName: '', materialType: MATERIAL_CREATE_TYPES[0], quantity: '1', notes: '' });
  const [kitForm, setKitForm] = useState({ date: today, quantity: '1', shippedDate: '', notes: '' });
  const [requestForm, setRequestForm] = useState({ requestDate: today, requester: REQUESTERS[0], assignee: '', description: '', completedDate: '', priority: 'normal', notes: '' });

  // Summary
  const summary = useMemo(() =>
    store.getSalesOpsSummary(range.start, range.end),
    [store.materialsSpend, store.marketingMaterials, store.materialsSent, store.kitsAssembled, store.adHocRequests, range]
  );

  // Filtered data
  const materials = useMemo(() =>
    store.marketingMaterials.filter((e) => e.date >= range.start && e.date <= range.end)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [store.marketingMaterials, range]
  );

  const sent = useMemo(() =>
    store.materialsSent.filter((e) => e.date >= range.start && e.date <= range.end)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [store.materialsSent, range]
  );

  const kits = useMemo(() =>
    store.kitsAssembled.filter((e) => e.date >= range.start && e.date <= range.end)
      .sort((a, b) => b.date.localeCompare(a.date)),
    [store.kitsAssembled, range]
  );

  const requests = useMemo(() =>
    store.adHocRequests.filter((e) => e.requestDate >= range.start && e.requestDate <= range.end)
      .sort((a, b) => b.requestDate.localeCompare(a.requestDate)),
    [store.adHocRequests, range]
  );

  // Handlers
  const handleSaveSpend = () => {
    if (!spendForm.amount) return;
    store.addMaterialsSpend({ ...spendForm, month: Number(spendForm.month), year: Number(spendForm.year), amount: Number(spendForm.amount) || 0 }, USER);
    setShowSpendModal(false);
    showToast('Spend logged');
    setSpendForm({ month: String(currentMonth), year: String(currentYear), amount: '', category: 'materials', notes: '' });
  };

  const handleSaveMaterial = () => {
    if (!materialForm.title.trim()) return;
    store.addMarketingMaterial({ ...materialForm, quantity: Number(materialForm.quantity) || 1 }, USER);
    setShowMaterialModal(false);
    showToast('Material created');
    setMaterialForm({ date: today, materialType: MATERIAL_CREATE_TYPES[0], title: '', quantity: '1', notes: '' });
  };

  const handleSaveSent = () => {
    if (!sentForm.recipientName.trim()) return;
    store.addMaterialsSent({ ...sentForm, quantity: Number(sentForm.quantity) || 1 }, USER);
    setShowSentModal(false);
    showToast('Materials sent logged');
    setSentForm({ date: today, recipientType: RECIPIENT_TYPES[0], recipientName: '', materialType: MATERIAL_CREATE_TYPES[0], quantity: '1', notes: '' });
  };

  const handleSaveKit = () => {
    store.addKitAssembled({ ...kitForm, quantity: Number(kitForm.quantity) || 1 }, USER);
    setShowKitModal(false);
    showToast('Kit logged');
    setKitForm({ date: today, quantity: '1', shippedDate: '', notes: '' });
  };

  const handleSaveRequest = () => {
    if (!requestForm.description.trim()) return;
    store.addAdHocRequest(requestForm, USER);
    setShowRequestModal(false);
    showToast('Request logged');
    setRequestForm({ requestDate: today, requester: REQUESTERS[0], assignee: '', description: '', completedDate: '', priority: 'normal', notes: '' });
  };

  const handleCompleteRequest = (id) => {
    store.updateAdHocRequest(id, { status: 'completed', completedDate: today }, USER);
    showToast('Request completed');
  };

  const handleExport = () => {
    let csv = 'SALES OPERATIONS KPIs\n';
    csv += `Period: ${range.label} (${range.start} to ${range.end})\n\n`;
    csv += `Materials Spend: ${fmtCurrency(summary.totalMaterialsSpend)}\n`;
    csv += `Shipping Spend: ${fmtCurrency(summary.totalShippingSpend)}\n`;
    csv += `Cost Per Kit: ${summary.costPerKit != null ? fmtCurrency(Math.round(summary.costPerKit)) : 'N/A'}\n`;
    csv += `Materials Created: ${summary.totalCreated}\n`;
    csv += `Materials Sent: ${summary.totalSent}\n`;
    csv += `Kits Assembled: ${summary.totalKits}\n`;
    csv += `Avg Fulfillment: ${summary.avgTurnaround != null ? Math.round(summary.avgTurnaround) + ' days' : 'N/A'}\n`;
    csv += `Ad Hoc Requests: ${summary.totalRequests} (${summary.openRequests} open, ${summary.completedRequests} completed)\n`;
    csv += `Avg Request Turnaround: ${summary.avgRequestTurnaround != null ? Math.round(summary.avgRequestTurnaround) + ' days' : 'N/A'}\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `SalesOps_KPIs_${range.start}_${range.end}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: isMobile ? '16px 0' : '0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <DateRangeFilter range={range} setRange={setRange} />
        <ExportButton onClick={handleExport} />
      </div>

      {/* ── Spend Tracking Cards ──────────────────────────────── */}
      <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t5)', marginBottom: 8 }}>
        Spend Tracking
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <KpiStatusCard
          label="Materials Spend"
          value={fmtCurrency(summary.totalMaterialsSpend)}
          status="green"
          onClick={() => setExpanded(expanded === 'spend' ? null : 'spend')}
          expanded={expanded === 'spend'}
        />
        <KpiStatusCard
          label="Cost Per Kit"
          value={summary.costPerKit != null ? fmtCurrency(Math.round(summary.costPerKit)) : '-'}
          status="green"
          subtitle={summary.totalKits > 0 ? `${summary.totalKits} kits assembled` : ''}
        />
        <KpiStatusCard
          label="Shipping/FedEx Spend"
          value={fmtCurrency(summary.totalShippingSpend)}
          status="green"
          onClick={() => setExpanded(expanded === 'spend' ? null : 'spend')}
          expanded={expanded === 'spend'}
        />
      </div>

      {/* ── Materials Activity Cards ──────────────────────────── */}
      <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t5)', marginBottom: 8 }}>
        Materials Activity
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 20 }}>
        <KpiStatusCard
          label="Materials Created"
          value={summary.totalCreated}
          status="green"
          subtitle={Object.entries(summary.materialsByType || {}).map(([t, c]) => `${t}: ${c}`).join(', ') || ''}
          onClick={() => setExpanded(expanded === 'created' ? null : 'created')}
          expanded={expanded === 'created'}
        />
        <KpiStatusCard
          label="Materials Sent"
          value={summary.totalSent}
          status="green"
          subtitle={Object.entries(summary.sentByRecipientType || {}).map(([t, c]) => `${t}: ${c}`).join(', ') || ''}
          onClick={() => setExpanded(expanded === 'sent' ? null : 'sent')}
          expanded={expanded === 'sent'}
        />
        <KpiStatusCard
          label="Kits Assembled"
          value={summary.totalKits}
          status="green"
          subtitle={summary.avgTurnaround != null ? `Avg ${Math.round(summary.avgTurnaround)}d turnaround` : ''}
          onClick={() => setExpanded(expanded === 'kits' ? null : 'kits')}
          expanded={expanded === 'kits'}
        />
      </div>

      {/* ── Fulfillment & Requests Cards ──────────────────────── */}
      <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t5)', marginBottom: 8 }}>
        Fulfillment & Requests
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <KpiStatusCard
          label="Fulfillment Turnaround"
          value={summary.avgTurnaround != null ? Math.round(summary.avgTurnaround) : '-'}
          unit="days"
          status={summary.avgTurnaround != null && summary.avgTurnaround > 5 ? 'yellow' : 'green'}
        />
        <KpiStatusCard
          label="Ad Hoc Requests"
          value={summary.totalRequests}
          status={summary.openRequests > 5 ? 'yellow' : 'green'}
          subtitle={`${summary.openRequests} open, ${summary.inProgressRequests || 0} in progress, ${summary.completedRequests} done`}
          onClick={() => setExpanded(expanded === 'requests' ? null : 'requests')}
          expanded={expanded === 'requests'}
        />
        <KpiStatusCard
          label="Avg Request Turnaround"
          value={summary.avgRequestTurnaround != null ? Math.round(summary.avgRequestTurnaround) : '-'}
          unit="days"
          status={summary.avgRequestTurnaround != null && summary.avgRequestTurnaround > 3 ? 'yellow' : 'green'}
          subtitle={Object.entries(summary.requestsByRequester || {}).map(([r, c]) => `${r}: ${c}`).join(', ') || ''}
        />
      </div>

      {/* ── Spend Detail ──────────────────────────────────────── */}
      {expanded === 'spend' && (
        <KpiSectionHeader title="Materials & Shipping Spend" onAdd={() => setShowSpendModal(true)}>
          {store.materialsSpend.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'month', label: 'Month', width: '100px', render: (r) => `${r.month}/${r.year}` },
                { key: 'category', label: 'Category', width: '100px' },
                { key: 'amount', label: 'Amount', width: '80px', render: (r) => fmtCurrency(r.amount) },
                { key: 'notes', label: 'Notes', width: '1fr' },
              ]}
              rows={store.materialsSpend.sort((a, b) => `${b.year}-${String(b.month).padStart(2, '0')}`.localeCompare(`${a.year}-${String(a.month).padStart(2, '0')}`))}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Materials Created Detail ──────────────────────────── */}
      {expanded === 'created' && (
        <KpiSectionHeader title="Marketing Materials Created" onAdd={() => setShowMaterialModal(true)}>
          {materials.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'date', label: 'Date', width: '85px', render: (r) => fmtDate(r.date) },
                { key: 'materialType', label: 'Type', width: '120px' },
                { key: 'title', label: 'Title', width: '1fr' },
                { key: 'quantity', label: 'Qty', width: '50px' },
              ]}
              rows={materials}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Materials Sent Detail ─────────────────────────────── */}
      {expanded === 'sent' && (
        <KpiSectionHeader title="Quantity of Materials Sent" onAdd={() => setShowSentModal(true)}>
          {sent.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'date', label: 'Date', width: '85px', render: (r) => fmtDate(r.date) },
                { key: 'recipientName', label: 'Recipient', width: '1fr' },
                { key: 'recipientType', label: 'Type', width: '80px' },
                { key: 'materialType', label: 'Material', width: '120px' },
                { key: 'quantity', label: 'Qty', width: '50px' },
              ]}
              rows={sent}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Kits Detail ───────────────────────────────────────── */}
      {expanded === 'kits' && (
        <KpiSectionHeader title="Kits Assembled & Shipped" onAdd={() => setShowKitModal(true)}>
          {kits.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'date', label: 'Assembled', width: '85px', render: (r) => fmtDate(r.date) },
                { key: 'quantity', label: 'Qty', width: '50px' },
                { key: 'shippedDate', label: 'Shipped', width: '85px', render: (r) => fmtDate(r.shippedDate) },
                { key: 'turnaroundDays', label: 'Days', width: '50px', render: (r) => r.turnaroundDays ?? '-' },
                { key: 'notes', label: 'Notes', width: '1fr' },
              ]}
              rows={kits}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Ad Hoc Requests Detail ────────────────────────────── */}
      {expanded === 'requests' && (
        <KpiSectionHeader title="Ad Hoc Requests Log" onAdd={() => setShowRequestModal(true)}>
          {requests.length === 0 ? <EmptyState /> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {requests.map((r) => (
                <div key={r.id} style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 6, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <span style={{ ...mono, fontSize: 10, color: 'var(--t5)' }}>{fmtDate(r.requestDate)}</span>
                    <span style={{
                      ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                      color: r.requester === 'Ken' ? 'var(--ylw)' : r.requester === 'Alex' ? 'var(--blu)' : 'var(--t4)',
                      padding: '2px 6px', borderRadius: 3,
                      background: r.requester === 'Ken' ? 'var(--ylwM)' : r.requester === 'Alex' ? 'var(--bluM)' : 'var(--bgM3)',
                    }}>{r.requester}</span>
                    <StatusBadge status={r.status === 'in_progress' ? 'in_progress' : r.status} />
                    {r.priority === 'urgent' && (
                      <span style={{ ...mono, fontSize: 9, fontWeight: 700, color: 'var(--red)', padding: '2px 6px', borderRadius: 3, background: 'var(--redM)' }}>URGENT</span>
                    )}
                    {r.assignee && (
                      <span style={{
                        ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase',
                        color: 'var(--grn)', padding: '2px 6px', borderRadius: 3,
                        background: 'var(--grnM)', display: 'flex', alignItems: 'center', gap: 3,
                      }}>→ {r.assignee}</span>
                    )}
                    {r.completedDate && (
                      <span style={{ ...mono, fontSize: 9, color: 'var(--t5)' }}>Done {fmtDate(r.completedDate)}</span>
                    )}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--t1)', lineHeight: 1.5, marginBottom: 6 }}>{r.description}</div>
                  {r.notes && <div style={{ ...mono, fontSize: 10, color: 'var(--t4)', marginBottom: 6 }}>{r.notes}</div>}
                  {r.status !== 'completed' && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {r.status === 'open' && (
                        <button
                          onClick={() => { store.updateAdHocRequest(r.id, { status: 'in_progress' }, USER); showToast('Request in progress'); }}
                          style={{
                            ...mono, fontSize: 9, fontWeight: 700, padding: '4px 12px',
                            border: '1px solid var(--ylwB)', background: 'var(--ylwM)',
                            color: 'var(--ylw)', borderRadius: 4, cursor: 'pointer',
                          }}
                        >Start</button>
                      )}
                      <button
                        onClick={() => handleCompleteRequest(r.id)}
                        style={{
                          ...mono, fontSize: 9, fontWeight: 700, padding: '4px 12px',
                          border: '1px solid rgba(52,211,153,0.3)', background: 'var(--grnM)',
                          color: 'var(--grn)', borderRadius: 4, cursor: 'pointer',
                        }}
                      >Complete</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </KpiSectionHeader>
      )}

      {/* ── Modals ───────────────────────────────────────────── */}
      {showSpendModal && (
        <KpiEntryModal title="Log Materials/Shipping Spend" onClose={() => setShowSpendModal(false)} onSave={handleSaveSpend} saveDisabled={!spendForm.amount}
          fields={[
            { key: 'category', label: 'Category', type: 'select', options: ['materials', 'shipping', 'fedex'] },
            { key: 'month', label: 'Month', type: 'select', options: ['1','2','3','4','5','6','7','8','9','10','11','12'] },
            { key: 'year', label: 'Year', type: 'text' },
            { key: 'amount', label: 'Amount ($)', type: 'number' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={spendForm} onChange={(k, v) => setSpendForm((f) => ({ ...f, [k]: v }))}
        />
      )}

      {showMaterialModal && (
        <KpiEntryModal title="Log Material Created" onClose={() => setShowMaterialModal(false)} onSave={handleSaveMaterial} saveDisabled={!materialForm.title.trim()}
          fields={[
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'materialType', label: 'Type', type: 'select', options: MATERIAL_CREATE_TYPES },
            { key: 'title', label: 'Title / Description', type: 'text' },
            { key: 'quantity', label: 'Quantity', type: 'number' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={materialForm} onChange={(k, v) => setMaterialForm((f) => ({ ...f, [k]: v }))}
        />
      )}

      {showSentModal && (
        <KpiEntryModal title="Log Materials Sent" onClose={() => setShowSentModal(false)} onSave={handleSaveSent} saveDisabled={!sentForm.recipientName.trim()}
          fields={[
            { key: 'date', label: 'Date', type: 'date' },
            { key: 'recipientType', label: 'Recipient Type', type: 'select', options: RECIPIENT_TYPES },
            { key: 'recipientName', label: 'Recipient Name', type: 'text' },
            { key: 'materialType', label: 'Material Type', type: 'select', options: MATERIAL_CREATE_TYPES },
            { key: 'quantity', label: 'Quantity', type: 'number' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={sentForm} onChange={(k, v) => setSentForm((f) => ({ ...f, [k]: v }))}
        />
      )}

      {showKitModal && (
        <KpiEntryModal title="Log Kits Assembled" onClose={() => setShowKitModal(false)} onSave={handleSaveKit}
          fields={[
            { key: 'date', label: 'Date Assembled', type: 'date' },
            { key: 'quantity', label: 'Quantity', type: 'number' },
            { key: 'shippedDate', label: 'Date Shipped', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={kitForm} onChange={(k, v) => setKitForm((f) => ({ ...f, [k]: v }))}
        />
      )}

      {showRequestModal && (
        <KpiEntryModal title="Log Ad Hoc Request" onClose={() => setShowRequestModal(false)} onSave={handleSaveRequest} saveDisabled={!requestForm.description.trim()}
          fields={[
            { key: 'requestDate', label: 'Date Opened', type: 'date' },
            { key: 'requester', label: 'Requested By', type: 'select', options: REQUESTERS },
            { key: 'assignee', label: 'Assignee', type: 'text', placeholder: 'Name' },
            { key: 'priority', label: 'Priority', type: 'select', options: ['normal', 'urgent'] },
            { key: 'description', label: 'Description', type: 'textarea', fullWidth: true },
            { key: 'completedDate', label: 'Date Completed (if done)', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={requestForm} onChange={(k, v) => setRequestForm((f) => ({ ...f, [k]: v }))}
        />
      )}
    </div>
  );
}
