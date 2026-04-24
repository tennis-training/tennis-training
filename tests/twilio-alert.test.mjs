import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAlertSmsBody, sendTwilioAlert } from '../scripts/twilio-alert.mjs';

test('buildAlertSmsBody includes key fields', () => {
  const msg = buildAlertSmsBody({
    runName: 'Daily Tennis Dashboard Sync',
    runId: '123',
    failedStage: 'github_push',
    failedStep: 'Commit and push',
    runUrl: 'https://example.test/run/123'
  });

  assert.match(msg, /ALERT: DASHBOARD SYNC FAILED/);
  assert.match(msg, /Workflow: Daily Tennis Dashboard Sync/);
  assert.match(msg, /Run: 123/);
  assert.match(msg, /Stage: github_push/);
  assert.match(msg, /Step: Commit and push/);
  assert.match(msg, /https:\/\/example\.test\/run\/123/);
});

test('sendTwilioAlert skips when secrets are missing', async () => {
  const result = await sendTwilioAlert({
    env: {
      TWILIO_ACCOUNT_SID: '',
      TWILIO_AUTH_TOKEN: '',
      TWILIO_FROM_NUMBER: '',
      ALERT_TO_NUMBER: ''
    },
    fetchImpl: async () => {
      throw new Error('fetch must not be called when secrets are missing');
    }
  });

  assert.equal(result.skipped, true);
  assert.match(result.reason, /Missing Twilio secrets/);
});

test('sendTwilioAlert posts to Twilio and returns SID/status', async () => {
  let seen = null;
  const env = {
    TWILIO_ACCOUNT_SID: 'AC1234567890abcdef1234567890abcd',
    TWILIO_AUTH_TOKEN: 'token-123',
    TWILIO_FROM_NUMBER: '+12345678901',
    ALERT_TO_NUMBER: '+10987654321',
    RUN_NAME: 'Monthly Google Token Health Check',
    RUN_ID: '999',
    FAILED_STAGE: 'token_calendar_health',
    FAILED_STEP: 'Validate Google token and calendar access',
    RUN_URL: 'https://example.test/run/999'
  };

  const result = await sendTwilioAlert({
    env,
    fetchImpl: async (url, options) => {
      seen = { url, options };
      return {
        ok: true,
        async json() {
          return { sid: 'SM123', status: 'queued' };
        }
      };
    }
  });

  assert.equal(result.skipped, false);
  assert.equal(result.sid, 'SM123');
  assert.equal(result.status, 'queued');
  assert.equal(
    seen.url,
    `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`
  );
  assert.equal(seen.options.method, 'POST');
  assert.match(String(seen.options.headers.Authorization), /^Basic /);

  const bodyText = seen.options.body.toString();
  assert.match(bodyText, /To=%2B10987654321/);
  assert.match(bodyText, /From=%2B12345678901/);
  assert.match(bodyText, /ALERT%3A\+DASHBOARD\+SYNC\+FAILED/);
});

test('sendTwilioAlert throws on non-2xx response', async () => {
  await assert.rejects(
    () =>
      sendTwilioAlert({
        env: {
          TWILIO_ACCOUNT_SID: 'AC1234567890abcdef1234567890abcd',
          TWILIO_AUTH_TOKEN: 'token-123',
          TWILIO_FROM_NUMBER: '+12345678901',
          ALERT_TO_NUMBER: '+10987654321'
        },
        fetchImpl: async () => ({
          ok: false,
          status: 400,
          async text() {
            return '{"code":21608,"message":"unverified"}';
          }
        })
      }),
    /Twilio SMS failed \(400\):/
  );
});

