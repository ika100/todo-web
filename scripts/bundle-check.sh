#!/usr/bin/env bash
# AC-001.25: the TODO_API_URL value must never appear in any file sent to the
# browser. Build with a distinctive placeholder and grep .next/static for it.
set -euo pipefail

cd "$(dirname "$0")/.."

PLACEHOLDER="http://todo-api-bundle-check.invalid:9999"
HOST="todo-api-bundle-check.invalid"

TODO_API_URL="$PLACEHOLDER" pnpm build

if [ ! -d .next/static ]; then
  echo "bundle-check: .next/static missing after build" >&2
  exit 1
fi

hits="$(grep -rlF -e "$PLACEHOLDER" -e "$HOST" .next/static || true)"
if [ -n "$hits" ]; then
  echo "bundle-check: FAIL (AC-001.25): TODO_API_URL leaked into browser files:" >&2
  echo "$hits" >&2
  exit 1
fi

echo "bundle-check: OK - TODO_API_URL placeholder not found in .next/static (AC-001.25)"
