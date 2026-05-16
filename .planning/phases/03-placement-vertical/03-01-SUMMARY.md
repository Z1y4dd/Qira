---
phase: 03-placement-vertical
plan: "01"
slice_name: wave-0-foundation
subsystem: placement
tags: [schema-migration, shadcn, escape-hatch, test-scaffolding, db-verification]
dependency_graph:
  requires: []
  provides:
    - src/components/ui/alert-dialog (AlertDialog primitive)
    - src/components/placement/escape-hatch (EscapeHatch shell with mode prop)
    - drizzle/migrations/0001_phase3_placement.sql (additive migration applied)
    - scripts/db-verify-columns.ts (T-3-schema-drift gate)
    - 8 test stubs for Wave 1+ plans
  affects:
    - src/db/schema.ts (6 new columns + 1 new enum)
    - package.json (new @radix-ui/react-alert-dialog dep, new db:verify-columns script)
    - vitest.config.ts (added src/**/*.test.ts to include pattern)
tech_stack:
  added:
    - "@radix-ui/react-alert-dialog ^1.1.15 (runtime dependency)"
  patterns:
    - "EscapeHatch Client Component with AlertDialog 2-tap confirmation"
    - "db-verify-columns script using information_schema.columns query (T-3-schema-drift gate)"
    - "Vitest test.todo() for stub tests + fully-implemented invariant"
    - "Playwright test.fixme() for E2E spec stubs"
key_files:
  created:
    - src/components/ui/alert-dialog.tsx
    - src/components/placement/escape-hatch.tsx
    - drizzle/migrations/0001_phase3_placement.sql
    - scripts/db-verify-columns.ts
    - src/services/placement.test.ts
    - src/services/placement.integration.test.ts
    - src/db/seed/placement-placeholder.test.ts
    - tests/invariants/placement-bundle-leak.test.ts
    - tests/e2e/placement-cross-parent.spec.ts
    - tests/e2e/placement-escape-hatch.spec.ts
    - tests/e2e/placement-flow.spec.ts
  modified:
    - src/db/schema.ts
    - package.json
    - vitest.config.ts
    - drizzle/migrations/meta/_journal.json
decisions:
  - "Used React.JSX.Element return type on EscapeHatch to satisfy TypeScript without JSX global namespace"
  - "Updated vitest.config.ts to include src/**/*.test.ts (Rule 3 fix: plan stub files in src/ were outside test include pattern)"
  - "Renamed generated migration from 0001_loving_grandmaster.sql to 0001_phase3_placement.sql and updated _journal.json tag accordingly"
metrics:
  duration: "~25 minutes"
  completed_date: "2026-05-16"
  tasks_completed: 7
  tasks_total: 7
  files_created: 11
  files_modified: 4
---

# Phase 3 Plan 01: Wave 0 Foundation Summary

Wave 0 shared infrastructure for the Phase 3 placement vertical. All 7 tasks executed. Live Supabase DB has the Phase 3 schema additions; shadcn AlertDialog is importable; EscapeHatch shell component is importable and renderable; 8 test stubs exist for Wave 1+ plans; T-3-bundle-leak and T-3-schema-drift gates are active.

## What Was Built

### Task 1.1: Install shadcn AlertDialog primitive

Ran `pnpm dlx shadcn@latest add alert-dialog`. The component arrived with RTL conventions baked in (the project was initialized with `--rtl` in Phase 1). Fixed Biome lint issues (import ordering, trailing semicolons) via `pnpm lint:fix`.

`@radix-ui/react-alert-dialog` appears in `dependencies` (not devDependencies).

Commit: `43aef5a2`

### Task 1.2: Add Phase 3 columns + enum to src/db/schema.ts

Added to `src/db/schema.ts`:
- Imports: `boolean`, `jsonb` added to `drizzle-orm/pg-core`
- New enum: `escapeHatchReason = pgEnum('escape_hatch_reason', ['too_hard', 'too_easy'])`
- `attempts` table: `escapeHatched`, `escapeHatchedAt`, `escapeHatchedReason`, `placementBankVersion`
- `attempt_answers` table: `choiceOrder` (jsonb)
- `texts` table: `isPlaceholder` (boolean, default false, notNull)
- `questions` table: `isPlaceholder` (boolean, default false, notNull)

No redundant `assigned_level` integer column — `assignedLevelId` UUID FK already existed (per D-07 reconciliation). RLS coverage invariant still passes (no new tables).

Commit: `0378fda7`

### Task 1.3: Generate Phase 3 migration SQL

`pnpm db:generate` emitted `drizzle/migrations/0001_loving_grandmaster.sql`. Renamed to `0001_phase3_placement.sql` and updated `meta/_journal.json` tag to `0001_phase3_placement`.

Generated SQL (additive only, zero DROP / ALTER COLUMN):

