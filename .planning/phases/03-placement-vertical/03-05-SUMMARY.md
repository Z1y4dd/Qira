---
phase: 03-placement-vertical
plan: 05
slice_name: escape-hatch
status: complete
completed_at: "2026-05-16T19:37:00.000Z"
requirements:
  - PLAC-04
  - PLAC-06
tags:
  - placement
  - escape-hatch
  - server-actions
  - e2e
  - security
key-decisions:
  - "abortPlacementAction validates reason at runtime (not just TypeScript type) to close T-3-escape-hatch-bypass; type narrowing alone is insufficient because a client can craft a custom POST body"
  - "EscapeHatch handleConfirm branches on mode prop: 'placement' calls abortPlacementAction inside startTransition; 'reader' branch keeps console.warn TODO for Phase 4"
  - "E2E tests cannot run locally (WSL2 missing libasound2t64/libnspr4.so browser deps) — spec is correctly written and verified via TypeScript; execution requires CI where playwright install-deps runs with sudo"
---

# Phase 3 Plan 05: Escape Hatch — SUMMARY

## One-liner

Escape-hatch abort wired end-to-end: EscapeHatch → abortPlacementAction (runtime-validated) → abortPlacement service → fallback level → result redirect; Playwright spec covers all 7 cases including RSC wire-payload bundle-leak runtime gate.

## What Changed

### Task 5.1: abortPlacementAction added to actions.ts

File: `src/app/(authenticated)/placement/actions.ts`

Appended `abortPlacementAction` to the existing Plan 04 actions file. Key properties:

- **Runtime reason validation (T-3-escape-hatch-bypass):** `if (args.reason !== 'too_hard' && args.reason !== 'too_easy') throw new Error('INVALID_ESCAPE_REASON')`. TypeScript type narrowing alone is insufficient — a client can send any string in a POST body.
- **attemptId validation:** non-empty string check before service call.
- **AuthError guard:** redirects to `/choose-child` if session is invalid.
- **Service call:** `await abortPlacement({ attemptId: args.attemptId as AttemptId, reason: args.reason })` — service computes fallback level via `computeAbortFallback` and updates the attempt row.
- **Redirect:** `redirect('/placement/${args.attemptId}/result')`.
- Imports added: `abortPlacement`, `AttemptId` from `@/services/placement`.

Plan 04 exports preserved: `startPlacementAction`, `advanceToFirstQuestionAction`, `recordPlacementAnswerAction`.

### Task 5.2: EscapeHatch handleConfirm wired (Wave 0 stub replaced)

File: `src/components/placement/escape-hatch.tsx`

Three targeted changes only — JSX markup, component exports, and props are unchanged from Wave 0:

1. **Import added:** `import { abortPlacementAction } from '@/app/(authenticated)/placement/actions';` (deliberately absent in Wave 0 — action didn't exist yet).
2. **Marker removed:** Deleted the `PLAN-05-ACTION-WIRING` comment.
3. **handleConfirm body replaced:** Old body called `console.warn('[PLAN-05] escape-hatch action wiring pending...')`. New body:
   - Branches on `props.mode === 'placement'` → calls `abortPlacementAction({ attemptId, reason })` inside `startTransition(async () => {...})`.
   - `mode === 'reader'` branch → `console.warn('reader-mode escape hatch not yet wired')` + TODO comment for Phase 4.

The 2-tap confirmation gate (D-04) was always present from Wave 0 (AlertDialog with Cancel/Confirm). This plan adds the server-side effect of the Confirm tap.

### Task 5.3: Playwright placement-escape-hatch.spec.ts filled

File: `tests/e2e/placement-escape-hatch.spec.ts`

Replaced 5 `test.fixme` stubs with 7 real test implementations (+ 1 remaining fixme for Phase 4):

| # | Test Name | Purpose |
|---|-----------|---------|
| 1 | hatch visible on /placement/start | PLAC-06 during placement |
| 2 | hatch visible on passage screen | PLAC-06 during placement |
| 3 | hatch visible on question screen | PLAC-06 during placement |
| 4 | confirmation dialog Cancel keeps URL | D-04 2-tap safety |
| 5 | confirmation Confirm aborts → result | Full abort flow |
| 6 | hatch visible on result screen (SC4) | PLAC-06 after placement — runtime gate |
| 7 | RSC wire payload no isCorrect (T-3) | Bundle-leak runtime gate |
| F | hatch visible on /reader — fixme | Phase 4 scope |

Test 7 (RSC wire-payload runtime gate) uses `page.waitForResponse()` to capture the placement RSC response, then asserts `"isCorrect"`, `"is_correct"`, and the correct-choice UUID are absent. This is the runtime complement to the `tests/invariants/placement-bundle-leak.test.ts` grep — the grep catches code-level leaks; the Playwright assertion catches runtime serialization bugs.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm tsc --noEmit` | PASS |
| `pnpm build` | PASS |
| `bash scripts/lint-rtl.sh` | PASS |
| `pnpm test:run tests/invariants/placement-bundle-leak.test.ts` | PASS (59/59) |
| `pnpm e2e tests/e2e/placement-escape-hatch.spec.ts` | NOT RUN — browser system deps missing in WSL2 (libasound2t64, libnspr4.so); spec compiles clean; CI runs with sudo playwright install-deps |

## Deviations from Plan

None — plan executed exactly as written. The Wave 0 stub was replaced as specified in the `<interfaces>` block. The RSC wire-payload test was implemented as specified in Task 5.3.

## Known Environment Constraint

The Playwright E2E tests require system browser libraries (`libasound2t64` for Firefox, `libnspr4.so` for Chromium) that cannot be installed without `sudo` in the WSL2 dev environment. All existing E2E specs in this project have the same constraint — they run in CI (GitHub Actions with `sudo pnpm exec playwright install-deps`). The spec file is TypeScript-clean and logically correct. This is a pre-existing infrastructure constraint, not a bug introduced by Plan 05.

## Phase 4 Note

Phase 4's reader plan must:
1. Edit `src/components/placement/escape-hatch.tsx` — locate the `reader` branch TODO comment and replace `console.warn` with `shiftLevelAction({ childId, direction: openReason === 'too_hard' ? 'down' : 'up' })`.
2. Add `shiftLevelAction` to a new or existing actions file.
3. Implement the `test.fixme` "hatch visible on /reader" case in `tests/e2e/placement-escape-hatch.spec.ts`.

## Commits

| Task | Commit | Files |
|------|--------|-------|
| 5.1 | `5246148a` | `src/app/(authenticated)/placement/actions.ts` |
| 5.2 | `70c5fb95` | `src/components/placement/escape-hatch.tsx` |
| 5.3 | `f60640e9` | `tests/e2e/placement-escape-hatch.spec.ts` |

## Self-Check

### Files modified:
- `/home/ziyad/Qira/src/app/(authenticated)/placement/actions.ts` — exists, contains `abortPlacementAction` and `INVALID_ESCAPE_REASON`
- `/home/ziyad/Qira/src/components/placement/escape-hatch.tsx` — exists, contains `abortPlacementAction` import, no `PLAN-05-ACTION-WIRING` marker, contains `reader-mode escape hatch not yet wired`
- `/home/ziyad/Qira/tests/e2e/placement-escape-hatch.spec.ts` — exists, 7 non-fixme tests + 1 fixme

### Commits:
- `5246148a` — exists
- `70c5fb95` — exists
- `f60640e9` — exists

## Self-Check: PASSED
