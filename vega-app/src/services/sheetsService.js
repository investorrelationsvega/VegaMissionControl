// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Google Sheets Service
// Bidirectional sync with Vega_Fund_Admin_v3 sheet
// ═══════════════════════════════════════════════

import useGoogleStore from '../stores/googleStore';

const SPREADSHEET_ID = '1cRfPG_KuXPR4dmbDbU4xwSwePQDLHRMBFyFSJn2xt7o';
const SHEETS_API = 'https://sheets.googleapis.com/v4/spreadsheets';

// Sheet tab names
const TABS = {
  INVESTORS: 'Investors',
  POSITIONS: 'Positions',
  COMPLIANCE: 'Compliance',
  AUDIT_LOG: 'Audit_Log',
  DISTRIBUTIONS: 'Distributions',
  REFERENCE: 'Reference',
  TIC: 'TIC_Properties',
};

// Tab GIDs (for reference / URL construction)
const TAB_GIDS = {
  Investors: 272844310,
  Positions: 1997553381,
  Compliance: 1538366363,
  Audit_Log: 1091796187,
  Distributions: 708162775,
  Reference: 1712479294,
  TIC_Properties: 0, // Will be set after tab is created
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getAccessToken() {
  return useGoogleStore.getState().accessToken;
}

async function sheetsRequest(url, options = {}) {
  const token = getAccessToken();
  if (!token) throw new Error('No Google access token available');

  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Sheets API error ${res.status}: ${errBody}`);
  }

  return res.json();
}

/** Read a range from a sheet tab. Returns array of rows (each row is array of cell values). */
async function readRange(range) {
  const url = `${SHEETS_API}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const data = await sheetsRequest(url);
  return data.values || [];
}

/** Read multiple ranges in one batch call. */
async function batchRead(ranges) {
  const params = ranges.map((r) => `ranges=${encodeURIComponent(r)}`).join('&');
  const url = `${SHEETS_API}/${SPREADSHEET_ID}/values:batchGet?${params}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING`;
  const data = await sheetsRequest(url);
  return data.valueRanges || [];
}

/** Update a single range (e.g. one cell or row). */
async function updateRange(range, values) {
  const url = `${SHEETS_API}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;
  return sheetsRequest(url, {
    method: 'PUT',
    body: JSON.stringify({ range, values }),
  });
}

/** Append rows to a sheet tab. */
async function appendRows(range, values) {
  const url = `${SHEETS_API}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;
  return sheetsRequest(url, {
    method: 'POST',
    body: JSON.stringify({ range, values }),
  });
}

/** Convert rows (array of arrays) to objects using first row as header keys. */
function rowsToObjects(rows) {
  if (rows.length < 2) return [];
  const headers = rows[0].map((h) => String(h).trim());
  return rows.slice(1).filter((row) => row.length > 0 && row[0] !== '').map((row) => {
    const obj = {};
    headers.forEach((key, i) => {
      obj[key] = row[i] !== undefined ? row[i] : '';
    });
    return obj;
  });
}

// ---------------------------------------------------------------------------
// ID mapping: Sheet IDs ↔ App IDs
// The sheet uses INV001-style IDs, the app uses I01-style IDs.
// We'll keep the sheet IDs as the source of truth and map them.
// ---------------------------------------------------------------------------

/** Map sheet investor_id (INV001) to app invId (I01) format */
function sheetInvIdToApp(sheetId) {
  if (!sheetId) return '';
  // INV001 → I01, INV032 → I32
  const num = parseInt(String(sheetId).replace(/^INV0*/, ''), 10);
  return isNaN(num) ? sheetId : `I${String(num).padStart(2, '0')}`;
}

/** Map app invId (I01) to sheet investor_id (INV001) format */
function appInvIdToSheet(appId) {
  if (!appId) return '';
  const num = parseInt(String(appId).replace(/^I0*/, ''), 10);
  return isNaN(num) ? appId : `INV${String(num).padStart(3, '0')}`;
}

/** Map sheet position_id (POS001) to app id (P01) */
function sheetPosIdToApp(sheetId) {
  if (!sheetId) return '';
  const num = parseInt(String(sheetId).replace(/^POS0*/, ''), 10);
  return isNaN(num) ? sheetId : `P${String(num).padStart(2, '0')}`;
}

/** Map app position id (P01) to sheet format (POS001) */
function appPosIdToSheet(appId) {
  if (!appId) return '';
  const num = parseInt(String(appId).replace(/^P0*/, ''), 10);
  return isNaN(num) ? appId : `POS${String(num).padStart(3, '0')}`;
}

/** Map sheet compliance_id (C001) to app id (C01) */
function sheetCompIdToApp(sheetId) {
  if (!sheetId) return '';
  const num = parseInt(String(sheetId).replace(/^C0*/, ''), 10);
  return isNaN(num) ? sheetId : `C${String(num).padStart(2, '0')}`;
}

/** Map sheet distribution_id (D0001) to app id (D01) */
function sheetDistIdToApp(sheetId) {
  if (!sheetId) return '';
  const num = parseInt(String(sheetId).replace(/^D0*/, ''), 10);
  return isNaN(num) ? sheetId : `D${String(num).padStart(2, '0')}`;
}

/** Map fund short name: "Fund I" / "Fund II" used in both sheet and app */
function normalizeFund(fund) {
  return String(fund || '').trim();
}

/** Map investor class: sheet uses "Class A" / "Class B", app uses "A" / "B" */
function sheetClassToApp(cls) {
  return String(cls || '').replace('Class ', '');
}

function appClassToSheet(cls) {
  if (!cls) return '';
  return cls.length === 1 ? `Class ${cls}` : cls;
}

/** Map profile type: sheet and app both use Individual/Entity/Joint Registration etc. */
function normalizeType(type) {
  const t = String(type || '').trim();
  if (t === 'Joint Registration') return 'Joint';
  if (t === 'Retirement Plan') return 'Trust'; // close mapping
  return t;
}

/** Map status: sheet has "active"/"pending"/"missing", app has "Approved"/"Pending" */
function sheetStatusToApp(status) {
  const s = String(status || '').toLowerCase().trim();
  if (s === 'active') return 'Approved';
  if (s === 'pending') return 'Pending';
  if (s === 'declined') return 'Declined';
  return 'Approved';
}

// ---------------------------------------------------------------------------
// DATA FETCHERS — Read sheet → app format
// ---------------------------------------------------------------------------

/**
 * Fetch all data from the sheet in one batch call.
 * Returns { investors, positions, compliance, distributions, funds, advisors, custodians }.
 */
export async function fetchAllSheetData() {
  const ranges = [
    `${TABS.INVESTORS}!A1:K100`,
    `${TABS.POSITIONS}!A1:M100`,
    `${TABS.COMPLIANCE}!A1:H100`,
    `${TABS.DISTRIBUTIONS}!A1:I100`,
    `${TABS.REFERENCE}!A1:G20`,
    `${TABS.TIC}!A1:G50`,
  ];

  const results = await batchRead(ranges);

  const investorRows = rowsToObjects(results[0]?.values || []);
  const positionRows = rowsToObjects(results[1]?.values || []);
  const complianceRows = rowsToObjects(results[2]?.values || []);
  const distributionRows = rowsToObjects(results[3]?.values || []);
  const referenceRows = results[4]?.values || [];
  const ticRows = rowsToObjects(results[5]?.values || []);

  // Build a lookup of investor data from the Investors tab
  const investorLookup = {};
  investorRows.forEach((row) => {
    const appId = sheetInvIdToApp(row.investor_id);
    investorLookup[appId] = {
      email: String(row.email || '').trim(),
      phone: String(row.phone || '').trim(),
      address: String(row.address || '').trim(),
      advisor: String(row.advisor || '').trim(),
      custodian: String(row.custodian || '').trim(),
      referrer: String(row.referrer || '').trim(),
      notes: String(row.notes || '').trim(),
      profileType: String(row.profile_type || '').trim(),
      contacts: (() => {
        try { return JSON.parse(row.contacts_json || '[]'); }
        catch { return []; }
      })(),
    };
  });

  // Transform positions
  const positions = positionRows.map((row) => {
    const appInvId = sheetInvIdToApp(row.investor_id);
    const inv = investorLookup[appInvId] || {};

    // Determine pipeline stage from sheet data
    let pipelineStage = 'Accepted';
    const status = String(row.status || '').toLowerCase().trim();
    if (status === 'pending') pipelineStage = 'Pending';
    else if (status === 'declined') pipelineStage = 'Declined';

    const signed = String(row.signed_date || '').trim();
    const funded = String(row.funded_date || '').trim();
    const banking = String(row.banking_status || '').toLowerCase().trim();

    // Build pipeline object
    const pipeline = {
      stage: pipelineStage,
      enteredDate: signed || funded || '',
    };
    if (signed) pipeline.fullyExecutedDate = signed;
    if (funded) pipeline.fundedDate = funded;

    return {
      id: sheetPosIdToApp(row.position_id),
      invId: appInvId,
      name: String(row.name || '').trim(),
      entity: String(row.entity || '').trim(),
      fund: normalizeFund(row.fund),
      type: normalizeType(row.profile_type || inv.profileType),
      cls: sheetClassToApp(row.investor_class),
      amt: Number(row.amount) || 0,
      status: sheetStatusToApp(row.status),
      signed: signed,
      funded: funded,
      advisor: inv.advisor || '',
      custodian: inv.custodian || '',
      phone: inv.phone || '',
      email: inv.email || '',
      state: '', // Not in sheet — will use contactOverrides or blank
      pipeline,
      signers: [],
      docRouting: 'direct',
      declinedReason: null,
      // Extra sheet fields
      bankingStatus: banking,
      paymentMethod: String(row.payment_method || '').trim(),
    };
  });

  // Transform compliance items
  const compliance = complianceRows.map((row) => {
    const appInvId = sheetInvIdToApp(row.investor_id);
    return {
      id: sheetCompIdToApp(row.compliance_id),
      invId: appInvId,
      name: String(row.name || '').trim(),
      entity: '',
      fund: normalizeFund(row.fund),
      doc: String(row.type || '').trim(),
      issue: String(row.issue || '').trim(),
      status: String(row.status || 'open').trim() === 'resolved' ? 'Resolved'
        : String(row.status || 'open').trim() === 'in-progress' ? 'Open'
        : 'Open',
      priority: 'standard',
      resolvedBy: '',
      resolvedDate: '',
      notes: '',
      createdDate: String(row.created_date || '').trim(),
    };
  });

  // Transform distributions
  const distributions = distributionRows.map((row) => {
    return {
      id: sheetDistIdToApp(row.distribution_id),
      invId: '', // Need to map from investor name — will resolve below
      name: String(row.name || '').trim(),
      entity: String(row.entity || '').trim(),
      fund: 'Fund II', // All current distributions are Fund II
      period: String(row.period || '').trim(),
      amt: Number(row.amount) || 0,
      method: String(row.method || '').trim(),
      status: String(row.status || '').trim() === 'sent' ? 'Sent' : String(row.status || '').trim(),
      date: String(row.sent_date || '').trim(),
      trackingRef: '',
      reportedInPortal: 'Yes',
      reconciliation: 'Matched',
      notes: String(row.notes || '').trim(),
      auditLog: [],
    };
  });

  // Resolve distribution invIds by matching investor name
  const nameToInvId = {};
  investorRows.forEach((row) => {
    nameToInvId[String(row.name || '').trim().toLowerCase()] = sheetInvIdToApp(row.investor_id);
  });

  distributions.forEach((d) => {
    const key = d.name.toLowerCase();
    if (nameToInvId[key]) {
      d.invId = nameToInvId[key];
    }
  });

  // Parse Reference tab (funds, advisors, custodians)
  const { funds, advisors, custodians } = parseReference(referenceRows);

  // Transform TIC property ownership records
  const ticProperties = ticRows.map((row, i) => {
    let distributions = {};
    try { distributions = JSON.parse(row.distributions_json || '{}'); }
    catch { distributions = {}; }
    return {
      id: row.tic_id || `TI${String(i + 1).padStart(2, '0')}`,
      entity: String(row.entity || '').trim(),
      property: String(row.property || '').trim(),
      ownership: parseFloat(row.ownership_pct) || 0,
      ticFunds: Number(String(row.tic_funds || '0').replace(/[$,]/g, '')) || 0,
      isFundII: String(row.is_fund_ii || '').toLowerCase() === 'true' || String(row.is_fund_ii || '') === '1',
      distributions,
    };
  });

  return { positions, compliance, distributions, funds, advisors, custodians, investorLookup, ticProperties };
}

/** Parse the Reference tab which has multiple sub-tables */
function parseReference(rows) {
  const funds = [];
  const advisors = [];
  const custodians = [];

  let section = null;
  let headers = null;

  rows.forEach((row) => {
    const first = String(row[0] || '').trim().toUpperCase();

    // Detect section headers
    if (first === 'FUNDS') {
      section = 'funds';
      headers = null;
      return;
    }
    if (first === 'ADVISORS') {
      section = 'advisors';
      headers = null;
      return;
    }
    if (first === 'CUSTODIANS') {
      section = 'custodians';
      headers = null;
      return;
    }

    // Skip empty rows
    if (!row[0] && row[0] !== 0) return;

    // Detect header rows
    const firstLower = String(row[0] || '').toLowerCase().trim();
    if (firstLower === 'fund_id' || firstLower === 'advisor_id' || firstLower === 'custodian_id') {
      headers = row.map((h) => String(h || '').trim());
      return;
    }

    if (!headers || !section) return;

    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i] !== undefined ? row[i] : '';
    });

    if (section === 'funds') {
      const shortName = String(obj.name || '').includes('Fund I') && !String(obj.name || '').includes('Fund II') && !String(obj.name || '').includes('Fund III')
        ? 'Fund I'
        : String(obj.name || '').includes('Fund III')
          ? 'Fund III'
          : String(obj.name || '').includes('Fund II')
            ? 'Fund II'
            : obj.name;

      funds.push({
        id: String(obj.fund_id || '').replace('FUND', 'F0'),
        name: String(obj.name || ''),
        shortName,
        status: String(obj.status || '').charAt(0).toUpperCase() + String(obj.status || '').slice(1),
        target: Number(obj.target) || 0,
        committed: 0, // Will be computed from positions
        funded: 0,     // Will be computed from positions
        vintage: String(obj.start_date || '').slice(0, 4),
        closeDate: String(obj.close_date || ''),
        positionCount: 0, // Will be computed from positions
        investorClass: '',
        annualRate: Number(obj.annual_rate) || 0,
        notes: '',
      });
    }

    if (section === 'advisors') {
      advisors.push({
        id: String(obj.advisor_id || '').replace('ADV', 'A'),
        name: String(obj.name || ''),
        firm: String(obj.firm || ''),
        email: String(obj.email || ''),
        phone: String(obj.phone || ''),
        territory: '',
        crd: '',
        status: 'Active',
        notes: '',
      });
    }

    if (section === 'custodians') {
      custodians.push({
        id: String(obj.custodian_id || '').replace('CUS', 'CU'),
        name: String(obj.name || ''),
        address: '',
        phone: '',
        email: '',
        reportingFrequency: '',
        nextReportingDate: '',
        notes: String(obj.notes || ''),
        dtccRequired: String(obj.dtcc_required || '').toLowerCase() === 'yes',
      });
    }
  });

  // Compute fund committed/funded/positionCount from positions (will be done in the store)
  return { funds, advisors, custodians };
}

