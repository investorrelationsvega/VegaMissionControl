// ═══════════════════════════════════════════════════════════════════
// ALM — QuickBooks Auto-Sync (Google Apps Script)
//
// Watches Gmail for QuickBooks Budget vs Actual reports (Excel),
// parses the data, and writes it to the ALM_Financial tab in the
// Vega Google Sheet. The ALM dashboard reads from that tab.
//
// ── DATA FORMAT ─────────────────────────────────────────────────
//
// The script stores a multi-period JSON blob in the sheet:
//   { revenueLabels, expenseLabels, periods: [
//       { month: "January", year: 2026, homes: [...] },
//       { month: "February", year: 2026, homes: [...] },
//     ]
//   }
//
// Each sync merges new data into the existing periods. Historical
// months are preserved — nothing is overwritten.
//
// ── SETUP (one time) ──────────────────────────────────────────────
//
// 1. Go to https://script.google.com → New Project
// 2. Paste this entire file into Code.gs
// 3. Click the "+" next to "Services" in the left panel
//    → Add "Google Sheets API" (v4)
//    → Add "Google Drive API" (v2)
// 4. Update the CONFIG section below with your values
// 5. Run the function: initialSetup()
//    (This creates Gmail label + daily trigger)
// 6. Authorize the permissions when prompted
//
// To verify everything works WITHOUT waiting for a real email:
//   Run writeSampleData() — it writes one month of test data
//   to the sheet so you can confirm the dashboard picks it up.
//   Then run clearSampleData() to remove it when done.
//
// ── HOW IT WORKS ──────────────────────────────────────────────────
//
// 1. Searches Gmail for emails matching GMAIL_QUERY
// 2. For each new (unlabeled) email with an .xlsx attachment:
//    a. Downloads the Excel file
//    b. Converts it to a temporary Google Sheet via Drive API
//    c. Parses the Budget vs Actual data
//    d. Maps line items to the dashboard categories
//    e. Merges into the multi-period JSON in the sheet
//    f. Labels the email as "ALM-Synced"
//    g. Deletes the temp sheet
//
// ═══════════════════════════════════════════════════════════════════


// ── CONFIG (customize these) ─────────────────────────────────────

var CONFIG = {
  // Your Vega Google Sheet ID (from the URL)
  SPREADSHEET_ID: '1cRfPG_KuXPR4dmbDbU4xwSwePQDLHRMBFyFSJn2xt7o',

  // Tab name for financial data
  TAB_NAME: 'ALM_Financial',

  // Gmail search query to find QuickBooks reports
  // Adjust the "from:" address to match your QuickBooks sender
  GMAIL_QUERY: 'from:quickbooks subject:"budget vs actual" has:attachment -label:ALM-Synced',

  // Gmail label to mark processed emails
  LABEL_NAME: 'ALM-Synced',

  // Map home names as they appear in your QuickBooks reports
  // Key = what appears in the email subject or filename (case-insensitive)
  // Value = canonical name used in the dashboard
  HOME_NAMES: {
    'cedar city':        'Cedar City',
    'riverton':          'Riverton',
    'elk ridge':         'Elk Ridge',
    'hearthstone':       'Hearthstone Manor',
    'hearthstone manor': 'Hearthstone Manor',
  },

  // Bed count per home
  HOME_BEDS: {
    'Cedar City':        20,
    'Riverton':          18,
    'Elk Ridge':         29,
    'Hearthstone Manor': 35,
  },

  // Occupancy targets (QuickBooks doesn't track this)
  OCCUPANCY_TARGETS: {
    'Cedar City':        85,
    'Riverton':          85,
    'Elk Ridge':         85,
    'Hearthstone Manor': 90,
  },

  // ── QuickBooks Report Mapping ──────────────────────────────
  // Map your QuickBooks account names to dashboard categories.
  // Matched case-insensitively against the Excel row labels.

  REVENUE_ACCOUNTS: [
    { match: /room\s*(&|and)\s*board/i,     label: 'Room & Board' },
    { match: /care\s*(level)?\s*premium/i,   label: 'Care Level Premiums' },
    { match: /respite|short[- ]term/i,       label: 'Respite & Short-Term' },
    { match: /other\s*income|misc/i,         label: 'Other Income' },
  ],

  EXPENSE_ACCOUNTS: [
    { match: /payroll|wages|salary|benefit/i,     label: 'Payroll & Benefits' },
    { match: /food|kitchen|meal|grocery/i,        label: 'Food & Kitchen' },
    { match: /supply|supplies|household/i,        label: 'Supplies & Household' },
    { match: /insurance/i,                        label: 'Insurance' },
    { match: /utilit/i,                           label: 'Utilities' },
    { match: /maintenance|repair|maint/i,         label: 'Maintenance & Repairs' },
    { match: /market|advertis/i,                  label: 'Marketing' },
    { match: /admin|office|postage|software/i,    label: 'Admin & Office' },
  ],
};


