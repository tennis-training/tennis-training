#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

if [[ ! -f .local/index.local.private.html ]]; then
  echo "Missing .local/index.local.private.html. Run scripts/local-private-save.sh first."
  exit 1
fi

cp .local/index.local.private.html index.html
echo "Restored local private index snapshot to index.html"
