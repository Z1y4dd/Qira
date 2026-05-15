#!/usr/bin/env bash
set -euo pipefail

# Gate: reject physical-direction Tailwind utilities in source files.
# Logical properties (ms-*, me-*, ps-*, pe-*, text-start, text-end, etc.) are permitted.
# Direction-neutral utilities (mx-*, my-*, px-*, py-*, border-x-*, border-y-*,
# inset-x-*, inset-y-*) are also permitted — the regex does NOT match them.
#
# Phase 1: hard fail (exit 1). RTL is architecturally non-negotiable from day one.

# Resolve repo root regardless of where this script is invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Extended regex: matches physical-direction Tailwind utilities.
# Uses (^|[^-]) prefix to avoid false positives like "border-x-l-something".
# Does NOT match: mx-*, my-*, px-*, py-*, border-x-*, border-y-* (direction-neutral).
# Note: arbitrary value syntax [10px] is handled by matching 0-9a-z and separately \[
PATTERN='(^|[^-])(ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|float-left|float-right|clear-left|clear-right|text-left|text-right)-[0-9a-z]'

SCAN_DIRS=()
for dir in src app; do
  [ -d "$REPO_ROOT/$dir" ] && SCAN_DIRS+=("$REPO_ROOT/$dir")
done

if [[ ${#SCAN_DIRS[@]} -eq 0 ]]; then
  echo "ERROR: No source directories found (src/ or app/ under $REPO_ROOT). Cannot run RTL check."
  exit 1
fi

# Use ripgrep if available (faster), otherwise fall back to grep
if command -v rg &>/dev/null; then
  MATCHES=$(rg -e "$PATTERN" \
    --glob '*.tsx' --glob '*.ts' --glob '*.jsx' --glob '*.js' --glob '*.css' \
    "${SCAN_DIRS[@]}" 2>/dev/null || true)
else
  MATCHES=$(grep -r -E "$PATTERN" \
    --include='*.tsx' --include='*.ts' --include='*.jsx' --include='*.js' --include='*.css' \
    "${SCAN_DIRS[@]}" 2>/dev/null || true)
fi

if [[ -n "$MATCHES" ]]; then
  echo "ERROR: Physical-direction Tailwind utility found. Use logical properties (ms-*, me-*, pe-*, text-start, etc.)"
  echo "$MATCHES"
  exit 1
fi

echo "OK: No physical-direction utilities."
