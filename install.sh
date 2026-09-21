#!/usr/bin/env bash
set -euo pipefail

# One line:
#   curl -fsSL https://raw.githubusercontent.com/goodnight000/exact-paste/main/install.sh | bash
# From a checkout:
#   ./install.sh
#   npm start

if ! command -v node >/dev/null 2>&1; then
  echo "Exact Paste needs Node 22+. https://nodejs.org" >&2
  exit 1
fi

SCRIPT_DIR=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
fi

if [[ -n "$SCRIPT_DIR" && -f "$SCRIPT_DIR/bin/exact-paste.mjs" ]]; then
  exec node "$SCRIPT_DIR/bin/exact-paste.mjs" "$@"
fi

if ! command -v git >/dev/null 2>&1; then
  echo "Need git, or clone exact-paste and run npm start." >&2
  exit 1
fi

REPO="${EXACT_PASTE_REPO:-https://github.com/goodnight000/exact-paste.git}"

DIR="${EXACT_PASTE_DIR:-$HOME/.exact-paste}"
if [[ -d "$DIR/.git" ]]; then
  git -C "$DIR" pull --ff-only
else
  git clone "$REPO" "$DIR"
fi
exec node "$DIR/bin/exact-paste.mjs" "$@"
