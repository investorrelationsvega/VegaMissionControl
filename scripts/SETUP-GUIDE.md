# ALM QuickBooks Auto-Sync — Setup Guide

This guide walks through deploying the Google Apps Script that automatically
syncs QuickBooks Budget vs Actual reports from your email to the ALM dashboard.

## How It Works

```
QuickBooks → Email (.xlsx) → Gmail → Apps Script → Google Sheet → Dashboard
```

1. You (or your bookkeeper) emails a QuickBooks "Budget vs Actual" report as an Excel attachment
2. The Apps Script runs daily at 7 AM, finds new unprocessed emails
3. For each email: detects the home name, parses revenue/expense line items, maps to dashboard categories
4. Writes multi-period JSON to the `ALM_Financial` tab in your Vega Google Sheet
5. The ALM dashboard reads from that tab on page load

---

## Step 1: Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com)
2. Click **New Project**
3. Name it: `ALM QuickBooks Sync`
4. Delete any existing code in `Code.gs`
5. Copy the entire contents of `alm-quickbooks-sync.gs` and paste it into `Code.gs`

## Step 2: Enable Required Services

In the Apps Script editor:

1. Click the **+** next to **Services** in the left panel
2. Find and add **Google Sheets API** (v4) → click **Add**
3. Find and add **Google Drive API** (v2) → click **Add**

> **Important**: Use Drive API **v2**, not v3. The script uses `Drive.Files.insert()` which is a v2 method.

## Step 3: Verify the Config

At the top of `Code.gs`, check these values in the `CONFIG` object:

| Setting | What to check |
|---------|--------------|
| `SPREADSHEET_ID` | Should match your Vega Google Sheet URL: `docs.google.com/spreadsheets/d/{THIS_ID}/edit` |
| `GMAIL_QUERY` | Update the `from:` address to match whoever sends the QuickBooks reports |
| `HOME_NAMES` | Add any homes not already listed (key = how it appears in email subject, value = dashboard name) |
| `HOME_BEDS` | Update bed counts if they've changed |
| `OCCUPANCY_TARGETS` | Update target percentages per home |

### Gmail Query Tips

The default query is:
```
from:quickbooks subject:"budget vs actual" has:attachment -label:ALM-Synced
```

Common adjustments:
- If reports come from your bookkeeper: `from:bookkeeper@example.com`
- If subjects vary: `subject:(budget actual) OR subject:(P&L)`
- To also match forwarded reports: remove the `from:` filter

## Step 4: Run Initial Setup

1. In the Apps Script editor, select **`initialSetup`** from the function dropdown (top toolbar)
2. Click **Run**
3. Google will ask you to authorize permissions — click through:
   - **Review Permissions** → choose your Google account
   - Click **Advanced** → **Go to ALM QuickBooks Sync (unsafe)**
   - Click **Allow**
4. Check the **Execution log** at the bottom — you should see:
   ```
   Created Gmail label: ALM-Synced
   Created daily trigger for syncQuickBooksReports at 7 AM
   Setup complete!
   ```

## Step 5: Test the Pipeline

Before waiting for a real QuickBooks email, verify everything connects:

1. Select **`writeSampleData`** from the function dropdown
2. Click **Run**
3. Open your ALM dashboard — you should see a "February 2026" period with test data
4. If it works, go back and run **`clearSampleData`** to remove the test data

## Step 6: Test with a Real Email

1. Export a "Budget vs Actual" report from QuickBooks as Excel (.xlsx)
2. Email it to yourself with a subject line like: `Budget vs Actual - Cedar City - January 2026`
   - The subject (or filename) must contain the home name so the script can identify it
3. In Apps Script, run **`syncQuickBooksReports`** manually
4. Check the execution log for success/errors
5. Refresh the ALM dashboard

---

## Ongoing Operation

Once set up, the script runs automatically every day at 7 AM. No action needed.

### Checking Status

Run **`checkStatus`** in Apps Script to see:
- How many months of data are stored
- Which homes have data in each period
- When the last sync occurred

### Adding a New Home

1. In `CONFIG.HOME_NAMES`, add a mapping: `'new home name': 'Display Name'`
2. In `CONFIG.HOME_BEDS`, add the bed count
3. In `CONFIG.OCCUPANCY_TARGETS`, add the target percentage
4. In `AlmDashboard.jsx` (the app), add the home to the `HOMES` array

### Re-syncing a Month

If you need to re-process a report (e.g., corrected numbers):
1. In Gmail, find the email and remove the `ALM-Synced` label
2. Run `syncQuickBooksReports` — it will re-process and update that month's data

### Troubleshooting

| Issue | Fix |
|-------|-----|
| "Could not determine home name" | The email subject/filename doesn't contain a recognized home name. Add it to `CONFIG.HOME_NAMES` |
| "Failed to convert Excel" | The attachment isn't a valid .xlsx file. Check the export from QuickBooks |
| Dashboard shows static data | Check that you're signed in to Google in the dashboard. The service falls back to static data when not authenticated |
| No data appears after sync | Run `checkStatus` to see what's stored. Then check the dashboard browser console for errors |

---

## Email Format Reference

The script expects **one email per home**, each with one `.xlsx` attachment:

- **Subject**: Must contain the home name (e.g., "Budget vs Actual - Riverton")
- **Attachment**: QuickBooks Budget vs Actual report exported as Excel
- **Report format**: The parser looks for "Actual" and "Budget" column headers

### QuickBooks Export Steps

1. In QuickBooks, go to **Reports** → **Budgets & Forecasts** → **Budget vs. Actual**
2. Set the date range to the month you want
3. Click **Export** → **Export to Excel**
4. Email the .xlsx file with the home name in the subject line
