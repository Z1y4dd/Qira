#!/usr/bin/env bash
set -euo pipefail

# Gate: every (authenticated) route-group layout must declare:
#   export const dynamic = "force-dynamic"
#
# This prevents Next.js from statically caching authenticated pages, which would
# serve stale session data. The gate fails if any authenticated layout is missing
# the declaration — and also fails if NO authenticated layouts exist at all
# (guards against the regression where the route group placeholder is accidentally
# deleted before Phase 2 adds real auth).

EXPECTED='export const dynamic = .force-dynamic.'

# Resolve repo root regardless of where this script is invoked from
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Find all (authenticated) layout files under src/app/ or app/.
# Robust to nesting depth: walks the app roots, finds any directory named
# '(authenticated)', then collects layout.tsx files inside it.
LAYOUTS=()
for ROOT in "$REPO_ROOT/src/app" "$REPO_ROOT/app"; do
  [[ -d "$ROOT" ]] || continue
  while IFS= read -r dir; do
    while IFS= read -r layout; do
      LAYOUTS+=("$layout")
    done < <(find "$dir" -type f -name 'layout.tsx' 2>/dev/null)
  done < <(find "$ROOT" -type d -name '(authenticated)' 2>/dev/null)
done

if [[ ${#LAYOUTS[@]} -eq 0 ]]; then
  echo "ERROR: No (authenticated) layouts found. Expected at least one under src/app/ or app/."
  exit 1
fi

FAILED=0
for layout in "${LAYOUTS[@]}"; do
  if ! grep -qE "$EXPECTED" "$layout"; then
    echo "ERROR: $layout missing 'export const dynamic = \"force-dynamic\"'"
    FAILED=1
  fi
done

if [[ $FAILED -eq 1 ]]; then
  exit 1
fi

echo "OK: All authenticated layouts have force-dynamic."
