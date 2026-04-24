import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

function parseDashboardData(html) {
  const sessionsMatch = html.match(/const sessions = \[([\s\S]*?)\n    \];/);
  const clayDatesMatch = html.match(/const courtBookingClayDates = new Set\(\[([\s\S]*?)\n    \]\);/);
  if (!sessionsMatch || !clayDatesMatch) {
    throw new Error('Unable to parse sessions or clay date blocks from index.html');
  }

  const sessions = Function(`"use strict"; return [${sessionsMatch[1]}];`)();
  const clayDates = new Set(
    Array.from(clayDatesMatch[1].matchAll(/'([^']+)'/g)).map((m) => m[1])
  );

  return { sessions, clayDates };
}

function summarize(html) {
  const { sessions, clayDates } = parseDashboardData(html);

  const byType = { private: 0, squad: 0, dad: 0, competition: 0, camp: 0 };
  let totalHours = 0;
  let clayHours = 0;
  let hardHours = 0;

  for (const s of sessions) {
    const hours = (new Date(s.end) - new Date(s.start)) / 36e5;
    const dateKey = String(s.start).slice(0, 10);
    const title = String(s.title || '').toLowerCase();
    const surface = title.includes('clay') || clayDates.has(dateKey) ? 'clay' : 'hard';

    totalHours += hours;
    byType[s.rawType] = (byType[s.rawType] || 0) + 1;
    if (surface === 'clay') clayHours += hours;
    else hardHours += hours;
  }

  return {
    sessions: sessions.length,
    totalHours: Number(totalHours.toFixed(1)),
    clayHours: Number(clayHours.toFixed(1)),
    hardHours: Number(hardHours.toFixed(1)),
    byType
  };
}

test('critical metrics parity: private snapshot vs current publish artifact', (t) => {
  const privateSnapshotPath = '.local/index.local.private.html';
  if (!fs.existsSync(privateSnapshotPath)) {
    t.skip('No private snapshot found at .local/index.local.private.html');
    return;
  }

  const privateHtml = fs.readFileSync(privateSnapshotPath, 'utf8');
  const currentHtml = fs.readFileSync('index.html', 'utf8');
  const privateSummary = summarize(privateHtml);
  const currentSummary = summarize(currentHtml);

  assert.deepEqual(currentSummary, privateSummary);
});