// ═══════════════════════════════════════════════════════════════════
// SETUP — Run once
// ═══════════════════════════════════════════════════════════════════

function initialSetup() {
  // Create the Gmail label if it doesn't exist
  var label = GmailApp.getUserLabelByName(CONFIG.LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(CONFIG.LABEL_NAME);
    Logger.log('Created Gmail label: ' + CONFIG.LABEL_NAME);
  }

  // Ensure the ALM_Financial tab exists
  ensureTab_();

  // Create a daily trigger (runs every morning at 7 AM)
  var triggers = ScriptApp.getProjectTriggers();
  var hasSync = triggers.some(function(t) { return t.getHandlerFunction() === 'syncQuickBooksReports'; });
  if (!hasSync) {
    ScriptApp.newTrigger('syncQuickBooksReports')
      .timeBased()
      .everyDays(1)
      .atHour(7)
      .create();
    Logger.log('Created daily trigger for syncQuickBooksReports at 7 AM');
  }

  Logger.log('');
  Logger.log('=== Setup complete! ===');
  Logger.log('The script will check for new reports every day at 7 AM.');
  Logger.log('');
  Logger.log('NEXT STEPS:');
  Logger.log('1. Run writeSampleData() to test the dashboard connection');
  Logger.log('2. Open the ALM dashboard and verify you see "February 2026" data');
  Logger.log('3. Run clearSampleData() to remove the test data');
  Logger.log('4. Forward a real QuickBooks report to yourself to test end-to-end');
}


// ═══════════════════════════════════════════════════════════════════
// MAIN SYNC — Runs on schedule (or manually)
// ═══════════════════════════════════════════════════════════════════

