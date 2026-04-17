// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Directory KPI Tab
// Investor-facing operations metrics:
// 1. Inquiry Response Time
// 2. LP Onboarding Time
// 3. Communications Delivered On Schedule
// ═══════════════════════════════════════════════

import { useState, useMemo } from 'react';
import useKpiStore from '../stores/kpiStore';
import useUiStore from '../stores/uiStore';
import useGoogleStore from '../stores/googleStore';
import useResponsive from '../hooks/useResponsive';
import {
  DateRangeFilter, getThisQuarterRange, fmtDate,
  KpiStatusCard, KpiDetailTable, KpiEntryModal,
  StatusBadge, KpiSectionHeader, EmptyState, ExportButton,
} from './KpiComponents';

const mono = { fontFamily: "'Space Mono', monospace" };
const today = new Date().toISOString().split('T')[0];

export default function DirectoryKpis() {
  const store = useKpiStore();
  const showToast = useUiStore((s) => s.showToast);
  const USER = useGoogleStore((s) => s.userEmail) || 'unknown';
  const { isMobile } = useResponsive();
  const [range, setRange] = useState(getThisQuarterRange);
  const [expanded, setExpanded] = useState(null);

  // Modals
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [showCommsModal, setShowCommsModal] = useState(false);

  // Form state
  const [inquiryForm, setInquiryForm] = useState({
    investorName: '', dateReceived: today, dateResponded: '', notes: '',
  });
  const [onboardingForm, setOnboardingForm] = useState({
    investorName: '', fund: 'Fund II',
    commitmentDate: '', agreementSentDate: '', executedDate: '', fundedDate: '', notes: '',
  });
  const [commsForm, setCommsForm] = useState({
    type: 'Quarterly Update', period: '', dueDate: '', deliveredDate: '', notes: '',
  });

  // Computed summary
  const summary = useMemo(() =>
    store.getDirectorySummary(range.start, range.end),
    [store.inquiryResponses, store.onboardingSegments, store.communicationDeliverables, range]
  );

  // Filtered data
  const inquiries = useMemo(() =>
    store.inquiryResponses.filter((e) => e.dateReceived >= range.start && e.dateReceived <= range.end)
      .sort((a, b) => b.dateReceived.localeCompare(a.dateReceived)),
    [store.inquiryResponses, range]
  );

  const onboardings = useMemo(() =>
    store.onboardingSegments.filter((e) => e.commitmentDate >= range.start && e.commitmentDate <= range.end)
      .sort((a, b) => b.commitmentDate.localeCompare(a.commitmentDate)),
    [store.onboardingSegments, range]
  );

  const comms = useMemo(() =>
    store.communicationDeliverables.filter((e) => e.dueDate >= range.start && e.dueDate <= range.end)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
    [store.communicationDeliverables, range]
  );

  // Handlers
  const handleSaveInquiry = () => {
    if (!inquiryForm.investorName.trim()) return;
    store.addInquiryResponse(inquiryForm, USER);
    setShowInquiryModal(false);
    showToast('Inquiry response logged');
    setInquiryForm({ investorName: '', dateReceived: today, dateResponded: '', notes: '' });
  };

  const handleSaveOnboarding = () => {
    if (!onboardingForm.investorName.trim()) return;
    store.addOnboardingSegment(onboardingForm, USER);
    setShowOnboardingModal(false);
    showToast('Onboarding segment logged');
    setOnboardingForm({ investorName: '', fund: 'Fund II', commitmentDate: '', agreementSentDate: '', executedDate: '', fundedDate: '', notes: '' });
  };

  const handleSaveComms = () => {
    if (!commsForm.type || !commsForm.dueDate) return;
    store.addCommunicationDeliverable(commsForm, USER);
    setShowCommsModal(false);
    showToast('Communication deliverable logged');
    setCommsForm({ type: 'Quarterly Update', period: '', dueDate: '', deliveredDate: '', notes: '' });
  };

  const handleExport = () => {
    let csv = 'DIRECTORY KPIs\n';
    csv += `Period: ${range.label} (${range.start} to ${range.end})\n\n`;

    csv += 'INQUIRY RESPONSE TIME\n';
    csv += 'Investor,Date Received,Date Responded,Response Hours\n';
    inquiries.forEach((e) => csv += `${e.investorName},${e.dateReceived},${e.dateResponded || ''},${e.responseHours ?? ''}\n`);

    csv += '\nLP ONBOARDING TIME\n';
    csv += 'Investor,Commitment,Agreement Sent,Executed,Funded,Days Total\n';
    onboardings.forEach((e) => csv += `${e.investorName},${e.commitmentDate},${e.agreementSentDate || ''},${e.executedDate || ''},${e.fundedDate || ''},${e.daysTotal ?? ''}\n`);

    csv += '\nCOMMUNICATIONS DELIVERED\n';
    csv += 'Type,Period,Due Date,Delivered Date,Status\n';
    comms.forEach((e) => csv += `${e.type},${e.period || ''},${e.dueDate},${e.deliveredDate || ''},${e.status}\n`);

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Directory_KPIs_${range.start}_${range.end}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: isMobile ? '16px 0' : '0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <DateRangeFilter range={range} setRange={setRange} />
        <ExportButton onClick={handleExport} />
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <KpiStatusCard
          label="Avg Response Time"
          value={summary.avgResponseTime != null ? Math.round(summary.avgResponseTime) : '-'}
          unit="hrs"
          target="24-48 hours"
          status={summary.responseStatus}
          subtitle={`${summary.responseCount} inquiries, ${summary.withinTarget} within target`}
          onClick={() => setExpanded(expanded === 'inquiry' ? null : 'inquiry')}
          expanded={expanded === 'inquiry'}
        />
        <KpiStatusCard
          label="LP Onboarding Time"
          value={summary.avgDaysTotal != null ? Math.round(summary.avgDaysTotal) : '-'}
          unit="days"
          target="Commitment to funded"
          status={summary.avgDaysTotal == null ? 'green' : summary.avgDaysTotal <= 30 ? 'green' : summary.avgDaysTotal <= 60 ? 'yellow' : 'red'}
          subtitle={summary.onboardingCount > 0 ? `${summary.onboardingCount} investors tracked` : 'No data'}
          onClick={() => setExpanded(expanded === 'onboarding' ? null : 'onboarding')}
          expanded={expanded === 'onboarding'}
        />
        <KpiStatusCard
          label="Comms On Schedule"
          value={summary.commsTotal > 0 ? `${summary.commsOnTime}/${summary.commsTotal}` : '-'}
          target="100% on time"
          status={summary.commsStatus}
          subtitle={summary.commsLate > 0 ? `${summary.commsLate} late, ${summary.commsPending} pending` : summary.commsPending > 0 ? `${summary.commsPending} pending` : 'All on time'}
          onClick={() => setExpanded(expanded === 'comms' ? null : 'comms')}
          expanded={expanded === 'comms'}
        />
      </div>

      {/* ── Inquiry Response Detail ──────────────────────────── */}
      {expanded === 'inquiry' && (
        <KpiSectionHeader title="Investor Inquiry Response Time" onAdd={() => setShowInquiryModal(true)}>
          {inquiries.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'investorName', label: 'Investor', width: '1fr' },
                { key: 'dateReceived', label: 'Received', width: '90px', render: (r) => fmtDate(r.dateReceived) },
                { key: 'dateResponded', label: 'Responded', width: '90px', render: (r) => fmtDate(r.dateResponded) },
                { key: 'responseHours', label: 'Hours', width: '60px',
                  render: (r) => r.responseHours != null ? Math.round(r.responseHours) : '-',
                  color: (r) => r.responseHours != null && r.responseHours > 48 ? 'var(--red)' : r.responseHours > 24 ? 'var(--ylw)' : 'var(--grn)',
                },
                { key: 'notes', label: 'Notes', width: '1fr' },
              ]}
              rows={inquiries}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Onboarding Segments Detail ───────────────────────── */}
      {expanded === 'onboarding' && (
        <KpiSectionHeader title="LP Onboarding Time" onAdd={() => setShowOnboardingModal(true)}>
          {/* Segment averages */}
          {onboardings.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 8, marginBottom: 16 }}>
              {[
                { label: 'Commitment → Sent', value: summary.avgDaysToSend },
                { label: 'Sent → Executed', value: summary.avgDaysToExecute },
                { label: 'Executed → Funded', value: summary.avgDaysToFund },
                { label: 'Total', value: summary.avgDaysTotal },
              ].map((s) => (
                <div key={s.label} style={{ background: 'var(--bg1)', border: '1px solid var(--bd)', borderRadius: 4, padding: '10px 12px' }}>
                  <div style={{ ...mono, fontSize: 8, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--t5)', marginBottom: 4 }}>{s.label}</div>
                  <div style={{ ...mono, fontSize: 18, fontWeight: 300, color: 'var(--t1)' }}>{s.value != null ? Math.round(s.value) : '-'}<span style={{ fontSize: 10, color: 'var(--t4)' }}> days</span></div>
                </div>
              ))}
            </div>
          )}
          {onboardings.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'investorName', label: 'Investor', width: '1fr' },
                { key: 'commitmentDate', label: 'Committed', width: '85px', render: (r) => fmtDate(r.commitmentDate) },
                { key: 'daysToSend', label: '→ Sent', width: '55px', render: (r) => r.daysToSend != null ? `${r.daysToSend}d` : '-' },
                { key: 'daysToExecute', label: '→ Exec', width: '55px', render: (r) => r.daysToExecute != null ? `${r.daysToExecute}d` : '-' },
                { key: 'daysToFund', label: '→ Fund', width: '55px', render: (r) => r.daysToFund != null ? `${r.daysToFund}d` : '-' },
                { key: 'daysTotal', label: 'Total', width: '55px',
                  render: (r) => r.daysTotal != null ? `${r.daysTotal}d` : '-',
                  color: (r) => r.daysTotal != null && r.daysTotal > 60 ? 'var(--red)' : r.daysTotal > 30 ? 'var(--ylw)' : 'var(--grn)',
                },
              ]}
              rows={onboardings}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Communications Detail ────────────────────────────── */}
      {expanded === 'comms' && (
        <KpiSectionHeader title="Communications Delivered On Schedule" onAdd={() => setShowCommsModal(true)}>
          {comms.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'type', label: 'Type', width: '1fr' },
                { key: 'period', label: 'Period', width: '100px' },
                { key: 'dueDate', label: 'Due', width: '85px', render: (r) => fmtDate(r.dueDate) },
                { key: 'deliveredDate', label: 'Delivered', width: '85px', render: (r) => fmtDate(r.deliveredDate) },
                { key: 'status', label: 'Status', width: '80px', render: (r) => <StatusBadge status={r.status} /> },
              ]}
              rows={comms}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Inquiry Modal ────────────────────────────────────── */}
      {showInquiryModal && (
        <KpiEntryModal
          title="Log Inquiry Response"
          fields={[
            { key: 'investorName', label: 'Investor Name', type: 'text' },
            { key: 'dateReceived', label: 'Date Received', type: 'datetime-local' },
            { key: 'dateResponded', label: 'Date Responded', type: 'datetime-local' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={inquiryForm}
          onChange={(key, val) => setInquiryForm((f) => ({ ...f, [key]: val }))}
          onSave={handleSaveInquiry}
          onClose={() => setShowInquiryModal(false)}
          saveDisabled={!inquiryForm.investorName.trim()}
        />
      )}

      {/* ── Onboarding Modal ─────────────────────────────────── */}
      {showOnboardingModal && (
        <KpiEntryModal
          title="Log LP Onboarding"
          wide
          fields={[
            { key: 'investorName', label: 'Investor Name', type: 'text' },
            { key: 'fund', label: 'Fund', type: 'select', options: ['Fund I', 'Fund II'] },
            { key: '_heading', label: 'Onboarding Milestones', type: 'heading' },
            { key: 'commitmentDate', label: 'Commitment Date', type: 'date' },
            { key: 'agreementSentDate', label: 'Agreement Sent', type: 'date' },
            { key: 'executedDate', label: 'Fully Executed', type: 'date' },
            { key: 'fundedDate', label: 'Funded', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={onboardingForm}
          onChange={(key, val) => setOnboardingForm((f) => ({ ...f, [key]: val }))}
          onSave={handleSaveOnboarding}
          onClose={() => setShowOnboardingModal(false)}
          saveDisabled={!onboardingForm.investorName.trim()}
        />
      )}

      {/* ── Communications Modal ─────────────────────────────── */}
      {showCommsModal && (
        <KpiEntryModal
          title="Log Communication Deliverable"
          fields={[
            { key: 'type', label: 'Type', type: 'select', options: ['Quarterly Update', 'Annual Report'] },
            { key: 'period', label: 'Period (e.g. Q4 2025)', type: 'text' },
            { key: 'dueDate', label: 'Due Date', type: 'date' },
            { key: 'deliveredDate', label: 'Delivered Date', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={commsForm}
          onChange={(key, val) => setCommsForm((f) => ({ ...f, [key]: val }))}
          onSave={handleSaveComms}
          onClose={() => setShowCommsModal(false)}
          saveDisabled={!commsForm.dueDate}
        />
      )}
    </div>
  );
}
