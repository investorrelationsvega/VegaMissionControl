// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Compliance KPI Tab
// Compliance operations metrics:
// 1. Subscription Agreements Processed
// 2. Blue Sky Filings
// 3. Form D Amendments
// 4. DTCC NAV/Fund Reporting
// 5. Audit — Tanner Deliverables
// 6. Audit — Clean Opinion
// 7. Custodian Reporting Reconciled
// ═══════════════════════════════════════════════

import { useState, useMemo } from 'react';
import useKpiStore, { CUSTODIANS, OPINION_TYPES, FILING_TYPES, DTCC_REPORT_TYPES } from '../stores/kpiStore';
import useUiStore from '../stores/uiStore';
import useResponsive from '../hooks/useResponsive';
import {
  DateRangeFilter, getThisYearRange, fmtDate,
  KpiStatusCard, KpiDetailTable, KpiEntryModal,
  StatusBadge, KpiSectionHeader, EmptyState, ExportButton,
} from './KpiComponents';

const mono = { fontFamily: "'Space Mono', monospace" };
const USER = 'j@vegarei.com';
const today = new Date().toISOString().split('T')[0];
const currentYear = new Date().getFullYear();
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const US_STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY','DC'];

export default function ComplianceKpis() {
  const store = useKpiStore();
  const showToast = useUiStore((s) => s.showToast);
  const { isMobile } = useResponsive();
  const [range, setRange] = useState(getThisYearRange);
  const [expanded, setExpanded] = useState(null);

  // Modals
  const [showSubModal, setShowSubModal] = useState(false);
  const [showBsModal, setShowBsModal] = useState(false);
  const [showFormDModal, setShowFormDModal] = useState(false);
  const [showDtccModal, setShowDtccModal] = useState(false);
  const [showAudDelModal, setShowAudDelModal] = useState(false);
  const [showAudOpModal, setShowAudOpModal] = useState(false);
  const [showReconModal, setShowReconModal] = useState(false);

  // Form states
  const [subForm, setSubForm] = useState({ investorName: '', processedDate: today, hasErrors: false, errorDescription: '', notes: '' });
  const [bsForm, setBsForm] = useState({ investorName: '', state: '', triggerDate: '', filedDate: '', notes: '' });
  const [formDForm, setFormDForm] = useState({ filingType: FILING_TYPES[0], dueDate: '', filedDate: '', notes: '' });
  const [dtccForm, setDtccForm] = useState({ reportType: DTCC_REPORT_TYPES[0], quarter: '1', year: String(currentYear), dueDate: '', sentDate: '', notes: '' });
  const [audDelForm, setAudDelForm] = useState({ deliverableType: '', dueDate: '', deliveredDate: '', notes: '' });
  const [audOpForm, setAudOpForm] = useState({ year: String(currentYear), opinionType: 'Clean', receivedDate: '', notes: '' });
  const [reconForm, setReconForm] = useState({ custodian: 'Schwab', month: String(new Date().getMonth() + 1), year: String(currentYear), reconciledDate: '', status: 'reconciled', discrepancyNotes: '', notes: '' });

  // Summary
  const summary = useMemo(() =>
    store.getComplianceSummary(range.start, range.end),
    [store.subAgreementProcessing, store.blueSkyFilingKpi, store.formDAmendments, store.dtccReporting, store.auditDeliverables, store.auditOpinions, store.custodianReconciliation, range]
  );

  // Filtered data helpers
  const filterByDate = (arr, dateField) =>
    arr.filter((e) => (e[dateField] || '') >= range.start && (e[dateField] || '') <= range.end)
      .sort((a, b) => (b[dateField] || '').localeCompare(a[dateField] || ''));

  const subs = useMemo(() => filterByDate(store.subAgreementProcessing, 'processedDate'), [store.subAgreementProcessing, range]);
  const bsFilings = useMemo(() => filterByDate(store.blueSkyFilingKpi, 'filedDate'), [store.blueSkyFilingKpi, range]);
  const formDs = useMemo(() => filterByDate(store.formDAmendments, 'dueDate'), [store.formDAmendments, range]);
  const dtccs = useMemo(() => filterByDate(store.dtccReporting, 'dueDate'), [store.dtccReporting, range]);
  const audDels = useMemo(() => filterByDate(store.auditDeliverables, 'dueDate'), [store.auditDeliverables, range]);
  const recons = useMemo(() => {
    return store.custodianReconciliation.filter((e) => {
      const d = `${e.year}-${String(e.month).padStart(2, '0')}-01`;
      return d >= range.start && d <= range.end;
    }).sort((a, b) => `${b.year}-${String(b.month).padStart(2, '0')}`.localeCompare(`${a.year}-${String(a.month).padStart(2, '0')}`));
  }, [store.custodianReconciliation, range]);

  // Handlers
  const handleSaveSub = () => {
    if (!subForm.investorName.trim()) return;
    store.addSubAgreementProcessing(subForm, USER);
    setShowSubModal(false);
    showToast('Sub agreement processing logged');
    setSubForm({ investorName: '', processedDate: today, hasErrors: false, errorDescription: '', notes: '' });
  };

  const handleSaveBs = () => {
    if (!bsForm.investorName.trim() || !bsForm.state) return;
    store.addBlueSkyFilingKpi(bsForm, USER);
    setShowBsModal(false);
    showToast('Blue Sky filing logged');
    setBsForm({ investorName: '', state: '', triggerDate: '', filedDate: '', notes: '' });
  };

  const handleSaveFormD = () => {
    if (!formDForm.dueDate) return;
    store.addFormDAmendment(formDForm, USER);
    setShowFormDModal(false);
    showToast('Form D amendment logged');
    setFormDForm({ filingType: FILING_TYPES[0], dueDate: '', filedDate: '', notes: '' });
  };

  const handleSaveDtcc = () => {
    if (!dtccForm.dueDate) return;
    store.addDtccReporting(dtccForm, USER);
    setShowDtccModal(false);
    showToast('DTCC reporting logged');
    setDtccForm({ reportType: DTCC_REPORT_TYPES[0], quarter: '1', year: String(currentYear), dueDate: '', sentDate: '', notes: '' });
  };

  const handleSaveAudDel = () => {
    if (!audDelForm.deliverableType.trim()) return;
    store.addAuditDeliverable(audDelForm, USER);
    setShowAudDelModal(false);
    showToast('Audit deliverable logged');
    setAudDelForm({ deliverableType: '', dueDate: '', deliveredDate: '', notes: '' });
  };

  const handleSaveAudOp = () => {
    if (!audOpForm.year) return;
    store.addAuditOpinion(audOpForm, USER);
    setShowAudOpModal(false);
    showToast('Audit opinion logged');
    setAudOpForm({ year: String(currentYear), opinionType: 'Clean', receivedDate: '', notes: '' });
  };

  const handleSaveRecon = () => {
    store.addCustodianReconciliation(reconForm, USER);
    setShowReconModal(false);
    showToast('Custodian reconciliation logged');
    setReconForm({ custodian: 'Schwab', month: String(new Date().getMonth() + 1), year: String(currentYear), reconciledDate: '', status: 'reconciled', discrepancyNotes: '', notes: '' });
  };

  const handleExport = () => {
    let csv = 'COMPLIANCE KPIs\n';
    csv += `Period: ${range.label} (${range.start} to ${range.end})\n\n`;
    csv += `Sub Agreements: ${summary.subTotal} processed, ${summary.subErrors} errors (${Math.round(summary.errorRate)}%)\n`;
    csv += `Blue Sky: ${summary.bsTotal} filings, ${summary.bsWithin30} within 30 days\n`;
    csv += `Form D: ${summary.formDTotal} filings, ${summary.formDOnTime} on time\n`;
    csv += `DTCC: ${summary.dtccTotal} reports, ${summary.dtccOnTime} on time\n`;
    csv += `Audit Deliverables: ${summary.audDelTotal} items, ${summary.audDelOnTime} on time\n`;
    csv += `Audit Opinion: ${summary.latestOpinion ? summary.latestOpinion.opinionType : 'N/A'}\n`;
    csv += `Custodian Recon: ${summary.reconTotal} months, ${summary.reconOk} reconciled, ${summary.reconDisc} discrepancies\n`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Compliance_KPIs_${range.start}_${range.end}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div style={{ padding: isMobile ? '16px 0' : '0' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 20 }}>
        <DateRangeFilter range={range} setRange={setRange} />
        <ExportButton onClick={handleExport} />
      </div>

      {/* ── Processing & Filing Cards ────────────────────────── */}
      <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t5)', marginBottom: 8 }}>
        Processing & Filing
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <KpiStatusCard
          label="Sub Agreements"
          value={summary.subTotal > 0 ? `${Math.round(summary.errorRate)}%` : '-'}
          unit="error rate"
          target="< 2% errors"
          status={summary.subStatus}
          subtitle={`${summary.subTotal} processed, ${summary.subErrors} errors`}
          onClick={() => setExpanded(expanded === 'sub' ? null : 'sub')}
          expanded={expanded === 'sub'}
        />
        <KpiStatusCard
          label="Blue Sky Filings"
          value={summary.bsTotal > 0 ? `${summary.bsWithin30}/${summary.bsTotal}` : '-'}
          target="100% within 30 days"
          status={summary.bsStatus}
          subtitle={summary.avgDaysToFile != null ? `Avg ${Math.round(summary.avgDaysToFile)} days to file` : ''}
          onClick={() => setExpanded(expanded === 'bs' ? null : 'bs')}
          expanded={expanded === 'bs'}
        />
        <KpiStatusCard
          label="Form D Filings"
          value={summary.formDTotal > 0 ? `${summary.formDOnTime}/${summary.formDTotal}` : '-'}
          target="All on time"
          status={summary.formDStatus}
          onClick={() => setExpanded(expanded === 'formD' ? null : 'formD')}
          expanded={expanded === 'formD'}
        />
        <KpiStatusCard
          label="DTCC Reporting"
          value={summary.dtccTotal > 0 ? `${summary.dtccOnTime}/${summary.dtccTotal}` : '-'}
          target="All on schedule"
          status={summary.dtccStatus}
          onClick={() => setExpanded(expanded === 'dtcc' ? null : 'dtcc')}
          expanded={expanded === 'dtcc'}
        />
      </div>

      {/* ── Audit & Reconciliation Cards ─────────────────────── */}
      <div style={{ ...mono, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t5)', marginBottom: 8 }}>
        Audit & Reconciliation
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        <KpiStatusCard
          label="Tanner Deliverables"
          value={summary.audDelTotal > 0 ? `${summary.audDelOnTime}/${summary.audDelTotal}` : '-'}
          target="All on time"
          status={summary.audDelStatus}
          subtitle={summary.avgTurnaround != null ? `Avg ${Math.round(summary.avgTurnaround)}d turnaround` : ''}
          onClick={() => setExpanded(expanded === 'audDel' ? null : 'audDel')}
          expanded={expanded === 'audDel'}
        />
        <KpiStatusCard
          label="Clean Opinion"
          value={summary.latestOpinion ? summary.latestOpinion.opinionType : '-'}
          target="Clean audit opinion"
          status={summary.opinionStatus}
          subtitle={summary.latestOpinion ? `Year: ${summary.latestOpinion.year}` : 'No opinion logged'}
          onClick={() => setExpanded(expanded === 'audOp' ? null : 'audOp')}
          expanded={expanded === 'audOp'}
        />
        <KpiStatusCard
          label="Custodian Reconciliation"
          value={summary.reconTotal > 0 ? `${summary.reconOk}/${summary.reconTotal}` : '-'}
          target="All months reconciled"
          status={summary.reconStatus}
          subtitle={summary.reconDisc > 0 ? `${summary.reconDisc} discrepancies` : ''}
          onClick={() => setExpanded(expanded === 'recon' ? null : 'recon')}
          expanded={expanded === 'recon'}
        />
      </div>

      {/* ── Sub Agreement Detail ──────────────────────────────── */}
      {expanded === 'sub' && (
        <KpiSectionHeader title="Subscription Agreements Processed" onAdd={() => setShowSubModal(true)}>
          {subs.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'investorName', label: 'Investor', width: '1fr' },
                { key: 'processedDate', label: 'Processed', width: '85px', render: (r) => fmtDate(r.processedDate) },
                { key: 'hasErrors', label: 'Errors', width: '70px',
                  render: (r) => r.hasErrors
                    ? <span style={{ ...mono, fontSize: 9, color: 'var(--red)', fontWeight: 700 }}>YES</span>
                    : <span style={{ ...mono, fontSize: 9, color: 'var(--grn)' }}>NO</span> },
                { key: 'errorDescription', label: 'Description', width: '1fr' },
              ]}
              rows={subs}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Blue Sky Detail ───────────────────────────────────── */}
      {expanded === 'bs' && (
        <KpiSectionHeader title="Blue Sky Filings" onAdd={() => setShowBsModal(true)}>
          {bsFilings.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'state', label: 'State', width: '55px' },
                { key: 'investorName', label: 'Investor', width: '1fr' },
                { key: 'triggerDate', label: 'Trigger', width: '85px', render: (r) => fmtDate(r.triggerDate) },
                { key: 'filedDate', label: 'Filed', width: '85px', render: (r) => fmtDate(r.filedDate) },
                { key: 'actualDays', label: 'Days', width: '50px',
                  color: (r) => r.actualDays != null && r.actualDays > 30 ? 'var(--red)' : 'var(--grn)' },
              ]}
              rows={bsFilings}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Form D Detail ─────────────────────────────────────── */}
      {expanded === 'formD' && (
        <KpiSectionHeader title="Form D Amendments & Regulatory Filings" onAdd={() => setShowFormDModal(true)}>
          {formDs.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'filingType', label: 'Type', width: '1fr' },
                { key: 'dueDate', label: 'Due', width: '85px', render: (r) => fmtDate(r.dueDate) },
                { key: 'filedDate', label: 'Filed', width: '85px', render: (r) => fmtDate(r.filedDate) },
                { key: 'status', label: 'Status', width: '80px', render: (r) => <StatusBadge status={r.status} /> },
              ]}
              rows={formDs}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── DTCC Detail ───────────────────────────────────────── */}
      {expanded === 'dtcc' && (
        <KpiSectionHeader title="DTCC NAV/Fund Reporting" onAdd={() => setShowDtccModal(true)}>
          {dtccs.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'reportType', label: 'Type', width: '80px' },
                { key: 'quarter', label: 'Quarter', width: '70px', render: (r) => `Q${r.quarter} ${r.year}` },
                { key: 'dueDate', label: 'Due', width: '85px', render: (r) => fmtDate(r.dueDate) },
                { key: 'sentDate', label: 'Sent', width: '85px', render: (r) => fmtDate(r.sentDate) },
                { key: 'status', label: 'Status', width: '80px', render: (r) => <StatusBadge status={r.status} /> },
              ]}
              rows={dtccs}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Audit Deliverables Detail ─────────────────────────── */}
      {expanded === 'audDel' && (
        <KpiSectionHeader title="Audit — Tanner Deliverables" onAdd={() => setShowAudDelModal(true)}>
          {audDels.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'deliverableType', label: 'Deliverable', width: '1fr' },
                { key: 'dueDate', label: 'Due', width: '85px', render: (r) => fmtDate(r.dueDate) },
                { key: 'deliveredDate', label: 'Delivered', width: '85px', render: (r) => fmtDate(r.deliveredDate) },
                { key: 'turnaroundDays', label: 'Days', width: '50px' },
                { key: 'status', label: 'Status', width: '80px', render: (r) => <StatusBadge status={r.status} /> },
              ]}
              rows={audDels}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Audit Opinion Detail ──────────────────────────────── */}
      {expanded === 'audOp' && (
        <KpiSectionHeader title="Audit — Clean Opinion" onAdd={() => setShowAudOpModal(true)}>
          {store.auditOpinions.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'year', label: 'Year', width: '80px' },
                { key: 'opinionType', label: 'Opinion', width: '120px',
                  render: (r) => (
                    <span style={{ ...mono, fontSize: 10, fontWeight: 700,
                      color: r.opinionType === 'Clean' ? 'var(--grn)' : 'var(--red)' }}>
                      {r.opinionType}
                    </span>
                  )},
                { key: 'receivedDate', label: 'Received', width: '85px', render: (r) => fmtDate(r.receivedDate) },
                { key: 'notes', label: 'Notes', width: '1fr' },
              ]}
              rows={[...store.auditOpinions].sort((a, b) => b.year - a.year)}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Custodian Reconciliation Detail ───────────────────── */}
      {expanded === 'recon' && (
        <KpiSectionHeader title="Custodian Reporting Reconciled" onAdd={() => setShowReconModal(true)}>
          {recons.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'custodian', label: 'Custodian', width: '100px' },
                { key: 'month', label: 'Month', width: '100px', render: (r) => `${MONTHS[r.month - 1] || r.month} ${r.year}` },
                { key: 'reconciledDate', label: 'Completed', width: '85px', render: (r) => fmtDate(r.reconciledDate) },
                { key: 'status', label: 'Status', width: '100px', render: (r) => <StatusBadge status={r.status} /> },
                { key: 'discrepancyNotes', label: 'Notes', width: '1fr' },
              ]}
              rows={recons}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Modals ───────────────────────────────────────────── */}
      {showSubModal && (
        <KpiEntryModal title="Log Sub Agreement Processing" onClose={() => setShowSubModal(false)} onSave={handleSaveSub} saveDisabled={!subForm.investorName.trim()}
          fields={[
            { key: 'investorName', label: 'Investor Name', type: 'text' },
            { key: 'processedDate', label: 'Processed Date', type: 'date' },
            { key: 'hasErrors', label: 'Had errors requiring rework', type: 'checkbox' },
            { key: 'errorDescription', label: 'Error Description', type: 'textarea', fullWidth: true },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={subForm} onChange={(k, v) => setSubForm((f) => ({ ...f, [k]: v }))}
        />
      )}

      {showBsModal && (
        <KpiEntryModal title="Log Blue Sky Filing" onClose={() => setShowBsModal(false)} onSave={handleSaveBs} saveDisabled={!bsForm.investorName.trim() || !bsForm.state}
          fields={[
            { key: 'investorName', label: 'Investor Name', type: 'text' },
            { key: 'state', label: 'State', type: 'select', options: US_STATES },
            { key: 'triggerDate', label: 'Sub Doc Completed Date', type: 'date' },
            { key: 'filedDate', label: 'Date Filed', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={bsForm} onChange={(k, v) => setBsForm((f) => ({ ...f, [k]: v }))}
        />
      )}

      {showFormDModal && (
        <KpiEntryModal title="Log Form D / Regulatory Filing" onClose={() => setShowFormDModal(false)} onSave={handleSaveFormD} saveDisabled={!formDForm.dueDate}
          fields={[
            { key: 'filingType', label: 'Filing Type', type: 'select', options: FILING_TYPES },
            { key: 'dueDate', label: 'Due Date', type: 'date' },
            { key: 'filedDate', label: 'Date Filed', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={formDForm} onChange={(k, v) => setFormDForm((f) => ({ ...f, [k]: v }))}
        />
      )}

      {showDtccModal && (
        <KpiEntryModal title="Log DTCC Reporting" onClose={() => setShowDtccModal(false)} onSave={handleSaveDtcc} saveDisabled={!dtccForm.dueDate}
          fields={[
            { key: 'reportType', label: 'Report Type', type: 'select', options: DTCC_REPORT_TYPES },
            { key: 'quarter', label: 'Quarter', type: 'select', options: ['1', '2', '3', '4'] },
            { key: 'year', label: 'Year', type: 'text' },
            { key: 'dueDate', label: 'Due Date', type: 'date' },
            { key: 'sentDate', label: 'Date Sent', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={dtccForm} onChange={(k, v) => setDtccForm((f) => ({ ...f, [k]: v }))}
        />
      )}

      {showAudDelModal && (
        <KpiEntryModal title="Log Audit Deliverable" onClose={() => setShowAudDelModal(false)} onSave={handleSaveAudDel} saveDisabled={!audDelForm.deliverableType.trim()}
          fields={[
            { key: 'deliverableType', label: 'Deliverable Name', type: 'text' },
            { key: 'dueDate', label: 'Due Date', type: 'date' },
            { key: 'deliveredDate', label: 'Delivered Date', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={audDelForm} onChange={(k, v) => setAudDelForm((f) => ({ ...f, [k]: v }))}
        />
      )}

      {showAudOpModal && (
        <KpiEntryModal title="Log Audit Opinion" onClose={() => setShowAudOpModal(false)} onSave={handleSaveAudOp} saveDisabled={!audOpForm.year}
          fields={[
            { key: 'year', label: 'Year', type: 'text' },
            { key: 'opinionType', label: 'Opinion Type', type: 'select', options: OPINION_TYPES },
            { key: 'receivedDate', label: 'Date Received', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={audOpForm} onChange={(k, v) => setAudOpForm((f) => ({ ...f, [k]: v }))}
        />
      )}

      {showReconModal && (
        <KpiEntryModal title="Log Custodian Reconciliation" onClose={() => setShowReconModal(false)} onSave={handleSaveRecon}
          fields={[
            { key: 'custodian', label: 'Custodian', type: 'select', options: CUSTODIANS },
            { key: 'month', label: 'Month', type: 'select', options: ['1','2','3','4','5','6','7','8','9','10','11','12'] },
            { key: 'year', label: 'Year', type: 'text' },
            { key: 'reconciledDate', label: 'Date Completed', type: 'date' },
            { key: 'status', label: 'Status', type: 'select', options: ['reconciled', 'discrepancy', 'pending'] },
            { key: 'discrepancyNotes', label: 'Discrepancy Notes', type: 'textarea', fullWidth: true },
          ]}
          values={reconForm} onChange={(k, v) => setReconForm((f) => ({ ...f, [k]: v }))}
        />
      )}
    </div>
  );
}
