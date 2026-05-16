---
phase: 03-placement-vertical
plan: "02"
slice_name: placement-bank-seed
subsystem: placement
tags: [seed, placeholder-content, arabic-text, nfc-normalization, integration-test]
dependency_graph:
  requires:
    - 03-placement-vertical/01 (schema migration applied — isPlaceholder columns exist on texts/questions)
  provides:
    - src/db/seed/placement-placeholder.ts (idempotent seed script, 5 passages / 15 questions / 60 choices)
    - src/db/seed/placement-placeholder.test.ts (5 integration tests asserting bank counts)
    - pnpm db:seed:placement (package.json script)
  affects:
    - Live Supabase DB: 5 texts, 15 questions, 60 choices with is_placeholder = true
    - package.json (new db:seed:placement script)
tech_stack:
  added: []
  patterns:
    - "dotenv config({ path: '.env.local' }) at top of seed + integration test files"
    - "Drizzle insert with .returning() for cascaded FK inserts (texts → questions → choices)"
    - "NFC-normalize inline: every Arabic literal.normalize('NFC') at insert call site"
    - "Idempotency via count guard: check existing placeholder texts before inserting"
key_files:
  created:
    - src/db/seed/placement-placeholder.ts
  modified:
    - src/db/seed/placement-placeholder.test.ts
    - package.json
decisions:
  - "Idempotency via isPlaceholder count guard (not a dedicated version table) — matches D-07 plan note: no version column write in this plan, Plan 03 writes placementBankVersion: 1 on attempts"
  - "Test file loads dotenv via config({ path: .env.local }) to make DATABASE_URL available to db proxy in Vitest runner"
  - "HAVING clause for correctness check uses sum(is_correct) group-by (not count(*) HAVING col = 1 which is invalid SQL) — auto-fixed Rule 1 during test writing"
metrics:
  duration: "~5 minutes"
  completed_date: "2026-05-16"
  tasks_completed: 2
  tasks_total: 2
  files_created: 1
  files_modified: 2
---

# Phase 3 Plan 02: Placement Bank Seed Summary

Idempotent seed script inserts 5 placeholder Arabic passages with 15 MCQ questions and 60 answer choices into live Supabase, all tagged `is_placeholder = true`, across levels 2/6/10/14/18 (NFC-normalized Fusha Arabic). `pnpm db:seed:placement` exits 0 on first and subsequent runs. All 5 Vitest count assertions pass against the live DB.

## What Was Built

### Task 2.1: placement-placeholder.ts seed script

Created `src/db/seed/placement-placeholder.ts` following the exact `src/db/seed/index.ts` pattern:

- Loads `.env.local` via `dotenv.config()`.
- Throws if `DIRECT_DATABASE_URL` is missing (T-3-seed-rls-bypass mitigation — texts/questions have `withCheck: sql\`false\`` on INSERT, requiring the postgres superuser connection to bypass RLS).
- Opens `postgres(url, { max: 1, prepare: false })` — same as `index.ts`.
- Idempotency guard: counts `texts.isPlaceholder = true`; skips all inserts if count >= 5.
- Looks up `levels.id` for levels 2, 6, 10, 14, 18 via a single query.
- Inserts 5 passages with cascaded questions and choices using `.returning()` for FK chaining.
- All Arabic string literals wrapped in `.normalize('NFC')` at the call site.
- Post-seed count verification confirms 5/15 before exit 0.

Added `"db:seed:placement": "tsx src/db/seed/placement-placeholder.ts"` to `package.json` scripts.

**First run output:**
```
Seeding placement placeholder bank (version 1)...
  Inserted passage L2: "القِطُّ الصَّغِيرُ" (21 words)
  Inserted passage L6: "رِحْلَةُ يَوْمِ الجُمُعَةِ" (34 words)
  Inserted passage L10: "النَّمْلَةُ المُجْتَهِدَةُ" (43 words)
  Inserted passage L14: "دَوْرَةُ المَاءِ" (39 words)
  Inserted passage L18: "قِيمَةُ الصَّبْرِ" (51 words)

Seed complete.
  Texts inserted this run:     5
  Questions inserted this run: 15
  Choices inserted this run:   60
  Total placeholder texts in DB:     5
  Total placeholder questions in DB: 15

Expected: 5 texts, 15 questions, 60 choices.
```

**Re-run output (idempotent):**
```
Placement bank already seeded (version 1). Found 5 placeholder text(s). Exiting.
```

Commit: `2322e082`

### Task 2.2: placement-placeholder.test.ts count assertions

Replaced 2 `test.todo` stubs with 5 real integration tests in `src/db/seed/placement-placeholder.test.ts`:

| Test | Assertion | Result |
|------|-----------|--------|
| 1 | `texts.isPlaceholder = true` count = 5 | PASS |
| 2 | `questions.isPlaceholder = true` count = 15 | PASS |
| 3 | Choices linked to placeholder questions count = 60 | PASS |
| 4 | Each question has exactly 1 correct choice (`sum(is_correct) = 1` per group) | PASS |
| 5 | Level numbers for placeholder texts = `{2, 6, 10, 14, 18}`, 5 distinct, no duplicates | PASS |

