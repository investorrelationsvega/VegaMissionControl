// ═══════════════════════════════════════════════
// ALM — Financial Report Card Data
// Source: QuickBooks Budget vs Actual (monthly)
// Update this file each month from the emailed
// QuickBooks report. Future: automate via parser.
// ═══════════════════════════════════════════════

const REPORT_CARD_DATA = {
  month: 'January',
  year: 2026,
  home: 'Cedar City',
  beds: 20,

  // Each category: actual vs budget, plus prior month for trend
  categories: [
    {
      key: 'revenue',
      label: 'Revenue',
      actual: 84200,
      budget: 80000,
      priorMonth: 80500,
      inverse: false,   // higher is better
      isCurrency: true,
    },
    {
      key: 'expenses',
      label: 'Expenses',
      actual: 46800,
      budget: 48000,
      priorMonth: 48200,
      inverse: true,    // lower is better
      isCurrency: true,
    },
    {
      key: 'occupancy',
      label: 'Occupancy',
      actual: 90,
      budget: 85,
      priorMonth: 85,
      inverse: false,
      isCurrency: false,
    },
    {
      key: 'noi',
      label: 'Net Operating Income',
      actual: 37400,
      budget: 32000,
      priorMonth: 32300,
      inverse: false,
      isCurrency: true,
    },
  ],
};

export default REPORT_CARD_DATA;
