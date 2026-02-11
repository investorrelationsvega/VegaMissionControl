// ═══════════════════════════════════════════════
// VEGA MISSION CONTROL — Calendar Service
// Fetch and transform Google Calendar events
// Uses existing Google auth token
// ═══════════════════════════════════════════════

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * Fetch upcoming events from Google Calendar.
 * Returns raw event objects from the API.
 */
export async function fetchUpcomingEvents(accessToken, daysAhead = 60, maxResults = 12) {
  const now = new Date();
  const future = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000);

  const params = new URLSearchParams({
    timeMin: now.toISOString(),
    timeMax: future.toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: String(maxResults),
  });

  const res = await fetch(`${CALENDAR_API}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Calendar fetch failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return (data.items || []).map(mapEventToUpcomingDate);
}

/**
 * Transform a Google Calendar event into the upcomingDates card shape.
 */
export function mapEventToUpcomingDate(event) {
  // Parse start — could be dateTime (timed) or date (all-day)
  const startRaw = event.start?.dateTime || event.start?.date || '';
  const startDate = new Date(startRaw);

  // Format date for display
  const formatted = formatEventDate(startDate, !event.start?.dateTime);

  // Badge based on proximity
  const { badgeText, badgeClass } = getProximityBadge(startDate);

  // Attendees — pick first non-organizer as primary, second as secondary
  const attendees = (event.attendees || []).filter(
    (a) => !a.organizer && !a.self,
  );
  const organizerEmail = event.organizer?.email || '';
  const primary = attendees[0]?.email || organizerEmail;
  const secondary = attendees[1]?.email || '';

  return {
    id: `GCAL-${event.id}`,
    title: event.summary || '(No title)',
    date: formatted,
    badgeText,
    badgeClass,
    primary,
    secondary,
    _startTime: startDate.getTime(), // for sorting
  };
}

function formatEventDate(date, allDay) {
  if (isNaN(date.getTime())) return '';
  const opts = { weekday: 'short', month: 'short', day: 'numeric' };
  if (!allDay) {
    opts.hour = 'numeric';
    opts.minute = '2-digit';
  }
  return date.toLocaleDateString('en-US', opts);
}

function getProximityBadge(date) {
  const now = new Date();
  const diffMs = date.getTime() - now.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < 0) {
    return { badgeText: 'Past', badgeClass: 'badge-muted' };
  }
  if (diffDays < 1) {
    return { badgeText: 'Today', badgeClass: 'badge-green' };
  }
  if (diffDays < 7) {
    return { badgeText: 'This Week', badgeClass: 'badge-yellow' };
  }
  return { badgeText: 'Upcoming', badgeClass: 'badge-muted' };
}