// ---------------------------------------------------------------------------
// WRITE OPERATIONS — App → Sheet
// ---------------------------------------------------------------------------

/**
 * Find the row number for a given ID in a sheet tab.
 * Column A is assumed to be the ID column.
 * Returns the 1-based row number, or null if not found.
 */
async function findRowById(tabName, id) {
  const rows = await readRange(`${tabName}!A:A`);
  for (let i = 0; i < rows.length; i++) {
    if (String(rows[i][0] || '').trim() === id) {
      return i + 1; // 1-based
    }
  }
  return null;
}

// --- Column index maps for each tab ---
const INVESTOR_COLS = {
  investor_id: 'A', name: 'B', profile_type: 'C', email: 'D',
  phone: 'E', address: 'F', advisor: 'G', custodian: 'H',
  referrer: 'I', notes: 'J', contacts_json: 'K',
};

const POSITION_COLS = {
  position_id: 'A', investor_id: 'B', fund: 'C', name: 'D',
  entity: 'E', profile_type: 'F', investor_class: 'G', amount: 'H',
  signed_date: 'I', funded_date: 'J', banking_status: 'K',
  payment_method: 'L', status: 'M',
};

const COMPLIANCE_COLS = {
  compliance_id: 'A', investor_id: 'B', name: 'C', fund: 'D',
  type: 'E', issue: 'F', status: 'G', created_date: 'H',
};