function syncQuickBooksReports() {
  Logger.log('Starting QuickBooks sync...');

  var label = GmailApp.getUserLabelByName(CONFIG.LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(CONFIG.LABEL_NAME);
  }

  // Search for unprocessed QuickBooks emails
  var threads = GmailApp.search(CONFIG.GMAIL_QUERY, 0, 20);
  Logger.log('Found ' + threads.length + ' unprocessed email(s)');

  if (threads.length === 0) {
    Logger.log('Nothing to sync.');
    return;
  }

  // Load existing multi-period data from the sheet
  var existing = loadExistingData_();
  var allPeriods = (existing && existing.periods) ? existing.periods : [];

  var processed = 0;
  var errors = [];

  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();

    for (var m = 0; m < messages.length; m++) {
      var msg = messages[m];
      var attachments = msg.getAttachments();

      for (var a = 0; a < attachments.length; a++) {
        var att = attachments[a];
        var name = att.getName().toLowerCase();

        // Only process Excel files
        if (!name.endsWith('.xlsx') && !name.endsWith('.xls')) continue;

        Logger.log('Processing: ' + att.getName() + ' (from: ' + msg.getSubject() + ')');

        try {
          // Detect which home this report is for
          var homeName = detectHomeName_(msg.getSubject(), att.getName());
          if (!homeName) {
            var errMsg = 'Could not determine home name from subject: "' + msg.getSubject() + '", file: "' + att.getName() + '"';
            Logger.log(errMsg);
            errors.push(errMsg);
            continue;
          }

          // Parse the Excel attachment
          var parsed = parseExcelReport_(att.copyBlob());
          if (!parsed) {
            var errMsg2 = 'Failed to parse Excel report for ' + homeName;
            Logger.log(errMsg2);
            errors.push(errMsg2);
            continue;
          }

          // Detect month/year from the report or email date
          var reportDate = parsed.reportDate || msg.getDate();
          var monthName = getMonthName_(reportDate);
          var year = reportDate.getFullYear();

          // Find prior month's data for this home (for priorMonth values)
          var priorHome = findPriorMonthHome_(allPeriods, monthName, year, homeName);

          // Build the home data object
          var homeData = buildHomeData_(homeName, parsed, priorHome);

          // Merge into the correct period
          mergePeriodHome_(allPeriods, monthName, year, homeData);

          processed++;
          Logger.log('OK: ' + homeName + ' ' + monthName + ' ' + year +
                     ' — Revenue $' + parsed.revenueTotal.toLocaleString() +
                     ', Expenses $' + parsed.expenseTotal.toLocaleString());

        } catch (err) {
          Logger.log('Error: ' + err.message);
          errors.push(att.getName() + ': ' + err.message);
        }
      }
    }

    // Mark thread as processed
    threads[t].addLabel(label);
  }

  if (processed === 0) {
    Logger.log('No reports were successfully parsed.');
    if (errors.length > 0) {
      Logger.log('Errors encountered:');
      errors.forEach(function(e) { Logger.log('  - ' + e); });
    }
    return;
  }

  // Sort periods chronologically
  allPeriods.sort(function(a, b) {
    var da = new Date(a.year, getMonthIndex_(a.month));
    var db = new Date(b.year, getMonthIndex_(b.month));
    return da - db;
  });

  // Build the full data structure
  var revenueLabels = CONFIG.REVENUE_ACCOUNTS.map(function(a) { return a.label; });
  var expenseLabels = CONFIG.EXPENSE_ACCOUNTS.map(function(a) { return a.label; });

  var reportCardData = {
    revenueLabels: revenueLabels,
    expenseLabels: expenseLabels,
    periods: allPeriods,
  };

  // Write to sheet
  writeToSheet_(reportCardData);

  Logger.log('');
  Logger.log('Sync complete! Processed ' + processed + ' report(s).');
  Logger.log('Total periods in sheet: ' + allPeriods.length);
  if (errors.length > 0) {
    Logger.log(errors.length + ' error(s) — check logs above.');
  }
}


// ═══════════════════════════════════════════════════════════════════
// TEST FUNCTIONS — For verifying the pipeline
// ═══════════════════════════════════════════════════════════════════

/**
 * Write sample data to the ALM_Financial tab.
 *
 * Run this to verify the dashboard reads from the sheet.
 * It writes one month (Feb 2026) with all four homes.
 * This does NOT require Gmail access — just the sheet.
 */
