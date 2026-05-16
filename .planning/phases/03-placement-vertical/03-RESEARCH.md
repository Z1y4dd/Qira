# Phase 3: Placement Vertical — Research

> Focused on Phase-3-specific patterns. Cross-phase invariants (RTL, fonts, schema, RLS, NFC,
> `<ArabicText>`, Service Layer purity, SDK allow-list, `force-dynamic`, `getUser` ban) live in
> `01-foundation/RESEARCH.md` and `02-auth-child-profiles/RESEARCH.md` and are not re-explained
> here. Read those documents alongside this one.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01** — Fixed 15-item exam, bias-down by 1 level after algorithm, grade-prior clamp ± 3. Grade-prior table locked (Pre-K → center 2, clamp 1–5; G1-2 → center 5, clamp 2–8; G3-4 → center 9, clamp 6–12; G5-6 → center 14, clamp 11–17). Formula: `max(min(algorithm_output − 1, clamp.max), clamp.min)` — bias-down applied BEFORE clamping.
- **D-02** — Passage-screen → one-question-per-page flow. Kid never sees passage + question simultaneously. Choice order is server-side deterministic seed `(attemptId + questionId)` so retakes match.
- **D-03** — Escape hatch during placement = immediate abort + fallback level from grade-prior center ± 1 (too-hard → center − 1, too-easy → center + 1), clamped within grade-prior window. Partial attempt row kept for audit.
- **D-04** — Hatch is always visible (item 1 through last item). Two floating buttons bottom-end: "هذا صعب" / "هذا سهل". Confirmation modal before abort (2-tap minimum). Same hatch component reused on Phase 4 reader screens via `mode` prop.
- **D-05** — Placeholder bank: 5 passages at Levels 2/6/10/14/18, 3 questions each (literal, vocabulary, inferential). Seeded via `src/db/seed/placement-placeholder.ts`. All rows tagged `is_placeholder: true`. Specialist replaces via single SQL transaction.
- **D-06** — New `(authenticated)/placement` route group. `getPlacementState(childId)` → `'not_started' | 'in_progress' | 'completed' | 'escape_hatched'`. Gating in the `(authenticated)` layout (one if/else layered on the existing `requireParent` + `requireActiveChild` gates).
- **D-07** — `attempts.kind = 'placement'`. Additive new columns on `attempts`: `assigned_level` (integer 1–20), `escape_hatched` (boolean default false), `escape_hatched_reason` (enum `'too_hard' | 'too_easy' | null`), `placement_bank_version` (integer, defaults to current placeholder version). Additive `is_placeholder: boolean default false` on `texts` and `questions`.

### Claude's Discretion

- Placeholder Arabic content for 5 passages + 15 items (Claude drafts in plan).
- Progress-dot component design language.
- Result-screen copy ("اخترنا لك المستوى ٤" + CTA).
- Server Action error states — Arabic-only via the `supabase-error-ar.ts` pattern.
- Choice randomization seed implementation (e.g., `crypto.subtle` or deterministic hash).
- `choice_order` persistence in `attempt_answers` — new nullable JSONB column.

### Deferred Ideas (OUT OF SCOPE)

- Real specialist-authored Arabic bank.
- Adaptive / CAT-style placement.
- Continuous recalibration from reader sessions.
- Pilot with ≥10 real kids (Phase 5 gate).
- Library / reader / comprehension screens (Phase 4).
- Mobile API surface (Phase 5).
- Multi-language placement, parent analytics, audio items.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PLAC-01 | New child profile is prompted to take a placement assessment before the library is available | D-06 routing gate; `(authenticated)` layout gating section below |
| PLAC-02 | Placement uses a hand-authored bank of ~15 MCQ items spanning staggered-difficulty passages | D-05 bank seeding; Server Action pattern (correctness never in client bundle) |
| PLAC-03 | Placement algorithm is deterministic, rules-based, grade-prior prior, biases DOWN on uncertainty | D-01 algorithm; `assignLevel()` pure function shape; bias-down invariant |
| PLAC-04 | Placement scoring runs server-side; correct answers never sent to the browser before submit | Server Action form-per-choice pattern; bundle leak anti-pitfall |
| PLAC-05 | On completion, child sees "we picked Level X" screen; parent sees assignment in profile view | Result screen + parent-facing status card on `/profiles/[childId]/manage` |
| PLAC-06 | "Too hard / too easy" escape hatch visible during AND after placement; tapping shifts level and is logged | D-03/D-04; escape-hatch component section; PLAC-06 requires Phase 4 reuse |
| PLAC-07 | Parent can reset placement and retake from the child profile screen | `resetPlacement` Server Action; soft-archive pattern; `(authenticated)` layout re-gates on reset |
| PLAC-08 | Placement results persisted in `attempts` with type `placement` | D-07 additive migration; schema push gate |
</phase_requirements>

---

## Overview

