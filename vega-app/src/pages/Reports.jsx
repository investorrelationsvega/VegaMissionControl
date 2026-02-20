import { useState, useMemo } from 'react';
import useInvestorStore from '../stores/investorStore';
import useComplianceStore from '../stores/complianceStore';
import useDistributionStore from '../stores/distributionStore';
import useFundStore from '../stores/fundStore';
import useUiStore from '../stores/uiStore';
import { fmt, fmtK } from '../utils/format';
import useResponsive from '../hooks/useResponsive';

const reportTypes = [
  { id: 'fund-summary', title: 'Fund Summary', desc: 'AUM, investor count, compliance status, key metrics', dot: 'var(--grn)' },
  { id: 'investor-detail', title: 'Investor Detail', desc: 'Complete investor profile with positions, compliance, distributions', dot: 'var(--blu)' },
  { id: 'compliance-status', title: 'Compliance Status', desc: 'All open issues grouped by investor or document type', dot: 'var(--ylw)' },
  { id: 'distribution-report', title: 'Distribution Report', desc: 'Per-period breakdown with totals and payment methods', dot: 'var(--red)' },
];

function downloadCSV(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function Reports() {
  const investorMap = useInvestorStore((s) => s.investors);
  const investors = useMemo(() => {
    if (!investorMap || typeof investorMap !== 'object') return [];
    return Object.values(investorMap);
  }, [investorMap]);
  const compliance = useComplianceStore((s) => s.items) || [];
  const distributions = useDistributionStore((s) => s.distributions) || [];
  const getPeriods = useDistributionStore((s) => s.getPeriods);
  const funds = useFundStore((s) => s.funds) || [];
  const showToast = useUiStore((s) => s.showToast);

  const { isMobile, isTablet } = useResponsive();

  const [reportType, setReportType] = useState('fund-summary');
  const [selectedFund, setSelectedFund] = useState('F02');
  const [selectedInvestor, setSelectedInvestor] = useState('');
  const [selectedPeriod, setSelectedPeriod] = useState('Dec 2025');
  const [groupBy, setGroupBy] = useState('investor');

  const periods = useMemo(() => (getPeriods ? getPeriods() : [...new Set(distributions.map((d) => d.period))]), [distributions, getPeriods]);
  const fund = funds.find((f) => f.id === selectedFund);
  const investor = investors.find((i) => i.id === selectedInvestor);

  const fundInvestors = useMemo(() => investors.filter((i) => i.funds && i.funds.includes(fund?.shortName)), [investors, fund]);
  const fundCompliance = useMemo(() => compliance.filter((c) => c.fund === fund?.shortName), [compliance, fund]);
  const fundDists = useMemo(() => distributions.filter((d) => d.fund === fund?.shortName), [distributions, fund]);
  const openCompliance = fundCompliance.filter((c) => c.status === 'Open');
  const periodDists = useMemo(() => distributions.filter((d) => d.period === selectedPeriod), [distributions, selectedPeriod]);

  const compGrouped = useMemo(() => {
    const open = compliance.filter((c) => c.status === 'Open');
    const groups = {};
    if (groupBy === 'investor') {
      open.forEach((c) => { (groups[c.name] = groups[c.name] || []).push(c); });
    } else {
      open.forEach((c) => { (groups[c.doc] = groups[c.doc] || []).push(c); });
    }
    return groups;
  }, [compliance, groupBy]);

  const exportFundSummary = () => {
    if (!fund) return;
    const rows = [
      ['Fund Name', 'Status', 'Total Raised', 'Target', '% Funded', 'Investors', 'Positions', 'Open Compliance', 'Total Distributed'],
      [fund.name, fund.status, fund.committed, fund.target, fund.target ? ((fund.committed / fund.target) * 100).toFixed(1) + '%' : 'N/A', fundInvestors.length, fund.positionCount, openCompliance.length, fundDists.reduce((s, d) => s + d.amt, 0)],
    ];
    downloadCSV(fund.shortName.replace(/\s/g, '_') + '_Summary.csv', rows.map((r) => r.join(',')).join('\n'));
    showToast('Fund summary exported');
  };

  const exportInvestorDetail = () => {
    if (!investor) return;
    const invCompliance = compliance.filter((c) => c.invId === investor.id);
    const invDists = distributions.filter((d) => d.invId === investor.id);
    let csv = 'INVESTOR DETAIL REPORT\n';
    csv += 'Name,' + investor.name + '\nID,' + investor.id + '\n';
    csv += 'Types,"' + investor.types.join(', ') + '"\nFunds,"' + investor.funds.join(', ') + '"\n';
    csv += 'Total Committed,' + investor.totalCommitted + '\nAdvisor,' + (investor.advisor || 'N/A') + '\nCustodian,' + (investor.custodian || 'N/A') + '\n\n';
    csv += 'POSITIONS\nFund,Entity,Type,Class,Amount,Status,Funded\n';
    investor.positions.forEach((p) => { csv += p.fund + ',"' + (p.entity || '') + '",' + p.type + ',' + p.cls + ',' + p.amt + ',' + p.status + ',' + (p.funded || '') + '\n'; });
    csv += '\nCOMPLIANCE (' + invCompliance.length + ' items)\nDocument,Issue,Status\n';
    invCompliance.forEach((c) => { csv += c.doc + ',"' + c.issue + '",' + c.status + '\n'; });
    csv += '\nDISTRIBUTIONS (' + invDists.length + ' records)\nPeriod,Amount,Method,Date\n';
    invDists.forEach((d) => { csv += d.period + ',' + d.amt + ',' + d.method + ',' + (d.date || '') + '\n'; });
    downloadCSV('Investor_' + investor.name.replace(/\s/g, '_') + '.csv', csv);
    showToast('Investor report exported');
  };

  const exportComplianceStatus = () => {
    let csv = 'COMPLIANCE STATUS REPORT\nGrouped By,' + (groupBy === 'investor' ? 'Investor' : 'Document Type') + '\n\n';
    csv += 'Group,Document,Investor,Issue,Status,Priority\n';
    Object.entries(compGrouped).forEach(([group, items]) => {
      items.forEach((c) => { csv += '"' + group + '",' + c.doc + ',"' + c.name + '","' + c.issue + '",' + c.status + ',' + c.priority + '\n'; });
    });
    downloadCSV('Compliance_Status.csv', csv);
    showToast('Compliance report exported');
  };

  const exportDistributionReport = () => {
    let csv = 'DISTRIBUTION REPORT\nPeriod,' + selectedPeriod + '\n';
    csv += 'Total,' + periodDists.reduce((s, d) => s + d.amt, 0) + '\nPayments,' + periodDists.length + '\n\n';
    csv += 'Investor,Entity,Amount,Method,Status,Date\n';
    periodDists.forEach((d) => { csv += '"' + d.name + '","' + (d.entity || '') + '",' + d.amt + ',' + d.method + ',' + d.status + ',' + (d.date || '') + '\n'; });
    downloadCSV('Distribution_' + selectedPeriod.replace(/\s/g, '_') + '.csv', csv);
    showToast('Distribution report exported');
  };

  const handleExport = () => {
    if (reportType === 'fund-summary') exportFundSummary();
    else if (reportType === 'investor-detail') exportInvestorDetail();
    else if (reportType === 'compliance-status') exportComplianceStatus();
    else if (reportType === 'distribution-report') exportDistributionReport();
  };

  return (
    <div className="main">
      <div className="page-header">
        <div className="page-header-dot"><span>Active Module</span></div>
        <h1 className="page-title">Reports</h1>
        <p className="page-subtitle">Generate Exportable Reports</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : isTablet ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 12, marginBottom: 32 }}>
        {reportTypes.map((rt) => (
          <div key={rt.id} onClick={() => setReportType(rt.id)} style={{
            background: reportType === rt.id ? 'rgba(52,211,153,0.03)' : 'var(--bg-card-half)',
            border: '1px solid ' + (reportType === rt.id ? 'var(--grn)' : 'var(--bd)'),
            borderRadius: 6, padding: 20, cursor: 'pointer', transition: 'all 0.15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: rt.dot }} />
              <span className="mono" style={{ fontSize: 11, color: 'var(--t5)' }}>Report</span>
            </div>
            <div style={{ fontSize: 16, fontWeight: 500, color: 'var(--t1)', marginBottom: 4 }}>{rt.title}</div>
            <div style={{ fontSize: 13, color: 'var(--t4)' }}>{rt.desc}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '300px 1fr', gap: 24 }}>
        <div>
          <div className="section-label" style={{ marginBottom: 16 }}>Parameters</div>
          <div style={{ background: 'var(--bg-card-half)', border: '1px solid var(--bd)', borderRadius: 6, padding: 20 }}>
            {reportType === 'fund-summary' && (
              <div>
                <label className="form-label">Select Fund</label>
                <select className="form-select" value={selectedFund} onChange={(e) => setSelectedFund(e.target.value)}>
                  {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                </select>
              </div>
            )}
            {reportType === 'investor-detail' && (
              <div>
                <label className="form-label">Select Investor</label>
                <select className="form-select" value={selectedInvestor} onChange={(e) => setSelectedInvestor(e.target.value)}>
                  <option value="">Choose investor...</option>
                  {investors.map((i) => <option key={i.id} value={i.id}>{i.name}</option>)}
                </select>
              </div>
            )}
            {reportType === 'compliance-status' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Group By</label>
                  <select className="form-select" value={groupBy} onChange={(e) => setGroupBy(e.target.value)}>
                    <option value="investor">Investor</option>
                    <option value="document">Document Type</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Fund Filter (optional)</label>
                  <select className="form-select" value={selectedFund} onChange={(e) => setSelectedFund(e.target.value)}>
                    <option value="">All Funds</option>
                    {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </>
            )}
            {reportType === 'distribution-report' && (
              <>
                <div style={{ marginBottom: 16 }}>
                  <label className="form-label">Period</label>
                  <select className="form-select" value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}>
                    {periods.map((p) => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Fund Filter</label>
                  <select className="form-select" value={selectedFund} onChange={(e) => setSelectedFund(e.target.value)}>
                    <option value="">All Funds</option>
                    {funds.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <div style={{ marginTop: 24, display: 'flex', gap: 8 }}>
              <button className="btn btn-primary" onClick={handleExport}>Export CSV</button>
              <button className="btn btn-secondary" onClick={() => window.print()}>Print</button>
            </div>
          </div>
        </div>

        <div>
          <div className="section-label" style={{ marginBottom: 16 }}>Preview</div>
          <div style={{ background: 'var(--bg-card-half)', border: '1px solid var(--bd)', borderRadius: 6, padding: 24, minHeight: 400 }}>

            {reportType === 'fund-summary' && fund && (
              <div className="fade-in">
                <div style={{ fontSize: 20, fontWeight: 300, color: 'var(--t1)', marginBottom: 4 }}>{fund.name}</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                  <span className={'badge ' + (fund.status === 'Closed' ? 'badge-closed' : fund.status === 'Open' ? 'badge-open' : 'badge-pending')}>{fund.status}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
                  {[
                    { l: 'Total Raised', v: fmt(fund.committed) },
                    { l: 'Target', v: fund.target ? fmt(fund.target) : 'TBD' },
                    { l: '% Funded', v: fund.target ? ((fund.committed / fund.target) * 100).toFixed(1) + '%' : 'N/A' },
                    { l: 'Investors', v: fundInvestors.length },
                    { l: 'Positions', v: fund.positionCount },
                    { l: 'Open Compliance', v: openCompliance.length, c: openCompliance.length > 0 ? 'var(--red)' : 'var(--grn)' },
                  ].map((s) => (
                    <div key={s.l} style={{ background: 'var(--bgI)', borderRadius: 5, padding: 12 }}>
                      <div className="mono" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 4 }}>{s.l}</div>
                      <div style={{ fontSize: 18, fontWeight: 300, color: s.c || 'var(--t1)' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {fundDists.length > 0 && (
                  <>
                    <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 12 }}>Distribution History</div>
                    <div style={{ fontSize: 14, color: 'var(--t2)' }}>
                      Total Distributed: {fmt(fundDists.reduce((s, d) => s + d.amt, 0))} across {fundDists.length} payments
                    </div>
                  </>
                )}
              </div>
            )}

            {reportType === 'investor-detail' && (
              <div className="fade-in">
                {investor ? (
                  <>
                    <div style={{ fontSize: 20, fontWeight: 300, color: 'var(--t1)', marginBottom: 4 }}>{investor.name}</div>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--t4)', marginBottom: 16 }}>
                      {investor.id} {'\u00B7'} {investor.types.join(', ')} {'\u00B7'} {investor.funds.join(', ')}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                      {[
                        { l: 'Committed', v: fmtK(investor.totalCommitted) },
                        { l: 'Positions', v: investor.positions.length },
                        { l: 'Compliance', v: compliance.filter((c) => c.invId === investor.id && c.status === 'Open').length + ' open' },
                        { l: 'Distributions', v: distributions.filter((d) => d.invId === investor.id).length },
                      ].map((s) => (
                        <div key={s.l} style={{ background: 'var(--bgI)', borderRadius: 5, padding: 12 }}>
                          <div className="mono" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 4 }}>{s.l}</div>
                          <div style={{ fontSize: 16, fontWeight: 300, color: 'var(--t1)' }}>{s.v}</div>
                        </div>
                      ))}
                    </div>
                    <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 8 }}>Positions</div>
                    <div className="r-scroll-table">
                    <table style={{ marginBottom: 20 }}>
                      <thead><tr>
                        {['Fund', 'Entity', 'Type', 'Amount', 'Status'].map((h) => <th key={h} className={h === 'Amount' ? 'right' : ''}>{h}</th>)}
                      </tr></thead>
                      <tbody>
                        {investor.positions.map((p, i) => (
                          <tr key={i}>
                            <td style={{ fontWeight: 700 }}>{p.fund}</td>
                            <td style={{ color: 'var(--t3)', fontSize: 12 }}>{p.entity || '\u2014'}</td>
                            <td><span className="badge badge-muted">{p.type}</span></td>
                            <td className="right" style={{ fontWeight: 700, color: 'var(--t1)' }}>{fmt(p.amt)}</td>
                            <td><span className={'badge ' + (p.status === 'Approved' ? 'badge-green' : 'badge-yellow')}>{p.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--t5)', fontSize: 14 }}>
                    Select an investor to preview report
                  </div>
                )}
              </div>
            )}

            {reportType === 'compliance-status' && (
              <div className="fade-in">
                <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                  <div style={{ background: 'var(--bgI)', borderRadius: 5, padding: 12, flex: 1 }}>
                    <div className="mono" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 4 }}>Total Open</div>
                    <div style={{ fontSize: 22, fontWeight: 300, color: compliance.filter((c) => c.status === 'Open').length > 0 ? 'var(--red)' : 'var(--grn)' }}>
                      {compliance.filter((c) => c.status === 'Open').length}
                    </div>
                  </div>
                  <div style={{ background: 'var(--bgI)', borderRadius: 5, padding: 12, flex: 1 }}>
                    <div className="mono" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 4 }}>Groups</div>
                    <div style={{ fontSize: 22, fontWeight: 300, color: 'var(--t1)' }}>{Object.keys(compGrouped).length}</div>
                  </div>
                </div>
                {Object.entries(compGrouped).map(([group, items]) => (
                  <div key={group} style={{ marginBottom: 16 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--t1)' }}>{group}</span>
                      <span className="badge badge-red">{items.length} issues</span>
                    </div>
                    {items.map((c) => (
                      <div key={c.id} style={{ padding: 8, paddingLeft: 14, borderLeft: '2px solid ' + (c.priority === 'blocking' ? 'var(--red)' : 'var(--ylw)'), background: 'var(--bgI)', borderRadius: '0 4px 4px 0', marginBottom: 4, fontSize: 13, color: 'var(--t3)' }}>
                        <span className="mono" style={{ fontSize: 10, fontWeight: 700, color: 'var(--t4)', marginRight: 8 }}>{groupBy === 'investor' ? c.doc : c.name}</span>
                        {c.issue}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {reportType === 'distribution-report' && (
              <div className="fade-in">
                <div style={{ fontSize: 18, fontWeight: 300, color: 'var(--t1)', marginBottom: 16 }}>{selectedPeriod} Distribution</div>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
                  {[
                    { l: 'Total', v: fmt(periodDists.reduce((s, d) => s + d.amt, 0)) },
                    { l: 'Payments', v: periodDists.length },
                    { l: 'ACH', v: periodDists.filter((d) => d.method === 'ACH').length },
                    { l: 'Wire / Check', v: periodDists.filter((d) => d.method !== 'ACH').length },
                  ].map((s) => (
                    <div key={s.l} style={{ background: 'var(--bgI)', borderRadius: 5, padding: 12 }}>
                      <div className="mono" style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--t4)', marginBottom: 4 }}>{s.l}</div>
                      <div style={{ fontSize: 18, fontWeight: 300, color: 'var(--t1)' }}>{s.v}</div>
                    </div>
                  ))}
                </div>
                {periodDists.length > 0 ? (
                  <div className="r-scroll-table">
                  <table>
                    <thead><tr>
                      {['Investor', 'Entity', 'Amount', 'Method', 'Status', 'Date'].map((h) => <th key={h} className={h === 'Amount' ? 'right' : ''}>{h}</th>)}
                    </tr></thead>
                    <tbody>
                      {periodDists.map((d) => (
                        <tr key={d.id}>
                          <td style={{ fontWeight: 500 }}>{d.name}</td>
                          <td style={{ color: 'var(--t3)', fontSize: 12 }}>{d.entity || '\u2014'}</td>
                          <td className="right" style={{ fontWeight: 700, color: 'var(--t1)' }}>{fmt(d.amt)}</td>
                          <td><span className={'badge ' + (d.method === 'ACH' ? 'badge-muted' : d.method === 'Wire' ? 'badge-blue' : 'badge-yellow')}>{d.method}</span></td>
                          <td><span className={'badge ' + (d.status === 'Sent' ? 'badge-green' : d.status === 'Prep' ? 'badge-yellow' : 'badge-muted')}>{d.status}</span></td>
                          <td className="mono" style={{ fontSize: 11, color: 'var(--t3)' }}>{d.date || '\u2014'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 40, color: 'var(--t5)' }}>No distributions for this period</div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
