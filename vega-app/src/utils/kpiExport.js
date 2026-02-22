// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — KPI Net Report Export
// Aggregates all KPI metrics across all 4 sections
// into a single CSV summary report
// ═══════════════════════════════════════════════

import useKpiStore from '../stores/kpiStore';

function fmtCurrency(n) {
  if (!n && n !== 0) return '-';
  return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function statusLabel(status) {
  if (status === 'green') return 'On Target';
  if (status === 'yellow') return 'Needs Attention';
  if (status === 'red') return 'Overdue / Off Target';
  return '-';
}

export function exportKpiNetReport(startDate, endDate, label = 'Custom') {
  const store = useKpiStore.getState();

  const dirSummary = store.getDirectorySummary(startDate, endDate);
  const distSummary = store.getDistributionSummary(startDate, endDate);
  const compSummary = store.getComplianceSummary(startDate, endDate);
  const opsSummary = store.getSalesOpsSummary(startDate, endDate);

  let csv = '';
  csv += 'VEGA MISSION CONTROL — KPI NET REPORT\n';
  csv += `Period: ${label} (${startDate} to ${endDate})\n`;
  csv += `Generated: ${new Date().toLocaleString()}\n\n`;

  csv += 'Metric,Value,Target,Status\n\n';

  // ── Directory ─────────────────────────────────────────────────────────────────
  csv += '═══ DIRECTORY (Investor-Facing Operations) ═══\n';
  csv += `Avg Inquiry Response Time,${dirSummary.avgResponseTime != null ? Math.round(dirSummary.avgResponseTime) + 'h' : 'N/A'},24-48 hours,${statusLabel(dirSummary.responseStatus)}\n`;
  csv += `Inquiries Received,${dirSummary.responseCount},,\n`;
  csv += `Responded Within Target,${dirSummary.withinTarget},,\n`;
  csv += `Avg LP Onboarding Time,${dirSummary.avgDaysTotal != null ? Math.round(dirSummary.avgDaysTotal) + ' days' : 'N/A'},N/A,${dirSummary.avgDaysTotal != null ? (dirSummary.avgDaysTotal <= 30 ? 'On Target' : dirSummary.avgDaysTotal <= 60 ? 'Needs Attention' : 'Off Target') : '-'}\n`;
  csv += `Onboardings Tracked,${dirSummary.onboardingCount},,\n`;
  csv += `Comms On Schedule,${dirSummary.commsOnTime}/${dirSummary.commsTotal},100% on time,${statusLabel(dirSummary.commsStatus)}\n`;
  csv += `Comms Late,${dirSummary.commsLate},,\n\n`;

  // ── Distributions ─────────────────────────────────────────────────────────────
  csv += '═══ DISTRIBUTIONS ═══\n';
  csv += `Distributions On Time,${distSummary.onTime}/${distSummary.processingTotal},100% on time + accurate,${statusLabel(distSummary.processingStatus)}\n`;
  csv += `Accuracy Rate,${distSummary.processingTotal > 0 ? Math.round((distSummary.accurate / distSummary.processingTotal) * 100) + '%' : 'N/A'},,\n`;
  csv += `Clean Streak,${distSummary.cleanStreak} consecutive,,\n`;
  csv += `Custodian Reports On Time,${distSummary.custOnTime}/${distSummary.custodianTotal},All on time,${statusLabel(distSummary.custodianStatus)}\n`;
  csv += `K-1s Delivered,${distSummary.k1Delivered}/${distSummary.k1Total},All by deadline,${statusLabel(distSummary.k1Status)}\n`;
  csv += `K-1s On Time,${distSummary.k1OnTime},,\n\n`;

  // ── Compliance ────────────────────────────────────────────────────────────────
  csv += '═══ COMPLIANCE ═══\n';
  csv += `Sub Agreement Error Rate,${compSummary.subTotal > 0 ? Math.round(compSummary.errorRate) + '%' : 'N/A'},< 2%,${statusLabel(compSummary.subStatus)}\n`;
  csv += `Sub Agreements Processed,${compSummary.subTotal},,\n`;
  csv += `Blue Sky Filed Within 30d,${compSummary.bsWithin30}/${compSummary.bsTotal},100% within 30 days,${statusLabel(compSummary.bsStatus)}\n`;
  csv += `Avg Days to File Blue Sky,${compSummary.avgDaysToFile != null ? Math.round(compSummary.avgDaysToFile) : 'N/A'},,\n`;
  csv += `Form D Filings On Time,${compSummary.formDOnTime}/${compSummary.formDTotal},All on time,${statusLabel(compSummary.formDStatus)}\n`;
  csv += `DTCC Reports On Time,${compSummary.dtccOnTime}/${compSummary.dtccTotal},All on schedule,${statusLabel(compSummary.dtccStatus)}\n`;
  csv += `Audit Deliverables On Time,${compSummary.audDelOnTime}/${compSummary.audDelTotal},All on time,${statusLabel(compSummary.audDelStatus)}\n`;
  csv += `Avg Audit Turnaround,${compSummary.avgTurnaround != null ? Math.round(compSummary.avgTurnaround) + ' days' : 'N/A'},,\n`;
  csv += `Audit Opinion,${compSummary.latestOpinion ? compSummary.latestOpinion.opinionType : 'N/A'},Clean,${statusLabel(compSummary.opinionStatus)}\n`;
  csv += `Custodian Recon Complete,${compSummary.reconOk}/${compSummary.reconTotal},All months reconciled,${statusLabel(compSummary.reconStatus)}\n`;
  csv += `Custodian Discrepancies,${compSummary.reconDisc},,\n\n`;

  // ── Sales Operations ──────────────────────────────────────────────────────────
  csv += '═══ SALES OPERATIONS ═══\n';
  csv += `Materials Spend,${fmtCurrency(opsSummary.totalMaterialsSpend)},,\n`;
  csv += `Shipping/FedEx Spend,${fmtCurrency(opsSummary.totalShippingSpend)},,\n`;
  csv += `Cost Per Kit,${opsSummary.costPerKit != null ? fmtCurrency(Math.round(opsSummary.costPerKit)) : 'N/A'},,\n`;
  csv += `Materials Created,${opsSummary.totalCreated},,\n`;
  csv += `Materials Sent,${opsSummary.totalSent},,\n`;
  csv += `Kits Assembled,${opsSummary.totalKits},,\n`;
  csv += `Avg Fulfillment Turnaround,${opsSummary.avgTurnaround != null ? Math.round(opsSummary.avgTurnaround) + ' days' : 'N/A'},,\n`;
  csv += `Ad Hoc Requests,${opsSummary.totalRequests} (${opsSummary.openRequests} open),,\n`;
  csv += `Avg Request Turnaround,${opsSummary.avgRequestTurnaround != null ? Math.round(opsSummary.avgRequestTurnaround) + ' days' : 'N/A'},,\n`;

  // Download
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Vega_KPI_Net_Report_${startDate}_${endDate}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