Phase 3 must deliver the complete vertical slice from "new child with no level" to "child has an assigned level 1–20 and the parent can see it." The dominant risk is **wrong-level-day-1** (Pitfall #4): even a single bad placement drives immediate churn among 5–12-year-olds, because a child given too-hard text shuts down and a child given too-easy text disengages. The mitigation is structural — bias-down by design, an always-visible escape hatch, and a soft-archive/reset path — not a sophisticated algorithm.

Phase 3 builds on a clean Phase 2 base: all eight schema tables exist in Supabase Postgres with RLS live, the `(authenticated)` layout already has `requireParent` + email-verification gates, and the `(active)` sub-layout already handles `requireActiveChild`. Phase 3 layers a placement-state check on top of the existing gating tree without modifying any Phase 2 path. The schema migration is purely additive: four new nullable columns on `attempts`, one boolean column each on `texts` and `questions`.

The placement algorithm — `assignLevel()` — is a pure TypeScript function of ~40 lines. Its simplicity is intentional: the 15-item fixed bank cannot support psychometric sophistication, and over-engineering here is Pitfall #4's warning sign verbatim ("founder over-confidence in the algorithm"). Build the escape hatch well; test the algorithm exhaustively.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Placement algorithm (`assignLevel()`) | API / Service Layer | — | Pure function, no Next.js imports; lives in `src/services/placement.ts`. Testable in isolation via Vitest. |
| Server-authoritative scoring | API / Service Layer | — | `recordPlacementAnswer()` looks up `choices.is_correct` server-side. Result (correct: bool) returned to browser; the answer key never goes the other direction. |
| Routing gate (placement state check) | Frontend Server (SSR) | — | Server Component layout reads `getPlacementState(childId)` and issues `redirect()`. No client JS involved. |
| Passage + question rendering | Frontend Server (RSC) | — | Server Component renders passage body (Noto Naskh Arabic) and question cards. Choice cards with form actions are the only client boundary. |
| Choice submission | API / Service Layer | Browser (form POST) | Hidden `<form>` per choice card; `action` is a Server Action. Browser sends choice ID; server returns correctness. |
| Escape hatch UI | Browser (Client Component) | Frontend Server | Floating component needs `onClick` for the confirmation modal. Server Action handles the abort write. |
| Placement bank seeding | Database / Storage | — | `src/db/seed/placement-placeholder.ts` script, runs via `pnpm db:seed:placement`. Not a runtime concern. |
| Parent placement status view | Frontend Server (RSC) | — | Server Component reads `attempts` table via `getPlacementState(childId)` — same query reused. |
| Schema migration | Database / Storage | — | `pnpm db:generate` + `pnpm db:migrate` against cloud Supabase. Must run before any Phase 3 code is exercised. |

---

## A. Placement Algorithm Shape

### `assignLevel()` — pure function contract

The algorithm is a pure function: no DB reads, no side effects, no async. All data it needs (per-passage accuracy, grade-band) is precomputed and passed in. This makes it trivially unit-testable and isolates scoring logic from DB errors.

```typescript
// src/services/placement.ts (Phase 3 implementation)

export interface PassageResult {
  level: number;            // The passage's difficulty level (2, 6, 10, 14, 18 for placeholder bank)
  totalQuestions: number;   // 3 per passage in v1
  correctAnswers: number;
}

export type GradeBand = 'k' | '1-2' | '3-4' | '5-6';

export interface AssignLevelInput {
  passageResults: PassageResult[];
  gradeBand: GradeBand;
}

export interface AssignLevelOutput {
  assignedLevel: number;    // 1–20, clamped
  algorithmOutput: number;  // before clamping, for audit
  highestPassingLevel: number | null;
}

// Grade-prior table — locked in D-01
const GRADE_PRIOR: Record<GradeBand, { center: number; min: number; max: number }> = {
  'k':   { center: 2,  min: 1,  max: 5  },
  '1-2': { center: 5,  min: 2,  max: 8  },
  '3-4': { center: 9,  min: 6,  max: 12 },
  '5-6': { center: 14, min: 11, max: 17 },
};

export function assignLevel(input: AssignLevelInput): AssignLevelOutput {
  const prior = GRADE_PRIOR[input.gradeBand];

  // Find highest passage where accuracy >= 60%
  const passing = input.passageResults
    .filter(r => r.totalQuestions > 0 && r.correctAnswers / r.totalQuestions >= 0.6)
    .map(r => r.level);

  const highestPassingLevel = passing.length > 0 ? Math.max(...passing) : null;

  // Algorithm output: highest passing level, or grade-prior center if none pass
  const raw = highestPassingLevel ?? prior.center;

  // Bias-down by 1 (D-01: applied BEFORE clamping)
  const biased = raw - 1;

  // Clamp within grade-prior window
  const assignedLevel = Math.max(prior.min, Math.min(prior.max, biased));

  return { assignedLevel, algorithmOutput: biased, highestPassingLevel };
}
```

[VERIFIED: codebase — `src/services/placement.ts` stubs + `src/services/profiles.ts` for `GradeBand` type shape]

### Vitest coverage matrix for `assignLevel()`

| Case | Input | Expected assignedLevel |
|------|-------|----------------------|
| All correct, G1-2 | All 5 passages pass | `min(8, 18 - 1)` = 8 (clamp.max) |
| All wrong, G1-2 | No passages pass | `max(2, 5 - 1)` = 4 (center − 1, within clamp) |
| Mixed: passes L2, L6, fails L10+, G1-2 | L6 is highest pass | `max(2, min(8, 6 - 1))` = 5 |
| Exactly 60% on L10, G3-4 | L10 passes | `max(6, min(12, 10 - 1))` = 9 |
| Escape-hatch "too hard", G3-4 | `passageResults=[]` (abort before first answer) | `max(6, min(12, 9 - 1))` = 8 (center − 1 for too-hard; different path) |
| Pre-K, all wrong | `highestPassingLevel=null` | `max(1, min(5, 2 - 1))` = 1 |

The escape-hatch path is a SEPARATE function call (`abortPlacement(reason)`) not `assignLevel()` — it uses a direct formula: `reason === 'too_hard' ? prior.center - 1 : prior.center + 1`, then clamped. This must be tested separately.

### What the algorithm cannot tell you

The algorithm tells you which level of the **placeholder bank** the child could pass at 60% accuracy. It says nothing about their actual reading ability, because:
- 3 questions per passage is not enough for reliable discrimination.
- The placeholder content is not psychometrically validated.
- Choice distractors in a smoke-test bank may be too obvious or too subtle.

This is fine — the algorithm's job is to produce a defensible starting point, not a precise assessment. The escape hatch and parent reset button handle the inevitable misses. Document this in the result screen's parent-facing copy.

[ASSUMED] — Psychometric literature on fixed-short-form assessments for early literacy; the defensibility claim is consistent with Raz-Kids' own framing ("placement is a hint, not an assessment") cited in Pitfall #4.

---

## B. Drizzle Additive Migration on Live Supabase

### Migration vs. push — which to use

`drizzle-kit push` applies schema changes directly to the DB without generating a migration file. It is fast but leaves no migration history and cannot be reviewed in a PR. **Use `generate` + `migrate` for Phase 3.** The project already has `pnpm db:generate` and `pnpm db:migrate` scripts pointing at `DIRECT_DATABASE_URL` (the unpooled port 5432 endpoint — required for DDL).

Workflow:
1. Edit `src/db/schema.ts` — add new columns and columns on existing tables.
2. `pnpm db:generate` → Drizzle inspects the live DB (via DIRECT_DATABASE_URL), diffs schema, emits a new SQL file in `drizzle/migrations/`.
3. **Review the SQL file before `migrate`.** Confirm only `ALTER TABLE ... ADD COLUMN` statements (no `DROP`, no type changes). This is the schema-push-pitfall gate.
4. `pnpm db:migrate` → applies the SQL file.
5. Post-migration verification (see Validation Architecture below).

[VERIFIED: codebase — `drizzle.config.ts` uses `DIRECT_DATABASE_URL`, existing `drizzle/migrations/0000_workable_trauma.sql` shows the pattern, `package.json` scripts confirmed]

### Schema additions for Phase 3

All changes are additive (nullable or defaulted), so existing `attempts`, `texts`, and `questions` rows are unaffected.

**On `attempts` table:**

```typescript
// src/db/schema.ts additions
import { boolean, jsonb } from 'drizzle-orm/pg-core'; // jsonb for choice_order

// New enum for escape-hatch reason
export const escapeHatchReason = pgEnum('escape_hatch_reason', ['too_hard', 'too_easy']);

// In the attempts table definition:
assignedLevel: integer('assigned_level'),          // 1–20 integer, null until completion
escapeHatched: boolean('escape_hatched').default(false).notNull(),
escapeHatchedAt: timestamp('escape_hatched_at', { withTimezone: true }),
escapeHatchedReason: escapeHatchReason('escape_hatched_reason'),
placementBankVersion: integer('placement_bank_version'), // defaults to null; seeder writes 1
```

**On `texts` table:**
```typescript
isPlaceholder: boolean('is_placeholder').default(false).notNull(),
```

**On `questions` table:**
```typescript
isPlaceholder: boolean('is_placeholder').default(false).notNull(),
```

**On `attempt_answers` table (Claude's discretion — choice order persistence):**
```typescript
choiceOrder: jsonb('choice_order'),  // nullable JSONB: ['uuid1','uuid2','uuid3','uuid4']
```

**No new table for bank versioning.** An integer column `placement_bank_version` on `attempts` is sufficient for v1. The seeder inserts `1` as the version; specialist replaces placeholder content and increments in the same SQL transaction. A dedicated `placement_bank_versions` table would be appropriate only if you need to store metadata (date, authoring notes) per version — not needed for v1.

### RLS on new columns

No new tables means no new RLS policies to author. The existing `attempts`, `texts`, `questions`, and `attempt_answers` policies already cover all rows in those tables. The new columns inherit the table-level RLS automatically — they are columns, not tables.

**One pitfall:** `texts` and `questions` have `withCheck: sql\`false\`` on INSERT/UPDATE — no one can write them via the anon key. Placeholder seeding must use `DIRECT_DATABASE_URL` (which bypasses RLS via the postgres superuser), or a service-role key in the seed script. The existing seed script (`src/db/seed/index.ts`) uses `DIRECT_DATABASE_URL` — the placeholder seed script follows the same pattern.

[VERIFIED: codebase — `src/db/schema.ts` shows `withCheck: sql\`false\`` on `texts` and `questions` INSERT policies; `src/db/seed/index.ts` uses DIRECT_DATABASE_URL]

### `assignedLevelId` vs `assignedLevel` — critical gap to resolve

The existing `attempts` schema has `assignedLevelId: uuid('assigned_level_id').references(() => levels.id)` (a FK to the `levels` table). CONTEXT D-07 specifies a new `assigned_level` integer (1–20). There are two options:

1. **Use the existing `assignedLevelId` FK column.** Look up `levels.id` where `levels.number = assignedLevel`, then write the UUID. No new column needed. Benefit: referential integrity, no duplicate data.
2. **Add a separate integer column `assigned_level`.** Simpler in the service layer — no UUID lookup. Creates minor redundancy with `assignedLevelId`.

**Recommendation: use existing `assignedLevelId`.** Reasons: (a) the column already exists and is live in Supabase, (b) it maintains referential integrity (the FK enforces that the level exists), (c) the service can resolve the UUID from `levels.number` in a single cached lookup (levels table has 20 rows, SELECT once per service invocation), (d) adding a second `assigned_level` integer alongside the FK creates a potential inconsistency surface. The `getPlacementState()` function reads `assignedLevelId` + joins to `levels.number` to return the integer. The planner should NOT add a redundant integer column for `assigned_level` — instead, use `assignedLevelId` exclusively and expose `assignedLevel: number` from the service layer by joining `levels`.

[VERIFIED: codebase — `src/db/schema.ts` line 298 confirms `assignedLevelId` exists on `attempts`]

### Post-migration verification query

After `pnpm db:migrate`, run in Supabase SQL Editor (or via psql):

```sql
-- Verify new columns landed on attempts
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'attempts'
  AND column_name IN ('escape_hatched', 'escape_hatched_at', 'escape_hatched_reason',
                      'placement_bank_version')
ORDER BY column_name;

-- Verify is_placeholder on texts + questions
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN ('texts', 'questions')
  AND column_name = 'is_placeholder';

-- Verify escape_hatch_reason enum exists
SELECT typname FROM pg_type WHERE typname = 'escape_hatch_reason';
```

All queries must return rows. If any return empty, the migration file was not applied to the live DB — the schema push gate blocked execution for a reason.

---

## C. Server Actions for Tap-Only Kid UI (PLAC-04)

### Why correctness must never reach the client bundle

`choices.is_correct` is stored in Postgres. The `choices_select` RLS policy is `USING (true)` — authenticated users can SELECT it. This is intentional: the Service Layer's contract is that `isCorrect` is queried server-side but **never serialized into a component's props or a page's RSC payload**. If a Server Component accidentally includes `isCorrect` in its returned data, it becomes visible in:
- The RSC wire format (Network tab → Fetch responses for RSC payloads)
- The rendered page HTML source (if the component renders it, even invisibly)

The existing schema comment confirms this:
> "Service Layer code MUST NOT select isCorrect into UI props. The hide-from-UI invariant is enforced by code review + a CI grep against src/services/"

[VERIFIED: codebase — `src/db/schema.ts` line 246 comment]

The CI gate is a grep: `grep -r "isCorrect" src/app/ src/components/` must return 0 results. This is analogous to the `getSession` ban grep from Phase 2.

### Hidden form-per-choice — the tap-to-submit pattern

The kid taps a choice card. There is no traditional `<form>` with a submit button. The correct pattern for Server Actions in this case is:

```tsx
// src/app/(authenticated)/placement/[attemptId]/page.tsx (Server Component)
import { recordPlacementAnswerAction } from './actions';

// The Server Component renders four <form> elements, one per choice card.
// Each form has exactly one submit button that IS the card face.
// No JS needed — native form submission invokes the Server Action.

function ChoiceCard({ choice, attemptId, questionId }: ChoiceCardProps) {
  const submitAnswer = recordPlacementAnswerAction.bind(null, {
    attemptId,
    questionId,
    chosenChoiceId: choice.id,
  });

  return (
    <form action={submitAnswer}>
      <button
        type="submit"
        className="w-full min-h-14 text-start ps-4 pe-4 ..."
      >
        <ArabicText size="ui">{choice.labelAr}</ArabicText>
      </button>
    </form>
  );
}
```

Key properties:
- `submitAnswer = action.bind(null, { attemptId, questionId, chosenChoiceId })` — the choice ID is baked in at render time on the server. It never comes from the client.
- The button IS the card face — no separate "submit" UI.
- No RHF, no client-side state — the page is a Server Component.
- Correctness is looked up inside `recordPlacementAnswerAction` (calls `recordPlacementAnswer()` service, which queries `choices.is_correct` server-side, writes `attempt_answers.is_correct`, and returns `{ correct: boolean }`).

[VERIFIED: pattern matches Phase 2's Server Action shape in `02-CONTEXT.md` "Claude's discretion" — "thin route-file actions calling service-layer"]

### Choice order deterministic randomization

The server must randomize choice order per `(attemptId, questionId)` and persist the order so retakes reproduce the same order. Implementation:

```typescript
// src/services/placement.ts
import { createHash } from 'node:crypto';

function deterministicShuffle<T>(items: T[], seed: string): T[] {
  const hash = createHash('sha256').update(seed).digest('hex');
  // Use successive 4-byte windows of the hash as sort keys
  const indexed = items.map((item, i) => ({
    item,
    key: parseInt(hash.slice(i * 4 % 60, i * 4 % 60 + 8), 16),
  }));
  return indexed.sort((a, b) => a.key - b.key).map(x => x.item);
}

// Seed: attemptId + questionId — unique per (attempt, question) pair
const seed = `${attemptId}:${questionId}`;
const shuffledChoices = deterministicShuffle(choices, seed);
```

The shuffled order (array of choice UUIDs) is written to `attempt_answers.choice_order` as JSONB when the answer is submitted — this enables the result screen to replay the exact order the kid saw, and enables auditing. The shuffle itself is deterministic from the same seed, so re-running produces the same order without reading `choice_order` from the DB first.

[ASSUMED] — Node.js `crypto.createHash` is available in Vercel Node runtime (standard Node.js). [VERIFIED: Vercel does not use Edge runtime for Phase 3; `src/app/(authenticated)` uses `force-dynamic` + standard Node functions]

---

## D. App Router Gating — Placement State Check

### Layering on the existing gate

The current gate tree:

```
(authenticated)/layout.tsx          → requireParent()  → redirect /sign-in or /verify-email
  (authenticated)/(active)/layout.tsx  → requireActiveChild() → redirect /choose-child
    (authenticated)/(active)/dashboard/page.tsx
```

Phase 3 adds a placement-state gate. The cleanest shape is a check inside the `(active)` layout — it already has the active child in scope:

```tsx
// src/app/(authenticated)/(active)/layout.tsx — Phase 3 addition
const state = await getPlacementState(active.id);

const isOnPlacementRoute = /* check if current path starts with /placement */;
const isOnProfilesRoute = /* check if current path starts with /profiles */;

if (
  (state === 'not_started' || state === 'in_progress') &&
  !isOnPlacementRoute &&
  !isOnProfilesRoute
) {
  redirect('/placement/start');
}
```

**Problem: App Router Server Component layouts do not have access to `headers()` `pathname`.** The `(active)` layout is a Server Component; it cannot call `usePathname()` (client-only hook). The workaround is `headers().get('x-pathname')` — Next.js middleware can inject this header.

**Simpler alternative: middleware-based redirect.** Add a check in `src/proxy.ts` (the existing middleware file):
- After the existing `updateSession()` call, if the child cookie is set, query `getPlacementState` and redirect if needed.
- **Problem:** Middleware cannot call the Drizzle DB (it runs before the Node runtime is fully available; PgBouncer connections are not available in middleware on Vercel).

**Recommended approach: dedicated `(placement-gate)` route group layout.**

```
(authenticated)/
  (active)/
    layout.tsx                    ← requireActiveChild, unchanged
    (placement-gate)/             ← NEW route group, no URL segment
      layout.tsx                  ← reads placement state, redirects if not_started/in_progress
      dashboard/
        page.tsx
      library/
        page.tsx                  ← Phase 4
```

The `(placement-gate)` layout wraps only the routes that require a completed placement (dashboard, library). The `/placement/*` routes live outside it:

```
(authenticated)/
  (active)/
    layout.tsx                    ← requireActiveChild
    (placement-gate)/
      layout.tsx                  ← getPlacementState → redirect /placement/start if needed
      dashboard/page.tsx
    placement/
      start/page.tsx              ← OUTSIDE placement-gate (this is where unplaced kids land)
      [attemptId]/page.tsx
      [attemptId]/result/page.tsx
```

This pattern avoids the pathname-check problem entirely: the placement gate layout only wraps routes that need a completed placement, so it can unconditionally redirect if `state !== 'completed'`.

[VERIFIED: pattern is consistent with Next.js App Router nested route group behavior — route groups add no URL segment, so `(placement-gate)` is invisible in URLs]

### `getPlacementState()` query — no N+1

The placement state query must be cheap: one DB round-trip per navigation to any gated route.

```typescript
// src/services/placement.ts
export type PlacementState = 'not_started' | 'in_progress' | 'completed' | 'escape_hatched';

export async function getPlacementState(childId: ChildId): Promise<PlacementState> {
  const [latest] = await db
    .select({
      finishedAt: attempts.finishedAt,
      escapeHatched: attempts.escapeHatched,
    })
    .from(attempts)
    .where(and(
      eq(attempts.childId, childId),
      eq(attempts.kind, 'placement'),
    ))
    .orderBy(desc(attempts.startedAt))
    .limit(1);

  if (!latest) return 'not_started';
  if (latest.escapeHatched) return 'escape_hatched';
  if (!latest.finishedAt) return 'in_progress';
  return 'completed';
}
```

This is a single indexed query (child_id + kind + started_at — the index on `attempts.childId` from Phase 1 RLS covers child_id). No joins. No N+1.

**Important:** `getPlacementState` is called once in the `(placement-gate)` layout per navigation. It must NOT be called in the `(authenticated)/layout.tsx` top-level layout (which runs for every authenticated route including `/sign-in` redirect paths). Placing it in the more specific `(placement-gate)` layout isolates the cost.

---

## E. Persistent Floating Escape-Hatch Component

### RTL positioning with Tailwind v4 logical properties

The escape-hatch buttons must be bottom-end of the viewport — in RTL, "end" is the left side. Tailwind v4 logical-property positioning:

```tsx
<div className="fixed end-4 bottom-4 z-50 flex flex-col gap-2">
  <button ...>هذا صعب</button>
  <button ...>هذا سهل</button>
</div>
```

`end-4` translates to `inset-inline-end: 1rem`, which becomes `left: 1rem` under `dir="rtl"`. This is the correct Tailwind v4 logical-property pattern.

[VERIFIED: Phase 1 RESEARCH.md confirms Tailwind v4 logical properties (`ps-`, `pe-`, `end-`, `start-`) are verified against tailwindcss.com. `end-4` follows the same convention as `pe-4`. [CITED: CLAUDE.md Tailwind v4 section — "end-4 bottom-4" explicitly listed as the hatch positioning pattern]]

### Mobile safe-area handling

iPhone notch and Android navigation bar can overlap the fixed escape hatch. Add:

```css
/* In globals.css or as a Tailwind v4 arbitrary value */
.escape-hatch {
  padding-bottom: env(safe-area-inset-bottom, 0px);
  bottom: calc(1rem + env(safe-area-inset-bottom, 0px));
}
```

In Tailwind v4: `bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]` or a CSS custom property approach. The simplest v4 approach: use `pb-safe` if the project has a Tailwind plugin that maps safe-area values, otherwise use arbitrary values.

[ASSUMED] — Safe-area-inset approach is standard for fixed-position floating UI on mobile browsers. Specific Tailwind v4 safe-area plugin availability not verified; arbitrary value fallback is always available.

### Shadcn AlertDialog for confirmation modal

The 2-tap confirmation (D-04) maps directly to shadcn `AlertDialog`:

```tsx
import {
  AlertDialog, AlertDialogTrigger, AlertDialogContent,
  AlertDialogHeader, AlertDialogTitle, AlertDialogDescription,
  AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from '@/components/ui/alert-dialog';

// Trigger: the "هذا صعب" or "هذا سهل" button
// Action: calls the Server Action abortPlacement(reason)
```

The `AlertDialog` is a Radix Dialog under the hood. Since the escape-hatch is a Client Component (it needs `onClick` to open the dialog), wrap the Server Action call in `startTransition` + a form action:

```tsx
'use client';
import { useTransition } from 'react';
import { abortPlacementAction } from '../actions';

export function EscapeHatch({ attemptId, mode }: EscapeHatchProps) {
  const [isPending, startTransition] = useTransition();

  function handleAbort(reason: 'too_hard' | 'too_easy') {
    startTransition(async () => {
      await abortPlacementAction({ attemptId, reason });
    });
  }
  // ...
}
```

### `mode` prop API for Phase 4 reuse

```typescript
// src/components/placement/escape-hatch.tsx
type EscapeHatchMode = 'placement' | 'reader';

interface EscapeHatchProps {
  mode: EscapeHatchMode;
  attemptId?: string;        // Required for 'placement' mode
  childId?: string;          // Required for 'reader' mode (shifts level directly)
}
```

Phase 4 imports the same component with `mode="reader"`. The internal `handleAbort` branches: `mode === 'placement'` calls `abortPlacementAction`; `mode === 'reader'` calls `shiftLevelAction` (Phase 4 Server Action — stub it in Phase 3 so the interface is stable). This is the CONTEXT D-04 requirement that the same component work on Phase 4 reader screens.

### z-index stacking

The escape-hatch is `z-50` (Tailwind's `z-50 = z-index: 50`). Shadcn modals (Dialog, AlertDialog) render at `z-50` by default via Radix's portal. A stacking conflict is possible if the confirmation modal and a page-level dialog are both open. The conventional resolution: the AlertDialog triggered by the escape hatch uses `z-[60]` on its overlay, or the escape hatch itself is `z-40` and the modal inherits a higher layer. The simplest approach: because the escape hatch triggers the only modal on placement screens, `z-50` for both is fine — the modal opens on top of the button that triggered it.

---

## F. Test Surface for Phase 3

### Vitest unit tests

**File: `tests/unit/placement-assign-level.test.ts`**

Covers `assignLevel()` pure function exhaustively:
- All correct → clamp.max (every grade band)
- All wrong → grade-prior center − 1, clamped
- Mixed: various combinations of passages at threshold (exactly 60%, exactly 59%)
- Edge: 0 questions answered (passageResults = []) → center − 1
- Edge: exactly 1 passage passes → bias-down applies
- Grade-prior clamping: result before clamp exceeds window → clamped correctly
- All four grade bands tested

This test file has no DB dependency. Pure TypeScript import. Runs in < 100ms.

**File: `tests/unit/placement-abort.test.ts`**

Covers the escape-hatch fallback formula:
- too_hard → center − 1, clamped within window
- too_easy → center + 1, clamped within window
- too_easy at the top of the window → stays at window max

**File: `tests/unit/placement-shuffle.test.ts`**

Covers `deterministicShuffle()`:
- Same seed → same order (idempotent)
- Different seeds → different orders (probabilistic, test with N > 5 distinct seeds)
- All input items appear in output (no items lost)
- Shuffled array length = input length

### Vitest invariant tests (new gate)

**File: `tests/invariants/placement-bundle-leak.test.ts`**

CI gate: greps `src/app/` and `src/components/` for `isCorrect` (camelCase — the Drizzle column alias). Any occurrence in client-visible code is a build failure. Pattern:

```typescript
import { execSync } from 'node:child_process';
import { describe, test, expect } from 'vitest';

describe('placement bundle leak', () => {
  test('isCorrect does not appear in src/app or src/components', () => {
    const result = execSync(
      `grep -r "isCorrect" ${process.cwd()}/src/app ${process.cwd()}/src/components --include="*.ts" --include="*.tsx" -l 2>/dev/null || true`,
      { encoding: 'utf-8' }
    );
    expect(result.trim()).toBe('');
  });
});
```

**File: `tests/invariants/rls-coverage.test.ts`** (already exists)

Phase 3 does not add new tables, so this test should pass without modification. But the planner must verify it stays green after schema.ts changes.

### Integration test

**File: `tests/unit/placement-state.test.ts`**

Tests `getPlacementState()` against a test DB. Uses the pattern established in `tests/unit/profiles-service.test.ts` (seed parent + child via admin API, then run placement scenarios). Covers:
- No attempts → `'not_started'`
- One in-progress attempt (finishedAt null, escapeHatched false) → `'in_progress'`
- One completed attempt (finishedAt set, escapeHatched false) → `'completed'`
- One escape-hatched attempt → `'escape_hatched'`
- Reset: archived attempt + new in-progress → `'in_progress'`

### Playwright E2E tests

**File: `tests/e2e/placement-cross-user.spec.ts`**

Cross-parent isolation (analogous to `auth-cross-user.spec.ts`):
1. Parent A creates child, completes placement → child has assignedLevel.
2. Parent B logs in fresh context — their child has no placement.
3. Assert Parent B cannot see Parent A's `attempts` row (attempt-count query returns 0).
4. Parent B spoofs the `qira_active_child` cookie to Parent A's child UUID → `requireActiveChild()` returns `NO_ACTIVE_CHILD`, redirects to `/choose-child`. Assert landing page.

**File: `tests/e2e/placement-flow.spec.ts`**

Happy path: full placement assessment in a real browser (placeholder bank). Covers:
- Passage screen renders Noto Naskh Arabic at correct size.
- "أنا جاهز" CTA advances to first question.
- Tapping a choice card submits and advances.
- Escape hatch is visible on every screen (aria-label assertion).
- Escape hatch tap opens confirmation modal.
- Result screen shows assigned level in Arabic numerals.
- Parent-facing `/profiles/[childId]/manage` shows placement status.

---

## Validation Architecture

> `nyquist_validation: true` in `.planning/config.json` — this section is REQUIRED.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 3.x |
| Config file | `vitest.config.ts` (existing from Phase 1) |
| Quick run command | `pnpm test:run tests/unit/placement-assign-level.test.ts` |
| Full suite command | `pnpm test:run` |
| E2E command | `pnpm e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PLAC-01 | Unplaced child redirected to `/placement/start` | E2E | `pnpm e2e --grep "placement-gate"` | ❌ Wave 0 |
| PLAC-02 | Placeholder bank of 15 items seeded and queryable | Integration | `pnpm test:run tests/unit/placement-state.test.ts` | ❌ Wave 0 |
| PLAC-03 | `assignLevel()` correct output for all grade bands | Unit | `pnpm test:run tests/unit/placement-assign-level.test.ts` | ❌ Wave 0 |
| PLAC-04 | `isCorrect` absent from `src/app/` and `src/components/` | Invariant (grep) | `pnpm test:run tests/invariants/placement-bundle-leak.test.ts` | ❌ Wave 0 |
| PLAC-05 | Result screen renders assigned level; parent manage page shows status | E2E | `pnpm e2e --grep "placement-flow"` | ❌ Wave 0 |
| PLAC-06 | Escape hatch visible on every placement screen (aria-label) | E2E | `pnpm e2e --grep "placement-flow"` | ❌ Wave 0 |
| PLAC-07 | `resetPlacement` archives attempt; subsequent `getPlacementState` returns `'not_started'` | Integration | `pnpm test:run tests/unit/placement-state.test.ts` | ❌ Wave 0 |
| PLAC-08 | `attempts` row with `kind='placement'` written on completion and escape | Integration | `pnpm test:run tests/unit/placement-state.test.ts` | ❌ Wave 0 |

### Validation Pillars

**Pillar 1 — Algorithm correctness**
Vitest unit tests on `assignLevel()` and the escape-hatch fallback formula. Pure function; no DB. All edge cases in the coverage matrix above must pass. This is the highest-confidence test because there are no external dependencies.

**Pillar 2 — Server-authoritative scoring (PLAC-04)**
Playwright assertion: after loading any placement question page, inspect the RSC wire payload (network tab) and the rendered HTML source for the string `is_correct` (snake_case DB column name) and `isCorrect` (camelCase Drizzle alias). Either appearing in the network response is a FAIL. The invariant grep test catches the code smell at build time; the Playwright assertion catches runtime serialization bugs.

**Pillar 3 — RLS isolation**
Existing `tests/invariants/rls-coverage.test.ts` must stay green (all tables have policies). New Playwright `placement-cross-user.spec.ts` must confirm Parent B cannot access Parent A's placement attempt rows.

**Pillar 4 — Schema migration applied to live DB**

```sql
-- Run in Supabase SQL Editor after pnpm db:migrate
SELECT column_name FROM information_schema.columns
WHERE table_name = 'attempts'
  AND column_name IN ('escape_hatched', 'escape_hatched_at',
                      'escape_hatched_reason', 'placement_bank_version');
-- Expected: 4 rows
```

This cannot be automated in Vitest (it requires live DB access outside the standard test harness). It is a **manual verification step** that must appear as a plan task before the seed task.

**Pillar 5 — Escape hatch persistence**
Integration test: call `abortPlacement({ attemptId, reason: 'too_hard' })` → query `attempts` table → assert `escape_hatched = true`, `escape_hatched_reason = 'too_hard'`, `assigned_level` matches the expected fallback formula, `finished_at` is not null. Covered in `tests/unit/placement-state.test.ts`.

**Pillar 6 — Placeholder bank seeded**

```typescript
// In tests/unit/placement-state.test.ts or as a standalone check
const placeholderTexts = await db
  .select({ count: sql<number>`count(*)` })
  .from(texts)
  .where(eq(texts.isPlaceholder, true));
expect(Number(placeholderTexts[0].count)).toBe(5);

const placeholderQuestions = await db
  .select({ count: sql<number>`count(*)` })
  .from(questions)
  .where(eq(questions.isPlaceholder, true));
expect(Number(placeholderQuestions[0].count)).toBe(15);
```

### Sampling Rate

- **Per task commit:** `pnpm test:run tests/unit/placement-assign-level.test.ts tests/unit/placement-abort.test.ts tests/unit/placement-shuffle.test.ts` — < 5 seconds
- **Per wave merge:** `pnpm test:run` (full Vitest suite) — all invariants must pass
- **Phase gate:** `pnpm test:run && pnpm e2e` fully green before `/gsd-verify-work`

### Wave 0 Gaps (files that must be created before implementation)

- [ ] `tests/unit/placement-assign-level.test.ts` — covers PLAC-03 (all cases in coverage matrix)
- [ ] `tests/unit/placement-abort.test.ts` — escape-hatch fallback formula
- [ ] `tests/unit/placement-shuffle.test.ts` — deterministic shuffle invariants
- [ ] `tests/unit/placement-state.test.ts` — integration: getPlacementState, resetPlacement, seed counts
- [ ] `tests/invariants/placement-bundle-leak.test.ts` — PLAC-04 grep gate
- [ ] `tests/e2e/placement-flow.spec.ts` — happy path + escape hatch visibility
- [ ] `tests/e2e/placement-cross-user.spec.ts` — RLS isolation

---

## Anti-Pitfalls

### Anti-pitfall 1: Types pass, live DB column absent (False positive migration verification)

**What goes wrong:** Drizzle infers TypeScript types from `src/db/schema.ts`, not the live DB. A developer adds `escapeHatched: boolean(...)` to the schema file, the TypeScript compiles, and `pnpm build` passes. But `pnpm db:migrate` was never run (or ran against a different environment). The first write to `escape_hatched` column in production silently returns a Postgres `column does not exist` error at runtime.

**Why it happens:** The schema file IS the source of truth for types, but it is NOT automatically applied to the DB. The migration step is a separate manual action. It is easy to forget, especially on Vercel where the deploy succeeds (it's pure TypeScript) even if the DB schema is mismatched.

**The gate:** Planner injects a `[BLOCKING]` task — "Apply Phase 3 schema migration to cloud Supabase and run post-migration verification query." This task must complete before any task that writes to the new columns. The verification query (from section B above) confirms the columns actually exist.

---

### Anti-pitfall 2: Bundle leak — correct answers reach the client

**What goes wrong:** A developer writes a Server Component that queries choices including `isCorrect` "just to pass it to a helper" or renders a hidden element. The rendered RSC payload now contains the answer key. A curious parent opens DevTools → Network → inspects the RSC fetch → sees `"isCorrect":1` for the correct choice. The placement assessment is compromised.

**Why it happens:** Server Components run on the server, but their output (the RSC wire format) travels to the client. Any data in the component's props or rendered output is visible in the wire payload. Developers may assume "server-only = invisible."

**The gate:** `tests/invariants/placement-bundle-leak.test.ts` greps `src/app/` + `src/components/` for `isCorrect`. Passes at build time. Additionally, a Playwright `page.waitForResponse` assertion on the RSC wire payload (during the placement question load) confirms `isCorrect` is absent from the response body.

---

### Anti-pitfall 3: Bias-down rule silently omitted

**What goes wrong:** The developer reads the `assignLevel()` spec and writes: "highest passing level, clamped to grade-prior window." Ships. The bias-down −1 step is absent. A child who passes Level 10 at 60% accuracy is assigned Level 10. Per Pitfall #4, this child will find Level 10 texts at the edge of their ability — the algorithm's intent was Level 9 (easier by design). Day-1 churn follows.

**Why it happens:** The −1 bias-down is a second step that's easy to miss when reading the requirements. The algorithm "looks correct" (it does clamp, it does use grade-prior) but is missing one line.

**The gate:** `tests/unit/placement-assign-level.test.ts` has an explicit test case: `all correct, G1-2 → expected assignedLevel = 8 (NOT 18 or 17 — the clamp.max of 8 reflects bias-down from 18 → 17, then clamp to 8)`. The test comment calls out the bias-down step. The formula comment in `assignLevel()` says "bias-down BEFORE clamping — see D-01."

---

### Anti-pitfall 4: Escape hatch absent on Phase 4 reader screens

**What goes wrong:** Phase 3 ships the escape hatch as a component specific to placement routes. Phase 4 ships the reader. The Phase 4 plan does not include the escape hatch because "that's a Phase 3 thing." PLAC-06 says: "visible during AND after placement." Post-placement, the escape hatch must shift level for an already-placed child. It never ships on reader screens.

**Why it happens:** Phase boundaries create tunnel vision. The CONTEXT.md says the component accepts a `mode` prop for Phase 4 reuse, but the Phase 4 plan is written without reading Phase 3's RESEARCH.

**The gate:** The escape-hatch component's `mode` prop API is specified in Phase 3 (see section E). Phase 3 plan must include a task: "Implement `EscapeHatch` component with `mode='placement' | 'reader'` — Phase 4 reader imports this component." The planner adds a cross-phase note referencing this. The Phase 4 research will see this note in the CONTEXT.md canonical refs.

---

### Anti-pitfall 5: RLS missing on the new `is_placeholder` data

**What goes wrong:** Someone assumes that because `texts` and `questions` have existing RLS policies, the new `is_placeholder` column is safe. It is — but the WRITE side of `texts` and `questions` has `withCheck: sql\`false\`` (nobody can INSERT via the anon client). If a future developer tries to seed placeholder content via the browser-side supabase client (not the seed script), RLS silently rejects it and the seeder reports 0 rows inserted. The app starts up with an empty placement bank — `getNextPlacementItem()` returns null immediately and the placement loop crashes.

**Why it happens:** The seed script uses `DIRECT_DATABASE_URL` (bypasses RLS). If someone tries to run the seeder against the pooler URL (transaction-mode, anon role), it fails silently.

**The gate:** `src/db/seed/placement-placeholder.ts` must validate at startup: `if (!process.env.DIRECT_DATABASE_URL) throw`. The seed task in the plan specifies `pnpm db:seed:placement` (which sources `DIRECT_DATABASE_URL`), not a Supabase client call. After seeding, Pillar 6 validation confirms row counts.

---

### Anti-pitfall 6: Choice randomization not persisted — retake shows different order

**What goes wrong:** `deterministicShuffle(choices, seed)` is called at render time with seed `attemptId:questionId`. If the attempt is reset and a new `attemptId` is issued, the shuffle seed changes → retake shows different order. But within a single attempt, if the page is refreshed, the seed is the same → same order. This is the intended behavior. However, if the `choice_order` is NOT persisted in `attempt_answers`, the result screen cannot reconstruct "what order did the kid see?" for audit purposes.

The more subtle bug: if the developer uses a non-deterministic seed (e.g., `Date.now()` or `Math.random()`), every navigation to the question page shows a different order. A kid who navigates back (browser back button) sees the choices shuffled differently. They become confused. If they re-select, the correct answer may have moved.

**Why it happens:** Non-deterministic shuffle is the default muscle memory. The `Date.now()` shortcut is common.

**The gate:** `tests/unit/placement-shuffle.test.ts` tests that the same seed always produces the same order (run the shuffle 10 times, assert all outputs are identical). Code review gate: the shuffle function signature takes a string seed — `Math.random()` cannot be passed as a string seed.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Supabase Postgres (cloud) | Schema migration, seed | ✓ (live from Phase 1+2) | Supabase Postgres 15 | — |
| `pnpm db:migrate` | Additive schema migration | ✓ (script exists) | drizzle-kit 0.31.x | — |
| `DIRECT_DATABASE_URL` env var | Migration + seed | ✓ (set in Phase 1) | — | — |
| Node.js `crypto` module | Deterministic shuffle | ✓ (standard Node.js) | Node 22 LTS | — |
| Shadcn `AlertDialog` | Escape hatch confirmation modal | Not yet installed | — | Run `npx shadcn@latest add alert-dialog` in Wave 0 |
| Playwright (E2E) | Cross-user isolation + flow tests | ✓ (installed Phase 1) | 1.50+ | — |

**Missing dependencies with no fallback:** None blocking.

**Missing with install step:** `alert-dialog` shadcn component. Add to Wave 0 task list.

---

## References

### Phase 3 canonical (planner hands these to executors)

- `src/db/schema.ts` — read before touching any schema, especially `attempts.assignedLevelId` (existing FK, do NOT add a redundant integer column)
- `src/services/placement.ts` — typed stubs to fill in; already has `PlacementItem`, `PlacementResult`, `RecordPlacementAnswerInput` types
- `src/services/profiles.ts` — `requireParent()`, `requireActiveChild()` — entry points placement service calls
- `src/app/(authenticated)/(active)/layout.tsx` — `(placement-gate)` child layout goes here, do not modify the existing layout
- `src/db/seed/index.ts` — template for `placement-placeholder.ts` seed script
- `src/lib/supabase-error-ar.ts` — Arabic error message pattern for placement Server Actions
- `drizzle.config.ts` — confirms `DIRECT_DATABASE_URL` + `drizzle/migrations/` out directory

### Official documentation

- [Next.js Server Actions](https://nextjs.org/docs/app/building-your-application/data-fetching/server-actions-and-mutations) — form action binding pattern (`action.bind(null, args)`)
- [Next.js Route Groups](https://nextjs.org/docs/app/building-your-application/routing/route-groups) — `(placement-gate)` nested group without URL segment
- [Drizzle ORM migrations docs](https://orm.drizzle.team/docs/migrations) — additive ALTER TABLE via `generate` + `migrate`
- [shadcn AlertDialog](https://ui.shadcn.com/docs/components/alert-dialog) — confirmation modal component
- [shadcn Button](https://ui.shadcn.com/docs/components/button) — tappable choice card base
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) — USING + WITH CHECK pattern (Pitfall #11)
- [Tailwind v4 logical properties](https://tailwindcss.com/docs/padding) — `ps-`, `pe-`, `end-`, `start-` utilities

### Invariants to keep green (from prior phases)

- `scripts/lint-force-dynamic.sh` — every `(authenticated)/**/layout.tsx` must have `export const dynamic = 'force-dynamic'`. The `(placement-gate)` layout must declare it.
- `tests/invariants/rls-coverage.test.ts` — Phase 3 adds no new tables; should pass without changes. Verify.
- `tests/invariants/service-layer-purity.test.ts` — `src/services/placement.ts` must NOT import from `next/*`.
- `tests/invariants/auth-getsession-ban.test.ts` — no `getSession()` in placement layouts or Server Actions.
- `tests/e2e/network-audit.spec.ts` — SDK allow-list; placement adds no new external network calls.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Node.js `crypto.createHash('sha256')` is available in Vercel Node runtime for the deterministic shuffle | Section C | Choose a different deterministic hash (e.g., `djb2` pure-JS, ~5 lines) — low risk, easy swap |
| A2 | Tailwind v4 `bottom-[calc(1rem+env(safe-area-inset-bottom,0px))]` arbitrary value works without a plugin | Section E | Use a CSS custom property in `globals.css` instead — low risk |
| A3 | Psychometric literature claim that 3-question-per-passage is insufficient for reliable level discrimination | Section A | Conservative claim directionally correct regardless of literature; the escape hatch is the real mitigation — no risk |
| A4 | Drizzle `generate` will correctly produce only `ADD COLUMN` statements for Phase 3's additive changes (no unexpected `DROP` or type alterations) | Section B | Always review the generated SQL before `migrate` — risk is caught by the migration review gate |

**Claims verified or cited:** All other claims are VERIFIED against the codebase or CITED from official docs referenced above.

---

## RESEARCH COMPLETE

Phase 3 is a well-bounded additive vertical: the schema migration is four new columns + two boolean flags, the algorithm is a ~40-line pure function, and the dominant architecture decision (where to gate) resolves cleanly with a `(placement-gate)` nested route group that avoids the pathname-check problem. The highest-risk item for the planner is the `assignedLevelId` vs integer-column question — use the existing FK, not a new integer. The highest-risk item for execution is the migration gate: types compile before the DB is updated, so the `[BLOCKING]` schema-push task must precede every task that writes to the new columns.
