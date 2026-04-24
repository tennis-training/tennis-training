#!/usr/bin/env node

const REQUIRED = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'];
for (const key of REQUIRED) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const THRESHOLD = Number(process.env.TWILIO_MIN_BALANCE || '1');
if (!Number.isFinite(THRESHOLD) || THRESHOLD < 0) {
  throw new Error(`Invalid TWILIO_MIN_BALANCE value: ${process.env.TWILIO_MIN_BALANCE}`);
}

async function fetchTwilioBalance() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const auth = Buffer.from(`${sid}:${token}`).toString('base64');
  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`;

  const res = await fetch(url, {
    headers: { Authorization: `Basic ${auth}` }
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Twilio balance fetch failed (${res.status}): ${body}`);
  }

  const json = await res.json();
  const balance = Number(json.balance);
  if (!Number.isFinite(balance)) {
    throw new Error(`Twilio returned non-numeric balance: ${json.balance}`);
  }

  return {
    balance,
    currency: String(json.currency || 'unknown')
  };
}

async function main() {
  const data = await fetchTwilioBalance();
  const ok = data.balance >= THRESHOLD;
  const out = {
    ok,
    checkedAt: new Date().toISOString(),
    balance: Number(data.balance.toFixed(4)),
    currency: data.currency,
    threshold: THRESHOLD
  };

  console.log(JSON.stringify(out, null, 2));

  if (!ok) {
    throw new Error(
      `Twilio balance below threshold: ${out.balance} ${out.currency} < ${THRESHOLD} ${out.currency}`
    );
  }
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});

