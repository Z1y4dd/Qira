# Phase 4 Pattern Map — Reader & Comprehension Loop (Happy Path)

**Mapped:** 2026-05-17
**Phase scope:** LIB-03, LIB-04, LIB-05, LIB-06, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-07, COMP-08.
**Out of scope (4.1/4.2):** library browse, retry, supportive feedback, a11y polish, loading polish, literacy gate.

The codebase is in remarkably good shape for Phase 4: every schema column needed, every cross-cutting primitive (ArabicText, Service Layer, force-dynamic, escape-hatch component, server-bound Server Actions, deterministic shuffle), and every test scaffold (Vitest unit, Vitest integration with admin client, Playwright cross-parent + happy-path) already exists from Phases 1–3. **Phase 4 is overwhelmingly a "copy the placement vertical, swap the kind" exercise.**

---

## Schema state (what exists, what's needed)

All tables and enums Phase 4 needs are **already in `src/db/schema.ts`**. No migration is required for the happy path.

| Table | Column / property | Status | Notes |
|---|---|---|---|
| `texts` | `id`, `levelId`, `titleAr`, `bodyAr`, `wordCount`, `genre`, `createdAt`, `isPlaceholder` | EXISTS (`src/db/schema.ts:162-205`) | RLS: authenticated SELECT open, INSERT/UPDATE/DELETE blocked (`withCheck: false`). Seeds must use `DIRECT_DATABASE_URL`. |
| `texts` | `position` / `content_status` (e.g. "draft" / "published") | NOT PRESENT | Phase 4 happy path may not need either. **If reader selects "next text at level X", a simple `ORDER BY createdAt` over `texts WHERE levelId = X` suffices for v1.** Flag for planner: if a deterministic curated order is desired, add a `position smallint` column in a new migration. |
| `questions` | `id`, `kind`, `textId`, `levelId`, `promptAr`, `questionType`, `position`, `isPlaceholder` | EXISTS (`src/db/schema.ts:208-248`) | `kind` enum already includes `'comprehension'` (`questionKind` enum at `src/db/schema.ts:35`). Phase 4 simply inserts rows with `kind: 'comprehension'`. |
| `choices` | `id`, `questionId`, `textAr`, `position`, `isCorrect` | EXISTS (`src/db/schema.ts:252-291`) | `isCorrect` is `integer` (0/1). **CRITICAL:** see "Shared Patterns → isCorrect bundle-leak gate". |
| `attempts` | `kind`, `textId`, `score`, `startedAt`, `finishedAt`, plus escape-hatch + bank-version columns | EXISTS (`src/db/schema.ts:294-339`) | `attemptKind` enum is `['placement', 'reading']` (`schema.ts:34`). **Phase 4 comprehension attempts MUST use `kind: 'reading'`** — there is no `'comprehension'` enum value. `textId` is already nullable and ready to point at the read passage. |
| `attempt_answers` | `id`, `attemptId`, `questionId`, `chosenChoiceId`, `isCorrect`, `answeredAt`, `choiceOrder` (jsonb) | EXISTS (`src/db/schema.ts:342-386`) | RLS scoped via attempt → child → parent join. Same shape used by placement. |
| `child_profiles` | `currentLevelId` | EXISTS (`schema.ts:88`) — FK to `levels.id` | Reader resolves "next text" via this column. Phase 3 writes it during `recordPlacementAnswer` / `abortPlacement` finalization. Phase 4 reads it. |
| Enums | `attempt_kind`, `question_kind`, `escape_hatch_reason` | EXISTS (`schema.ts:34-36`) | No new enum values needed for the happy path. |

**Verdict:** Phase 4 happy path is **schema-additive-zero**. The planner can skip a migration plan entirely unless the team decides to add a `texts.position` column or a `texts.contentStatus` flag for curation ordering — both are deferred-safe.

---

## Anticipated new files (with closest analog)

### 1. DB schema additions — `src/db/schema.ts`

**Closest analog:** N/A — no changes needed.

