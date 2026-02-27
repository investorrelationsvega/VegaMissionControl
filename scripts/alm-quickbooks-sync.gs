// ═══════════════════════════════════════════════════════════════════
// ALM — QuickBooks Auto-Sync (Google Apps Script)
//
// This script runs automatically in Google Apps Script. It watches
// your Gmail for QuickBooks Budget vs Actual reports (Excel), parses
// the data, and writes it to the ALM_Financial tab in your Vega
// Google Sheet. The ALM dashboard then reads from that tab.
//
// ── SETUP (one time) ──────────────────────────────────────────────
//
// 1. Go to https://script.google.com → New Project
// 2. Paste this entire file into Code.gs
// 3. Click the "+" next to "Services" in the left panel
//    → Add "Google Sheets API" (v4)
//    → Add "Google Drive API" (v3)
// 4. Update the CONFIG section below with your values
// 5. Run the function: initialSetup()
//    (This creates a daily trigger so it runs automatically)
// 6. Authorize the permissions when prompted
//
// That's it! The script will check your inbox once per day
// and sync any new QuickBooks reports to the dashboard.
//
// ── HOW IT WORKS ──────────────────────────────────────────────────
//
// 1. Searches Gmail for emails matching GMAIL_QUERY
// 2. For each new (unlabeled) email with an .xlsx attachment:
//    a. Downloads the Excel file
//    b. Converts it to a temporary Google Sheet
//    c. Parses the Budget vs Actual data
//    d. Maps line items to the dashboard data structure
//    e. Writes JSON to the ALM_Financial tab
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
  // The key is what appears in the email subject or report title (case-insensitive)
  // The value is the canonical name used in the dashboard
  HOME_NAMES: {
    'cedar city':        'Cedar City',
    'riverton':          'Riverton',
    'elk ridge':         'Elk Ridge',
    'hearthstone':       'Hearthstone Manor',
    'hearthstone manor': 'Hearthstone Manor',
  },

  // Bed count per home (used for the dashboard display)
  HOME_BEDS: {
    'Cedar City':        20,
    'Riverton':          18,
    'Elk Ridge':         29,
    'Hearthstone Manor': 35,
  },

  // Occupancy targets per home (QuickBooks doesn't track this)
  // Update these if targets change
  OCCUPANCY_TARGETS: {
    'Cedar City':        85,
    'Riverton':          85,
    'Elk Ridge':         85,
    'Hearthstone Manor': 90,
  },

  // ── QuickBooks Report Mapping ──────────────────────────────
  // Map your QuickBooks account names to dashboard categories.
  // These are matched case-insensitively against the Excel row labels.
  // Adjust these to match your Chart of Accounts.

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
// SETUP FUNCTION — Run this once
// ═══════════════════════════════════════════════════════════════════

function initialSetup() {
  // Create the Gmail label if it doesn't exist
  var label = GmailApp.getUserLabelByName(CONFIG.LABEL_NAME);
  if (!label) {
    label = GmailApp.createLabel(CONFIG.LABEL_NAME);
    Logger.log('Created Gmail label: ' + CONFIG.LABEL_NAME);
  }

  // Ensure the ALM_Financial tab exists with headers
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

  Logger.log('Setup complete! The script will now run daily.');
  Logger.log('You can also run syncQuickBooksReports manually to test.');
}


// ═══════════════════════════════════════════════════════════════════
// MAIN SYNC FUNCTION — Runs on schedule
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

  if (threads.length === 0) return;

  // Load existing data from the sheet (for prior month values)
  var existingData = loadExistingData_();
  var allHomeData = existingData ? existingData.homes || [] : [];
  var latestMonth = '';
  var latestYear = 0;

  var processed = 0;

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

        Logger.log('Processing: ' + att.getName());

        try {
          // Detect which home this report is for
          var homeName = detectHomeName_(msg.getSubject(), att.getName());
          if (!homeName) {
            Logger.log('Could not determine home name from: ' + msg.getSubject());
            continue;
          }

          // Parse the Excel attachment
          var parsed = parseExcelReport_(att.copyBlob());
          if (!parsed) {
            Logger.log('Failed to parse report for ' + homeName);
            continue;
          }

          // Detect month/year from the report or email date
          var reportDate = parsed.reportDate || msg.getDate();
          var monthName = getMonthName_(reportDate);
          var year = reportDate.getFullYear();

          if (!latestMonth || reportDate > new Date(latestYear, getMonthIndex_(latestMonth))) {
            latestMonth = monthName;
            latestYear = year;
          }

          // Find prior month data for this home
          var priorHome = findPriorMonth_(allHomeData, homeName);

          // Build the home data object
          var homeData = buildHomeData_(homeName, parsed, priorHome);

          // Merge into allHomeData (replace if same home exists)
          var idx = allHomeData.findIndex(function(h) { return h.name === homeName; });
          if (idx >= 0) {
            allHomeData[idx] = homeData;
          } else {
            allHomeData.push(homeData);
          }

          processed++;
          Logger.log('Parsed ' + homeName + ': Revenue ' + parsed.revenueTotal + ', Expenses ' + parsed.expenseTotal);

        } catch (err) {
          Logger.log('Error processing attachment: ' + err.message);
        }
      }
    }

    // Mark thread as processed
    threads[t].addLabel(label);
  }

  if (processed === 0) {
    Logger.log('No reports were successfully parsed.');
    return;
  }

  // Build the full data structure
  var revenueLabels = CONFIG.REVENUE_ACCOUNTS.map(function(a) { return a.label; });
  var expenseLabels = CONFIG.EXPENSE_ACCOUNTS.map(function(a) { return a.label; });

  var reportCardData = {
    month: latestMonth,
    year: latestYear,
    revenueLabels: revenueLabels,
    expenseLabels: expenseLabels,
    homes: allHomeData,
  };

  // Write to sheet
  writeToSheet_(reportCardData);

  Logger.log('Sync complete! Processed ' + processed + ' report(s).');
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
  // Set headers if empty
  if (sheet.getLastRow() === 0) {
    sheet.getRange('A1:B1').setValues([['last_synced', 'data_json']]);
  }
}

