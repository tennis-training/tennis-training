#!/usr/bin/env bash
set -euo pipefail

echo "[auto-guard] Running public-safe sync..."
./scripts/sync-public-safe.sh

echo "[auto-guard] Running privacy checks..."
./scripts/prepush-privacy-check.sh

echo "[auto-guard] OK: public-safe sync and privacy checks passed."