const DISTRIBUTION_COLS = {
  distribution_id: 'A', name: 'B', entity: 'C', period: 'D',
  amount: 'E', method: 'F', status: 'G', sent_date: 'H', notes: 'I',
};

const AUDIT_COLS = {
  audit_id: 'A', record_type: 'B', record_id: 'C', action: 'D',
  notes: 'E', user: 'F', timestamp: 'G', attachments: 'H',
};

const TIC_COLS = {
  tic_id: 'A', entity: 'B', property: 'C', ownership_pct: 'D',
  tic_funds: 'E', is_fund_ii: 'F', distributions_json: 'G',
};

/**
 * Update a single cell in a sheet tab.
 * @param {string} tabName - Tab name (e.g. 'Investors')
 * @param {number} row - 1-based row number
 * @param {string} col - Column letter (e.g. 'D')
 * @param {*} value - Cell value
 */
export async function updateCell(tabName, row, col, value) {
  const range = `${tabName}!${col}${row}`;
  return updateRange(range, [[value]]);
}

/**
 * Update an investor field in the Investors tab.
 * Maps app field names to sheet columns.
 */
export async function updateInvestorField(appInvId, field, value) {
  const sheetInvId = appInvIdToSheet(appInvId);
  const row = await findRowById(TABS.INVESTORS, sheetInvId);
  if (!row) {
    console.warn(`Investor ${sheetInvId} not found in sheet`);
    return;
  }

  const fieldToCol = {
    email: INVESTOR_COLS.email,
    phone: INVESTOR_COLS.phone,
    address: INVESTOR_COLS.address,
    advisor: INVESTOR_COLS.advisor,
    custodian: INVESTOR_COLS.custodian,
    referrer: INVESTOR_COLS.referrer,
    notes: INVESTOR_COLS.notes,
    profile_type: INVESTOR_COLS.profile_type,
    contacts_json: INVESTOR_COLS.contacts_json,
  };

  const col = fieldToCol[field];
  if (!col) {
    console.warn(`Unknown investor field: ${field}`);
    return;
  }

  return updateCell(TABS.INVESTORS, row, col, value);
}