```sql
CREATE TYPE "public"."escape_hatch_reason" AS ENUM('too_hard', 'too_easy');
ALTER TABLE "attempt_answers" ADD COLUMN "choice_order" jsonb;
ALTER TABLE "attempts" ADD COLUMN "escape_hatched" boolean DEFAULT false NOT NULL;
ALTER TABLE "attempts" ADD COLUMN "escape_hatched_at" timestamp with time zone;
ALTER TABLE "attempts" ADD COLUMN "escape_hatched_reason" "escape_hatch_reason";
ALTER TABLE "attempts" ADD COLUMN "placement_bank_version" integer;
ALTER TABLE "questions" ADD COLUMN "is_placeholder" boolean DEFAULT false NOT NULL;
ALTER TABLE "texts" ADD COLUMN "is_placeholder" boolean DEFAULT false NOT NULL;
```

7 ADD COLUMN statements + 1 CREATE TYPE. Zero DROP/ALTER COLUMN.

Commit: `0e615978`

### Task 1.4: Apply migration + create db:verify-columns script (T-3-schema-drift gate)

Created `scripts/db-verify-columns.ts` following the `scripts/db-verify.ts` pattern. The script queries `information_schema.columns` for all 7 new columns and `pg_type` for the `escape_hatch_reason` enum. Exits 1 with a named list of missing items if any are absent.

Added `"db:verify-columns": "tsx scripts/db-verify-columns.ts"` to `package.json`.

Applied the migration: `pnpm db:migrate` → `migrations applied successfully!`

Verification output:
```
  ✓ attempts.escape_hatched
  ✓ attempts.escape_hatched_at
  ✓ attempts.escape_hatched_reason
  ✓ attempts.placement_bank_version
  ✓ attempt_answers.choice_order
  ✓ texts.is_placeholder
  ✓ questions.is_placeholder
  ✓ enum: escape_hatch_reason

Phase 3 schema verified — all 7 columns + escape_hatch_reason enum present.
```

T-3-schema-drift mitigation: live DB now matches schema.ts. Wave 1 unblocked.

Commit: `a2f149be`

### Task 1.5: Stub 4 Vitest test files

Created 4 test files:

| File | Type | Tests | Downstream Owner |
|------|------|-------|-----------------|
| `src/services/placement.test.ts` | Stub (test.todo) | 12 | Plan 03 |
| `src/services/placement.integration.test.ts` | Stub (test.todo) | 5 | Plan 03 |
| `src/db/seed/placement-placeholder.test.ts` | Stub (test.todo) | 2 | Plan 02 |
| `tests/invariants/placement-bundle-leak.test.ts` | FULLY IMPLEMENTED | 50 | Standing invariant |

The `placement-bundle-leak.test.ts` invariant is fully implemented (not a stub). It greps `src/app/**/*.{ts,tsx}` and `src/components/**/*.{ts,tsx}` for `/\bisCorrect\b/` and fails if found. This is the T-3-bundle-leak gate — active from Wave 0 forward. Currently passes 50 tests (one per matched source file).

Deviation (Rule 3): `vitest.config.ts` only included `tests/**/*.test.ts`. Updated to add `src/**/*.test.ts` so the service and seed test files are discoverable by `pnpm test:run`.

Commit: `639a7b88`

### Task 1.6: Stub 3 Playwright E2E spec files

Created 3 Playwright spec stubs using `test.fixme()`:

| File | Cases | Coverage | Downstream Owner |
|------|-------|----------|-----------------|
| `tests/e2e/placement-cross-parent.spec.ts` | 2 | T-3-rls-cross-parent | Plan 06 |
| `tests/e2e/placement-escape-hatch.spec.ts` | 5 | PLAC-06 SC4 (during + after) | Plan 06 |
| `tests/e2e/placement-flow.spec.ts` | 3 | PLAC-01 gate + PLAC-05 happy path | Plan 06 |

`pnpm e2e --grep placement --list` reports 10 unique cases (40 total across browser configurations). VALIDATION.md grep target `placement-flow` resolves to 3 cases as required.

Commit: `28e377c2`

### Task 1.7: Scaffold EscapeHatch component shell

Created `src/components/placement/escape-hatch.tsx`:

- `'use client'` directive at top
- Exports: `EscapeHatch`, `EscapeHatchMode`, `EscapeHatchProps`
- Two floating buttons at `fixed end-4 bottom-4 z-50` (RTL logical-property positioning)
- AlertDialog 2-tap confirmation modal with Arabic copy
- Stubbed `handleConfirm` with `console.warn('[PLAN-05] escape-hatch action wiring pending...')`
- Literal `PLAN-05-ACTION-WIRING` marker comment above the stub body
- Does NOT import `abortPlacementAction` (Plan 05 creates and wires this)
- Accepted by `pnpm build` (production build passes)
- `tests/invariants/placement-bundle-leak.test.ts` still passes (50 tests — component does not reference `isCorrect`)

