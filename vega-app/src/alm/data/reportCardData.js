// ═══════════════════════════════════════════════
// ALM — Financial Report Card Data
// Source: QuickBooks Budget vs Actual (monthly)
// Update this file each month from the emailed
// QuickBooks report. Future: automate via parser.
//
// Revenue line items = Room & Board, Care Premiums,
// Respite stays, Other. Expense items match the
// QuickBooks chart of accounts.
// ═══════════════════════════════════════════════

const REVENUE_LABELS = [
  'Room & Board',
  'Care Level Premiums',
  'Respite & Short-Term',
  'Other Income',
];

const EXPENSE_LABELS = [
  'Payroll & Benefits',
  'Food & Kitchen',
  'Supplies & Household',
  'Insurance',
  'Utilities',
  'Maintenance & Repairs',
  'Marketing',
  'Admin & Office',
];

const REPORT_CARD_DATA = {
  month: 'January',
  year: 2026,

  revenueLabels: REVENUE_LABELS,
  expenseLabels: EXPENSE_LABELS,

  homes: [
    // ── Cedar City (20 beds) ── Strong month, solid across the board
    {
      name: 'Cedar City',
      beds: 20,
      revenue: {
        actual: 84200, budget: 80000, priorMonth: 80500,
        items: [
          { actual: 62000, budget: 60000 },
          { actual: 14200, budget: 13000 },
          { actual: 5800,  budget: 5000 },
          { actual: 2200,  budget: 2000 },
        ],
      },
      expenses: {
        actual: 46800, budget: 48000, priorMonth: 48200,
        items: [
          { actual: 28500, budget: 30000 },
          { actual: 5200,  budget: 5000 },
          { actual: 3100,  budget: 3200 },
          { actual: 2800,  budget: 2800 },
          { actual: 3400,  budget: 3500 },
          { actual: 2100,  budget: 2000 },
          { actual: 800,   budget: 1000 },
          { actual: 900,   budget: 500 },
        ],
      },
      occupancy: { actual: 90, budget: 85, priorMonth: 85 },
      noi:       { actual: 37400, budget: 32000, priorMonth: 32300 },
    },

    // ── Riverton (18 beds) ── Struggling: low occupancy, tight margins
    {
      name: 'Riverton',
      beds: 18,
      revenue: {
        actual: 54500, budget: 62000, priorMonth: 56200,
        items: [
          { actual: 39000, budget: 46000 },
          { actual: 9500,  budget: 10000 },
          { actual: 4000,  budget: 4000 },
          { actual: 2000,  budget: 2000 },
        ],
      },
      expenses: {
        actual: 43200, budget: 42000, priorMonth: 42800,
        items: [
          { actual: 27000, budget: 26000 },
          { actual: 4200,  budget: 4000 },
          { actual: 2500,  budget: 2500 },
          { actual: 2400,  budget: 2400 },
          { actual: 3200,  budget: 3200 },
          { actual: 2400,  budget: 2000 },
          { actual: 800,   budget: 1000 },
          { actual: 700,   budget: 900 },
        ],
      },
      occupancy: { actual: 72, budget: 85, priorMonth: 74 },
      noi:       { actual: 11300, budget: 20000, priorMonth: 13400 },
    },

    // ── Elk Ridge (29 beds) ── Solid: efficient ops, good cost control
    {
      name: 'Elk Ridge',
      beds: 29,
      revenue: {
        actual: 81500, budget: 78000, priorMonth: 78400,
        items: [
          { actual: 61000, budget: 58000 },
          { actual: 13500, budget: 13000 },
          { actual: 4500,  budget: 4500 },
          { actual: 2500,  budget: 2500 },
        ],
      },
      expenses: {
        actual: 41700, budget: 43000, priorMonth: 42500,
        items: [
          { actual: 25500, budget: 27000 },
          { actual: 5800,  budget: 5500 },
          { actual: 2800,  budget: 3000 },
          { actual: 2000,  budget: 2000 },
          { actual: 2800,  budget: 2800 },
          { actual: 1500,  budget: 1500 },
          { actual: 500,   budget: 500 },
          { actual: 800,   budget: 700 },
        ],
      },
      occupancy: { actual: 86, budget: 85, priorMonth: 83 },
      noi:       { actual: 39800, budget: 35000, priorMonth: 35900 },
    },

    // ── Hearthstone Manor (35 beds) ── Star: highest margin, biggest NOI
    {
      name: 'Hearthstone Manor',
      beds: 35,
      revenue: {
        actual: 117800, budget: 110000, priorMonth: 112500,
        items: [
          { actual: 87000, budget: 82000 },
          { actual: 19800, budget: 18000 },
          { actual: 7000,  budget: 6500 },
          { actual: 4000,  budget: 3500 },
        ],
      },
      expenses: {
        actual: 49900, budget: 52000, priorMonth: 51200,
        items: [
          { actual: 30500, budget: 32000 },
          { actual: 6800,  budget: 7000 },
          { actual: 3500,  budget: 3500 },
          { actual: 2800,  budget: 2800 },
          { actual: 3000,  budget: 3200 },
          { actual: 1800,  budget: 2000 },
          { actual: 500,   budget: 500 },
          { actual: 1000,  budget: 1000 },
        ],
      },
      occupancy: { actual: 91, budget: 90, priorMonth: 89 },
      noi:       { actual: 67900, budget: 58000, priorMonth: 61300 },
    },
  ],
};

export default REPORT_CARD_DATA;
