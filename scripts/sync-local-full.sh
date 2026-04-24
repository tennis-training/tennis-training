#!/usr/bin/env bash
set -euo pipefail

CALENDAR_TIMEZONE="${CALENDAR_TIMEZONE:-Australia/Melbourne}" \
node scripts/sync-calendar-to-index.mjs