/**
 * Update a position field in the Positions tab.
 */
export async function updatePositionField(appPosId, field, value) {
  const sheetPosId = appPosIdToSheet(appPosId);
  const row = await findRowById(TABS.POSITIONS, sheetPosId);
  if (!row) {
    console.warn(`Position ${sheetPosId} not found in sheet`);
    return;
  }

  const fieldToCol = {
    amount: POSITION_COLS.amount,
    status: POSITION_COLS.status,
    signed_date: POSITION_COLS.signed_date,
    funded_date: POSITION_COLS.funded_date,
    banking_status: POSITION_COLS.banking_status,
    payment_method: POSITION_COLS.payment_method,
    profile_type: POSITION_COLS.profile_type,
  };

  const col = fieldToCol[field];
  if (!col) {
    console.warn(`Unknown position field: ${field}`);
    return;
  }

  // Map app values back to sheet format
  let sheetValue = value;
  if (field === 'status') {
    sheetValue = String(value || '').toLowerCase();
    if (sheetValue === 'approved') sheetValue = 'active';
  }

  return updateCell(TABS.POSITIONS, row, col, sheetValue);
}

/**
 * Update a compliance item's status in the Compliance tab.
 */
export async function updateComplianceStatus(appCompId, newStatus) {
  // App uses C01, sheet uses C001 — but sheet actually uses C001 format
  const sheetId = `C${String(appCompId.replace(/^C0*/, '')).padStart(3, '0')}`;
  const row = await findRowById(TABS.COMPLIANCE, sheetId);
  if (!row) {
    console.warn(`Compliance item ${sheetId} not found in sheet`);
    return;
  }

  const sheetStatus = newStatus.toLowerCase();
  return updateCell(TABS.COMPLIANCE, row, COMPLIANCE_COLS.status, sheetStatus);
}

