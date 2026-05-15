---
phase: 01-foundation
plan: 02
slice_name: lint-and-ci-gates
status: complete
completed_date: "2026-05-15"
duration_minutes: 30
tasks_completed: 6
tasks_total: 6
files_created: 7
files_modified: 3
commits: 6
key_decisions:
  - Biome 2.x config uses tailwindDirectives in css.parser to handle Tailwind v4 @theme syntax
  - Biome file scope restricted to src/** and root config files (excludes .claude/ GSD tooling)
  - lint:ci script name used instead of ci to avoid collision with pnpm's own ci subcommand
  - bash gate scripts use grep fallback when ripgrep not in PATH (e.g. in Claude Code shell sessions)
  - Vitest RTL test uses lookbehind regex to avoid false positives from html/display/explore substrings
  - @vitest/coverage-v8@3 pinned to match vitest@3 (v4 resolves by default but has peer dep mismatch)
tags:
  - biome
  - vitest
  - ci
  - github-actions
  - rtl-gate
  - lint
requires:
  - next.js-16-app-router-scaffold
  - tailwind-v4-rtl-config
  - ar-landing-page
provides:
  - biome-lint-format
  - vitest-infrastructure
  - rtl-bash-gate
  - force-dynamic-bash-gate
  - arabic-wrapper-soft-gate
  - github-actions-ci-workflow
affects:
  - slice-3-drizzle
  - slice-4-arabic-text
  - slice-5-playwright
  - slice-6-deploy
tech_stack_added:
  - "@biomejs/biome@2.4.15"
  - vitest@3.2.4
  - "@vitest/coverage-v8@3.2.4"
  - tinyglobby@0.2.16
tech_patterns:
  - Biome 2.x as single lint+format tool replacing ESLint+Prettier
  - Vitest node environment for source-scan invariant tests (no DOM)
  - Bash gate scripts resolve REPO_ROOT via BASH_SOURCE[0] for cwd-independence
  - rg/grep fallback pattern for portability across environments
key_files_created:
  - biome.json
  - vitest.config.ts
  - scripts/lint-rtl.sh
  - scripts/lint-force-dynamic.sh
  - scripts/lint-arabic-wrapper.sh
  - tests/invariants/rtl-utilities.test.ts
  - .github/workflows/ci.yml
key_files_modified:
  - package.json
  - pnpm-lock.yaml
---

# Phase 1 Plan 02: Lint + Invariant CI Summary

One-liner: Biome 2.x as lint+format, three bash invariant gates (RTL, force-dynamic, Arabic wrapper), Vitest source-scan mirror, and GitHub Actions workflow running all gates on every push.

## Tasks Completed

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 2.1 | Configure Biome 2.x as single lint+format tool | a420b0c | biome.json, package.json (lint/lint:fix/lint:ci/format scripts) |
| 2.2 | Add scripts/lint-rtl.sh ripgrep gate | c310f28 | scripts/lint-rtl.sh |
| 2.3 | Add Vitest + rtl-utilities.test.ts mirror | f753729 | vitest.config.ts, tests/invariants/rtl-utilities.test.ts, package.json (test/test:run) |
| 2.4 | Add scripts/lint-force-dynamic.sh gate | b31ad43 | scripts/lint-force-dynamic.sh |
| 2.5 | Add scripts/lint-arabic-wrapper.sh soft-warn | 4d7a50d | scripts/lint-arabic-wrapper.sh |
| 2.6 | Wire GitHub Actions CI workflow | aa9236e | .github/workflows/ci.yml |

## Decisions Made

### D1: Biome 2.x schema differences from 1.x
Biome 2.x removed the top-level `organizeImports` key (moved to `assist.actions.source.organizeImports`) and changed `files.ignore` to `files.includes` with negation patterns. Added `css.parser.tailwindDirectives: true` to handle Tailwind v4's `@theme` directive which otherwise causes a CSS parse error. Biome's file scope restricted to `src/**` and root config files to exclude `.claude/` GSD tooling directory.

### D2: lint:ci instead of ci script name
The plan mentioned a risk of `pnpm ci` (Biome strict mode) colliding with pnpm's own internal `ci` equivalent. Named the script `lint:ci` to be unambiguous. The CI workflow calls `pnpm lint:ci`.

### D3: bash gates use grep fallback
The plan specified ripgrep (`rg`) for the bash gates, but ripgrep is not available in bash subprocesses in the current development environment (it's a Claude Code zsh shell function, not a binary). Scripts now check `command -v rg` and fall back to `grep -E` / `grep -P`. In GitHub Actions (ubuntu-latest), both `grep` and potentially `rg` (if installed) are available. The fallback ensures scripts work everywhere.

### D4: Vitest RTL regex uses lookbehind
The plan's example regex `\b(ml|mr|...)` uses `\b` word boundary which matched substrings inside words like `html` (→ `ml`), `display` (→ `pl`), `explore` (→ `pr`). Replaced with `(?<=["'\s\`\n^]|^)` lookbehind to require the utility to appear at a class string boundary. Verified catches `ml-2 mr-4` in JSX className strings.

### D5: @vitest/coverage-v8 pinned to v3
`pnpm add -D @vitest/coverage-v8` resolved to v4.1.6 (latest) which has a peer dep conflict with vitest@3. Explicitly installed `@vitest/coverage-v8@3` to match vitest@3.2.4.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Biome 2.x uses different config schema than plan's biome.json structure**
- **Found during:** Task 2.1
- **Issue:** `organizeImports` top-level key removed in Biome 2.x; moved to `assist.actions.source.organizeImports`. `files.ignore` array replaced with `files.includes` with negation patterns. CSS parser does not understand Tailwind v4 `@theme` directive by default.
- **Fix:** Rewrote biome.json with correct 2.x schema. Added `css.parser.tailwindDirectives: true`. Used Biome's own `configuration_schema.json` to verify each key.
- **Files modified:** biome.json
- **Commit:** a420b0c

**2. [Rule 1 - Bug] Vitest RTL regex matched substrings within English words**
- **Found during:** Task 2.3
- **Issue:** The plan's example regex `\b(ml|mr|pl|pr|...)-?\w*` matched `ml` inside `html`, `pl` inside `display`, `pr` inside `explore`, etc. causing the test to fail on the clean tree with false positives.
- **Fix:** Rewrote regex to use ES2018 lookbehind `(?<=["'\s\`\n^]|^)` requiring the utility to appear after a quote, whitespace, or start of string — consistent with how Tailwind classes appear in JSX.
- **Files modified:** tests/invariants/rtl-utilities.test.ts
- **Commit:** f753729

**3. [Rule 1 - Bug] lint-rtl.sh used rg which is unavailable in bash subprocesses**
- **Found during:** Task 2.2
- **Issue:** `rg` is a Claude Code shell function in zsh but does not exist in bash subprocesses. The script silently exited 0 without finding matches. Also, the `\[\]` inside the grep character class caused a malformed regex.
- **Fix:** Added `command -v rg` check with `grep -E` fallback. Simplified character class to `[0-9a-z]` (removed `\[\]` which broke ERE). Verified the script correctly fails on `ml-2` after fix.
- **Files modified:** scripts/lint-rtl.sh
- **Commit:** c310f28

## Demo Gate Status

All local CI gates verified:

| Gate | Command | Result |
|------|---------|--------|
| Biome CI | `pnpm lint:ci` | Passes — 18 files checked |
| TypeScript | `pnpm tsc --noEmit` | Passes — no errors |
| RTL bash | `bash scripts/lint-rtl.sh` | Passes — "OK: No physical-direction utilities." |
| force-dynamic bash | `bash scripts/lint-force-dynamic.sh` | Passes — "OK: All authenticated layouts have force-dynamic." |
| Arabic wrapper | `bash scripts/lint-arabic-wrapper.sh` | Passes — "OK: No raw Arabic literals in source .ts/.tsx files." |
| Vitest | `pnpm test:run` | Passes — 1 test, 1 pass |

**Deliberately-bad branch demo (Task 2.6 verification):** Deferred. This plan does not push to GitHub remote. The demo of `ml-2` failing `Lint RTL utilities (bash gate)` in GitHub Actions can be verified by:
1. Pushing this branch to the remote
2. Opening a PR that adds `ml-2` to any `.tsx` file
3. Observing the CI run fail on the `Lint RTL utilities (bash gate)` step

Local verification completed instead: `bash scripts/lint-rtl.sh` exits 1 with error line printed when `ml-2` is introduced; `pnpm test:run` fails with clear JSON offenders when `ml-2 mr-4` is added.

## Known Stubs

None. All plan-02 deliverables are fully functional. The `lint-arabic-wrapper.sh` is intentionally soft-warn (exit 0) per the plan — this is by design, not a stub.

## Threat Flags

None. This plan creates no network endpoints, auth paths, file access patterns, or schema changes. All added surface is local tooling and CI configuration files.

## Self-Check: PASSED

All 7 created files verified to exist:
- FOUND: biome.json
- FOUND: vitest.config.ts
- FOUND: scripts/lint-rtl.sh
- FOUND: scripts/lint-force-dynamic.sh
- FOUND: scripts/lint-arabic-wrapper.sh
- FOUND: .github/workflows/ci.yml
- FOUND: tests/invariants/rtl-utilities.test.ts

All 6 commits verified in git log:
- FOUND: a420b0c (Biome)
- FOUND: c310f28 (lint-rtl.sh)
- FOUND: f753729 (Vitest)
- FOUND: b31ad43 (lint-force-dynamic.sh)
- FOUND: 4d7a50d (lint-arabic-wrapper.sh)
- FOUND: aa9236e (ci.yml)
