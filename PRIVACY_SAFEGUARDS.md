# Privacy Safeguards Runbook

## Goal

Protect personal identifiers and secrets while keeping public GitHub Pages updates automated.

## Implemented Controls

- Local frontend (`index.html`) is the source of truth.
- GitHub Actions (`.github/workflows/daily-dashboard-sync.yml`) is the always-on scheduler for public syncs.
- Public workflow sets `PUBLIC_BUILD=1` in `.github/workflows/daily-dashboard-sync.yml`.
- Sync script (`scripts/sync-calendar-to-index.mjs`) anonymizes session titles when `PUBLIC_BUILD=1`.
- Public page title/header are neutral in `index.html`.
- No OAuth credentials are hardcoded in repository files.

## Safe Commands

Public-safe manual sync:

```bash
./scripts/sync-public-safe.sh
```

Local/private sync (full-detail local use only):

```bash
./scripts/sync-local-full.sh
```

## Pre-Push Checklist

1. Run public-safe sync command if you intend to publish.
2. Confirm no personal names/club names in `index.html`:

```bash
rg -n -f .pii-watchlist.txt index.html -i -S
```

Create `.pii-watchlist.txt` locally (and keep it uncommitted) with sensitive terms you want to block.

3. Confirm no hardcoded secrets:

```bash
rg -n "(GOCSPX-|ya29\\.|refresh_token\\s*[:=]\\s*['\\\"]|client_secret\\s*[:=]\\s*['\\\"])" -S
```

4. Push only after both checks are clean.

Helper command:

```bash
./scripts/prepush-privacy-check.sh
```

## Push Behavior

- The pre-push hook does not rewrite your local files.
- It scans committed `HEAD:index.html` (public artifact), not your local working copy.
- It blocks push when sensitive terms are detected in the committed artifact.
- Secret-pattern checks are scoped to committed `HEAD:index.html` to avoid false positives from docs/scripts text.
- It runs a critical-metrics parity test (`tests/metrics-parity.test.mjs`) and blocks push if local/public metrics diverge.

## Incident Response

If a token is exposed:

1. Revoke token in Google account/security console.
2. Generate a new refresh token.
3. Update GitHub secrets (`GOOGLE_REFRESH_TOKEN` and others if needed).
4. Re-run workflow manually and verify success.
