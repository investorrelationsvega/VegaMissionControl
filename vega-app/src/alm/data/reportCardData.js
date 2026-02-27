// ═══════════════════════════════════════════════
// ALM — Financial Report Card Data (Multi-Period)
// Source: QuickBooks Budget vs Actual (monthly)
//
// Structure:
//   { revenueLabels, expenseLabels, periods[] }
//   Each period: { month, year, homes[] }
//
// Sept–Oct '25: Cedar City + Riverton only
//   (acquired Aug '25)
// Oct '25+: Elk Ridge + Hearthstone added
//   (acquired Oct '25)
// Jan '26+: West Jordan (Fund I) added
//   Real QuickBooks Budget vs Actual data from Jan '26
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
  revenueLabels: REVENUE_LABELS,
  expenseLabels: EXPENSE_LABELS,

  periods: [
    // ══════════════════════════════════════════════
    // SEPTEMBER 2025  (Cedar City + Riverton only)
    // First full month after Aug '25 acquisition
    // ══════════════════════════════════════════════
    {
      month: 'September',
      year: 2025,
      homes: [
        {
          name: 'Cedar City',
          beds: 20,
          revenue: {
            actual: 72400, budget: 80000, priorMonth: null,
            items: [
              { actual: 53000, budget: 60000 },
              { actual: 12400, budget: 13000 },
              { actual: 5000,  budget: 5000 },
              { actual: 2000,  budget: 2000 },
            ],
          },
          expenses: {
            actual: 50200, budget: 48000, priorMonth: null,
            items: [
              { actual: 31000, budget: 30000 },
              { actual: 5400,  budget: 5000 },
              { actual: 3800,  budget: 3200 },
              { actual: 2800,  budget: 2800 },
              { actual: 3600,  budget: 3500 },
              { actual: 2000,  budget: 2000 },
              { actual: 900,   budget: 1000 },
              { actual: 700,   budget: 500 },
            ],
          },
          occupancy: { actual: 78, budget: 85, priorMonth: null },
          noi:       { actual: 22200, budget: 32000, priorMonth: null },
        },
        {
          name: 'Riverton',
          beds: 18,
          revenue: {
            actual: 48000, budget: 62000, priorMonth: null,
            items: [
              { actual: 34000, budget: 46000 },
              { actual: 8500,  budget: 10000 },
              { actual: 3500,  budget: 4000 },
              { actual: 2000,  budget: 2000 },
            ],
          },
          expenses: {
            actual: 44500, budget: 42000, priorMonth: null,
            items: [
              { actual: 28000, budget: 26000 },
              { actual: 4300,  budget: 4000 },
              { actual: 2600,  budget: 2500 },
              { actual: 2400,  budget: 2400 },
              { actual: 3300,  budget: 3200 },
              { actual: 2200,  budget: 2000 },
              { actual: 1000,  budget: 1000 },
              { actual: 700,   budget: 900 },
            ],
          },
          occupancy: { actual: 65, budget: 85, priorMonth: null },
          noi:       { actual: 3500, budget: 20000, priorMonth: null },
        },
      ],
    },

    // ══════════════════════════════════════════════
    // OCTOBER 2025  (all 4 homes)
    // Elk Ridge + Hearthstone acquired this month
    // ══════════════════════════════════════════════
    {
      month: 'October',
      year: 2025,
      homes: [
        {
          name: 'Cedar City',
          beds: 20,
          revenue: {
            actual: 76000, budget: 80000, priorMonth: 72400,
            items: [
              { actual: 55500, budget: 60000 },
              { actual: 13000, budget: 13000 },
              { actual: 5200,  budget: 5000 },
              { actual: 2300,  budget: 2000 },
            ],
          },
          expenses: {
            actual: 49100, budget: 48000, priorMonth: 50200,
            items: [
              { actual: 30200, budget: 30000 },
              { actual: 5300,  budget: 5000 },
              { actual: 3500,  budget: 3200 },
              { actual: 2800,  budget: 2800 },
              { actual: 3500,  budget: 3500 },
              { actual: 2100,  budget: 2000 },
              { actual: 900,   budget: 1000 },
              { actual: 800,   budget: 500 },
            ],
          },
          occupancy: { actual: 82, budget: 85, priorMonth: 78 },
          noi:       { actual: 26900, budget: 32000, priorMonth: 22200 },
        },
        {
          name: 'Riverton',
          beds: 18,
          revenue: {
            actual: 50200, budget: 62000, priorMonth: 48000,
            items: [
              { actual: 36000, budget: 46000 },
              { actual: 8800,  budget: 10000 },
              { actual: 3600,  budget: 4000 },
              { actual: 1800,  budget: 2000 },
            ],
          },
          expenses: {
            actual: 43800, budget: 42000, priorMonth: 44500,
            items: [
              { actual: 27500, budget: 26000 },
              { actual: 4200,  budget: 4000 },
              { actual: 2500,  budget: 2500 },
              { actual: 2400,  budget: 2400 },
              { actual: 3200,  budget: 3200 },
              { actual: 2300,  budget: 2000 },
              { actual: 900,   budget: 1000 },
              { actual: 800,   budget: 900 },
            ],
          },
          occupancy: { actual: 68, budget: 85, priorMonth: 65 },
          noi:       { actual: 6400, budget: 20000, priorMonth: 3500 },
        },
        {
          name: 'Elk Ridge',
          beds: 29,
          revenue: {
            actual: 70000, budget: 78000, priorMonth: null,
            items: [
              { actual: 51500, budget: 58000 },
              { actual: 12000, budget: 13000 },
              { actual: 4200,  budget: 4500 },
              { actual: 2300,  budget: 2500 },
            ],
          },
          expenses: {
            actual: 44500, budget: 43000, priorMonth: null,
            items: [
              { actual: 27500, budget: 27000 },
              { actual: 5800,  budget: 5500 },
              { actual: 3200,  budget: 3000 },
              { actual: 2000,  budget: 2000 },
              { actual: 3000,  budget: 2800 },
              { actual: 1500,  budget: 1500 },
              { actual: 700,   budget: 500 },
              { actual: 800,   budget: 700 },
            ],
          },
          occupancy: { actual: 75, budget: 85, priorMonth: null },
          noi:       { actual: 25500, budget: 35000, priorMonth: null },
        },
        {
          name: 'Hearthstone Manor',
          beds: 35,
          revenue: {
            actual: 100000, budget: 110000, priorMonth: null,
            items: [
              { actual: 74000, budget: 82000 },
              { actual: 16000, budget: 18000 },
              { actual: 6500,  budget: 6500 },
              { actual: 3500,  budget: 3500 },
            ],
          },
          expenses: {
            actual: 54000, budget: 52000, priorMonth: null,
            items: [
              { actual: 33000, budget: 32000 },
              { actual: 7200,  budget: 7000 },
              { actual: 3800,  budget: 3500 },
              { actual: 2800,  budget: 2800 },
              { actual: 3400,  budget: 3200 },
              { actual: 2200,  budget: 2000 },
              { actual: 600,   budget: 500 },
              { actual: 1000,  budget: 1000 },
            ],
          },
          occupancy: { actual: 83, budget: 90, priorMonth: null },
          noi:       { actual: 46000, budget: 58000, priorMonth: null },
        },
      ],
    },

    // ══════════════════════════════════════════════
    // NOVEMBER 2025
    // ══════════════════════════════════════════════
    {
      month: 'November',
      year: 2025,
      homes: [
        {
          name: 'Cedar City',
          beds: 20,
          revenue: {
            actual: 78500, budget: 80000, priorMonth: 76000,
            items: [
              { actual: 57500, budget: 60000 },
              { actual: 13500, budget: 13000 },
              { actual: 5300,  budget: 5000 },
              { actual: 2200,  budget: 2000 },
            ],
          },
          expenses: {
            actual: 48500, budget: 48000, priorMonth: 49100,
            items: [
              { actual: 29800, budget: 30000 },
              { actual: 5200,  budget: 5000 },
              { actual: 3400,  budget: 3200 },
              { actual: 2800,  budget: 2800 },
              { actual: 3500,  budget: 3500 },
              { actual: 2100,  budget: 2000 },
              { actual: 850,   budget: 1000 },
              { actual: 850,   budget: 500 },
            ],
          },
          occupancy: { actual: 84, budget: 85, priorMonth: 82 },
          noi:       { actual: 30000, budget: 32000, priorMonth: 26900 },
        },
        {
          name: 'Riverton',
          beds: 18,
          revenue: {
            actual: 53000, budget: 62000, priorMonth: 50200,
            items: [
              { actual: 38000, budget: 46000 },
              { actual: 9200,  budget: 10000 },
              { actual: 3800,  budget: 4000 },
              { actual: 2000,  budget: 2000 },
            ],
          },
          expenses: {
            actual: 43200, budget: 42000, priorMonth: 43800,
            items: [
              { actual: 27200, budget: 26000 },
              { actual: 4100,  budget: 4000 },
              { actual: 2500,  budget: 2500 },
              { actual: 2400,  budget: 2400 },
              { actual: 3200,  budget: 3200 },
              { actual: 2300,  budget: 2000 },
              { actual: 800,   budget: 1000 },
              { actual: 700,   budget: 900 },
            ],
          },
          occupancy: { actual: 71, budget: 85, priorMonth: 68 },
          noi:       { actual: 9800, budget: 20000, priorMonth: 6400 },
        },
        {
          name: 'Elk Ridge',
          beds: 29,
          revenue: {
            actual: 75000, budget: 78000, priorMonth: 70000,
            items: [
              { actual: 56000, budget: 58000 },
              { actual: 12500, budget: 13000 },
              { actual: 4200,  budget: 4500 },
              { actual: 2300,  budget: 2500 },
            ],
          },
          expenses: {
            actual: 43000, budget: 43000, priorMonth: 44500,
            items: [
              { actual: 26500, budget: 27000 },
              { actual: 5600,  budget: 5500 },
              { actual: 3000,  budget: 3000 },
              { actual: 2000,  budget: 2000 },
              { actual: 2900,  budget: 2800 },
              { actual: 1500,  budget: 1500 },
              { actual: 600,   budget: 500 },
              { actual: 900,   budget: 700 },
            ],
          },
          occupancy: { actual: 80, budget: 85, priorMonth: 75 },
          noi:       { actual: 32000, budget: 35000, priorMonth: 25500 },
        },
        {
          name: 'Hearthstone Manor',
          beds: 35,
          revenue: {
            actual: 108000, budget: 110000, priorMonth: 100000,
            items: [
              { actual: 80000, budget: 82000 },
              { actual: 17500, budget: 18000 },
              { actual: 6800,  budget: 6500 },
              { actual: 3700,  budget: 3500 },
            ],
          },
          expenses: {
            actual: 52000, budget: 52000, priorMonth: 54000,
            items: [
              { actual: 31800, budget: 32000 },
              { actual: 7000,  budget: 7000 },
              { actual: 3600,  budget: 3500 },
              { actual: 2800,  budget: 2800 },
              { actual: 3200,  budget: 3200 },
              { actual: 2000,  budget: 2000 },
              { actual: 500,   budget: 500 },
              { actual: 1100,  budget: 1000 },
            ],
          },
          occupancy: { actual: 86, budget: 90, priorMonth: 83 },
          noi:       { actual: 56000, budget: 58000, priorMonth: 46000 },
        },
      ],
    },

    // ══════════════════════════════════════════════
    // DECEMBER 2025
    // ══════════════════════════════════════════════
    {
      month: 'December',
      year: 2025,
      homes: [
        {
          name: 'Cedar City',
          beds: 20,
          revenue: {
            actual: 80500, budget: 80000, priorMonth: 78500,
            items: [
              { actual: 59500, budget: 60000 },
              { actual: 13500, budget: 13000 },
              { actual: 5400,  budget: 5000 },
              { actual: 2100,  budget: 2000 },
            ],
          },
          expenses: {
            actual: 48200, budget: 48000, priorMonth: 48500,
            items: [
              { actual: 29500, budget: 30000 },
              { actual: 5200,  budget: 5000 },
              { actual: 3300,  budget: 3200 },
              { actual: 2800,  budget: 2800 },
              { actual: 3500,  budget: 3500 },
              { actual: 2200,  budget: 2000 },
              { actual: 800,   budget: 1000 },
              { actual: 900,   budget: 500 },
            ],
          },
          occupancy: { actual: 85, budget: 85, priorMonth: 84 },
          noi:       { actual: 32300, budget: 32000, priorMonth: 30000 },
        },
        {
          name: 'Riverton',
          beds: 18,
          revenue: {
            actual: 56200, budget: 62000, priorMonth: 53000,
            items: [
              { actual: 40500, budget: 46000 },
              { actual: 9500,  budget: 10000 },
              { actual: 4000,  budget: 4000 },
              { actual: 2200,  budget: 2000 },
            ],
          },
          expenses: {
            actual: 42800, budget: 42000, priorMonth: 43200,
            items: [
              { actual: 26800, budget: 26000 },
              { actual: 4100,  budget: 4000 },
              { actual: 2500,  budget: 2500 },
              { actual: 2400,  budget: 2400 },
              { actual: 3200,  budget: 3200 },
              { actual: 2300,  budget: 2000 },
              { actual: 800,   budget: 1000 },
              { actual: 700,   budget: 900 },
            ],
          },
          occupancy: { actual: 74, budget: 85, priorMonth: 71 },
          noi:       { actual: 13400, budget: 20000, priorMonth: 9800 },
        },
        {
          name: 'Elk Ridge',
          beds: 29,
          revenue: {
            actual: 78400, budget: 78000, priorMonth: 75000,
            items: [
              { actual: 58500, budget: 58000 },
              { actual: 13000, budget: 13000 },
              { actual: 4500,  budget: 4500 },
              { actual: 2400,  budget: 2500 },
            ],
          },
          expenses: {
            actual: 42500, budget: 43000, priorMonth: 43000,
            items: [
              { actual: 26000, budget: 27000 },
              { actual: 5700,  budget: 5500 },
              { actual: 2900,  budget: 3000 },
              { actual: 2000,  budget: 2000 },
              { actual: 2800,  budget: 2800 },
              { actual: 1600,  budget: 1500 },
              { actual: 500,   budget: 500 },
              { actual: 1000,  budget: 700 },
            ],
          },
          occupancy: { actual: 83, budget: 85, priorMonth: 80 },
          noi:       { actual: 35900, budget: 35000, priorMonth: 32000 },
        },
        {
          name: 'Hearthstone Manor',
          beds: 35,
          revenue: {
            actual: 112500, budget: 110000, priorMonth: 108000,
            items: [
              { actual: 83500, budget: 82000 },
              { actual: 18500, budget: 18000 },
              { actual: 6800,  budget: 6500 },
              { actual: 3700,  budget: 3500 },
            ],
          },
          expenses: {
            actual: 51200, budget: 52000, priorMonth: 52000,
            items: [
              { actual: 31200, budget: 32000 },
              { actual: 6800,  budget: 7000 },
              { actual: 3500,  budget: 3500 },
              { actual: 2800,  budget: 2800 },
              { actual: 3100,  budget: 3200 },
              { actual: 2000,  budget: 2000 },
              { actual: 500,   budget: 500 },
              { actual: 1300,  budget: 1000 },
            ],
          },
          occupancy: { actual: 89, budget: 90, priorMonth: 86 },
          noi:       { actual: 61300, budget: 58000, priorMonth: 56000 },
        },
      ],
    },

    // ══════════════════════════════════════════════
    // JANUARY 2026  (real QuickBooks data)
    // Source: Budget vs Actuals FY26 P&L reports
    // ══════════════════════════════════════════════
    {
      month: 'January',
      year: 2026,
      homes: [
        {
          name: 'Cedar City',
          beds: 20,
          revenue: {
            actual: 82840, budget: 93042, priorMonth: 80500,
            items: [
              { actual: 82840, budget: 92000 },
              { actual: 0,     budget: 0 },
              { actual: 0,     budget: 833 },
              { actual: 0,     budget: 208 },
            ],
          },
          expenses: {
            actual: 59670, budget: 55488, priorMonth: 48200,
            items: [
              { actual: 42659, budget: 43417 },
              { actual: 3107,  budget: 3333 },
              { actual: 1000,  budget: 1083 },
              { actual: 709,   budget: 1829 },
              { actual: 1288,  budget: 1917 },
              { actual: 1492,  budget: 1250 },
              { actual: 523,   budget: 542 },
              { actual: 9014,  budget: 2784 },
            ],
          },
          occupancy: { actual: 83, budget: 92, priorMonth: 85 },
          noi:       { actual: 23170, budget: 37488, priorMonth: 32300 },
        },
        {
          name: 'Riverton',
          beds: 18,
          revenue: {
            actual: 57326, budget: 73042, priorMonth: 56200,
            items: [
              { actual: 57326, budget: 72000 },
              { actual: 0,     budget: 0 },
              { actual: 0,     budget: 833 },
              { actual: 0,     budget: 208 },
            ],
          },
          expenses: {
            actual: 50934, budget: 50981, priorMonth: 42800,
            items: [
              { actual: 36732, budget: 37227 },
              { actual: 1761,  budget: 4583 },
              { actual: 296,   budget: 479 },
              { actual: 1163,  budget: 1058 },
              { actual: 3544,  budget: 2292 },
              { actual: 602,   budget: 1033 },
              { actual: 0,     budget: 50 },
              { actual: 6836,  budget: 7858 },
            ],
          },
          occupancy: { actual: 71, budget: 90, priorMonth: 74 },
          noi:       { actual: 6392, budget: 22061, priorMonth: 13400 },
        },
        {
          name: 'Elk Ridge',
          beds: 29,
          revenue: {
            actual: 80809, budget: 89583, priorMonth: 78400,
            items: [
              { actual: 80809, budget: 89583 },
              { actual: 0,     budget: 0 },
              { actual: 0,     budget: 0 },
              { actual: 0,     budget: 0 },
            ],
          },
          expenses: {
            actual: 62098, budget: 47692, priorMonth: 42500,
            items: [
              { actual: 42317, budget: 32167 },
              { actual: 5526,  budget: 5417 },
              { actual: 899,   budget: 483 },
              { actual: 1497,  budget: 1500 },
              { actual: 3232,  budget: 5417 },
              { actual: 225,   budget: 833 },
              { actual: 0,     budget: 167 },
              { actual: 11513, budget: 625 },
            ],
          },
          occupancy: { actual: 90, budget: 100, priorMonth: 83 },
          noi:       { actual: 18711, budget: 41683, priorMonth: 35900 },
        },
        {
          name: 'Hearthstone Manor',
          beds: 35,
          revenue: {
            actual: 119600, budget: 121883, priorMonth: 112500,
            items: [
              { actual: 119600, budget: 121883 },
              { actual: 0,      budget: 0 },
              { actual: 0,      budget: 0 },
              { actual: 0,      budget: 0 },
            ],
          },
          expenses: {
            actual: 75678, budget: 67015, priorMonth: 51200,
            items: [
              { actual: 54899, budget: 44815 },
              { actual: 213,   budget: 9167 },
              { actual: 426,   budget: 880 },
              { actual: 1890,  budget: 2083 },
              { actual: 3899,  budget: 4583 },
              { actual: 7145,  budget: 2083 },
              { actual: 0,     budget: 83 },
              { actual: 7206,  budget: 3308 },
            ],
          },
          occupancy: { actual: 98, budget: 100, priorMonth: 89 },
          noi:       { actual: 43922, budget: 54868, priorMonth: 61300 },
        },
        {
          name: 'West Jordan',
          beds: 16,
          revenue: {
            actual: 123353, budget: 207000, priorMonth: null,
            items: [
              { actual: 120853, budget: 207000 },
              { actual: 0,      budget: 0 },
              { actual: 1500,   budget: 0 },
              { actual: 1000,   budget: 0 },
            ],
          },
          expenses: {
            actual: 87060, budget: 133188, priorMonth: null,
            items: [
              { actual: 59589, budget: 67700 },
              { actual: 12910, budget: 13039 },
              { actual: 437,   budget: 1150 },
              { actual: 4886,  budget: 2951 },
              { actual: 6364,  budget: 6000 },
              { actual: 322,   budget: 2400 },
              { actual: 0,     budget: 150 },
              { actual: 2525,  budget: 39598 },
            ],
          },
          occupancy: { actual: 58, budget: 100, priorMonth: null },
          noi:       { actual: 36293, budget: 73112, priorMonth: null },
        },
      ],
    },

  ],
};

export default REPORT_CARD_DATA;
