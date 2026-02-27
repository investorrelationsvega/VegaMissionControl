// ═══════════════════════════════════════════════
// ALM — Proforma Budget Data
// Source: Property acquisition proforma Excel files
//
// Annual Year 1 projections extracted from:
//   Cedar City - Assisted Living Model (3).xlsx
//   Elk Ridge - Assisted Living Model.xlsx
//   Gilbert - Assisted Living Model (Tim).xlsx
//   Hearthstone - Assisted Living Model.xlsx
//   Riverton Assisted Living Model - Beehive Riverton (2).xlsx
//
// These are the underwriting targets used at acquisition.
// Compare against QuickBooks actuals to track actual vs
// proforma performance.
//
// Revenue/expense items are mapped to the same categories
// used in reportCardData.js and the QuickBooks sync script.
// ═══════════════════════════════════════════════

const PROFORMA_DATA = {
  // ── Cedar City ──────────────────────────────────
  // Acquired Aug 2025 · 20 beds
  // Source: Bank Proforma sheet, Proforma Year 1
  'Cedar City': {
    beds: 20,
    acquired: '2025-08-01',
    deal: {
      purchasePrice: 3200000,
      totalCost: 3550000,
      totalDebt: 2310000,
      totalEquity: 1240000,
      annualDebtService: 197691,
      interestRate: 0.071,
    },
    annual: {
      revenue: {
        total: 1116500,
        items: {
          'Room & Board':          1104000,  // Rental Income
          'Care Level Premiums':     0,      // Not broken out in proforma
          'Respite & Short-Term':   10000,   // Day Care + Move In Fees
          'Other Income':            2500,
        },
      },
      expenses: {
        total: 666646,
        items: {
          'Payroll & Benefits':   515000,  // Administrator ($65K) + Employees ($450K)
          'Food & Kitchen':        40000,  // Raw Food
          'Supplies & Household':  12000,  // Household Supplies ($5K) + Medical ($4.5K) + Activities ($2.5K)
          'Insurance':             21950,
          'Utilities':             23000,
          'Maintenance & Repairs': 15000,
          'Marketing':              6500,  // Advertising/Promotional
          'Admin & Office':        33196,  // Accounting ($8K) + Bank ($1.2K) + Licenses ($2.5K) + Dues ($2.5K) + Office ($1K) + Nursing ($4.5K) + Taxes ($9.7K) + Lease ($0.8K) + Ops ($1.5K) + Misc ($1.5K)
        },
      },
      noi: 449854,
    },
    // 3-year growth projections
    projections: {
      year1: { income: 1032500, expenses: 666646, noi: 365854 },
      year2: { income: 1065100, expenses: 686645, noi: 378455 },
      year3: { income: 1099018, expenses: 707245, noi: 391773 },
    },
  },

  // ── Riverton ────────────────────────────────────
  // Acquired Aug 2025 · 18 beds
  // Source: Proforma sheet, Proforma Year 1
  'Riverton': {
    beds: 18,
    acquired: '2025-08-01',
    deal: {
      purchasePrice: 2050000,
      totalCost: 2230400,
      totalDebt: 1640000,
      totalEquity: 590400,
      annualDebtService: 132796,
      interestRate: 0.06375,
    },
    annual: {
      revenue: {
        total: 876500,
        items: {
          'Room & Board':          864000,  // Rental Income
          'Care Level Premiums':     0,
          'Respite & Short-Term':   10000,  // Day Care + Move In Fees
          'Other Income':            2500,
        },
      },
      expenses: {
        total: 631670,
        items: {
          'Payroll & Benefits':   440000,  // Administrator ($55K) + Employees ($385K)
          'Food & Kitchen':        55000,  // Raw Food
          'Supplies & Household':   7750,  // Medical ($3.5K) + Activities ($0.75K) + Supplies est.
          'Insurance':             12700,
          'Utilities':             27500,
          'Maintenance & Repairs': 12400,
          'Marketing':               600,  // Advertising/Promotional
          'Admin & Office':        75720,  // Accounting ($2K) + Bank ($0.5K) + Licenses ($1.8K) + Dues ($2.1K) + Nursing ($6.7K) + Office ($1.5K) + Taxes ($19.9K) + Franchise ($43.2K) + Misc ($1.5K)
        },
      },
      noi: 244830,
    },
    projections: {
      year1: { income: 876500, expenses: 631670, noi: 244830 },
      year2: { income: 904420, expenses: 650620, noi: 253800 },
      year3: { income: 933153, expenses: 670139, noi: 263014 },
    },
  },

  // ── Elk Ridge ───────────────────────────────────
  // Acquired Oct 2025 · 29 beds
  // Source: Proforma sheet, Proforma Year 1
  'Elk Ridge': {
    beds: 29,
    acquired: '2025-10-01',
    deal: {
      purchasePrice: 4166000,
      totalCost: 4501363,
      totalDebt: 2916200,
      totalEquity: 1585163,
      annualDebtService: 223335,
      interestRate: 0.059,
    },
    annual: {
      revenue: {
        total: 1075000,
        items: {
          'Room & Board':         1075000,  // Rental Income (all-in)
          'Care Level Premiums':       0,
          'Respite & Short-Term':      0,
          'Other Income':              0,
        },
      },
      expenses: {
        total: 574800,
        items: {
          'Payroll & Benefits':  375000,  // Administrator ($40K) + Employees ($335K)
          'Food & Kitchen':       65000,  // Raw Food
          'Supplies & Household':  9800,  // Cleaning ($5K) + Medical ($2.5K) + Activities ($1.8K) + Supplies ($0.5K)
          'Insurance':            18000,
          'Utilities':            65000,
          'Maintenance & Repairs':10000,
          'Marketing':             2000,  // Advertising/Promotional
          'Admin & Office':       30000,  // Accounting ($1.5K) + Bank ($0.5K) + Licenses ($1.5K) + Dues ($0.5K) + Nursing ($6K) + Office ($1.5K) + Taxes ($16K) + Lease ($2.5K) + Misc ($0.5K)
        },
      },
      noi: 500200,
    },
    projections: {
      year1: { income: 1075000, expenses: 574800, noi: 500200 },
      year2: { income: 1107250, expenses: 592044, noi: 515206 },
      year3: { income: 1140468, expenses: 609805, noi: 530663 },
    },
  },

  // ── Hearthstone Manor ───────────────────────────
  // Acquired Oct 2025 · 35 beds
  // Source: Proforma sheet, Proforma Year 1
  'Hearthstone Manor': {
    beds: 35,
    acquired: '2025-10-01',
    deal: {
      purchasePrice: 6500000,
      totalCost: 7091500,
      totalDebt: 4550000,
      totalEquity: 2541500,
      annualDebtService: 370371,
      interestRate: 0.0655,
    },
    annual: {
      revenue: {
        total: 1462598,
        items: {
          'Room & Board':         1462598,  // Rental Income (all-in)
          'Care Level Premiums':        0,
          'Respite & Short-Term':       0,
          'Other Income':               0,
        },
      },
      expenses: {
        total: 804185,
        items: {
          'Payroll & Benefits':  537780,  // Administrator ($32.5K) + Employees ($505.3K)
          'Food & Kitchen':      110000,  // Raw Food
          'Supplies & Household':  8055,  // Medical ($3.6K) + Activities ($4.5K)
          'Insurance':            25000,
          'Utilities':            55000,
          'Maintenance & Repairs':25000,
          'Marketing':             1000,  // Advertising/Promotional
          'Admin & Office':       42350,  // Accounting ($6K) + Bank ($0.15K) + Taxes ($12K) + Office ($2.5K) + Travel ($0.15K) + Misc ($1.5K) + Reserves ($20K)
        },
      },
      noi: 658413,
    },
    projections: {
      year1: { income: 1462598, expenses: 804185, noi: 658413 },
      year2: { income: 1506476, expenses: 828311, noi: 678165 },
      year3: { income: 1551670, expenses: 853160, noi: 698510 },
    },
  },

  // ── Gilbert ─────────────────────────────────────
  // Under Contract · 24 beds (22 rooms)
  // Source: Proforma sheet, Proforma Year 1
  'Gilbert': {
    beds: 24,
    acquired: null,  // not yet acquired
    deal: {
      purchasePrice: 3700000,
      totalCost: 4065375,
      totalDebt: 2775000,
      totalEquity: 1290375,
      annualDebtService: 224844,
      interestRate: 0.065,
    },
    annual: {
      revenue: {
        total: 1627500,
        items: {
          'Room & Board':         1620000,  // Rental income equivalent
          'Care Level Premiums':        0,
          'Respite & Short-Term':    5000,  // Day Care + Move In
          'Other Income':            2500,
        },
      },
      expenses: {
        total: 1095845,
        items: {
          'Payroll & Benefits':  700000,  // Employee Expenses (no separate admin listed)
          'Food & Kitchen':       90000,  // Raw Food
          'Supplies & Household':  47000, // Household Supplies ($27K) + Medical ($15K) + Activities ($5K)
          'Insurance':             25000,
          'Utilities':             45000,
          'Maintenance & Repairs': 35000,
          'Marketing':              3500,  // Advertising/Promotional
          'Admin & Office':       150345,  // Accounting ($7K) + Bank ($0.25K) + Licenses ($2.8K) + Dues ($1.5K) + Nursing ($20K) + Office ($5K) + Franchise ($81.4K) + Placement ($15K) + Taxes ($12K) + Lease ($2.4K) + Misc ($1.5K) + Reserves ($100K - unforeseen)
        },
      },
      noi: 531655,
    },
    projections: {
      year1: { income: 1627500, expenses: 1095845, noi: 531655 },
      year2: { income: 1676325, expenses: 1128720, noi: 547605 },
      year3: { income: 1726615, expenses: 1162582, noi: 564033 },
    },
  },
};

