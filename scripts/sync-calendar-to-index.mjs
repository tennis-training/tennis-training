#!/usr/bin/env node
import fs from 'fs';

const INDEX_PATH = 'index.html';
const TZ = process.env.CALENDAR_TIMEZONE || 'Australia/Melbourne';
const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';
const PUBLIC_BUILD = /^(1|true|yes)$/i.test(process.env.PUBLIC_BUILD || '');

const REQUIRED = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

function pad(n) {
  return String(n).padStart(2, '0');
}

function nowInTimezoneDateParts(date = new Date(), timeZone = TZ) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.map(p => [p.type, p.value]));
  return { year: byType.year, month: byType.month, day: byType.day };
}

function dateKeyInTimezone(iso, timeZone = TZ) {
  const d = new Date(iso);
  const parts = nowInTimezoneDateParts(d, timeZone);
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function startOfYearRfc3339InTimezone(year) {
  return `${year}-01-01T00:00:00+11:00`;
}

function endOfTodayRfc3339InTimezone() {
  const p = nowInTimezoneDateParts(new Date(), TZ);
  return `${p.year}-${p.month}-${p.day}T23:59:59+10:00`;
}

function escapeSingleQuoted(str) {
  return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

async function fetchAccessToken() {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    client_secret: process.env.GOOGLE_CLIENT_SECRET,
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
    grant_type: 'refresh_token'
  });

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Token fetch failed (${res.status}): ${body}`);
  }
  const json = await res.json();
  if (!json.access_token) {
    throw new Error('Token fetch failed: no access_token in response');
  }
  return json.access_token;
}

async function fetchEvents(accessToken, timeMin, timeMax) {
  const out = [];
  let pageToken = null;

  while (true) {
    const url = new URL(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}/events`);
    url.searchParams.set('singleEvents', 'true');
    url.searchParams.set('orderBy', 'startTime');
    url.searchParams.set('timeMin', timeMin);
    url.searchParams.set('timeMax', timeMax);
    url.searchParams.set('timeZone', TZ);
    url.searchParams.set('maxResults', '2500');
    if (pageToken) url.searchParams.set('pageToken', pageToken);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Calendar fetch failed (${res.status}): ${body}`);
    }

    const json = await res.json();
    out.push(...(json.items || []));

    if (!json.nextPageToken) break;
    pageToken = json.nextPageToken;
  }

  return out;
}

function eventText(ev) {
  return [ev.summary || '', ev.description || '', ev.location || ''].join(' ').toLowerCase();
}

function isTennisSessionEvent(ev) {
  if (!ev.start?.dateTime || !ev.end?.dateTime) return false;

  const t = eventText(ev);
  const hasTennisSignal =
    t.includes('tennis') ||
    t.includes('training') ||
    t.includes('private') ||
    t.includes('squad') ||
    t.includes('camp') ||
    t.includes('competition') ||
    t.includes('holiday program') ||
    t.includes('slamin') ||
    t.includes('dad');

  const excluded =
    t.includes('plan tennis booking') ||
    t.includes(' tennis - social') ||
    t.includes('social') ||
    t.includes('will tennis competition') ||
    t.includes('meme squad training tennis') ||
    t.includes('basket');

  const isCourtBookingOnly = /\bcourt\s*[1-9]\b/.test(t);

  return hasTennisSignal && !excluded && !isCourtBookingOnly;
}

function inferRawType(ev) {
  const t = eventText(ev);
  if (t.includes('camp') || t.includes('holiday program') || t.includes('slamin')) return 'camp';
  if (t.includes('competition') || t.includes('competitions') || /\bcomp\b/.test(t)) return 'competition';
  if (t.includes('private')) return 'private';
  if (t.includes('squad')) return 'squad';
  if (t.includes('dad')) return 'dad';
  if (t.includes('training')) return 'dad';
  return null;
}

function toSession(ev) {
  const rawType = inferRawType(ev);
  if (!rawType) return null;

  const cancelled = (ev.status || '').toLowerCase() === 'cancelled' || eventText(ev).includes('cancelled');
  const surfaceHint = eventText(ev).includes('clay') ? 'clay' : 'hard';
  const title = PUBLIC_BUILD
    ? publicTitle(rawType, cancelled, surfaceHint)
    : (ev.summary || 'Tennis session');

  return {
    start: ev.start.dateTime,
    end: ev.end.dateTime,
    rawType,
    title,
    cancelled
  };
}

function publicTitle(rawType, cancelled, surfaceHint) {
  const base = {
    private: 'Private training session',
    squad: 'Squad training session',
    dad: 'Dad coaching session',
    competition: 'Competition session',
    camp: 'Camp session'
  }[rawType] || 'Tennis session';

  const withSurface = surfaceHint === 'clay' ? `${base} (clay)` : base;
  return cancelled ? `${withSurface} (cancelled)` : withSurface;
}

function getClayOverrideDates(events) {
  const dates = new Set();
  for (const ev of events) {
    if (!ev.start?.dateTime) continue;
    const t = eventText(ev);
    if (t.includes('court 3') || t.includes('court 4')) {
      dates.add(dateKeyInTimezone(ev.start.dateTime, TZ));
    }
  }
  return [...dates].sort();
}

function formatSessionsBlock(sessions) {
  const lines = sessions.map(s => {
    const fields = [
      `start: '${escapeSingleQuoted(s.start)}'`,
      `end: '${escapeSingleQuoted(s.end)}'`,
      `rawType: '${s.rawType}'`,
      `title: '${escapeSingleQuoted(s.title)}'`
    ];
    if (s.cancelled) fields.push('cancelled: true');
    return `      { ${fields.join(', ')} }`;
  });

  return `const sessions = [\n${lines.join(',\n')}\n    ];`;
}

function formatClayDatesBlock(dates) {
  const lines = dates.map(d => `      '${d}'`);
  return `const courtBookingClayDates = new Set([\n${lines.join(',\n')}\n    ]);`;
}

function summarize(sessions) {
  const byType = { private: 0, squad: 0, dad: 0, competition: 0, camp: 0 };
  let totalHours = 0;
  for (const s of sessions) {
    byType[s.rawType] = (byType[s.rawType] || 0) + 1;
    totalHours += (new Date(s.end) - new Date(s.start)) / 36e5;
  }
  return {
    count: sessions.length,
    totalHours: Number(totalHours.toFixed(1)),
    byType
  };
}

async function main() {
  const nowParts = nowInTimezoneDateParts();
  const timeMin = startOfYearRfc3339InTimezone(nowParts.year);
  const timeMax = endOfTodayRfc3339InTimezone();

  const token = await fetchAccessToken();
  const events = await fetchEvents(token, timeMin, timeMax);

  const sessions = [];
  const seen = new Set();
  for (const ev of events) {
    if (!isTennisSessionEvent(ev)) continue;
    const s = toSession(ev);
    if (!s) continue;
    const key = `${s.start}|${s.end}|${s.rawType}|${s.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    sessions.push(s);
  }

  sessions.sort((a, b) => {
    if (a.start < b.start) return -1;
    if (a.start > b.start) return 1;
    return a.title.localeCompare(b.title);
  });

  const clayDates = getClayOverrideDates(events);

  const html = fs.readFileSync(INDEX_PATH, 'utf8');
  const nextSessionsBlock = formatSessionsBlock(sessions);
  const nextClayBlock = formatClayDatesBlock(clayDates);

  const withSessions = html.replace(/const sessions = \[[\s\S]*?\n    \];/, nextSessionsBlock);
  const withClay = withSessions.replace(/const courtBookingClayDates = new Set\(\[[\s\S]*?\n    \]\);/, nextClayBlock);

  const changed = withClay !== html;
  if (changed) fs.writeFileSync(INDEX_PATH, withClay, 'utf8');

  const summary = summarize(sessions);
  console.log(JSON.stringify({
    changed,
    window: { timeMin, timeMax, timezone: TZ },
    sessions: summary,
    clayOverrideDates: clayDates.length
  }, null, 2));
}

main().catch(err => {
  console.error(err.stack || String(err));
  process.exit(1);
});
