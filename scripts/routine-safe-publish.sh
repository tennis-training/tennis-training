#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

dry_run=0
sync_local_first=1
commit_message=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      dry_run=1
      shift
      ;;
    --no-local-sync)
      sync_local_first=0
      shift
      ;;
    --message)
      commit_message="${2:-}"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: scripts/routine-safe-publish.sh [--dry-run] [--no-local-sync] [--message \"...\"]"
      exit 1
      ;;
  esac
done

restore_private() {
  if [[ -f .local/index.local.private.html ]]; then
    ./scripts/local-private-restore.sh >/dev/null 2>&1 || true
  fi
}
trap restore_private EXIT

if [[ "$sync_local_first" -eq 1 ]]; then
  echo "[routine] Refreshing local private data from calendar..."
  ./scripts/sync-local-full.sh
fi

echo "[routine] Saving private local snapshot..."
./scripts/local-private-save.sh

echo "[routine] Building public-safe artifact..."
./scripts/sync-public-safe.sh

echo "[routine] Running pre-push privacy and parity checks..."
./scripts/prepush-privacy-check.sh

if git diff --quiet -- index.html; then
  echo "[routine] No public artifact changes to publish."
  exit 0
fi

if [[ "$dry_run" -eq 1 ]]; then
  echo "[routine] Dry-run mode: showing diff only."
  git diff --stat -- index.html
  exit 0
fi

if [[ -z "$commit_message" ]]; then
  commit_message="chore: safe public dashboard publish"
fi

echo "[routine] Committing public-safe index.html..."
git add index.html
git commit -m "$commit_message"

echo "[routine] Pushing to origin/main..."
git push origin main

echo "[routine] Publish complete. Private local view restored."