/**
 * Update a distribution field in the Distributions tab.
 */
export async function updateDistributionField(appDistId, field, value) {
  const sheetId = `D${String(appDistId.replace(/^D0*/, '')).padStart(4, '0')}`;
  const row = await findRowById(TABS.DISTRIBUTIONS, sheetId);
  if (!row) {
    console.warn(`Distribution ${sheetId} not found in sheet`);
    return;
  }

  const fieldToCol = {
    amount: DISTRIBUTION_COLS.amount,
    method: DISTRIBUTION_COLS.method,
    status: DISTRIBUTION_COLS.status,
    sent_date: DISTRIBUTION_COLS.sent_date,
    notes: DISTRIBUTION_COLS.notes,
  };

  const col = fieldToCol[field];
  if (!col) return;

  return updateCell(TABS.DISTRIBUTIONS, row, col, value);
}

/**
 * Append an entry to the Audit_Log tab.
 */
export async function appendAuditLog(entry) {
  const row = [
    entry.id || `AUD-${Date.now()}`,
    entry.recordType || '',
    entry.recordId || '',
    entry.action || '',
    entry.notes || entry.detail || '',
    entry.user || 'j@vegarei.com',
    entry.timestamp || new Date().toISOString(),
    '',
  ];
  return appendRows(`${TABS.AUDIT_LOG}!A:H`, [row]);
}