function writeSampleData() {
  ensureTab_();

  var sampleData = {
    revenueLabels: ['Room & Board', 'Care Level Premiums', 'Respite & Short-Term', 'Other Income'],
    expenseLabels: ['Payroll & Benefits', 'Food & Kitchen', 'Supplies & Household', 'Insurance', 'Utilities', 'Maintenance & Repairs', 'Marketing', 'Admin & Office'],
    periods: [
      {
        month: 'February',
        year: 2026,
        homes: [
          {
            name: 'Cedar City',
            beds: 20,
            revenue:   { actual: 82100, budget: 80000, priorMonth: 78400, items: [{ actual: 62000, budget: 60000 }, { actual: 14100, budget: 14000 }, { actual: 4500, budget: 4500 }, { actual: 1500, budget: 1500 }] },
            expenses:  { actual: 46200, budget: 48000, priorMonth: 45100, items: [{ actual: 28500, budget: 30000 }, { actual: 5200, budget: 5500 }, { actual: 3100, budget: 3000 }, { actual: 2800, budget: 2800 }, { actual: 2400, budget: 2400 }, { actual: 1800, budget: 2000 }, { actual: 1200, budget: 1300 }, { actual: 1200, budget: 1000 }] },
            occupancy: { actual: 87, budget: 85, priorMonth: 84 },
            noi:       { actual: 35900, budget: 32000, priorMonth: 33300 },
          },
          {
            name: 'Riverton',
            beds: 18,
            revenue:   { actual: 63500, budget: 65000, priorMonth: 61800, items: [{ actual: 48000, budget: 50000 }, { actual: 10500, budget: 10000 }, { actual: 3500, budget: 3500 }, { actual: 1500, budget: 1500 }] },
            expenses:  { actual: 42800, budget: 44000, priorMonth: 41900, items: [{ actual: 26000, budget: 27000 }, { actual: 4800, budget: 5000 }, { actual: 2800, budget: 2800 }, { actual: 2600, budget: 2600 }, { actual: 2200, budget: 2200 }, { actual: 1800, budget: 1900 }, { actual: 1400, budget: 1500 }, { actual: 1200, budget: 1000 }] },
            occupancy: { actual: 83, budget: 85, priorMonth: 81 },
            noi:       { actual: 20700, budget: 21000, priorMonth: 19900 },
          },
          {
            name: 'Elk Ridge',
            beds: 29,
            revenue:   { actual: 88200, budget: 85000, priorMonth: 86400, items: [{ actual: 68000, budget: 65000 }, { actual: 12200, budget: 12000 }, { actual: 5500, budget: 5500 }, { actual: 2500, budget: 2500 }] },
            expenses:  { actual: 48600, budget: 50000, priorMonth: 47200, items: [{ actual: 29500, budget: 31000 }, { actual: 5400, budget: 5500 }, { actual: 3400, budget: 3500 }, { actual: 3000, budget: 3000 }, { actual: 2600, budget: 2600 }, { actual: 2100, budget: 2200 }, { actual: 1200, budget: 1200 }, { actual: 1400, budget: 1000 }] },
            occupancy: { actual: 88, budget: 85, priorMonth: 87 },
            noi:       { actual: 39600, budget: 35000, priorMonth: 39200 },
          },
          {
            name: 'Hearthstone Manor',
            beds: 35,
            revenue:   { actual: 105800, budget: 102000, priorMonth: 103200, items: [{ actual: 82000, budget: 80000 }, { actual: 15800, budget: 15000 }, { actual: 5500, budget: 5000 }, { actual: 2500, budget: 2000 }] },
            expenses:  { actual: 57400, budget: 60000, priorMonth: 56100, items: [{ actual: 35000, budget: 37000 }, { actual: 6200, budget: 6500 }, { actual: 3800, budget: 4000 }, { actual: 3200, budget: 3200 }, { actual: 3000, budget: 3000 }, { actual: 2400, budget: 2500 }, { actual: 1800, budget: 1800 }, { actual: 2000, budget: 2000 }] },
            occupancy: { actual: 93, budget: 90, priorMonth: 91 },
            noi:       { actual: 48400, budget: 42000, priorMonth: 47100 },
          },
        ],
      },
    ],
  };

  writeToSheet_(sampleData);

  Logger.log('');
  Logger.log('Sample data written to ' + CONFIG.TAB_NAME + '!');
  Logger.log('Open the ALM dashboard to verify it shows "February 2026" data.');
  Logger.log('Run clearSampleData() when done testing.');
}

/**
 * Clear the ALM_Financial tab (remove test/sample data).
 */
function clearSampleData() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.TAB_NAME);
  if (sheet && sheet.getLastRow() >= 2) {
    sheet.getRange('A2:B2').clearContent();
    Logger.log('Cleared data from ' + CONFIG.TAB_NAME + '!A2:B2');
  } else {
    Logger.log('Nothing to clear.');
  }
}

/**
 * Check the current state of the sheet data.
 * Run this to see what's stored without modifying anything.
 */
function checkStatus() {
  var data = loadExistingData_();
  if (!data) {
    Logger.log('No data in ' + CONFIG.TAB_NAME + ' tab.');
    Logger.log('Run writeSampleData() to add test data, or wait for a real sync.');
    return;
  }

  var periods = data.periods || [];
  Logger.log('=== ALM Financial Data Status ===');
  Logger.log('Periods stored: ' + periods.length);

  periods.forEach(function(p) {
    var homeNames = (p.homes || []).map(function(h) { return h.name; }).join(', ');
    Logger.log('  ' + p.month + ' ' + p.year + ': ' + (p.homes || []).length + ' homes (' + homeNames + ')');
  });

  // Check last sync time
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.TAB_NAME);
    var lastSynced = sheet.getRange('A2').getValue();
    if (lastSynced) {
      Logger.log('Last synced: ' + lastSynced);
    }
  } catch (e) {}
}


