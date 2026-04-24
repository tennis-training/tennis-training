# Privacy Safeguards Runbook

## Goal

Protect personal identifiers and secrets while keeping public GitHub Pages updates automated.

## Implemented Controls

- Public workflow sets `PUBLIC_BUILD=1` in `.github/workflows/daily-dashboard-sync.yml`.
- Sync script (`scripts/sync-calendar-to-index.mjs`) anonymizes session titles when `PUBLIC_BUILD=1`.
- Public page title/header are neutral in `index.html`.
- No OAuth credentials are hardcoded in repository files.

## Safe Commands

Public-safe manual sync:

```bash
PUBLIC_BUILD=1 node scripts/sync-calendar-to-index.mjs
```

Local/private sync (full-detail local use only):

```bash
node scripts/sync-calendar-to-index.mjs
```

## Pre-Push Checklist

1. Run public-safe sync command if data changed.
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

## Incident Response

If a token is exposed:

1. Revoke token in Google account/security console.
2. Generate a new refresh token.
3. Update GitHub secrets (`GOOGLE_REFRESH_TOKEN` and others if needed).
4. Re-run workflow manually and verify success.
