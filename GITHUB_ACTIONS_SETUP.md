# GitHub Actions Always-On Scheduler Setup

This repo includes an always-on scheduler workflow at:

- `.github/workflows/daily-dashboard-sync.yml`

It runs daily and updates `index.html` session data from Google Calendar.

## 1) Add GitHub Secrets

In your GitHub repo:

- `Settings` -> `Secrets and variables` -> `Actions` -> `New repository secret`

Create these secrets:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REFRESH_TOKEN`
- `GOOGLE_CALENDAR_ID` (use `primary` unless you need another calendar)

## 2) Google OAuth Credentials

Use Google Cloud Console to create OAuth client credentials with Calendar read scope:

- Scope needed: `https://www.googleapis.com/auth/calendar.readonly`

Generate a refresh token once, then store it as `GOOGLE_REFRESH_TOKEN`.

## 3) Run First Test

- Go to `Actions` tab
- Open `Daily Tennis Dashboard Sync`
- Click `Run workflow`

If session data changed, the workflow commits and pushes to `main`.
If no real data changed, it exits cleanly with no commit.

## 4) Privacy Safeguards (Public GitHub Pages)

The workflow rewrites only:

- `const sessions = [...]`
- `const courtBookingClayDates = new Set([...])`

The workflow sets:

- `PUBLIC_BUILD=1`

This forces anonymized session titles during sync so public source does not contain personal names or club names.

## 5) Local vs Public Sync Rules

Use this when you are syncing data intended for public GitHub Pages:

```bash
PUBLIC_BUILD=1 node scripts/sync-calendar-to-index.mjs
```

If you run local sync without `PUBLIC_BUILD=1`, full-detail labels may be written locally for private localhost use. Do not push those full-detail changes to a public repo.

## 6) Pre-Push Privacy Check (Recommended)

Before pushing to a public repo, run:

```bash
rg -n -f .pii-watchlist.txt index.html -i -S
```

Expected result: no matches.

Create `.pii-watchlist.txt` locally (do not commit it) with any personal names/locations you want to detect.

## 7) Secrets Safety

- Never commit raw OAuth credentials or tokens to files.
- Keep credentials only in:
  - GitHub Actions secrets
  - Local shell environment variables
- If any access token is accidentally exposed in chat/logs, revoke it and re-authenticate.
