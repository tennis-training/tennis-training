#!/usr/bin/env node

function requiredSecrets(env) {
  return ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_FROM_NUMBER', 'ALERT_TO_NUMBER']
    .filter((k) => !env[k]);
}

function valueOrUnknown(v) {
  const out = String(v || '').trim();
  return out ? out : 'unknown';
}

export function buildAlertSmsBody(meta = {}) {
  const runName = valueOrUnknown(meta.runName);
  const runId = valueOrUnknown(meta.runId);
  const failedStage = valueOrUnknown(meta.failedStage);
  const failedStep = valueOrUnknown(meta.failedStep);
  const runUrl = valueOrUnknown(meta.runUrl);

  return `ALERT: DASHBOARD SYNC FAILED | Workflow: ${runName} | Run: ${runId} | Stage: ${failedStage} | Step: ${failedStep} | ${runUrl}`;
}

export async function sendTwilioAlert({ env = process.env, fetchImpl = fetch } = {}) {
  const missing = requiredSecrets(env);
  if (missing.length) {
    return { skipped: true, reason: `Missing Twilio secrets: ${missing.join(', ')}` };
  }

  const body = buildAlertSmsBody({
    runName: env.RUN_NAME,
    runId: env.RUN_ID,
    failedStage: env.FAILED_STAGE,
    failedStep: env.FAILED_STEP,
    runUrl: env.RUN_URL
  });

  const params = new URLSearchParams({
    To: env.ALERT_TO_NUMBER,
    From: env.TWILIO_FROM_NUMBER,
    Body: body
  });

  const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;

  const res = await fetchImpl(url, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Twilio SMS failed (${res.status}): ${txt}`);
  }

  const json = await res.json();
  return { skipped: false, sid: json.sid || null, status: json.status || null };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  sendTwilioAlert()
    .then((result) => {
      if (result.skipped) {
        console.log(result.reason);
        process.exit(0);
      }
      console.log(`Twilio SMS sent. SID=${result.sid || 'n/a'} status=${result.status || 'n/a'}`);
    })
    .catch((err) => {
      console.error(err.stack || String(err));
      process.exit(1);
    });
}