/**
 * Update a TIC property field in the TIC_Properties tab.
 */
export async function updateTicField(appTicId, field, value) {
  const sheetId = appTicId; // TIC IDs are the same in app and sheet (TI01 format)
  const row = await findRowById(TABS.TIC, sheetId);
  if (!row) {
    console.warn(`TIC record ${sheetId} not found in sheet`);
    return;
  }

  const fieldToCol = {
    entity: TIC_COLS.entity,
    property: TIC_COLS.property,
    ownership_pct: TIC_COLS.ownership_pct,
    tic_funds: TIC_COLS.tic_funds,
    is_fund_ii: TIC_COLS.is_fund_ii,
    distributions_json: TIC_COLS.distributions_json,
  };

  const col = fieldToCol[field];
  if (!col) {
    console.warn(`Unknown TIC field: ${field}`);
    return;
  }

  return updateCell(TABS.TIC, row, col, value);
}

/**
 * Ensure the TIC_Properties tab exists with proper headers.
 * Creates the header row if the tab exists but is empty.
 * If the tab doesn't exist, the batch read will just return empty — seed data will be used.
 */
export async function ensureTicTab() {
  try {
    const rows = await readRange(`${TABS.TIC}!A1:G1`);
    const headers = rows[0] || [];
    if (!headers.length || String(headers[0] || '').trim() !== 'tic_id') {
      await updateRange(`${TABS.TIC}!A1:G1`, [['tic_id', 'entity', 'property', 'ownership_pct', 'tic_funds', 'is_fund_ii', 'distributions_json']]);
      console.log('[Sheets] Added TIC_Properties header row');
    }
  } catch (err) {
    // Tab probably doesn't exist yet — that's OK, seed data will be used
    console.warn('[Sheets] TIC_Properties tab not found (will use seed data):', err.message);
  }
}

/**
 * Write all TIC seed data to the sheet (one-time population).
 * Call after ensureTicTab() if the tab is empty.
 */