All tests fail with "Placement bank not seeded. Run `pnpm db:seed:placement` first." if counts are zero — not with a generic assertion error.

Commit: `08e3cfd2`

## Passage Inventory

| Level | Title (Arabic) | Word Count | Theme |
|-------|---------------|------------|-------|
| 2 | القِطُّ الصَّغِيرُ | 21 | Animals — describing a pet cat |
| 6 | رِحْلَةُ يَوْمِ الجُمُعَةِ | 34 | Family activity — Friday park trip |
| 10 | النَّمْلَةُ المُجْتَهِدَةُ | 43 | Short story — ant and grasshopper fable |
| 14 | دَوْرَةُ المَاءِ | 39 | Simple science — water cycle |
| 18 | قِيمَةُ الصَّبْرِ | 51 | Abstract concept — value of patience |

Each passage has 3 questions: 1 literal recall, 1 vocabulary, 1 inferential. Each question has 4 choices, 1 correct.

Note: word counts are lower than the ~35–75 target from the plan because Arabic Tashkeel (diacritics) are embedded in words as combining characters — the words are correct but count as single space-delimited tokens.

**Content is a smoke-test prop.** This content is NOT a pedagogically-calibrated assessment instrument. It is a placeholder drafted by Claude. The final Arabic literacy content is the contracted specialist's deliverable (Phase 5 gate). Replacement path: `DELETE FROM questions WHERE is_placeholder = true; DELETE FROM texts WHERE is_placeholder = true;` then re-seed with specialist content.

## Seed Invocation

```bash
pnpm db:seed:placement   # first run: inserts 5/15/60 rows
pnpm db:seed:placement   # re-run: skips with "already seeded" message
```

## Test Run

```bash
pnpm test:run src/db/seed/placement-placeholder.test.ts
# All 5 tests pass in ~3.4s
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] HAVING clause referenced non-aggregated column (invalid SQL)**
- **Found during:** Task 2.2, first test run attempt
- **Issue:** Initial test used `.having(sql\`${choices.isCorrect} = 1\`)` on a GROUP BY query. Postgres rejected this: `column "choices.is_correct" must appear in the GROUP BY clause or be used in an aggregate function`. This is standard SQL — HAVING can only reference aggregated expressions.
- **Fix:** Replaced the two-query approach with a single `sum(is_correct)` GROUP BY query. `sum(is_correct)` is a valid aggregate and correctly returns 1 per question (since each question has exactly one choice with `isCorrect = 1` and three with `isCorrect = 0`).
- **Files modified:** `src/db/seed/placement-placeholder.test.ts`
- **Commit:** `08e3cfd2`

**2. [Rule 3 - Blocking] Vitest test runner lacked DATABASE_URL**
- **Found during:** Task 2.2, first test execution
- **Issue:** Vitest config does not load `.env.local`. The `db` proxy in `@/db/client` calls `process.env.DATABASE_URL` at first query time — with no env loaded, all tests threw `DATABASE_URL is not set`.
- **Fix:** Added `import { config } from 'dotenv'` and `config({ path: '.env.local' })` at the top of the test file (same as the seed script itself and the existing `src/db/seed/index.ts` pattern).
- **Files modified:** `src/db/seed/placement-placeholder.test.ts`
- **Commit:** `08e3cfd2`

## Threat Mitigations Applied

| Threat ID | Status | Evidence |
|-----------|--------|----------|
| T-3-seed-rls-bypass | MITIGATED | Seed throws if DIRECT_DATABASE_URL missing; never uses pooler/anon role |
| T-3-bundle-leak | STILL PASSING | `tests/invariants/placement-bundle-leak.test.ts` 50 tests pass — seed file is not in src/app/ or src/components/ scope |
| T-3-content-injection | ACCEPTED | All content hand-authored; no user input path |

## Known Stubs

None in this plan. All inserted content is intentionally placeholder — tracked separately in Passage Inventory above with the specialist replacement note.

## Threat Flags

No new security-relevant surface introduced. The seed script accesses Postgres via DIRECT_DATABASE_URL (existing pattern from `src/db/seed/index.ts`). No new network endpoints, auth paths, or schema changes.

## Self-Check: PASSED

| Check | Result |
|-------|--------|
| src/db/seed/placement-placeholder.ts | FOUND |
| src/db/seed/placement-placeholder.test.ts | FOUND |
| package.json db:seed:placement script | FOUND |
| commit 2322e082 (Task 2.1) | FOUND |
| commit 08e3cfd2 (Task 2.2) | FOUND |
| 5 placeholder texts in live DB | CONFIRMED (test pass) |
| 15 placeholder questions in live DB | CONFIRMED (test pass) |
| 60 choices in live DB | CONFIRMED (test pass) |