Commit: `e2b51c28`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] vitest.config.ts include pattern excluded src/ test files**
- **Found during:** Task 1.5
- **Issue:** `vitest.config.ts` had `include: ['tests/**/*.test.ts']` only. The plan requires stub test files at `src/services/placement.test.ts` and `src/db/seed/placement-placeholder.test.ts` — these were not discovered by `pnpm test:run`.
- **Fix:** Added `'src/**/*.test.ts'` to the `include` array in `vitest.config.ts`.
- **Files modified:** `vitest.config.ts`
- **Commit:** `639a7b88`

**2. [Rule 1 - Bug] shadcn-generated alert-dialog.tsx had Biome lint violations**
- **Found during:** Task 1.1
- **Issue:** shadcn CLI generated the file with double quotes (instead of single), missing semicolons, and un-sorted imports/exports — all Biome violations.
- **Fix:** Ran `pnpm lint:fix` to auto-fix. All violations resolved.
- **Files modified:** `src/components/ui/alert-dialog.tsx`
- **Commit:** `43aef5a2`

**3. [Rule 1 - Bug] EscapeHatch used bare JSX namespace (not available in this tsconfig)**
- **Found during:** Task 1.7
- **Issue:** `JSX.Element` return type failed TypeScript because the project uses `@types/react` which puts JSX under `React.JSX.Element` in React 19 with the `--jsx react-jsx` transform.
- **Fix:** Changed return type to `React.JSX.Element` and used `import type React from 'react'`.
- **Files modified:** `src/components/placement/escape-hatch.tsx`
- **Commit:** `e2b51c28`

**4. [Rule 3 - Blocking] drizzle-kit generated migration with random slug name**
- **Found during:** Task 1.3
- **Issue:** `pnpm db:generate` created `0001_loving_grandmaster.sql` but the plan specifies `0001_phase3_placement.sql` for clarity and downstream reference.
- **Fix:** Renamed the file and updated `meta/_journal.json` tag from `0001_loving_grandmaster` to `0001_phase3_placement`. `pnpm db:migrate` still applied it successfully.
- **Files modified:** `drizzle/migrations/meta/_journal.json`
- **Commit:** `0e615978`

## Threat Mitigations Applied

| Threat ID | Status | Evidence |
|-----------|--------|----------|
| T-3-schema-drift | MITIGATED | `pnpm db:verify-columns` exits 0 — all 7 columns + enum confirmed in live DB |
| T-3-bundle-leak | MITIGATED (code gate) | `tests/invariants/placement-bundle-leak.test.ts` passing (50 tests); runtime complement deferred to Plan 05 + Plan 06 Playwright assertions |
| T-3-rls-cross-parent | ACCEPTED (spec stub) | Playwright spec scaffold exists; Plan 06 fills the test bodies |

## Known Stubs

The following stubs are intentional and tracked for downstream plans:

| File | Stub Nature | Resolving Plan |
|------|-------------|----------------|
| `src/components/placement/escape-hatch.tsx` | `handleConfirm` is a no-op with `console.warn` | Plan 05 (wave 4) replaces with `abortPlacementAction` |
| `src/services/placement.test.ts` | 12 `test.todo` cases | Plan 03 implements `assignLevel`, `deterministicShuffle`, `abortPlacement` |
| `src/services/placement.integration.test.ts` | 5 `test.todo` cases | Plan 03 implements `getPlacementState` and other service functions |
| `src/db/seed/placement-placeholder.test.ts` | 2 `test.todo` cases | Plan 02 seeds placeholder Arabic content |
| `tests/e2e/placement-cross-parent.spec.ts` | 2 `test.fixme` cases | Plan 06 fills bodies |
| `tests/e2e/placement-escape-hatch.spec.ts` | 5 `test.fixme` cases | Plan 06 fills bodies |
| `tests/e2e/placement-flow.spec.ts` | 3 `test.fixme` cases | Plan 06 fills bodies |

## Threat Flags

No new security-relevant surface introduced beyond what is covered in the plan's threat model.

## Self-Check: PASSED

All 11 created files confirmed present on disk. All 7 task commits found in git log.

| Check | Result |
|-------|--------|
| src/components/ui/alert-dialog.tsx | FOUND |
| src/components/placement/escape-hatch.tsx | FOUND |
| drizzle/migrations/0001_phase3_placement.sql | FOUND |
| scripts/db-verify-columns.ts | FOUND |
| src/services/placement.test.ts | FOUND |
| src/services/placement.integration.test.ts | FOUND |
| src/db/seed/placement-placeholder.test.ts | FOUND |
| tests/invariants/placement-bundle-leak.test.ts | FOUND |
| tests/e2e/placement-cross-parent.spec.ts | FOUND |
| tests/e2e/placement-escape-hatch.spec.ts | FOUND |
| tests/e2e/placement-flow.spec.ts | FOUND |
| commit 43aef5a2 (Task 1.1) | FOUND |
| commit 0378fda7 (Task 1.2) | FOUND |
| commit 0e615978 (Task 1.3) | FOUND |
| commit a2f149be (Task 1.4) | FOUND |
| commit 639a7b88 (Task 1.5) | FOUND |
| commit 28e377c2 (Task 1.6) | FOUND |
| commit e2b51c28 (Task 1.7) | FOUND |