// ═══════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════

/** Ensure the ALM_Financial tab exists with headers */
function ensureTab_() {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.TAB_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.TAB_NAME);
    Logger.log('Created tab: ' + CONFIG.TAB_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.getRange('A1:B1').setValues([['last_synced', 'data_json']]);
  }
}

/** Write multi-period report card data to the sheet */
function writeToSheet_(data) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.TAB_NAME);
  if (!sheet) {
    ensureTab_();
    sheet = ss.getSheetByName(CONFIG.TAB_NAME);
  }

  var now = new Date().toISOString();
  var json = JSON.stringify(data);

  sheet.getRange('A2:B2').setValues([[now, json]]);

  Logger.log('Wrote ' + json.length + ' chars to ' + CONFIG.TAB_NAME + '!B2 (synced: ' + now + ')');
}

/** Load existing multi-period data from the sheet */
function loadExistingData_() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.TAB_NAME);
    if (!sheet || sheet.getLastRow() < 2) return null;

    var json = sheet.getRange('B2').getValue();
    if (!json) return null;

    var data = JSON.parse(json);

    // Migrate legacy single-period format to multi-period
    if (!data.periods && data.homes && data.month) {
      Logger.log('Migrating legacy single-period data to multi-period format');
      data = {
        revenueLabels: data.revenueLabels || CONFIG.REVENUE_ACCOUNTS.map(function(a) { return a.label; }),
        expenseLabels: data.expenseLabels || CONFIG.EXPENSE_ACCOUNTS.map(function(a) { return a.label; }),
        periods: [{ month: data.month, year: data.year, homes: data.homes }],
      };
    }

    return data;
  } catch (err) {
    Logger.log('Could not load existing data: ' + err.message);
    return null;
  }
}

/** Detect home name from email subject or attachment filename */
function detectHomeName_(subject, filename) {
  var combined = (subject + ' ' + filename).toLowerCase();

  var keys = Object.keys(CONFIG.HOME_NAMES);
  for (var i = 0; i < keys.length; i++) {
    if (combined.indexOf(keys[i]) >= 0) {
      return CONFIG.HOME_NAMES[keys[i]];
    }
  }
  return null;
}

/** Parse an Excel attachment into structured data */
function parseExcelReport_(blob) {
  // Convert Excel to temporary Google Sheet via Drive API v2
  var resource = {
    title: 'ALM_temp_' + Date.now(),
    mimeType: 'application/vnd.google-apps.spreadsheet',
  };

  var file;
  try {
    file = Drive.Files.insert(resource, blob, { convert: true });
  } catch (err) {
    Logger.log('Failed to convert Excel: ' + err.message);
    return null;
  }

  try {
    var ss = SpreadsheetApp.openById(file.id);
    var sheet = ss.getSheets()[0];
    var rows = sheet.getDataRange().getValues();

    return parseBudgetVsActual_(rows);

  } finally {
    // Clean up temp file
    try { DriveApp.getFileById(file.id).setTrashed(true); } catch (e) {}
  }
}

/**
 * Parse QuickBooks Budget vs Actual rows.
 *
 * Expected format (columns may vary):
 *   [Account Name] [Actual] [Budget] [$ Over Budget] [% of Budget]
 *
 * The parser auto-detects the header row by looking for "Actual" and "Budget".
 */
