#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

cd "$repo_root/packages/desktop"

if [ -n "${BUN_BIN:-}" ]; then
  bun_bin="$BUN_BIN"
else
  bun_bin=""
  for candidate in "$(command -v bun 2>/dev/null || true)" "$HOME/.bun/bin/bun" "$HOME/.local/share/bun/bin/bun" /usr/local/bin/bun /opt/bun/bin/bun; do
    if [ -x "$candidate" ]; then
      bun_bin="$candidate"
      break
    fi
  done
fi

if [ -z "$bun_bin" ]; then
  echo "Bun is required to run OpenRedou Desktop in development mode." >&2
  echo "Install Bun first, then run this launcher again:" >&2
  echo "  curl -fsSL https://bun.sh/install | bash" >&2
  echo "If Bun is already installed somewhere else, set BUN_BIN=/path/to/bun in this script." >&2
  read -r -p "Press Enter to close..." _
  exit 1
fi

export OPENCODE_CHANNEL="${OPENCODE_CHANNEL:-dev}"

set +e
"$bun_bin" run dev
status="$?"
set -e

if [ "$status" -ne 0 ]; then
  echo
  read -r -p "OpenRedou Dev exited with status $status. Press Enter to close..." _
fi

exit "$status"
