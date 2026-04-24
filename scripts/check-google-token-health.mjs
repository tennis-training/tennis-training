#!/usr/bin/env node

const REQUIRED = [
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN'
];

for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID || 'primary';

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
    throw new Error(`Token refresh failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  if (!json.access_token) {
    throw new Error('Token refresh succeeded but no access_token was returned.');
  }

  return json;
}

async function checkCalendarAccess(accessToken) {
  const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(CALENDAR_ID)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Calendar access failed (${res.status}): ${body}`);
  }

  return res.json();
}

async function main() {
  const token = await fetchAccessToken();
  const calendar = await checkCalendarAccess(token.access_token);

  const out = {
    ok: true,
    checkedAt: new Date().toISOString(),
    calendarId: CALENDAR_ID,
    calendarSummary: calendar.summary || null,
    tokenExpiresInSeconds: token.expires_in ?? null,
    tokenScope: token.scope ?? null
  };

  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});

