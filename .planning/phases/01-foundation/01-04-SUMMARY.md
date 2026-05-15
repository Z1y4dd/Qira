---
phase: 01-foundation
plan: 04
slice_name: arabictext-service-layer
status: complete
completed_date: "2026-05-15"
duration_minutes: 10
tasks_completed: 5
tasks_total: 5
files_created: 0
files_modified: 1
commits: 1
key_decisions:
  - Plan 04 scope was already delivered during Plan 01-01 scaffolding (ArabicText, Zod ArabicText, nfc helper, four service stubs, three tests, page wiring). This slice confirmed all five tasks against the plan's verification gates and added only the lint-pass delta on schema.ts and drizzle.config.ts.
  - Lint pass replaced the non-null assertion in drizzle.config.ts with an explicit guard (biome's noNonNullAssertion rule).
tags:
  - arabic-text
  - bdi
  - zod
  - nfc
  - service-layer
  - vitest
requires:
  - next.js-16-app-router-scaffold
  - vitest-infrastructure
  - drizzle-schema-eight-entities
provides:
  - arabic-text-primitive
  - zod-arabic-text-schema
  - nfc-db-boundary-helper
  - service-layer-stubs-four
  - service-layer-purity-test
affects:
  - slice-5-playwright
  - phase-2-auth
  - phase-3-placement
  - phase-4-reader
tech_stack_added: []
tech_patterns:
  - "<bdi> for bidi isolation (not dir='auto')"
  - Service Layer purity test scans every src/services/**/*.ts for `from 'next/...'`
  - Zod ArabicText refinement gates non-NFC input at every Server Action boundary
  - nfc() helper applied at the DB write boundary (post-Zod) for belt-and-suspenders
key_files_modified:
  - drizzle.config.ts
  - src/db/schema.ts
  - biome.json
---

# Phase 1 Plan 04: ArabicText + Service Layer Skeleton Summary

**Verified that ArabicText (with `<bdi>`), the Zod `ArabicText` schema, the `nfc()` DB-boundary helper, four Service Layer stubs (profiles/placement/library/comprehension), and three Vitest gates (purity, zod-arabic, nfc) are all present and meet the plan's verification gates. No new code was needed — scope was delivered during initial scaffolding (Plan 01-01) and Plan 01-02 lint infrastructure. Only delta: a biome lint pass on Plan 03's outputs.**

## Performance
- **Duration:** ~10 min (verification + lint pass)
- **Tasks:** 5/5 verified complete
- **Files modified:** 3 (lint pass only)
- **Commits:** 1

## Tasks Verified

| Task | Description | Status | Evidence |
|------|-------------|--------|----------|
| 4.1 | `<ArabicText>` with `<bdi>` + size/diacritics props | ✓ shipped | `src/components/arabic-text.tsx`; 2 `<bdi>` tokens (open+close), 0 `dir="auto"` |
| 4.2 | Zod ArabicText schema + nfc() helper | ✓ shipped | `src/lib/zod.ts` exports `ArabicText`; `src/db/normalize.ts` exports `nfc()` and `nfcString()` |
| 4.3 | Landing page wired through `<ArabicText>` | ✓ shipped | `src/app/page.tsx` renders `<ArabicText as="h1" size="reader">` |
| 4.4 | Four service stubs throwing "not implemented until Phase N" | ✓ shipped | `find src/services -name "*.ts" -exec grep -l "not implemented"` lists all 4; `placement.ts` parses `RecordPlacementAnswerInput` with Zod before throwing |
| 4.5 | service-layer-purity + zod-arabic-text + nfc-normalize tests | ✓ shipped | 5 + 4 + 5 = 14 passing tests; full suite is 30/30 green |

## Decisions & Deviations

### D1: Scope was front-loaded into Plan 01-01 scaffolding
The five Plan 04 deliverables were authored during Plan 01-01's initial scaffold and refined in Plan 01-02's lint pass. Re-running the plan's verification commands confirmed every gate is met:

- `grep -c '<bdi>' src/components/arabic-text.tsx` → 2 (open+close, 1 element)
- `grep -c "dir=\"auto\"" src/components/arabic-text.tsx` → 0
- `find src/services -name "*.ts" | xargs grep -l "not implemented"` → 4 files
- `pnpm test:run` → 30 passing (includes 5 service-purity, 4 zod-arabic, 5 nfc, 9 rls-coverage, 1 rtl-utilities, 6 sdk-allowlist)
- `pnpm tsc --noEmit` → clean
- `pnpm build` → success

### D2: Lint pass triggered by Plan 03's outputs
Biome flagged the non-null assertion (`process.env.X!`) in `drizzle.config.ts` and a trailing blank line in `biome.json`. Replaced the assertion with an explicit guard and stripped the whitespace. Also alphabetized the `drizzle-orm/supabase` import in `schema.ts`. These are mechanical lint fixes; the project still passes `pnpm lint:ci`.

## Files Created/Modified
- `drizzle.config.ts` — replaced non-null assertion with explicit guard; sorted imports.
- `src/db/schema.ts` — alphabetized `drizzle-orm/supabase` import.
- `biome.json` — stripped trailing blank line.

## Next Slice Readiness
- Slice 5 (SDK allow-list + Playwright baseline) can build directly on the `<bdi>`-rendering ArabicText to baseline visual regression.
- The Zod ArabicText schema is ready to gate every Phase 2 Server Action input.
- The `nfc()` helper is wired into `library.insertText` already — Phase 4 callers will use it identically.

## What is NOT done
- Real implementations of any Service Layer function (Phases 2–4).
- AST-level CI gate that EVERY Arabic literal goes through `<ArabicText>` (Phase 4 scope; bash soft-warn is in place).
- Per-text Tashkeel toggle in `<ArabicText>` (Phase 4 LIB-03).
