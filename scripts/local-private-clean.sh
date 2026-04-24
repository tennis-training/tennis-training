#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
cd "$repo_root"

./scripts/local-private-save.sh
git restore --source=HEAD --worktree index.html

echo "Saved private snapshot and reset index.html to HEAD."
