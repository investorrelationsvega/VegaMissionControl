// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Distribution KPI Tab
// Distribution operations metrics:
// 1. Distributions Processed On Schedule
// 2. Custodian Reporting
// 3. K-1s Delivered by Deadline
// ═══════════════════════════════════════════════

import { useState, useMemo } from 'react';
import useKpiStore, { CUSTODIANS } from '../stores/kpiStore';
import useUiStore from '../stores/uiStore';
import useResponsive from '../hooks/useResponsive';
import {
  DateRangeFilter, getThisQuarterRange, fmtDate,
  KpiStatusCard, KpiDetailTable, KpiEntryModal,
  StatusBadge, KpiSectionHeader, EmptyState, ExportButton,
} from './KpiComponents';

const mono = { fontFamily: "'Space Mono', monospace" };
const USER = 'j@vegarei.com';
const today = new Date().toISOString().split('T')[0];

export default function DistributionKpis() {
  const store = useKpiStore();
  const showToast = useUiStore((s) => s.showToast);
  const { isMobile } = useResponsive();
  const [range, setRange] = useState(getThisQuarterRange);
  const [expanded, setExpanded] = useState(null);

  // Modals
  const [showProcessingModal, setShowProcessingModal] = useState(false);
  const [showCustodianModal, setShowCustodianModal] = useState(false);
  const [showK1Modal, setShowK1Modal] = useState(false);

  // Form state
  const [procForm, setProcForm] = useState({
    period: '', dueDate: '', processedDate: today, accurate: true, errorDescription: '', notes: '',
  });
  const [custForm, setCustForm] = useState({
    custodian: 'Schwab', period: '', dueDate: '', reportedDate: '', notes: '',
  });
  const [k1Form, setK1Form] = useState({
    taxYear: String(new Date().getFullYear() - 1), investorName: '', dueDate: '', deliveredDate: '', notes: '',
  });

  // Summary
  const summary = useMemo(() =>
    store.getDistributionSummary(range.start, range.end),
    [store.distributionProcessing, store.custodianReporting, store.k1Deliveries, range]
  );

  // Filtered data
  const processing = useMemo(() =>
    store.distributionProcessing.filter((e) => (e.processedDate || e.dueDate) >= range.start && (e.processedDate || e.dueDate) <= range.end)
      .sort((a, b) => (b.processedDate || b.dueDate).localeCompare(a.processedDate || a.dueDate)),
    [store.distributionProcessing, range]
  );

  const custodianReports = useMemo(() =>
    store.custodianReporting.filter((e) => e.dueDate >= range.start && e.dueDate <= range.end)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
    [store.custodianReporting, range]
  );

  const k1s = useMemo(() =>
    store.k1Deliveries.filter((e) => e.dueDate >= range.start && e.dueDate <= range.end)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate)),
    [store.k1Deliveries, range]
  );

  // Handlers
  const handleSaveProcessing = () => {
    if (!procForm.period.trim()) return;
    store.addDistributionProcessing({
      ...procForm,
      accurate: procForm.accurate === true || procForm.accurate === 'true',
    }, USER);
    setShowProcessingModal(false);
    showToast('Distribution processing logged');
    setProcForm({ period: '', dueDate: '', processedDate: today, accurate: true, errorDescription: '', notes: '' });
  };

  const handleSaveCustodian = () => {
    if (!custForm.custodian || !custForm.period.trim()) return;
    store.addCustodianReporting(custForm, USER);
    setShowCustodianModal(false);
    showToast('Custodian reporting logged');
    setCustForm({ custodian: 'Schwab', period: '', dueDate: '', reportedDate: '', notes: '' });
  };

  const handleSaveK1 = () => {
    if (!k1Form.investorName.trim()) return;
    store.addK1Delivery(k1Form, USER);
    setShowK1Modal(false);
    showToast('K-1 delivery logged');
    setK1Form({ taxYear: String(new Date().getFullYear() - 1), investorName: '', dueDate: '', deliveredDate: '', notes: '' });
  };

  const handleExport = () => {
    let csv = 'DISTRIBUTION KPIs\n';
    csv += `Period: ${range.label} (${range.start} to ${range.end})\n\n`;

    csv += 'DISTRIBUTIONS PROCESSED\n';
    csv += 'Period,Due Date,Processed Date,On Time,Accurate,Errors\n';
    processing.forEach((e) => csv += `${e.period},${e.dueDate},${e.processedDate || ''},${e.onTime ? 'Yes' : 'No'},${e.accurate !== false ? 'Yes' : 'No'},${e.errorDescription || ''}\n`);

    csv += '\nCUSTODIAN REPORTING\n';
    csv += 'Custodian,Period,Due Date,Reported Date,Status\n';
    custodianReports.forEach((e) => csv += `${e.custodian},${e.period},${e.dueDate},${e.reportedDate || ''},${e.status}\n`);

    csv += '\nK-1 DELIVERIES\n';
    csv += 'Tax Year,Investor,Due Date,Delivered Date,Status\n';
    k1s.forEach((e) => csv += `${e.taxYear},${e.investorName},${e.dueDate},${e.deliveredDate || ''},${e.status}\n`);

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `Distribution_KPIs_${range.start}_${range.end}.csv`;
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
          label="Processed On Schedule"
          value={summary.processingTotal > 0 ? `${summary.onTime}/${summary.processingTotal}` : '-'}
          target="100% on time + accurate"
          status={summary.processingStatus}
          subtitle={summary.cleanStreak > 0 ? `${summary.cleanStreak} clean streak` : summary.withErrors > 0 ? `${summary.withErrors} with errors` : ''}
          onClick={() => setExpanded(expanded === 'processing' ? null : 'processing')}
          expanded={expanded === 'processing'}
        />
        <KpiStatusCard
          label="Custodian Reporting"
          value={summary.custodianTotal > 0 ? `${summary.custOnTime}/${summary.custodianTotal}` : '-'}
          target="On time to Schwab & Inspira"
          status={summary.custodianStatus}
          onClick={() => setExpanded(expanded === 'custodian' ? null : 'custodian')}
          expanded={expanded === 'custodian'}
        />
        <KpiStatusCard
          label="K-1s Delivered"
          value={summary.k1Total > 0 ? `${summary.k1Delivered}/${summary.k1Total}` : '-'}
          target="All by tax deadline"
          status={summary.k1Status}
          subtitle={summary.k1OnTime > 0 ? `${summary.k1OnTime} on time` : ''}
          onClick={() => setExpanded(expanded === 'k1' ? null : 'k1')}
          expanded={expanded === 'k1'}
        />
      </div>

      {/* ── Distribution Processing Detail ───────────────────── */}
      {expanded === 'processing' && (
        <KpiSectionHeader title="Distributions Processed" onAdd={() => setShowProcessingModal(true)}>
          {processing.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'period', label: 'Period', width: '1fr' },
                { key: 'dueDate', label: 'Due', width: '85px', render: (r) => fmtDate(r.dueDate) },
                { key: 'processedDate', label: 'Processed', width: '85px', render: (r) => fmtDate(r.processedDate) },
                { key: 'onTime', label: 'On Time', width: '70px',
                  render: (r) => <StatusBadge status={r.onTime ? 'on_time' : 'late'} /> },
                { key: 'accurate', label: 'Accurate', width: '70px',
                  render: (r) => r.accurate !== false
                    ? <span style={{ ...mono, fontSize: 9, color: 'var(--grn)' }}>YES</span>
                    : <span style={{ ...mono, fontSize: 9, color: 'var(--red)' }}>NO</span> },
                { key: 'errorDescription', label: 'Errors', width: '1fr' },
              ]}
              rows={processing}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Custodian Reporting Detail ────────────────────────── */}
      {expanded === 'custodian' && (
        <KpiSectionHeader title="Distribution Data Reported to Custodians" onAdd={() => setShowCustodianModal(true)}>
          {custodianReports.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'custodian', label: 'Custodian', width: '100px' },
                { key: 'period', label: 'Period', width: '1fr' },
                { key: 'dueDate', label: 'Due', width: '85px', render: (r) => fmtDate(r.dueDate) },
                { key: 'reportedDate', label: 'Reported', width: '85px', render: (r) => fmtDate(r.reportedDate) },
                { key: 'status', label: 'Status', width: '80px', render: (r) => <StatusBadge status={r.status} /> },
              ]}
              rows={custodianReports}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── K-1 Delivery Detail ──────────────────────────────── */}
      {expanded === 'k1' && (
        <KpiSectionHeader title="K-1s Delivered by Tax Deadline" onAdd={() => setShowK1Modal(true)}>
          {k1s.length === 0 ? <EmptyState /> : (
            <KpiDetailTable
              columns={[
                { key: 'taxYear', label: 'Tax Year', width: '80px' },
                { key: 'investorName', label: 'Investor', width: '1fr' },
                { key: 'dueDate', label: 'Deadline', width: '85px', render: (r) => fmtDate(r.dueDate) },
                { key: 'deliveredDate', label: 'Delivered', width: '85px', render: (r) => fmtDate(r.deliveredDate) },
                { key: 'status', label: 'Status', width: '80px', render: (r) => <StatusBadge status={r.status} /> },
              ]}
              rows={k1s}
            />
          )}
        </KpiSectionHeader>
      )}

      {/* ── Processing Modal ─────────────────────────────────── */}
      {showProcessingModal && (
        <KpiEntryModal
          title="Log Distribution Processing"
          fields={[
            { key: 'period', label: 'Period (e.g. Q4 2025)', type: 'text' },
            { key: 'dueDate', label: 'Due Date', type: 'date' },
            { key: 'processedDate', label: 'Processed Date', type: 'date' },
            { key: 'accurate', label: 'Accurate (no errors)', type: 'checkbox' },
            { key: 'errorDescription', label: 'Error Description (if any)', type: 'textarea', fullWidth: true },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={procForm}
          onChange={(key, val) => setProcForm((f) => ({ ...f, [key]: val }))}
          onSave={handleSaveProcessing}
          onClose={() => setShowProcessingModal(false)}
          saveDisabled={!procForm.period.trim()}
        />
      )}

      {/* ── Custodian Modal ──────────────────────────────────── */}
      {showCustodianModal && (
        <KpiEntryModal
          title="Log Custodian Reporting"
          fields={[
            { key: 'custodian', label: 'Custodian', type: 'select', options: CUSTODIANS },
            { key: 'period', label: 'Period (e.g. Q4 2025)', type: 'text' },
            { key: 'dueDate', label: 'Due Date', type: 'date' },
            { key: 'reportedDate', label: 'Reported Date', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={custForm}
          onChange={(key, val) => setCustForm((f) => ({ ...f, [key]: val }))}
          onSave={handleSaveCustodian}
          onClose={() => setShowCustodianModal(false)}
          saveDisabled={!custForm.period.trim()}
        />
      )}

      {/* ── K-1 Modal ────────────────────────────────────────── */}
      {showK1Modal && (
        <KpiEntryModal
          title="Log K-1 Delivery"
          fields={[
            { key: 'taxYear', label: 'Tax Year', type: 'text' },
            { key: 'investorName', label: 'Investor Name', type: 'text' },
            { key: 'dueDate', label: 'Deadline', type: 'date' },
            { key: 'deliveredDate', label: 'Delivered Date', type: 'date' },
            { key: 'notes', label: 'Notes', type: 'textarea', fullWidth: true },
          ]}
          values={k1Form}
          onChange={(key, val) => setK1Form((f) => ({ ...f, [key]: val }))}
          onSave={handleSaveK1}
          onClose={() => setShowK1Modal(false)}
          saveDisabled={!k1Form.investorName.trim()}
        />
      )}
    </div>
  );
}
