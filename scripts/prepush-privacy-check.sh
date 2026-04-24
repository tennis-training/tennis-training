#!/usr/bin/env bash
set -euo pipefail

if [[ ! -f .pii-watchlist.txt ]]; then
  cat <<'EOF'
Missing .pii-watchlist.txt
Create it locally with sensitive terms (one per line), for example:
  person_name
  location_name
Then rerun this check.
EOF
  exit 2
fi

echo "Running PII scan against index.html..."
if rg -n -f .pii-watchlist.txt index.html -i -S; then
  echo "PII terms detected. Do not push."
  exit 1
fi

echo "Running hardcoded secret pattern scan..."
if rg -n "(GOCSPX-|ya29\\.|refresh_token\\s*[:=]\\s*['\\\"]|client_secret\\s*[:=]\\s*['\\\"])" -S; then
  echo "Potential hardcoded secret pattern detected. Do not push."
  exit 1
fi

echo "Privacy check passed."