function parseBudgetVsActual_(rows) {
  var actualCol = -1;
  var budgetCol = -1;
  var nameCol = 0;
  var headerRow = -1;
  var reportDate = null;

  // Find the header row
  for (var r = 0; r < Math.min(rows.length, 15); r++) {
    for (var c = 0; c < rows[r].length; c++) {
      var val = String(rows[r][c] || '').toLowerCase().trim();
      if (val === 'actual' || val.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{0,4}\s*actual$/i)) {
        actualCol = c;
        headerRow = r;
      }
      if (val === 'budget' || val.match(/budget/i)) {
        if (actualCol >= 0 && headerRow === r) {
          budgetCol = c;
        }
      }
    }
    if (actualCol >= 0 && budgetCol >= 0) break;
  }

  // Fallback
  if (actualCol < 0) {
    Logger.log('Warning: Could not auto-detect columns. Using B=Actual, C=Budget');
    actualCol = 1;
    budgetCol = 2;
    headerRow = 0;
  }

  // Try to detect the report date from early rows
  for (var r2 = 0; r2 < Math.min(rows.length, 5); r2++) {
    var text = String(rows[r2][0] || '');
    var dateMatch = text.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{4})/i);
    if (dateMatch) {
      reportDate = new Date(dateMatch[2], getMonthIndex_(dateMatch[1]));
      break;
    }
  }

  // Parse line items
  var revenueItems = [];
  var expenseItems = [];
  var revenueTotal = 0;
  var expenseTotal = 0;
  var revenueBudgetTotal = 0;
  var expenseBudgetTotal = 0;
  var section = null;

  for (var r3 = headerRow + 1; r3 < rows.length; r3++) {
    var label = String(rows[r3][nameCol] || '').trim();
    var actual = parseNumber_(rows[r3][actualCol]);
    var budget = parseNumber_(rows[r3][budgetCol]);
    var labelLower = label.toLowerCase();

    if (labelLower.match(/^(income|revenue|ordinary income)/)) {
      section = 'income';
      continue;
    }
    if (labelLower.match(/^(expense|cost of goods|operating expense)/)) {
      section = 'expense';
      continue;
    }

    if (labelLower.match(/^total\s*(income|revenue)/)) {
      revenueTotal = actual || revenueTotal;
      revenueBudgetTotal = budget || revenueBudgetTotal;
      section = null;
      continue;
    }
    if (labelLower.match(/^total\s*(expense|cost)/)) {
      expenseTotal = actual || expenseTotal;
      expenseBudgetTotal = budget || expenseBudgetTotal;
      section = null;
      continue;
    }
    if (labelLower.match(/^net\s*(operating\s*)?(income|profit|loss)/)) {
      continue;
    }

    if (!label || actual === null) continue;

    if (section === 'income' || (!section && actual > 0)) {
      var revMatch = matchAccount_(label, CONFIG.REVENUE_ACCOUNTS);
      if (revMatch) {
        revenueItems.push({ label: revMatch, actual: actual, budget: budget || 0 });
      }
    }

    if (section === 'expense' || (!section && actual > 0)) {
      var expMatch = matchAccount_(label, CONFIG.EXPENSE_ACCOUNTS);
      if (expMatch) {
        expenseItems.push({ label: expMatch, actual: actual, budget: budget || 0 });
      }
    }
  }

  // Compute totals if not found
  if (!revenueTotal) {
    revenueTotal = revenueItems.reduce(function(s, i) { return s + i.actual; }, 0);
  }
  if (!revenueBudgetTotal) {
    revenueBudgetTotal = revenueItems.reduce(function(s, i) { return s + i.budget; }, 0);
  }
  if (!expenseTotal) {
    expenseTotal = expenseItems.reduce(function(s, i) { return s + i.actual; }, 0);
  }
  if (!expenseBudgetTotal) {
    expenseBudgetTotal = expenseItems.reduce(function(s, i) { return s + i.budget; }, 0);
  }

  return {
    reportDate: reportDate,
    revenueItems: revenueItems,
    expenseItems: expenseItems,
    revenueTotal: revenueTotal,
    revenueBudgetTotal: revenueBudgetTotal,
    expenseTotal: expenseTotal,
    expenseBudgetTotal: expenseBudgetTotal,
  };
}

/** Match an account label against regex patterns */
function matchAccount_(label, accounts) {
  for (var i = 0; i < accounts.length; i++) {
    if (accounts[i].match.test(label)) {
      return accounts[i].label;
    }
  }
  return null;
}

/** Parse a cell value as a number (handles currency formatting) */
function parseNumber_(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  var cleaned = String(val).replace(/[$,\s]/g, '').replace(/\(([^)]+)\)/, '-$1');
  var num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/**
 * Merge a home's data into the correct period within allPeriods.
 * Creates the period if it doesn't exist. Replaces the home if it already exists
 * within that period (so re-syncing the same month updates rather than duplicates).
 */
