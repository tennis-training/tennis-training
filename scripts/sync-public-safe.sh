#!/usr/bin/env bash
set -euo pipefail

PUBLIC_BUILD=1 \
CALENDAR_TIMEZONE="${CALENDAR_TIMEZONE:-Australia/Melbourne}" \
node scripts/sync-calendar-to-index.mjs
