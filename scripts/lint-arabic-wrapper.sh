#!/usr/bin/env bash
# Phase 1 soft warning: flags Arabic Unicode block (U+0600–U+06FF) characters
# in src/ + app/ source .ts and .tsx files. Reviewer manually confirms each is
# inside <ArabicText> or in an i18n message catalog. AST-level enforcement
# deferred to Phase 4 when content lands (RESEARCH §E).
set -euo pipefail

# Resolve repo root regardless of where this script is invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

SCAN_DIRS=()
for dir in src app; do
  [ -d "$REPO_ROOT/$dir" ] && SCAN_DIRS+=("$REPO_ROOT/$dir")
done

if [[ ${#SCAN_DIRS[@]} -eq 0 ]]; then
  echo "WARN: No source directories found (src/ or app/ under $REPO_ROOT). Skipping."
  exit 0
fi

# Arabic Unicode block: U+0600–U+06FF
# Use grep with Perl-compatible regex for Unicode range
if command -v rg &>/dev/null; then
  OFFENDERS=$(rg -e '[؀-ۿ]' \
    --glob '*.tsx' --glob '*.ts' \
    "${SCAN_DIRS[@]}" --no-heading --line-number 2>/dev/null || true)
else
  OFFENDERS=$(grep -r -P '[\x{0600}-\x{06FF}]' \
    --include='*.tsx' --include='*.ts' \
    "${SCAN_DIRS[@]}" 2>/dev/null || true)
fi

if [[ -n "$OFFENDERS" ]]; then
  echo "WARN: Arabic literals found in source .ts/.tsx files. Verify each is inside <ArabicText> or i18n message catalog:"
  echo "$OFFENDERS"
  # Phase 1: soft fail (exit 0 with warning). Phase 4 will harden to exit 1.
  exit 0
fi

echo "OK: No raw Arabic literals in source .ts/.tsx files."