/** Write the full report card data to the sheet */
function writeToSheet_(data) {
  var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  var sheet = ss.getSheetByName(CONFIG.TAB_NAME);
  if (!sheet) {
    ensureTab_();
    sheet = ss.getSheetByName(CONFIG.TAB_NAME);
  }

  var now = new Date().toISOString();
  var json = JSON.stringify(data);

  // Write to row 2: timestamp + JSON
  sheet.getRange('A2:B2').setValues([[now, json]]);

  Logger.log('Wrote ' + json.length + ' chars to ' + CONFIG.TAB_NAME + '!B2');
}

/** Load existing data from the sheet */
function loadExistingData_() {
  try {
    var ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
    var sheet = ss.getSheetByName(CONFIG.TAB_NAME);
    if (!sheet || sheet.getLastRow() < 2) return null;

    var json = sheet.getRange('B2').getValue();
    if (!json) return null;

    return JSON.parse(json);
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
  // Convert Excel to temporary Google Sheet
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

    // Parse the budget vs actual data
    var result = parseBudgetVsActual_(rows);

    return result;

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

  // Find the header row with "Actual" and "Budget" columns
  for (var r = 0; r < Math.min(rows.length, 15); r++) {
    for (var c = 0; c < rows[r].length; c++) {
      var val = String(rows[r][c] || '').toLowerCase().trim();
      if (val === 'actual' || val === 'jan actual' || val.match(/^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s*\d{0,4}\s*actual$/i)) {
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

  // Fallback: try columns B and C if headers not found
  if (actualCol < 0) {
    Logger.log('Warning: Could not auto-detect columns. Using B=Actual, C=Budget');
    actualCol = 1;
    budgetCol = 2;
    headerRow = 0;
  }

  // Try to detect the report date from early rows
  for (var r = 0; r < Math.min(rows.length, 5); r++) {
    var text = String(rows[r][0] || '');
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
  var section = null; // 'income' or 'expense'

  for (var r = headerRow + 1; r < rows.length; r++) {
    var label = String(rows[r][nameCol] || '').trim();
    var actual = parseNumber_(rows[r][actualCol]);
    var budget = parseNumber_(rows[r][budgetCol]);
    var labelLower = label.toLowerCase();

    // Detect section changes
    if (labelLower.match(/^(income|revenue|ordinary income)/)) {
      section = 'income';
      continue;
    }
    if (labelLower.match(/^(expense|cost of goods|operating expense)/)) {
      section = 'expense';
      continue;
    }

    // Detect total rows
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
      // We'll compute NOI ourselves
      continue;
    }

    // Skip empty or header rows
    if (!label || actual === null) continue;

    // Try to match against our account mappings
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

  // Compute totals if not found in the report
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

/** Match an account label against a list of regex patterns */
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

/** Build the home data object for the dashboard */
function buildHomeData_(homeName, parsed, priorHome) {
  var beds = CONFIG.HOME_BEDS[homeName] || 0;
  var occTarget = CONFIG.OCCUPANCY_TARGETS[homeName] || 85;

  // Map parsed items to the expected order (matching CONFIG arrays)
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

  // Estimate occupancy from revenue (rough: actual/budget ratio applied to target)
  var revRatio = parsed.revenueBudgetTotal > 0
    ? parsed.revenueTotal / parsed.revenueBudgetTotal
    : 1;
  var occEstimate = Math.round(occTarget * revRatio);

  // Prior month values (from previous sync, or 0)
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

/** Find a home's data from the previous sync (for prior month comparison) */
function findPriorMonth_(homes, homeName) {
  for (var i = 0; i < homes.length; i++) {
    if (homes[i].name === homeName) return homes[i];
  }
  return null;
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