/**
 * Get monthly proforma budget for a home (annual ÷ 12).
 * Returns same shape as reportCardData budget fields.
 */
export function getMonthlyProforma(homeName) {
  const pf = PROFORMA_DATA[homeName];
  if (!pf) return null;

  return {
    revenue: {
      total: Math.round(pf.annual.revenue.total / 12),
      items: Object.fromEntries(
        Object.entries(pf.annual.revenue.items).map(([k, v]) => [k, Math.round(v / 12)])
      ),
    },
    expenses: {
      total: Math.round(pf.annual.expenses.total / 12),
      items: Object.fromEntries(
        Object.entries(pf.annual.expenses.items).map(([k, v]) => [k, Math.round(v / 12)])
      ),
    },
    noi: Math.round(pf.annual.noi / 12),
  };
}

/**
 * Compute cumulative actuals from report card periods for a home.
 * Returns { monthsTracked, revenue, expenses, noi }.
 */
export function getCumulativeActuals(periods, homeName) {
  let monthsTracked = 0;
  let totalRevenue = 0;
  let totalExpenses = 0;

  for (const period of periods) {
    const home = (period.homes || []).find((h) => h.name === homeName);
    if (home) {
      monthsTracked++;
      totalRevenue += home.revenue.actual;
      totalExpenses += home.expenses.actual;
    }
  }

  return {
    monthsTracked,
    revenue: totalRevenue,
    expenses: totalExpenses,
    noi: totalRevenue - totalExpenses,
  };
}

