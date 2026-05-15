---
phase: 01-foundation
plan: 05
slice_name: sdk-allowlist-playwright
status: complete-with-deferred-baseline
completed_date: "2026-05-15"
duration_minutes: 25
tasks_completed: 5
tasks_total: 6
files_created: 0
files_modified: 3
commits: 1
key_decisions:
  - Visual baseline PNG capture deferred to first CI run — local Playwright launch blocked by missing libnspr4 / libnss3 / libasound2 system libs (sudo apt required on this WSL distro)
  - CI uses `playwright install --with-deps` on ubuntu-latest, which installs the system libs and the browsers in one step
  - playwright-report and test-results added to .gitignore; only __screenshots__/.gitkeep tracked
  - SDK allow-list shipped with an extra `isAllowedHost()` helper not in the plan; the network-audit Playwright spec already uses it
tags:
  - playwright
  - e2e
  - rtl
  - visual-regression
  - sdk-allowlist
  - compliance
  - ci
requires:
  - next.js-16-app-router-scaffold
  - vitest-infrastructure
  - drizzle-schema-eight-entities
  - arabic-text-primitive
provides:
  - playwright-config-four-projects
  - rtl-baseline-spec
  - network-audit-spec
  - sdk-allowlist-runtime
  - ci-e2e-pipeline
affects:
  - slice-6-deploy
  - phase-2-auth
  - phase-3-placement
  - phase-4-reader
tech_stack_added: []
tech_patterns:
  - Four-project Playwright matrix (chromium+webkit × desktop+mobile) for RTL/WebKit-mobile coverage
  - Same-origin-implicit allow-list with explicit forbidden-host commentary
  - Network listener attached BEFORE page.goto to capture first-paint requests
  - CI caches ~/.cache/ms-playwright keyed on pnpm-lock.yaml to skip re-download
key_files_modified:
  - .github/workflows/ci.yml
  - package.json
  - .gitignore
---

# Phase 1 Plan 05: SDK Allow-List + Playwright RTL Baseline Summary

**SDK allow-list, four-project Playwright config, RTL baseline spec, and network-audit spec were all shipped during initial scaffolding. This slice wired Playwright into CI with --with-deps installation, browser caching, and failure-artifact upload. Visual baseline PNG capture deferred to first CI run (or a one-time local run after `sudo apt install libnspr4 libnss3 libasound2t64`).**

## Performance
- **Duration:** ~25 min
- **Tasks:** 5/6 complete + 1 deferred (visual-baseline PNG capture, blocked by local sudo)
- **Files modified:** 3
- **Commits:** 1

## Tasks Verified

| Task | Description | Status | Evidence |
|------|-------------|--------|----------|
| 5.1 | `src/lib/sdk-allowlist.ts` Supabase-only allow-list | ✓ shipped | `ALLOWED_HOST_PATTERNS` exports 2 Supabase regexes + `isAllowedHost()` helper |
| 5.2 | Vitest sanity-test for allow-list shape | ✓ shipped | `tests/invariants/sdk-allowlist.test.ts` — 6 tests pass |
| 5.3 | Playwright config with 4 projects | ✓ shipped | `playwright.config.ts` enumerates chromium-desktop / chromium-mobile (Pixel 7) / webkit-desktop / webkit-mobile (iPhone 14) |
| 5.4 | `network-audit.spec.ts` (COMP-LEGAL-01 + FOUND-03 runtime gate) | ✓ shipped | Two tests: allow-listed-only + zero Google Fonts hosts |
| 5.5 | `rtl-baseline.spec.ts` capturing initial snapshots | ⚠ partial | All 4 functional tests authored (lang/dir, font, bdi locator, visual baseline). **PNG baselines not yet captured** — local browser launch blocked by missing system libs |
| 5.6 | CI wired with build + Playwright (4 projects) | ✓ shipped | `.github/workflows/ci.yml` runs install --with-deps, cache, e2e, upload-artifact on failure |

## Decisions & Deviations

### D1: Local Playwright launch blocked by missing system libs
Running `playwright test --update-snapshots` from this WSL distro fails with `libnspr4.so: cannot open shared object file: No such file or directory`. The standard remedy (`playwright install --with-deps`) requires sudo (it runs `apt install`). Documented two paths forward in the SUMMARY note: (a) `sudo apt install libnspr4 libnss3 libasound2t64` then re-run `pnpm e2e:update-snapshots`; (b) trigger a one-shot CI run in snapshot-update mode to seed baselines, then commit them. Tracking as deferred — does not gate Plan 05 closure because all source artifacts are in place and CI will generate consistent Ubuntu baselines on first run anyway (the plan itself flagged that local-vs-CI rendering may diverge).

### D2: CI uses official --with-deps installer
On ubuntu-latest the standard pattern is `playwright install --with-deps chromium webkit`. This installs the same system libs that block local execution. Cached on `~/.cache/ms-playwright` keyed by `pnpm-lock.yaml` hash, so re-runs skip the ~500 MB browser binary download.

### D3: Extra `isAllowedHost()` helper in sdk-allowlist.ts
The plan's reference code exported only `ALLOWED_HOST_PATTERNS`. The shipped file exports both the patterns and a small `isAllowedHost(url, pageOrigin)` helper that wraps the same-origin-implicit + pattern check. The Vitest sanity test and the Playwright network-audit spec both reuse this helper, eliminating duplication. Strict superset of the plan, no behavior change.

### D4: pnpm-workspace.yaml auto-stub reverted (housekeeping)
`pnpm add @playwright/test ...` (had it been needed — playwright was already installed) and other `pnpm add` calls scaffold an `allowBuilds:` placeholder block in `pnpm-workspace.yaml` with literal `"set this to true or false"` values. That stub is not actionable as committed; reverted twice during Phase 1 closeout to keep workspace.yaml clean.

## Files Created/Modified
- `.github/workflows/ci.yml` — appended cache, install --with-deps, e2e run, upload-artifact on failure.
- `package.json` — added `e2e` and `e2e:update-snapshots` scripts.
- `.gitignore` — excluded /playwright-report, /test-results, /blob-report.
- `tests/e2e/__screenshots__/.gitkeep` — pre-existing, kept.

## Next Slice Readiness
- Slice 6 (Deploy + Verify) can reuse the Playwright suite by setting `PLAYWRIGHT_BASE_URL=https://qira-<hash>.vercel.app` — the webServer config skips local dev when the env var is set.
- Phase 2 auth tests can extend the same Playwright matrix for the cross-user E2E (parent A vs parent B no-bleed) without further config.

## What is NOT done
- **Committed PNG baselines** for `rtl-baseline.spec.ts` — first CI run (or local after sudo apt) needs `pnpm e2e:update-snapshots` to seed them. Until baselines exist, the `landing visual baseline` test will fail in CI; expected and documented.
- Webkit-on-Linux dep verification — `playwright install --with-deps webkit` on Ubuntu may pull additional libs; CI's standard installer handles this.
- Production-domain network audit (Slice 6, against the live Vercel URL).
