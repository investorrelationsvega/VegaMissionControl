// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Salesforce API Service
// Fetch tasks, events, opportunities, users
// ═══════════════════════════════════════════════

import useSalesforceStore from '../stores/salesforceStore';
import { refreshSalesforceToken } from './salesforceAuth';

// ---------------------------------------------------------------------------
// Generic SOQL query helper
// ---------------------------------------------------------------------------

async function sfQuery(soql) {
  const store = useSalesforceStore.getState();
  let { accessToken, instanceUrl } = store;

  if (!accessToken || !instanceUrl) {
    throw new Error('Not connected to Salesforce');
  }

  // Auto-refresh if token is about to expire
  if (store.tokenExpiresAt && store.tokenExpiresAt < Date.now() + 300000) {
    try {
      const refreshed = await refreshSalesforceToken(store.refreshToken);
      store.setTokens(refreshed);
      accessToken = refreshed.access_token;
      instanceUrl = refreshed.instance_url;
    } catch (err) {
      store.clearAuth();
      throw new Error('Salesforce session expired — please reconnect.');
    }
  }

  const url = `${instanceUrl}/services/data/v59.0/query/?q=${encodeURIComponent(soql)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    // Try one refresh
    try {
      const refreshed = await refreshSalesforceToken(store.refreshToken);
      store.setTokens(refreshed);
      const retry = await fetch(url.replace(instanceUrl, refreshed.instance_url), {
        headers: {
          Authorization: `Bearer ${refreshed.access_token}`,
          'Content-Type': 'application/json',
        },
      });
      if (!retry.ok) throw new Error('Retry failed');
      const data = await retry.json();
      return data.records || [];
    } catch {
      store.clearAuth();
      throw new Error('Salesforce session expired — please reconnect.');
    }
  }

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err[0]?.message || `Salesforce query failed (${response.status})`);
  }

  const data = await response.json();
  return data.records || [];
}

// ---------------------------------------------------------------------------
// Fetch Functions
// ---------------------------------------------------------------------------

/**
 * Fetch Tasks (calls, emails, follow-ups) within a date range.
 */
export async function fetchSalesforceTasks(startDate, endDate) {
  const soql = `
    SELECT Id, Subject, Description, Status, Priority, Type, TaskSubtype,
           ActivityDate, CreatedDate, CompletedDateTime,
           OwnerId, WhoId, WhatId,
           CallDurationInSeconds, CallDisposition, CallType
    FROM Task
    WHERE ActivityDate >= ${startDate}
      AND ActivityDate <= ${endDate}
    ORDER BY ActivityDate DESC
    LIMIT 500
  `.trim().replace(/\s+/g, ' ');

  const records = await sfQuery(soql);
  useSalesforceStore.getState().setTasks(records);
  return records;
}

/**
 * Fetch Events (meetings, webinars) within a date range.
 */
export async function fetchSalesforceEvents(startDate, endDate) {
  const soql = `
    SELECT Id, Subject, Description, Location, Type,
           StartDateTime, EndDateTime, ActivityDate,
           OwnerId, WhoId, WhatId,
           DurationInMinutes, IsAllDayEvent,
           ShowAs
    FROM Event
    WHERE ActivityDate >= ${startDate}
      AND ActivityDate <= ${endDate}
    ORDER BY StartDateTime DESC
    LIMIT 500
  `.trim().replace(/\s+/g, ' ');

  const records = await sfQuery(soql);
  useSalesforceStore.getState().setEvents(records);
  return records;
}

/**
 * Fetch Opportunities (pipeline/conversion data).
 */
export async function fetchSalesforceOpportunities() {
  const soql = `
    SELECT Id, Name, StageName, Amount, Probability,
           CloseDate, CreatedDate, LastModifiedDate,
           OwnerId, AccountId, Type,
           Description, NextStep, ForecastCategoryName
    FROM Opportunity
    WHERE IsClosed = false
       OR CloseDate >= LAST_N_MONTHS:3
    ORDER BY CloseDate ASC
    LIMIT 200
  `.trim().replace(/\s+/g, ' ');

  const records = await sfQuery(soql);
  useSalesforceStore.getState().setOpportunities(records);
  return records;
}

/**
 * Fetch Salesforce Users (to map OwnerId → name).
 */
export async function fetchSalesforceUsers() {
  const soql = `
    SELECT Id, Name, FirstName, LastName, Email, IsActive
    FROM User
    WHERE IsActive = true
    ORDER BY Name ASC
    LIMIT 50
  `.trim().replace(/\s+/g, ' ');

  const records = await sfQuery(soql);
  useSalesforceStore.getState().setUsers(records);
  return records;
}

/**
 * Fetch all SF data for a given date range.
 * Called when the Sales page loads or refreshes.
 */
export async function fetchAllSalesforceData(startDate, endDate) {
  const store = useSalesforceStore.getState();
  if (!store.isAuthenticated) return;

  store.setLoading(true);
  try {
    await Promise.all([
      fetchSalesforceTasks(startDate, endDate),
      fetchSalesforceEvents(startDate, endDate),
      fetchSalesforceOpportunities(),
      fetchSalesforceUsers(),
    ]);
    store.setLastFetchedAt();
    store.setLoading(false);
  } catch (err) {
    console.error('Salesforce data fetch failed:', err);
    store.setError(err.message);
  }
}

// ---------------------------------------------------------------------------
// KPI Mapping Helpers
// ---------------------------------------------------------------------------

/**
 * Map Salesforce Tasks + Events into KPI-ready counts.
 * Returns an object matching the salesStore KPI entry shape.
 */
export function mapSalesforceToKPIs(tasks, events, userMap) {
  // userMap: { 'Alex': sfUserId, 'Ken': sfUserId }
  const alexId = userMap?.Alex;
  const kenId = userMap?.Ken;

  const calls = tasks.filter((t) =>
    t.TaskSubtype === 'Call' || t.Type === 'Call' || t.CallType);

  const outboundCalls = calls.filter((t) =>
    t.CallType === 'Outbound' || t.CallType === 'External');

  const advisorConversations = outboundCalls.filter((t) =>
    t.CallDisposition && !['No Answer', 'Left Message', 'Voicemail', 'Busy'].includes(t.CallDisposition));

  const emails = tasks.filter((t) =>
    t.TaskSubtype === 'Email' || t.Type === 'Email');

  const meetings = events.filter((e) =>
    !e.IsAllDayEvent);

  return {
    outboundCallsLogged: outboundCalls.length,
    advisorConversations: advisorConversations.length,
    emailsSent: emails.length,
    inPersonMeetingsTaken: meetings.length,
    // These would need custom fields or more specific filtering:
    materialsSent: 0,
    appointmentsSetForKen: 0,
    newFirmsVisited: 0,
    scheduledMeetings: events.length,
    webinarsHosted: 0,
    webinarAttendees: 0,
    meetingsAdvancing: 0,
    materialsRequested: 0,
    factRightViewed: 0,
    factRightFollowUpHrs: null,
    postMeetingFollowUpHrs: null,
    subAgreementsSent: 0,
    subAgreementsCompleted: 0,
    capitalFunded: 0,
    // Raw data for drill-down
    _rawCalls: calls,
    _rawEmails: emails,
    _rawMeetings: meetings,
  };
}