**Action for planner:** Confirm no schema delta. If the team decides to add `texts.position smallint` for deterministic library ordering, mirror the `questions.position` pattern at `src/db/schema.ts:218` and write a migration (see #2).

---

### 2. Migration file — `drizzle/migrations/0002_*.sql`

**Closest analog:** `drizzle/migrations/0001_phase3_placement.sql` (full file, 8 lines).

**Why it's the analog:** Phase 3 used `drizzle-kit generate` to emit additive column changes. Generated filename pattern is `NNNN_<auto-name>.sql` (Drizzle's haiku scheme — Phase 3's is `0001_phase3_placement.sql` so the team has chosen to **rename generated files for clarity** post-generate; Phase 4 should follow suit and rename to `0002_phase4_reader.sql`).

**Pattern to copy:**
- Additive only (`ADD COLUMN`, `CREATE TYPE`, never `DROP`).
- One `--> statement-breakpoint` between each statement.
- Run via `pnpm db:generate` then commit the file as-is.

**Likely outcome for Phase 4 happy path:** no migration needed. Only required if the team adds curation columns.

---

### 3. Service Layer — `src/services/comprehension.ts` (REPLACES the existing stub)

**Closest analog:** `src/services/placement.ts` (full file, lines 1-544).

**Why it's the analog:** Phase 3's placement service is the canonical Service Layer module — same data shape (attempt + answers per question), same RLS surface, same server-authoritative-scoring pattern.

**Current state:** A stub already exists at `src/services/comprehension.ts:1-53` with the right TYPE shapes (`ComprehensionChoice`, `ComprehensionQuestion`, `QuestionKind`, `RecordAnswerInput`, `RecordAnswerResult`) — every function throws `'not implemented until Phase 4'`. Phase 4 **fills in** these stubs rather than creating new ones. The existing stub already enforces `isCorrect` absence in `ComprehensionChoice` (`comprehension.ts:18-19`).

**Imports pattern to copy** (`src/services/placement.ts:1-26`):
```typescript
import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import { attemptAnswers, attempts, childProfiles, choices, levels, questions, texts } from '@/db/schema';
import type { ChildId } from './profiles';
import { AuthError } from './profiles';
```

**Functions Phase 4 needs and their placement.ts analogs:**

| Phase 4 function | Placement.ts analog | Notes |
|---|---|---|
| `getNextTextForChild(childId)` → `LeveledText \| null` | NEW PATTERN — closest is `getNextPlacementItem` (placement.ts:230-308), but the selection rule is simpler: `WHERE levelId = child.currentLevelId AND id NOT IN (texts the child has already attempted with kind='reading' finishedAt IS NOT NULL)`. Use `inArray` (already imported in placement.ts:13). Return null if no eligible text. **Trimmed Phase 4 behaviour:** "auto-route to one passage at their level" — if all texts are exhausted, return the first/last text (D-TBD; planner clarifies). |
| `getTextWithQuestions(textId)` → `{ text, questions[] }` | Pattern: same Drizzle multi-select used in `getNextPlacementItem` lines 249-288. Filter `questions WHERE textId = X AND kind = 'comprehension'`; fetch choices with `inArray(choices.questionId, qIds)`. **Apply `deterministicShuffle` to choices per question.** Use **`(attemptId:questionId)` as the shuffle seed** — copy the seed convention from `placement.ts:291,338`. |
| `startComprehensionAttempt({ childId, textId })` → `AttemptId` | `startPlacement(childId)` (placement.ts:211-223). **Diff:** insert with `kind: 'reading'` (NOT `'placement'`), set `textId`, omit `placementBankVersion`. |
| `recordComprehensionAnswer({ attemptId, questionId, chosenChoiceId })` → `{ correct, nextItem \| null, finalResult \| null }` | `recordPlacementAnswer(...)` (placement.ts:315-451). Verbatim pattern: server-side `isCorrect` lookup, re-derive shuffled order via `deterministicShuffle`, insert `attempt_answers` row, count answers, branch on "all answered → finalize / else → next". **Diff:** completion condition is "all questions for THIS text answered" (4-6), not "15 questions" — count via `COUNT questions WHERE textId = attempt.textId AND kind='comprehension'`. Score = sum of correct. **No `assignLevel` call** — score is the only finalization. |
| `getReadingAttemptResult(attemptId)` → `{ score, totalQuestions, textTitle }` | Pattern: query in `src/app/(authenticated)/placement/[attemptId]/result/page.tsx:48-77` (inline select), promote it into the service. Returns score for the result screen. |

**Pure-function pattern to copy verbatim** (`src/services/placement.ts:157-166`): `deterministicShuffle()`. Re-use; do not re-implement.

**Branded-type pattern** (`placement.ts:32-36`): branded `AttemptId`, `QuestionId`, `ChoiceId` already exported from placement.ts. **Phase 4 should import these from `@/services/placement`** rather than re-declare — the existing comprehension.ts stub already does this (`comprehension.ts:13`).

**Zod input schemas pattern** (`placement.ts:105-117`): one Zod `.object` per public function input, parsed inside the function (not in the Server Action).

---

### 4. Server Actions — `src/app/(authenticated)/reader/actions.ts` (NEW)

**Closest analog:** `src/app/(authenticated)/placement/actions.ts` (full file, lines 1-121).

**Pattern to copy verbatim:**

**File header + imports** (`placement/actions.ts:1-12`):
```typescript
'use server';
import type { Route } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_CHILD_COOKIE } from '@/lib/active-child-cookie';
import { /* comprehension functions */ } from '@/services/comprehension';
import { AuthError, requireActiveChild } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';
```

**Auth pattern** (`placement/actions.ts:18-32`): every action begins with the `cookies() → createClient → requireActiveChild → catch AuthError → redirect('/choose-child')` 12-line block. **Copy literally.**

**Server-binding pattern for choice cards** (`placement/actions.ts:59-87`): args are passed via `.bind(null, {...})` at render time — never via client formData. **The choice ID is server-bound in the JSX, eliminating the "client picks correctness" attack surface.** This is PLAC-04 / COMP equivalent.

**Anticipated actions:**
| Action | Mirrors placement.ts:line |
|---|---|
| `startReadingAttemptAction({ textId })` (or `startReadingForActiveChildAction()` for auto-route) | `startPlacementAction` (lines 18-32) |
| `recordComprehensionAnswerAction({ attemptId, questionId, chosenChoiceId })` | `recordPlacementAnswerAction` (lines 59-87) |
| (Optional) `advanceToFirstQuestionAction` for a "passage → questions" two-screen flow | `advanceToFirstQuestionAction` (lines 42-49). **Planner decides:** does the reader use a passage→questions split like placement, or a single combined view? See "Decisions inherited" below. |

---

### 5. Route group + pages

**Closest analog:** `src/app/(authenticated)/placement/` (entire subtree, lines as cited below).

#### Route-group placement decision

**Phase 4 reader belongs INSIDE `(placement-gate)`.** The gate at `src/app/(authenticated)/(active)/(placement-gate)/layout.tsx:20-43` is exactly what gates reader access to placed children. The existing layout already redirects unplaced children to `/placement/start` and lets `completed` + `escape_hatched` through.

**Recommended new tree:**
```
src/app/(authenticated)/(active)/(placement-gate)/
├── dashboard/page.tsx                 (existing — Phase 1)
└── reader/                            (NEW Phase 4)
    ├── actions.ts                     ← analog: placement/actions.ts
    ├── layout.tsx                     ← analog: placement/layout.tsx (placement/layout.tsx:1-14)
    ├── page.tsx                       ← auto-route: pick next text, redirect to [attemptId]
    └── [attemptId]/
        ├── page.tsx                   ← analog: placement/[attemptId]/page.tsx (lines 1-51)
        └── result/page.tsx            ← analog: placement/[attemptId]/result/page.tsx
```

**`layout.tsx` analog** (`src/app/(authenticated)/placement/layout.tsx:1-14`): just declares `dynamic = 'force-dynamic'` + a `max-w-2xl` main wrapper. Copy verbatim.

**`reader/page.tsx` (auto-route)** — closest analog is `src/app/(authenticated)/placement/start/page.tsx:18-42` (loads active child, renders a CTA). **Diff:** Phase 4's auto-route should fetch `getNextTextForChild(active.id)` and either redirect to `/reader/[attemptId]` (after starting an attempt) or render an "all done" empty state. The "no CTA, just go" version is closer to the auto-route behaviour described in the phase scope.

**`reader/[attemptId]/page.tsx`** — closest analog is `src/app/(authenticated)/placement/[attemptId]/page.tsx:1-51`. Pattern:
- `export const dynamic = 'force-dynamic'`
- `params: Promise<{ attemptId: string }>` then `await params`
- Branch on showPassage / question state (if the planner picks a two-screen flow).
- Redirect to `/reader/[attemptId]/result` when no question remains.

**`reader/[attemptId]/result/page.tsx`** — closest analog is `src/app/(authenticated)/placement/[attemptId]/result/page.tsx:1-110`. Verbatim pattern to copy:
- `dynamic = 'force-dynamic'`
- `requireActiveChild` + AuthError → redirect.
- **Defense-in-depth child-id cross-check** (`result/page.tsx:48-61`): always re-load the attempt row, compare `attemptRow.childId !== active.id`, redirect if mismatch. **MANDATORY for Phase 4 result page** to satisfy `placement-cross-parent.spec.ts`-equivalent isolation.
- Render score copy with `<bdi dir="ltr">{n}</bdi>` for Western digits (see `result/page.tsx:80-86`).

---

### 6. UI components — `src/components/reader/...`

**Closest analog tree:** `src/components/placement/` (5 files).

| New component | Closest analog | Pattern notes |
|---|---|---|
| `src/components/reader/passage-renderer.tsx` | `src/components/placement/passage-screen.tsx:1-52` | Uses `<ArabicText size="reader">` (already supports `diacritics: 'show' \| 'hide'`). Tashkeel toggle: copy the conditional at `passage-screen.tsx:25` (`const showDiacritics = item.level >= 14 ? 'hide' : 'show'`). **For Phase 4 the toggle is interactive** (child can flip Tashkeel), so this is a `'use client'` component with `useState`. **No analog has interactive Tashkeel yet — NEW PATTERN.** See "Gaps" below. |
| `src/components/reader/tashkeel-toggle.tsx` | NEW PATTERN — no analog. Smallest precedent is the AlertDialog open/close state in `escape-hatch.tsx:28`. Recommended: a tiny `'use client'` component holding `useState<'show' \| 'hide'>` and passing it to `<ArabicText diacritics={...} />`. Tashkeel default per text comes from `LeveledText.tashkeelDefault` (already typed in `src/services/library.ts:20`). |
| `src/components/reader/question-card.tsx` | `src/components/placement/question-screen.tsx:1-48` | Verbatim pattern: `<ArabicText as="h2">` prompt, vertical stack of `<ChoiceCard>`, `<ProgressDots>`. RTL-safe via `dir="rtl"` + logical `ps-/pe-`. |
| `src/components/reader/choice-card.tsx` | `src/components/placement/choice-card.tsx:1-46` | **Copy verbatim**, swap the imported action from `recordPlacementAnswerAction` to `recordComprehensionAnswerAction`. The `min-h-14` (56 px tap target), `ps-4 pe-4 text-start` logical-property pattern, and `.bind(null, {...})` server-binding are all required. |
| `src/components/reader/result-card.tsx` | `src/app/(authenticated)/placement/[attemptId]/result/page.tsx:79-110` (inline JSX) | Pattern: `dir="rtl"`, `<ArabicText as="h1" size="reader">` for the headline, `<bdi dir="ltr">` wrapping any digit. **Phase 4 may inline this directly in `reader/[attemptId]/result/page.tsx` rather than extract a component — placement does the same.** |
| `src/components/reader/progress-dots.tsx` | `src/components/placement/progress-dots.tsx:1-46` | **Already general** — `total` + `current` (1-based). Re-use as-is by importing from `@/components/placement/progress-dots`, or move it to `@/components/shared/progress-dots.tsx` if the team wants a reorg. **Recommendation:** import-and-reuse for Phase 4; defer the move. |
| Escape-hatch | `src/components/placement/escape-hatch.tsx:1-99` — **already has `mode: 'reader'` branch wired (lines 19, 43-46)** but unimplemented. | Phase 4 wires the `// TODO(Phase 4)` at `escape-hatch.tsx:44`: implement `shiftLevelAction({ childId, direction })`. This is OUT OF SCOPE for the happy-path slice per phase scope, so the `console.warn` placeholder stays for now. |

---

### 7. Seed content — `src/db/seed/comprehension-bank.ts` (NEW)

**Closest analog:** `src/db/seed/placement-placeholder.ts` (full file, 423 lines).

**Pattern to copy verbatim:**

- **`dotenv` + `DIRECT_DATABASE_URL` gate** (lines 16-24, 259-264): RLS blocks anon INSERT on `texts`/`questions`/`choices`. Must run via the `postgres` superuser URL or seed will fail with `withCheck: false`.
- **Idempotency guard** (lines 269-282): query the existing placeholder/seeded count; exit 0 if already seeded.
- **Inline TypeScript literal for content** (lines 41-253): typed as `Passage[]` with nested `questions` and `choices` arrays. **TS literal, NOT JSON** — gives IDE autocomplete + compile-time safety.
- **Per-row `.normalize('NFC')`** at insert (lines 311-312, 340, 369). Required — schema CHECK is enforced via Zod `ArabicText` at write boundary.
- **Verification counts** (lines 382-413): post-insert COUNT(*) sanity assertions with explicit `console.error + process.exit(1)` on mismatch.
- **`pnpm db:seed:comprehension` script entry** to add to `package.json` mirroring `db:seed:placement` (`package.json:22`).

**Diff for Phase 4 content:**
- `kind: 'comprehension'` (not `'placement'`) on every question insert (placeholder analog: `placement-placeholder.ts:345`).
- Questions are scoped per text (no cross-level placement aggregation needed).
- 4–6 questions per text (vs 3 per placement passage).
- `isPlaceholder: true` if the bank is still authoring-stub-quality; switch to `false` when the literacy specialist's content lands (Phase 5 gate).
- Count of texts/questions/choices in the verification block will differ — update the assertions.

---

### 8. Tests

#### 8a. Vitest unit tests — pure functions

**Closest analog:** `src/services/placement.test.ts` (full file, 199 lines).

**Pattern to copy:**
- Co-located test file: `src/services/comprehension.test.ts` next to `comprehension.ts`.
- `import { describe, expect, test } from 'vitest';`
- One `describe()` per pure function.
- No `globals: true` — the vitest config requires explicit imports (`vitest.config.ts:8`).

**What's pure to test in comprehension service:**
- Score computation (totalCorrect / totalQuestions).
- Choice randomization (re-use `deterministicShuffle` from placement.ts — its tests are already at `placement.test.ts:119-156`, no need to re-test).
- Any "next text" eligibility logic if it has a pure helper.

#### 8b. Vitest integration tests — DB-backed services

**Closest analog:** `src/services/placement.integration.test.ts` (lines 1-80 read; same admin-client + test-parent helper pattern throughout the rest).

**Pattern to copy:**
- File path: `src/services/comprehension.integration.test.ts`.
- **`dotenv` early-load** (lines 11-14): `config({ path: '.env.local' })` BEFORE importing anything that reads env. Critical — the comprehension service imports `@/db/client` which reads `DATABASE_URL` at module load.
- **Admin Supabase client** (lines 53-56) for RLS-bypass writes (parent + child creation).
- **Test-parent helper** from `tests/e2e/_helpers/test-parents.ts` (lines 33-34): `createTestParent()` / `deleteTestParent()` — reuse, do not re-implement.
- **`createTestChild(parentId, gradeBand)` helper** (lines 40-78): copy verbatim if the integration test needs a child fixture.

#### 8c. Playwright E2E — happy path

**Closest analog:** `tests/e2e/placement-flow.spec.ts` (full file, 175 lines).

**Pattern to copy:**
- `test.describe.serial(...)` with shared parent + child fixtures in `test.beforeAll` / `test.afterAll`.
- `createTestParent` / `deleteTestParent` from `_helpers/test-parents`.
- Sign-in helper (lines 39-44): `goto('/sign-in') + fill + click + expect(URL)`.
- Child creation via UI (lines 47-54).
- Cookie-extraction pattern for `childId` (lines 62-65): `await page.context().cookies()` then `.find((c) => c.name === 'qira_active_child')`.
- Loop-and-click pattern for the multi-question flow (lines 103-131): wait for selector → click first choice → wait for URL change.
- Result-screen assertion pattern (lines 134-141): `await expect(page).toHaveURL(...)` + text assertion + `<bdi dir="ltr">` digit assertion.

**Phase 4 specs to anticipate:**
- `tests/e2e/reader-flow.spec.ts` — placed child auto-routes to `/reader`, reads passage, answers 4-6 questions, sees score.
- `tests/e2e/reader-cross-parent.spec.ts` — closest analog `tests/e2e/placement-cross-parent.spec.ts` (full file, 147 lines). Same pattern: two parents, Parent B cannot navigate to Parent A's `/reader/[attemptId]` or `/reader/[attemptId]/result`; forged `qira_active_child` cookie → `/choose-child`.

#### 8d. Playwright visual regression

**Closest analog:** `tests/e2e/rtl-baseline.spec.ts:30-33` (single screenshot test with `toHaveScreenshot('home-rtl.png', { fullPage: true })`).

**Pattern to copy:**
- Use the existing project matrix in `playwright.config.ts:33-49` — `chromium-desktop`, `chromium-mobile`, `webkit-desktop`, `webkit-mobile` — these are automatic per spec.
- `expect.toHaveScreenshot` config has `maxDiffPixels: 100` (`playwright.config.ts:24-26`).
- Phase 4 visual snapshot worth taking: the reader passage page at L2 (Tashkeel on) and L18 (Tashkeel off) to lock the Noto Naskh rendering across browsers/widths.

---

## Re-usable primitives (import directly, do NOT re-implement)

| Primitive | Path | Phase 4 usage |
|---|---|---|
| `<ArabicText as size diacritics>` | `src/components/arabic-text.tsx:37-52` | Every Arabic literal in reader/comprehension UI. `size="reader"` is already tuned for passage rendering: `font-naskh text-2xl leading-[1.9]` (`arabic-text.tsx:20`). `diacritics="hide"` already disables OpenType `liga` (`arabic-text.tsx:25`). Wraps children in `<bdi>` automatically. |
| `deterministicShuffle<T>(items, seed)` | `src/services/placement.ts:157-166` | Re-use for shuffling comprehension choices. Use seed `${attemptId}:${questionId}` — copy the convention from `placement.ts:291`. |
| Service Layer `AuthError` class | `src/services/profiles.ts:49-54` | Reader Server Actions catch this and `redirect('/choose-child')`. |
| `requireActiveChild(supabase, cookieValue)` | `src/services/profiles.ts:83-103` | Use in every reader Server Action and Server Component. Returns the active `ChildProfile` (with branded `ChildId`). |
| `createClient(cookieStore)` | `src/utils/supabase/server.ts` (re-exported via `@/utils/supabase/server`) | Standard Server-Component / Action Supabase client. |
| `ACTIVE_CHILD_COOKIE` + `parseActiveChildCookie` | `src/lib/active-child-cookie.ts:10,35` | Required by `requireActiveChild`. UUID regex defense against malformed cookie values. |
| `nfc(obj, fields)` + `nfcString(s)` | `src/db/normalize.ts:13,24` | Use at every Drizzle insert/update boundary for Arabic fields. |
| `ArabicText` Zod schema | `src/lib/zod.ts:18-23` | Validate Arabic strings at Service Layer entry points. Pairs with `nfc()` — call `nfc()` first to normalize, then `.parse()` to verify. |
| `<ProgressDots total current>` | `src/components/placement/progress-dots.tsx:15-45` | **Already generic.** Import directly into reader question-card. |
| `<EscapeHatch mode attemptId childId>` | `src/components/placement/escape-hatch.tsx:27-99` | Already has `mode="reader"` branch reserved (lines 43-46); wire is out of Phase 4 happy-path scope. **Pass `mode="reader" childId={...}` to show the FAB; the `shiftLevelAction` wire lands in Phase 4.1/4.2.** |
| Branded ID types: `AttemptId`, `QuestionId`, `ChoiceId`, `ChildId`, `TextId` | `placement.ts:32-34`, `profiles.ts:24-25`, `library.ts:12` | Import and use end-to-end. |
| Server-bound `.bind(null, {...})` for Server Actions | `src/components/placement/choice-card.tsx:24-28` | The PLAC-04 / COMP-04 server-authoritative-scoring pattern. **Mandatory** — never accept `chosenChoiceId` via client formData. |

---

## Cross-cutting CI/test gates that apply to Phase 4 files

These gates run automatically against new files; new Phase 4 files MUST pass them.

| Gate | Enforces | Applies to |
|---|---|---|
| **isCorrect bundle-leak** (`tests/invariants/placement-bundle-leak.test.ts:24-49`) | The literal `isCorrect` MUST NOT appear in `src/app/**` or `src/components/**`. Service Layer reads it server-side and returns only `correct: boolean`. | Every Phase 4 component and page. **Direct consequence:** `ComprehensionChoice` is already correctly typed without `isCorrect` (`src/services/comprehension.ts:18-19`). Maintain. |
| **Service-layer purity** (`tests/invariants/service-layer-purity.test.ts:14-30`) | No `next/*` imports in `src/services/**`. | `src/services/comprehension.ts`. Pass `SupabaseClient` and cookie values in from the calling Server Action, do not import `cookies()` here. |
| **RLS coverage** (`tests/invariants/rls-coverage.test.ts:20-30`) | Every `pgTable` has ≥1 RLS policy attached. | If Phase 4 adds any new table (it shouldn't), it MUST attach 4 `pgPolicy` entries (SELECT/INSERT/UPDATE/DELETE). |
| **force-dynamic gate** (`scripts/lint-force-dynamic.sh`) | Every `(authenticated)/**/layout.tsx` exports `dynamic = 'force-dynamic'`. | Any new layout files under `(authenticated)/` (e.g. `reader/layout.tsx`). Copy `placement/layout.tsx:5` verbatim. |
| **RTL physical-direction gate** (`scripts/lint-rtl.sh`) | Reject `ml-/mr-/pl-/pr-/border-l/border-r/text-left/text-right/...` in `src/` + `app/`. Logical properties only. | Every reader component. Use `ms-/me-/ps-/pe-/border-s/border-e/text-start/text-end`. The existing `placement/choice-card.tsx:34` is the reference. |
| **Arabic wrapper** (`scripts/lint-arabic-wrapper.sh`) | Bare Arabic literals in JSX must be wrapped in `<ArabicText>`. | Every reader component. |
| **SDK allowlist** (`tests/invariants/sdk-allowlist.test.ts`) | Tightly controls which `@supabase/*` and `next/*` symbols are imported where. | Re-check if Phase 4 introduces a new import path. |

---

## Gaps / new patterns (planner attention)

| Gap | Recommended approach |
|---|---|
| **Interactive Tashkeel toggle** — no client component in the codebase yet drives `<ArabicText diacritics={...}>` reactively. | Build `src/components/reader/tashkeel-toggle.tsx` as a small `'use client'` component holding `useState<'show' \| 'hide'>(initial)`, where `initial` comes from `LeveledText.tashkeelDefault`. Pass the state into a `<PassageRenderer>` client wrapper. **The state lives in the URL or component memory — no DB write needed for Phase 4 happy path** (per-child Tashkeel preference is deferred). Closest interactivity precedent: `escape-hatch.tsx:1-99` (use-state + useTransition pattern). |
| **"Next text for child" selection rule** — `texts` has no `position` column; Phase 4 needs a deterministic order. | Planner picks: (a) `ORDER BY texts.createdAt` (cheap, deterministic-by-insert-order), or (b) add `texts.position smallint` in a migration. (a) is the no-migration path and is recommended for the happy-path slice. |
| **Already-attempted-text exclusion** — `getNextTextForChild` should skip texts the child finished reading. | Pattern: `WHERE texts.levelId = child.currentLevelId AND texts.id NOT IN (SELECT textId FROM attempts WHERE childId = X AND kind='reading' AND finishedAt IS NOT NULL)`. Use Drizzle's `notInArray` or a subquery — placement.ts doesn't have this exact shape but uses `inArray` analogously (`placement.ts:13`). |
| **Passage + questions in one page vs split** — placement uses a `showPassage` query-param to toggle Passage→Question on the same `[attemptId]` route (`placement/[attemptId]/page.tsx:43-50`). The reader spec says "reads, then answers 4-6 questions" — either model works. | Planner decides. **Recommendation:** copy the placement split (passage screen → "أنا جاهز" → question screen) so the kid-touch and pacing model stays consistent across placement and reader. |
| **`bdi` on every digit** — every Western digit must be wrapped in `<bdi dir="ltr">`. | Pattern at `progress-dots.tsx:20-22`, `placement/[attemptId]/result/page.tsx:83-85`, `manage/page.tsx:80,87,108`. Tested by `placement-flow.spec.ts:140`. **Reader result page MUST follow.** |
| **Comprehension question kinds** (literal, vocab, inferential, prediction, evaluative — `comprehension.ts:21`) | The `questionType` column is plain `text` (`schema.ts:217`), not an enum. Seed strings directly. No DB change needed. |

---

## Decisions inherited from Phases 1–3 that constrain Phase 4

1. **NFC at the boundary.** Every Arabic string written via Drizzle MUST go through `nfc()` (`src/db/normalize.ts:24`) before insert/update. The Zod `ArabicText` schema (`src/lib/zod.ts:18`) verifies — it does not auto-normalize. The order is **normalize → validate → insert**.

2. **Service-layer purity.** `src/services/comprehension.ts` MUST NOT import from `next/*`. The CI gate at `tests/invariants/service-layer-purity.test.ts:24-29` fails the build otherwise. Cookies and `SupabaseClient` are injected from the calling Server Action.

3. **`force-dynamic` on every `(authenticated)` layout.** Phase 4's `reader/layout.tsx` must declare `export const dynamic = 'force-dynamic'; export const revalidate = 0;` (pattern at `placement/layout.tsx:5-6`). CI gate: `scripts/lint-force-dynamic.sh`.

4. **CSS logical properties only.** No `ml-/mr-/pl-/pr-/text-left/text-right/border-l/border-r/rounded-l/rounded-r/float-left/float-right/clear-left/clear-right` anywhere. Use `ms-/me-/ps-/pe-/text-start/text-end/border-s/border-e/...`. CI gate: `scripts/lint-rtl.sh`.

5. **Server-authoritative scoring.** The client submits a choice ID; the server resolves `isCorrect` from the DB. `isCorrect` MUST NEVER appear in `src/app/**` or `src/components/**` (CI gate at `tests/invariants/placement-bundle-leak.test.ts`). The `ComprehensionChoice` type already enforces this at the type level (`comprehension.ts:18-19`).

6. **`.bind(null, {...})` for choice cards.** Server actions for "the kid picked this choice" MUST be created with `.bind(null, { attemptId, questionId, chosenChoiceId })` at render time so the choice ID is server-bound, not client-supplied (pattern at `placement/choice-card.tsx:24-28`).

7. **Defense-in-depth child-id cross-check on result pages.** `placement/[attemptId]/result/page.tsx:48-61` does a second `attemptRow.childId !== active.id` check after `requireActiveChild`, beyond RLS. **Phase 4 result page MUST mirror this** so `placement-cross-parent.spec.ts`-equivalent isolation tests pass.

8. **`attempts.kind` enum is `['placement', 'reading']`.** Phase 4 comprehension attempts use `kind: 'reading'`. There is no `'comprehension'` enum value and Phase 4 should NOT add one.

9. **`questions.kind` enum already includes `'comprehension'`.** New seed rows use `kind: 'comprehension'`.

10. **Seeds run via `DIRECT_DATABASE_URL`.** Texts/questions/choices have `withCheck: sql\`false\`` on INSERT (`schema.ts:188, 231, 274`); only the postgres superuser connection can seed. Pattern: `placement-placeholder.ts:259-266`.

11. **Active child cookie `qira_active_child`** — UUID-validated at parse time. Read via `requireActiveChild`. Never trust the value beyond the RLS-checked `child_profiles` row it resolves to.

12. **`<bdi dir="ltr">` around every Western digit** rendered inside Arabic prose. Reader passage page, question prompts, and result screen all subject to this.

13. **Branded ID types.** `AttemptId`, `QuestionId`, `ChoiceId`, `ChildId`, `TextId` are all branded — pass them through, do not cast to/from `string` casually.

14. **Test-parent helper is the canonical e2e fixture.** `tests/e2e/_helpers/test-parents.ts` `createTestParent()` / `deleteTestParent()` — used by both Playwright specs and Vitest integration tests. Phase 4 tests MUST use this rather than spinning up their own auth fixtures.

---

## Metadata

- **Codebase scan completed:** schema, all services, all placement pages/components, seed scripts, all invariant tests, Playwright specs, config files.
- **No directory walks missed:** `src/app/(authenticated)/**`, `src/services/**`, `src/components/**`, `src/db/**`, `drizzle/migrations/**`, `tests/**`, `scripts/**`.
- **Phase 4 is uniquely well-positioned:** the Phase 3 vertical was authored as a template for Phase 4. Roughly 80% of Phase 4's code is "copy from `placement/`, swap `kind`, swap content".