/**
 * Compute proforma vs actual comparison for a home.
 * prorated = proforma annual × (monthsTracked / 12)
 */
export function getProformaComparison(periods, homeName) {
  const pf = PROFORMA_DATA[homeName];
  if (!pf) return null;

  const actuals = getCumulativeActuals(periods, homeName);
  if (actuals.monthsTracked === 0) return null;

  const fraction = actuals.monthsTracked / 12;

  const proratedRevenue = Math.round(pf.annual.revenue.total * fraction);
  const proratedExpenses = Math.round(pf.annual.expenses.total * fraction);
  const proratedNoi = Math.round(pf.annual.noi * fraction);

  // Annualized run rate
  const annualizedRevenue = Math.round(actuals.revenue / fraction);
  const annualizedExpenses = Math.round(actuals.expenses / fraction);
  const annualizedNoi = Math.round(actuals.noi / fraction);

  return {
    homeName,
    monthsTracked: actuals.monthsTracked,
    proforma: {
      annual: pf.annual,
      prorated: { revenue: proratedRevenue, expenses: proratedExpenses, noi: proratedNoi },
    },
    actual: {
      cumulative: actuals,
      annualized: { revenue: annualizedRevenue, expenses: annualizedExpenses, noi: annualizedNoi },
    },
    variance: {
      revenue: actuals.revenue - proratedRevenue,
      expenses: actuals.expenses - proratedExpenses,
      noi: actuals.noi - proratedNoi,
    },
    pctOfProforma: {
      revenue: proratedRevenue > 0 ? actuals.revenue / proratedRevenue : 0,
      expenses: proratedExpenses > 0 ? actuals.expenses / proratedExpenses : 0,
      noi: proratedNoi > 0 ? actuals.noi / proratedNoi : 0,
    },
    deal: pf.deal,
  };
}

export default PROFORMA_DATA;