function mergePeriodHome_(allPeriods, monthName, year, homeData) {
  // Find existing period
  var period = null;
  for (var i = 0; i < allPeriods.length; i++) {
    if (allPeriods[i].month === monthName && allPeriods[i].year === year) {
      period = allPeriods[i];
      break;
    }
  }

  // Create period if it doesn't exist
  if (!period) {
    period = { month: monthName, year: year, homes: [] };
    allPeriods.push(period);
  }

  // Merge home (replace if exists, otherwise add)
  var idx = -1;
  for (var j = 0; j < period.homes.length; j++) {
    if (period.homes[j].name === homeData.name) {
      idx = j;
      break;
    }
  }

  if (idx >= 0) {
    period.homes[idx] = homeData;
  } else {
    period.homes.push(homeData);
  }
}

/**
 * Find a home's data from the previous month's period.
 * Used to populate priorMonth values.
 */
function findPriorMonthHome_(allPeriods, currentMonth, currentYear, homeName) {
  // Calculate prior month
  var monthIdx = getMonthIndex_(currentMonth);
  var priorMonthIdx = monthIdx === 0 ? 11 : monthIdx - 1;
  var priorYear = monthIdx === 0 ? currentYear - 1 : currentYear;
  var priorMonthName = getMonthName_(new Date(priorYear, priorMonthIdx));

  // Find that period
  for (var i = 0; i < allPeriods.length; i++) {
    if (allPeriods[i].month === priorMonthName && allPeriods[i].year === priorYear) {
      var homes = allPeriods[i].homes || [];
      for (var j = 0; j < homes.length; j++) {
        if (homes[j].name === homeName) return homes[j];
      }
      break;
    }
  }

  return null;
}

/** Build the home data object for the dashboard */
function buildHomeData_(homeName, parsed, priorHome) {
  var beds = CONFIG.HOME_BEDS[homeName] || 0;
  var occTarget = CONFIG.OCCUPANCY_TARGETS[homeName] || 85;

  var revItems = CONFIG.REVENUE_ACCOUNTS.map(function(acct) {
    var found = parsed.revenueItems.find(function(i) { return i.label === acct.label; });
    return { actual: found ? found.actual : 0, budget: found ? found.budget : 0 };
  });

  var expItems = CONFIG.EXPENSE_ACCOUNTS.map(function(acct) {
    var found = parsed.expenseItems.find(function(i) { return i.label === acct.label; });
    return { actual: found ? found.actual : 0, budget: found ? found.budget : 0 };
  });

  var noi = parsed.revenueTotal - parsed.expenseTotal;
  var noiBudget = parsed.revenueBudgetTotal - parsed.expenseBudgetTotal;

  // Estimate occupancy from revenue ratio
  var revRatio = parsed.revenueBudgetTotal > 0
    ? parsed.revenueTotal / parsed.revenueBudgetTotal
    : 1;
  var occEstimate = Math.round(occTarget * revRatio);

  // Prior month values (from previous period, or echo current if no history)
  var priorRev = priorHome ? priorHome.revenue.actual : parsed.revenueTotal;
  var priorExp = priorHome ? priorHome.expenses.actual : parsed.expenseTotal;
  var priorOcc = priorHome ? priorHome.occupancy.actual : occEstimate;
  var priorNoi = priorHome ? priorHome.noi.actual : noi;

  return {
    name: homeName,
    beds: beds,
    revenue: {
      actual: parsed.revenueTotal,
      budget: parsed.revenueBudgetTotal,
      priorMonth: priorRev,
      items: revItems,
    },
    expenses: {
      actual: parsed.expenseTotal,
      budget: parsed.expenseBudgetTotal,
      priorMonth: priorExp,
      items: expItems,
    },
    occupancy: {
      actual: occEstimate,
      budget: occTarget,
      priorMonth: priorOcc,
    },
    noi: {
      actual: noi,
      budget: noiBudget,
      priorMonth: priorNoi,
    },
  };
}

/** Get month name from a Date object */
function getMonthName_(date) {
  var months = ['January','February','March','April','May','June',
                'July','August','September','October','November','December'];
  return months[date.getMonth()];
}

/** Get 0-based month index from name */
function getMonthIndex_(name) {
  var months = ['january','february','march','april','may','june',
                'july','august','september','october','november','december'];
  return months.indexOf(name.toLowerCase());
}