export async function populateTicTab(records) {
  try {
    // Check if data already exists
    const existing = await readRange(`${TABS.TIC}!A2:A50`);
    if (existing.length > 0 && existing[0]?.length > 0) {
      console.log('[Sheets] TIC_Properties already has data, skipping populate');
      return;
    }

    const rows = records.map((r) => [
      r.id,
      r.entity,
      r.property,
      r.ownership,
      r.ticFunds || 0,
      r.isFundII ? 'true' : 'false',
      JSON.stringify(r.distributions || {}),
    ]);

    await appendRows(`${TABS.TIC}!A:G`, rows);
    console.log(`[Sheets] Populated TIC_Properties with ${rows.length} records`);
  } catch (err) {
    console.warn('[Sheets] Failed to populate TIC_Properties:', err.message);
  }
}

/**
 * Backfill investor phone/email from external data source (e.g., CSV import).
 * Only fills fields that are currently empty or "-".
 * Returns an object keyed by app invId with the fields that were updated,
 * so the caller can apply them to the in-memory store immediately.
 * @param {Object} contactMap - { investorName: { phone, email } }
 * @returns {Object} - { [appInvId]: { phone?, email? } } of updates applied
 */
export async function backfillContactInfo(contactMap) {
  const storeUpdates = {}; // { appInvId: { phone?, email? } }
  try {
    // Read all investor rows to find name → row mapping
    const rows = await readRange(`${TABS.INVESTORS}!A1:K100`);
    if (rows.length < 2) return storeUpdates;

    const headers = rows[0];
    const idCol = headers.indexOf('investor_id');
    const nameCol = headers.indexOf('name');
    const phoneCol = headers.indexOf('phone');
    const emailCol = headers.indexOf('email');

    if (nameCol === -1 || idCol === -1) return storeUpdates;

    let updated = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = String(row[nameCol] || '').trim();
      if (!name) continue;

      // Try to match by name (case-insensitive)
      const match = Object.entries(contactMap).find(
        ([csvName]) => csvName.toLowerCase() === name.toLowerCase()
      );

      if (!match) continue;
      const [, csvData] = match;
      const sheetRow = i + 1; // 1-based
      const sheetInvId = String(row[idCol] || '').trim();

      // Convert INV017 → I17 for store updates
      const num = parseInt(sheetInvId.replace(/^INV0*/, ''), 10);
      const appInvId = isNaN(num) ? '' : `I${num}`;

      const currentPhone = String(row[phoneCol] || '').trim();
      const currentEmail = String(row[emailCol] || '').trim();
      const thisUpdate = {};

      // Only fill if current is empty or "-"
      if (csvData.phone && (!currentPhone || currentPhone === '-' || currentPhone === '')) {
        await updateCell(TABS.INVESTORS, sheetRow, 'E', csvData.phone);
        thisUpdate.phone = csvData.phone;
        updated++;
      }
      if (csvData.email && (!currentEmail || currentEmail === '-' || currentEmail === '')) {
        await updateCell(TABS.INVESTORS, sheetRow, 'D', csvData.email);
        thisUpdate.email = csvData.email;
        updated++;
      }

      if (Object.keys(thisUpdate).length > 0 && appInvId) {
        storeUpdates[appInvId] = thisUpdate;
      }
    }

    if (updated > 0) {
      console.log(`[Sheets] Backfilled ${updated} contact fields from CSV data`);
    }
  } catch (err) {
    console.warn('[Sheets] Contact backfill failed:', err.message);
  }
  return storeUpdates;
}

/**
 * Ensure the contacts_json column header exists in Investors!K1.
 * Called once after sign-in; safe to call repeatedly (no-op if already present).
 */
export async function ensureContactsColumn() {
  try {
    const rows = await readRange(`${TABS.INVESTORS}!K1:K1`);
    const current = rows[0]?.[0];
    if (!current || String(current).trim() !== 'contacts_json') {
      await updateRange(`${TABS.INVESTORS}!K1`, [['contacts_json']]);
      console.log('[Sheets] Added contacts_json header to Investors!K1');
    }
  } catch (err) {
    console.error('[Sheets] Failed to ensure contacts_json column:', err);
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

export {
  SPREADSHEET_ID,
  TABS,
  TAB_GIDS,
  readRange,
  batchRead,
  updateRange,
  appendRows,
  findRowById,
  sheetInvIdToApp,
  appInvIdToSheet,
  sheetPosIdToApp,
  appPosIdToSheet,
  TIC_COLS,
};
