# Phase 4: Reader + Comprehension Loop (Happy Path) — Research

**Researched:** 2026-05-17
**Domain:** Server-rendered Arabic reader, server-authoritative MCQ comprehension scoring, Playwright RTL visual regression
**Confidence:** HIGH (most decisions reuse Phase 3 patterns already verified in-repo)

> Phase-4-specific patterns only. Cross-phase invariants — RTL boilerplate, fonts, schema, RLS,
> NFC normalisation, `<ArabicText>`, Service Layer purity, SDK allow-list, `force-dynamic`,
> `getUser` ban, server-bound action args, branded IDs, bundle-leak grep — are already locked
> in Phases 1–3 and are not re-explained here.

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| LIB-03 | Noto Naskh body, line-height ≥ 1.8, Tashkeel ON L1–10 / OFF L11–20 with toggle | §A Typography — recommends `liga off` toggle on `<ArabicText size="reader">`, leading 1.9, plus server-side stripping helper for the OFF default |
| LIB-04 | Reader uses CSS logical properties; verified by Playwright visual regression desktop + mobile Chromium + WebKit | §F Visual regression — extends existing 4-project Playwright matrix (no config change), `tests/e2e/reader-visual.spec.ts` |
| LIB-05 | Text bodies in Postgres `text` (one record per text); v1 hand-seeded ≥ 30 passages | Already supported by `texts` table (schema lines 162–205); §G seeding plan reuses `placement-placeholder.ts` shape |
| LIB-06 | Mixed Arabic + Latin tokens render correctly via `<bdi>` | Already enforced by `<ArabicText>` primitive (wraps children in `<bdi>`); §B confirms primitive is sufficient |
| COMP-01 | 4–6 comprehension questions per text in `questions` with kind=`comprehension` | Already supported — `questionKind` enum includes `'comprehension'` (schema line 35); seed adds rows |
| COMP-02 | Question-type distribution per text: literal ~30%, vocab ~25–30%, inferential ~25%, prediction/evaluative ~15–20% | §G seeding plan — distribution enforced per-passage at author time, asserted in a seed sanity test |
| COMP-03 | Multiple choice, 3–4 choices, one correct | Already supported by `choices` table |
| COMP-04 | Question order + choice order randomized per attempt | §C — reuse `deterministicShuffle()` from `src/services/placement.ts` lines 157–166. Seeds: `attemptId:Q` for question order, `attemptId:questionId` for choices (same key Phase 3 uses) |
| COMP-05 | Server-authoritative scoring (client submits choice ID, action returns correctness) | §B — clone `recordPlacementAnswer` pattern (`src/services/placement.ts` lines 315–451); bundle-leak grep at `tests/invariants/placement-bundle-leak.test.ts` already protects new files |
| COMP-07 | Result screen with kid-readable score + single CTA back | §D — `getComprehensionResult(attemptId)` + new page `/read/[attemptId]/result` mirrors placement result page |
| COMP-08 | Persist attempt in `attempts` + `attempt_answers`, kind=`comprehension` | §E — `attemptKind` enum currently only has `['placement','reading']`. **ADDITIVE MIGRATION REQUIRED**: add `'comprehension'` value (or reuse `'reading'`). Recommendation below. |
</phase_requirements>

---

## Project Constraints (from CLAUDE.md)

- All file edits via a GSD command; no ad-hoc Edit/Write outside the workflow.
- Service Layer purity is mandatory (`tests/invariants/service-layer-purity.test.ts`): NO `next/*` imports in `src/services/`.
- Tailwind v4 logical utilities only — `tests/invariants/rtl-utilities.test.ts` rejects physical-direction utilities.
- Bundle-leak grep gate (`tests/invariants/placement-bundle-leak.test.ts`) bans the literal token `isCorrect` from `src/app/**` and `src/components/**`. Phase 4 service code MUST keep `isCorrect` reads inside `src/services/`.
- Every `(authenticated)` route must `export const dynamic = 'force-dynamic'` and use `getUser()` (not `getSession()`).
- Arabic literals NFC-normalized at the write boundary (`src/lib/zod.ts` `ArabicText` schema + `src/db/normalize.ts` `nfc()` helper).
- No third-party SDKs on child-facing routes (SDK allow-list).
- `<ArabicText>` is the only legal Arabic-rendering primitive (FOUND-04).

---

## Overview

Phase 4 is the first **content + scoring loop** of the product. After Phase 3's placement vertical, every code-path that matters is already in the repo: server-authoritative MCQ scoring, `deterministicShuffle()`, the `choices.is_correct` column, `attempts` + `attempt_answers` tables, the `<ArabicText>` primitive, the four-project Playwright matrix, and a placeholder-content seeding pattern that nests passage → questions → choices in one TS literal and inserts via the superuser `DIRECT_DATABASE_URL`. **Phase 4 should clone these, not redesign them.**

Three things genuinely need new research:

1. **Tashkeel toggle mechanics** — the `<ArabicText>` primitive already has a `diacritics: 'show' | 'hide'` prop that uses `font-feature-settings: 'liga' off`. That is **the wrong mechanism** for hiding Tashkeel and needs to change in Phase 4 (see §A). Tashkeel is not a ligature; turning ligatures off breaks letter joining.
2. **Single-passage auto-routing without library UI** — the SPIDR split deferred the library browse UI to Phase 4.2, so Phase 4 must pick a text deterministically and route the child into it. Algorithm + SQL pattern is in §D.
3. **Attempt-persistence schema gap** — `attemptKind` enum lacks the literal `'comprehension'` value. Decide migration shape (see §E).

The rest of the phase is execution.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Server-side Tashkeel stripping helper (`stripTashkeel(s)`) | API / Service Layer | — | Pure string transform on the read path. Lives in `src/services/comprehension.ts` (or `src/lib/arabic-text.ts`); zero DB I/O. |
| Tashkeel UI toggle | Frontend Server (RSC) + Browser (Client Component) | — | Default is a server-rendered choice (passage text variant); a small Client Component handles the in-session toggle and re-fetches via `router.refresh()` or controlled state. |
| Reader page (passage rendering) | Frontend Server (RSC) | — | Server Component fetches the text via service, renders `<ArabicText size="reader">`. Zero JS for the read itself. |
| Comprehension question rendering | Frontend Server (RSC) | Browser (form POST) | Server Component pattern from Phase 3's `QuestionScreen`. Each `ChoiceCard` is a `<form>` with server-bound `recordComprehensionAnswerAction`. |
| `recordComprehensionAnswer()` scoring | API / Service Layer | — | Pure clone of `recordPlacementAnswer` shape. Reads `choices.isCorrect` server-side. Returns `{ correct, nextItem, finalResult }`. |
| Question + choice randomization | API / Service Layer | — | `deterministicShuffle(items, seed)` — pure function, already in `src/services/placement.ts`; **lift to `src/services/_shuffle.ts`** so both services share it without cross-service import. |
| Auto-pick-next-passage | API / Service Layer | — | `getNextTextForChild(childId)` — single LEFT JOIN against `attempts` to find unattempted text at child's level. |
| Result screen | Frontend Server (RSC) | — | Reads aggregated correct count from `attempt_answers`; renders kid-friendly score. |
| Attempt + answer persistence | Database / Storage | API | Drizzle inserts to `attempts` (kind='comprehension') + `attempt_answers`. Single transaction per session via `db.transaction(...)` (new pattern for the codebase — see §E). |
| Visual regression | CI / E2E test runner | — | `tests/e2e/reader-visual.spec.ts`. Reuses existing 4-project matrix. |
| Comprehension seed content | Database / Storage | — | `src/db/seed/comprehension-bank.ts`, idempotent, run via `DIRECT_DATABASE_URL` (RLS withCheck: false on `texts`/`questions`/`choices`). |

---

## A. Arabic Typography — Tashkeel Toggle

### A.1 The current primitive is buggy

`src/components/arabic-text.tsx` line 25:

```typescript
const diacriticsHideClass = '[font-feature-settings:"liga"_off]';
```

This is **incorrect** for hiding Tashkeel. The CSS `font-feature-settings: 'liga' off` disables OpenType **standard ligatures** (e.g., the Lam-Alif (لا) ligature). It does not hide Tashkeel diacritics. Arabic Tashkeel marks are **combining characters in the Unicode source string** (U+064B–U+0652 plus a few related marks), not OpenType features. A font cannot suppress them on the render path — the glyphs are in the string and the renderer will draw them.

Worse, `liga off` breaks Arabic letter-joining in some shaping pipelines, because Arabic shaping depends on the `init`, `medi`, `fina`, and `isol` GSUB features, and some engines bundle these under the general "ligature" umbrella in the spec's loose reading.

[VERIFIED: notofonts/arabic GitHub issue #241 — Noto Naskh's diacritics are intrinsically close to the base glyph; this is a font-level concern, not a feature-flag concern]

**The right mechanism is to strip the Tashkeel characters from the string before rendering.**

### A.2 Recommended approach — server-side stripping with a CSS escape hatch

**Recommendation:** Strip Tashkeel **server-side in the service layer** when the level's default is OFF, and pass the result to the renderer. Toggle in the UI re-fetches with the opposite preference (or uses a Client Component that holds both variants and conditionally renders).

```typescript
// src/services/comprehension.ts (or src/lib/arabic.ts)

/**
 * Strips Arabic Tashkeel (harakat) from a string while preserving
 * letters, the shadda-base ligatures, and Latin / punctuation tokens.
 *
 * Range covers:
 *   U+064B FATHATAN  through  U+0652 SUKUN (the eight core marks)
 *   U+0670 SUPERSCRIPT ALEF (dagger alif)
 *   U+0640 TATWEEL (kashida elongation) — NOT a mark, but optional to strip
 *
 * We deliberately KEEP U+0653 MADDAH, U+0654 HAMZA-ABOVE, U+0655 HAMZA-BELOW
 * because they are phonemically significant (e.g., ﺁ vs ا).
 *
 * NFC-normalize before stripping so combining marks are in canonical order.
 */
const TASHKEEL = /[ً-ْٰ]/g;

export function stripTashkeel(s: string): string {
  return s.normalize('NFC').replace(TASHKEEL, '');
}
```

[CITED: hubail/TashkeelRemover, overdoe.com 2020 — confirm the U+064B–U+0652 range is the standard harakat range]
[VERIFIED: project's own `src/db/normalize.ts` already does NFC at write time, so input to `stripTashkeel` is canonical]

**Why server-side, not CSS?**
- A CSS-only suppression mechanism for Tashkeel does not exist. There is no `font-variant` or `font-feature-settings` value that hides combining marks.
- Delivering two text variants (with/without Tashkeel) doubles DB storage with no benefit; stripping is a 1-line transform.
- Stripping on the server means the OFF variant ships less data to the client (every Tashkeel character is 2 UTF-8 bytes).

**Toggle UX:** Render a small Client Component near the passage with `aria-pressed` state. On change, either:
- (a) `router.push('?tashkeel=on')` and let the server re-render the passage (simplest, RSC-friendly), or
- (b) pass both variants to the client and swap in a `useState` (cheaper for the toggle, but doubles wire payload).

**Recommendation: (a)** — server-controlled, no extra wire weight, consistent with project's "render on the server" stance.

### A.3 `<ArabicText>` primitive changes

Replace the `diacritics: 'show' | 'hide'` prop's implementation. The prop API can stay — but the contract becomes "the caller is responsible for passing pre-stripped text when `hide` is desired." Add a doc comment to this effect. Remove the `liga off` class — it does not do what the comment claims and risks breaking joining.

Alternative: deprecate the prop entirely and force callers to do the stripping themselves. **Recommended** — fewer footguns, the primitive does one job (render Arabic with a `<bdi>`).

### A.4 Line-height for Tashkeel ON (LIB-03 requires ≥ 1.8)

The existing `<ArabicText size="reader">` class is `font-naskh text-2xl leading-[1.9]`. **1.9 is correct** and satisfies LIB-03's ≥ 1.8 floor with margin. Recommendation: keep 1.9; do **not** raise to 2.0+ even for L1–10 — visual testing during plan execution should confirm but the existing value reflects deliberate Phase 1 calibration.

[CITED: w3.org/TR/alreq — Arabic vertical metrics need extra space above the baseline for marks; 1.8–2.0 is the standard educational publishing range]

### A.5 Rendering strategy — spans vs single text node

Current Phase 3 reader (`PassageScreen`) renders the body as a single `<ArabicText>` text node. **Keep this for Phase 4.** Splitting into per-word `<span>` nodes for future highlight/click features is a Phase 4.1+ concern; doing it now adds DOM weight (a 75-word L18 passage becomes 75 spans) and serves no Phase 4 requirement. Do **not** use `dangerouslySetInnerHTML` — Arabic strings are plain text, not HTML; using `dangerouslySetInnerHTML` for plain text is an XSS footgun with no upside.

---

## B. `<bdi>` vs `dir="auto"` for Mixed Tokens (LIB-06)

The `<ArabicText>` primitive already wraps children in `<bdi>` (`src/components/arabic-text.tsx` line 49). This is correct and Phase 4 needs no change.

[VERIFIED: MDN `<bdi>` element docs — `<bdi>` is defined as having `unicode-bidi: isolate` and `dir="auto"` by default. The two are semantically equivalent for the isolation behavior we want.]

**When you'd reach for `dir="auto"` instead of `<bdi>`:** If you wanted to isolate text on a non-inline element (e.g., a list item or table cell) where `<bdi>` would change the layout, you'd add `dir="auto"` to the existing element. `<bdi>` is inline by default and is preferred when wrapping an inline run of unknown-direction text inside surrounding RTL flow — exactly Qira's case.

**Within a passage that has mixed Arabic + Latin (e.g., the text mentions "iPad" or the number "2024"):** The passage as a whole is wrapped in `<ArabicText>` → `<bdi>`, which sets the run's direction from the first strong character (always Arabic for Qira passages). Inline Latin tokens inside that run are handled by the Unicode Bidirectional Algorithm automatically — **no additional `<bdi>` wrapper is needed inside the passage** because the surrounding paragraph is already isolated. The UBA's neutral-character resolution handles digits and the embedded Latin word correctly inside an RTL run.

[CITED: w3.org "Inline markup and bidirectional text in HTML" — wrapping each Latin token inside a `<bdi>` is only needed when the *injected* phrase's direction is unknown (e.g., user-generated content)]

**For LIB-06 verification:** A unit test should assert `stripTashkeel("جاء أحمد iPad 2024.")` does **not** mangle the Latin tokens, and a Playwright test should screenshot a passage containing the literal string `iPad 2024` to catch any RTL-mirror regression around the Latin run.

---

## C. Question + Choice Randomization (COMP-04)

### C.1 Reuse `deterministicShuffle()`

The function already exists in `src/services/placement.ts` lines 157–166:

```typescript
export function deterministicShuffle<T>(items: T[], seed: string): T[] {
  if (items.length <= 1) return items.slice();
  const hash = createHash('sha256').update(seed).digest('hex');
  const indexed = items.map((item, i) => ({
    item,
    key: parseInt(hash.slice((i * 4) % 60, (i * 4) % 60 + 8), 16),
  }));
  return indexed.sort((a, b) => a.key - b.key).map((x) => x.item);
}
```

**Recommendation:** Lift to `src/services/_shuffle.ts` (or `src/lib/shuffle.ts`) so both `placement.ts` and the new `comprehension.ts` import from one source. Keep the original signature; do not change Phase 3 behavior. A separate refactor task is appropriate.

### C.2 Seeds (Phase 4 specific)

| What is shuffled | Seed string |
|------------------|-------------|
| Order of N comprehension questions for an attempt | `${attemptId}:questions` |
| Order of 3–4 choices for one question | `${attemptId}:${questionId}` (same shape as Phase 3, no key collision since attempts have different IDs) |

**Why server-side:** The same Phase 3 reasoning applies — COMP-04 + COMP-05 require server-authoritative order for retake reproducibility and to keep client code out of the trust path. The choice order is persisted in `attempt_answers.choiceOrder` (JSONB) on submission — the same column Phase 3 uses for placement (schema line 357).

### C.3 Stable IDs, never positional

Client receives `{ id: ChoiceId, labelAr: string }` only (mirror of `PlacementItem.choices` shape). The choice ID is the stable UUID from the DB; the client posts that ID back. **Do not send positional indices** ("the user chose choice #2") — that breaks under any shuffle and creates a class of off-by-one bugs.

---

## D. Auto-Route to Next Passage (No Library UI in Phase 4)

The SPIDR split removed Phase 4.2's library UI from this phase's scope, but the child still needs to land on **a** passage after the dashboard. The dashboard CTA ("ابدأ القراءة") must call a Server Action that picks a passage and redirects to `/read/{textId}` (or, more cleanly, creates a comprehension attempt up-front and redirects to `/read/{attemptId}` — see §E for the schema decision).

### D.1 Algorithm

Given a child at `assignedLevel = N`, the next-text function picks **the lowest-positioned text at level N that this child has not yet completed**. Fallback chain:

1. Un-attempted text at level N → pick that one.
2. All texts at level N already attempted → pick the lowest-positioned text at level N anyway (allow re-reads). v1 content is sparse; re-reading is a feature not a bug.
3. No text at level N exists at all → error (seeded content must cover L1–10 per LIB-05; a missing level is a seed bug).

For deterministic order in case (1), order texts by `created_at ASC, id ASC` (no `position` column on `texts` in the current schema — see Open Questions).

### D.2 SQL pattern

```typescript
// src/services/comprehension.ts

export async function getNextTextForChild(childId: ChildId): Promise<TextId | null> {
  // Resolve the child's assigned level
  const [child] = await db
    .select({ levelId: childProfiles.currentLevelId })
    .from(childProfiles)
    .where(eq(childProfiles.id, childId))
    .limit(1);

  if (!child?.levelId) throw new AuthError('NO_LEVEL_ASSIGNED');

  // LEFT JOIN to find an unattempted text at the child's level.
  // We treat an attempt as "completed" iff finishedAt IS NOT NULL.
  const rows = await db
    .select({ id: texts.id, hasAttempt: sql<boolean>`bool_or(${attempts.finishedAt} IS NOT NULL)` })
    .from(texts)
    .leftJoin(
      attempts,
      and(
        eq(attempts.textId, texts.id),
        eq(attempts.childId, childId),
        eq(attempts.kind, 'comprehension'),  // see §E re: enum value
      ),
    )
    .where(eq(texts.levelId, child.levelId))
    .groupBy(texts.id, texts.createdAt)
    .orderBy(texts.createdAt, texts.id);

  // Prefer un-attempted; otherwise fall back to the first text.
  const unattempted = rows.find((r) => !r.hasAttempt);
  return (unattempted?.id ?? rows[0]?.id ?? null) as TextId | null;
}
```

### D.3 Where this lives

- Function in `src/services/comprehension.ts`.
- Server Action wrapper `startComprehensionAction()` in `src/app/(authenticated)/(active)/(placement-gate)/read/actions.ts` (new route group sibling of the dashboard).
- Dashboard CTA links to a Server Action that calls `getNextTextForChild`, calls `startComprehensionAttempt(childId, textId)`, then `redirect('/read/{attemptId}')`.

This mirrors Phase 3's `startPlacementAction → startPlacement → redirect('/placement/{attemptId}')` shape exactly.

---

## E. Attempt + Answer Persistence (COMP-08)

### E.1 Schema gap — `attemptKind` enum

`src/db/schema.ts` line 34:

```typescript
export const attemptKind = pgEnum('attempt_kind', ['placement', 'reading']);
```

The enum has `'placement'` (used by Phase 3) and `'reading'` (currently unused). It does **not** have `'comprehension'`. Two options:

**Option A — reuse `'reading'`** (cleanest if "reading attempt" is the project's term for what Phase 4 builds).
- Pro: no migration, the enum was clearly designed with this in mind.
- Pro: matches the requirement's wording ("Leveled Library & Reader" / "Comprehension Questions" are facets of one reading session).
- Con: the requirement text in REQUIREMENTS.md says "Each completed comprehension attempt is persisted in `attempts` + `attempt_answers`" — using `kind='reading'` is a small semantic mismatch.

**Option B — add a third enum value `'comprehension'`.**
- Pro: matches REQUIREMENTS.md COMP-08 wording 1:1.
- Con: Postgres `ALTER TYPE ... ADD VALUE` migration; Drizzle Kit generates this fine but it cannot run inside a transaction (Postgres restriction on enum extension), so the migration must be standalone.

**Recommendation: Option A (reuse `'reading'`).** The enum was authored in Phase 1 with foresight; the comprehension loop **is** the reading loop. A code-comment on the enum and the service module documenting the equivalence is sufficient. This avoids a non-transactional enum migration and reduces moving parts. **Surface this for user confirmation in /gsd-discuss-phase** because it touches a previously-documented semantic name. [ASSUMED — defer to user]

### E.2 Two-row pattern

```typescript
// One row in `attempts` per session
{
  id: uuid,
  childId,
  kind: 'reading',                    // or 'comprehension' per E.1 outcome
  textId: <the passage>,              // existing nullable FK; now used
  startedAt: now(),
  finishedAt: null,                   // set on last answer
  score: null,                        // set on last answer (e.g., correct/total * 100)
  placementBankVersion: null,         // n/a for reading attempts
}

// One row in `attempt_answers` per question answered
{
  id, attemptId, questionId, chosenChoiceId,
  isCorrect: 0|1,                     // server-derived
  answeredAt: now(),
  choiceOrder: [<uuid>, <uuid>, ...], // JSONB, the shuffled order shown to the kid
}
```

The `attempts.assignedLevelId` column is **placement-only** and stays NULL for reading attempts. The `attempts.escapeHatched*` columns also stay NULL (escape hatch is reused later in Phase 4.1, not 4).

### E.3 Idempotency on result-screen reload

The result screen at `/read/{attemptId}/result` reads the existing rows; it does not write. Idempotency is achieved by writing `finishedAt` on the **last** `recordComprehensionAnswer` call (when `answerCount === totalQuestions`). Any subsequent POST to the same answer endpoint should be a no-op: an explicit guard at the top of `recordComprehensionAnswer` checks `attempts.finishedAt IS NOT NULL` and throws / returns the existing finalResult.

This mirrors `getNextPlacementItem`'s guard at `src/services/placement.ts` lines 238–239.

### E.4 Transaction pattern (new to the codebase)

The placement service does sequential inserts without an explicit transaction (`src/services/placement.ts` lines 342–438). This is acceptable for Phase 3 because:
- Each call writes one `attempt_answers` row.
- The "close the attempt" update is also one row.
- RLS errors fail the connection cleanly.

For Phase 4, the same shape works — `recordComprehensionAnswer` writes one answer row, and the final call also updates `attempts`. **No explicit transaction wrapper is required for the happy path.** If a future requirement needs atomic multi-row writes (e.g., bulk-insert all attempt_answers on a "submit all at once" UI variant), introduce `db.transaction(async (tx) => { ... })` then. Drizzle supports this on `postgres.js` driver via `client.begin()` under the hood.

[CITED: orm.drizzle.team/docs/transactions — `db.transaction` syntax is `await db.transaction(async (tx) => { await tx.insert(...) })`]

---

## F. Playwright RTL Visual Regression for the Reader (LIB-04)

### F.1 The matrix is already configured

`playwright.config.ts` defines four projects: `chromium-desktop`, `chromium-mobile`, `webkit-desktop`, `webkit-mobile`. Each project automatically runs every spec under `tests/e2e/`. **Phase 4 needs to add a spec — no config change.**

### F.2 Spec location and naming

- File: `tests/e2e/reader-visual.spec.ts`
- Snapshot folder: `tests/e2e/__screenshots__/reader-visual.spec.ts/` (auto-generated)
- Snapshot file naming: Playwright automatically suffixes the project name → `passage-l5-rtl-chromium-desktop.png`, `passage-l5-rtl-webkit-mobile.png`, etc. No manual naming needed.

### F.3 Spec shape (follow `rtl-baseline.spec.ts`)

```typescript
// tests/e2e/reader-visual.spec.ts
import { expect, test } from '@playwright/test';
import { authenticateAsTestParent, withActiveChildAtLevel } from './_helpers/test-parents';

test.describe('Reader visual baseline @ /read/{attemptId}', () => {
  test.beforeEach(async ({ page }) => {
    await authenticateAsTestParent(page);
    await withActiveChildAtLevel(page, 5);   // seed an L5-placed child + start an attempt
  });

  test('passage renders right-aligned with Tashkeel on (L5 default)', async ({ page }) => {
    await page.goto('/read/start');           // server action → redirect to /read/{attemptId}
    // Wait for fonts before screenshotting — Arabic glyphs flash without this on WebKit.
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('passage-l5-tashkeel-on.png', { fullPage: true });
  });

  test('question screen renders 4 choices in vertical stack', async ({ page }) => {
    await page.goto('/read/start');
    await page.getByRole('button', { name: 'أنا جاهز' }).click();  // advance from passage to Q1
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('question-1-rtl.png', { fullPage: true });
  });
});
```

### F.4 Font-loading flake — the standard pattern

Use `await page.evaluate(() => document.fonts.ready)` immediately before `toHaveScreenshot`. This is more reliable than `waitForLoadState('networkidle')` because `next/font/google` may have already inlined fonts and `networkidle` will fire before the browser has painted with the Arabic face.

Known caveat: `document.fonts.ready` has been observed to behave inconsistently on WebKit + Ubuntu in CI. If flakes appear, two mitigations exist:
- Use `PW_TEST_SCREENSHOT_NO_FONTS_READY=1` to bypass Playwright's internal fonts-ready wait and rely solely on the explicit `evaluate` line above.
- Increase `expect.toHaveScreenshot.maxDiffPixels` (currently 100 in `playwright.config.ts`) modestly if anti-aliasing of Arabic glyphs varies by sub-pixel.

[CITED: microsoft/playwright issues #18640, #20570, #12839 — known font-loading flakiness on WebKit; `document.fonts.ready` is the canonical workaround]

### F.5 What to assert beyond the screenshot

Per Phase 3's `rtl-baseline.spec.ts` template, add non-screenshot assertions for cheap CI feedback when a snapshot diff is hit:

```typescript
test('reader root sets dir=rtl and lang=ar', async ({ page }) => {
  await page.goto('/read/start');
  const main = page.locator('main').first();
  await expect(main).toHaveAttribute('dir', /rtl|auto/);
});

test('passage body resolves to Noto Naskh', async ({ page }) => {
  await page.goto('/read/start');
  const passage = page.locator('[data-testid="passage-body"]').first();
  const ff = await passage.evaluate((el) => getComputedStyle(el).fontFamily);
  expect(ff).toMatch(/Naskh/i);
});
```

The `data-testid="passage-body"` hook is a tiny but valuable addition to `PassageScreen` (or the new Phase 4 reader equivalent).

---

## G. Seed Content Strategy

### G.1 File shape — clone `placement-placeholder.ts`

Place at `src/db/seed/comprehension-bank.ts`. Use the same TypeScript literal pattern (passages → questions → choices nested). Insert via `DIRECT_DATABASE_URL` superuser connection (RLS `withCheck: false` on `texts`/`questions`/`choices` requires it — see `placement-placeholder.ts` lines 16–17). Idempotent guard: bail with exit 0 if N+ placeholder comprehension texts already exist.

Why TypeScript literal over JSON / markdown:
- **TS literal:** Type-checked at author time (the `Passage[]` type catches missing fields); diffs cleanly in PRs; one file the literacy specialist can be walked through. **Recommended.**
- **JSON:** Loses type-check; no comments for the literacy specialist; verbose. **Rejected.**
- **Markdown front-matter:** Requires a parser; complicates the seed pipeline; not used elsewhere in repo. **Rejected.**

### G.2 Volume

LIB-05 requires ≥ 30 passages covering Levels 1–10 (target 50). For Phase 4 happy-path, **seed a minimum that exercises the full loop without blocking ship**:

- **Phase 4 ship minimum:** ≥ 3 passages at the most-likely-assigned level (Level 5 — the K and 1–2 grade-prior centers cluster near 2 and 5). The user story requires "one passage" — three lets a child reload and get a different unattempted passage, exercising `getNextTextForChild`'s un-attempted fallback (D.1 case 1).
- **LIB-05 full target (≥ 30):** Can be filled progressively by appending to the seed file in subsequent commits within Phase 4 or deferred to a Phase 4 tail task. The plan should make this explicit.

Each passage needs 4–6 comprehension questions (COMP-01) at the distribution in COMP-02. A seed sanity test (Vitest) asserts the distribution per passage.

### G.3 `is_placeholder` flag

The existing `texts.isPlaceholder`, `questions.isPlaceholder` columns (schema lines 176, 219) already support the "specialist replaces via single SQL transaction" pattern Phase 3 uses. **Reuse — all Phase 4 seed rows get `isPlaceholder: true` until a literacy specialist signs them off.** This is the same model Phase 3 placement uses.

No new `content_status` column is needed. The boolean flag is sufficient for the v1 placeholder/approved distinction. A future column can refine this when the literacy authoring workflow lands in v2.

### G.4 Distribution enforcement (COMP-02)

Add a Vitest test in `tests/unit/comprehension-bank.test.ts` that imports the seed module's `PASSAGES` array and asserts:

```typescript
for (const passage of PASSAGES) {
  expect(passage.questions.length).toBeGreaterThanOrEqual(4);
  expect(passage.questions.length).toBeLessThanOrEqual(6);

  const types = passage.questions.map(q => q.questionType);
  const counts = countBy(types);  // literal, vocabulary, inferential, prediction|evaluative
  // Soft assertions — distribution is a target, not a hard contract:
  expect(counts.literal / types.length).toBeGreaterThan(0.15);
  expect(counts.vocabulary / types.length).toBeGreaterThan(0.15);
  expect(counts.inferential / types.length).toBeGreaterThan(0.15);
}
```

`questions.questionType` is already a `text` column (schema line 217). The Phase 3 seed uses values `'literal' | 'vocabulary' | 'inferential'`. Phase 4 adds `'prediction'` and `'evaluative'` as legal values. No enum migration — the column is `text` not `pgEnum`.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Deterministic shuffle for retakes | Custom Math.random-with-seed | Existing `deterministicShuffle()` from `src/services/placement.ts` (lift to shared module) | Already verified, already covered by Phase 3 tests |
| Server-authoritative scoring scaffolding | New Server Action shape | Clone `recordPlacementAnswerAction` + `recordPlacementAnswer` 1:1 | Pattern is already grep-tested by `placement-bundle-leak.test.ts` |
| Stripping Tashkeel | Custom char-by-char loop | Single-line regex `/[ً-ْٰ]/g` on NFC-normalized input | Standard, tested upstream pattern |
| Bidirectional isolation for embedded Latin | Per-token `<bdi>` wrapping | The outer `<ArabicText>` `<bdi>` + UBA is sufficient | Spec-defined behaviour; over-wrapping adds DOM noise |
| Choice positional numbering | Index-based "user chose #2" payload | Stable choice UUIDs | Phase 3 uses UUIDs; preserves randomization invariant |
| Comprehension result-screen aggregation | Client-side count | Server-side `SUM(is_correct)` in the service | `isCorrect` MUST NOT cross the bundle-leak boundary |

---

## Common Pitfalls

### Pitfall 1: `font-feature-settings: 'liga' off` to hide Tashkeel
**What goes wrong:** Tashkeel still renders (it's combining characters, not ligatures), and Arabic letter-joining may degrade.
**Why it happens:** The current `<ArabicText>` `diacritics: 'hide'` prop uses exactly this. The comment claims it suppresses Tashkeel; it does not.
**How to avoid:** Strip Tashkeel server-side with the regex helper. Remove or re-document the `diacritics` prop.

### Pitfall 2: Storing the correct-choice ID in the question fetch
**What goes wrong:** A clever client can read it from the RSC payload and pre-resolve every answer.
**Why it happens:** `db.select().from(choices)` returns all columns by default if you don't project; `isCorrect` ships to the wire.
**How to avoid:** Always project explicitly in service queries that build the client-bound payload — `db.select({ id: choices.id, textAr: choices.textAr })`. The `placement-bundle-leak.test.ts` grep gate catches `isCorrect` references in `src/app/**` and `src/components/**`, but **it does not catch service-layer leaks via spread or wildcard select** — manual projection is the only enforcement at the service boundary.

### Pitfall 3: Result-screen double-write on reload
**What goes wrong:** Kid taps refresh on `/read/{attemptId}/result`; if the page action re-runs `recordComprehensionAnswer`, a second `attempt_answers` row appears.
**Why it happens:** Server Components can re-render; if scoring logic is in the page's data fetch instead of the action, reload triggers a write.
**How to avoid:** All writes go through Server Actions (POST). The result page is a pure read: `getComprehensionResult(attemptId)` queries `attempts` + `attempt_answers`, no writes. Guard `recordComprehensionAnswer` against re-entry by checking `attempts.finishedAt IS NOT NULL`.

### Pitfall 4: `dangerouslySetInnerHTML` for the passage body
**What goes wrong:** Passage content is plain text. Using `dangerouslySetInnerHTML` adds an XSS attack surface for zero benefit. Worse, a future "passage authored in markdown" feature might land HTML in the DB — without a sanitizer, that's an immediate XSS.
**How to avoid:** Render the body as a text child of `<ArabicText>`. Period.

### Pitfall 5: Snapshot tests against `Math.random` choice order
**What goes wrong:** Visual regression fails every CI run because the choice order differs.
**Why it happens:** Tests forget that COMP-04 is deterministic per attempt — they don't seed the attempt deterministically.
**How to avoid:** E2E tests should use a fixed test-attempt ID OR `mask` the choice region in `toHaveScreenshot({ mask: [...] })`. Recommend the former: seed a known `attemptId` in the test-parent helper.

### Pitfall 6: Forgetting `export const dynamic = 'force-dynamic'` on new routes
**What goes wrong:** Next.js statically optimizes `/read/[attemptId]/page.tsx` because it doesn't see runtime cookies, and a stale snapshot is served across users.
**Why it happens:** Easy to miss when copying a page file.
**How to avoid:** All new authenticated routes must have it. AUTH-06's invariant test (`tests/invariants/auth-getsession-ban.test.ts`) covers `getSession` but a parallel test for `force-dynamic` on `(authenticated)/**` page.tsx files would be valuable to add as a Phase 4 hardening task. [VERIFIED: pattern is asserted ad-hoc, not enforced — see Open Questions]

---

## Code Examples

### Server-authoritative comprehension answer

```typescript
// src/services/comprehension.ts (Phase 4 — clone of recordPlacementAnswer shape)

export async function recordComprehensionAnswer(
  input: RecordComprehensionAnswerInput,
): Promise<RecordComprehensionAnswerResult> {
  const parsed = RecordComprehensionAnswerInput.parse(input);
  const attemptId = parsed.attemptId as AttemptId;
  const questionId = parsed.questionId as QuestionId;
  const chosenChoiceId = parsed.chosenChoiceId as ChoiceId;

  // Re-entry guard (idempotency on reload)
  const [attempt] = await db
    .select({ finishedAt: attempts.finishedAt, textId: attempts.textId })
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);
  if (!attempt) throw new AuthError('ATTEMPT_NOT_FOUND');
  if (attempt.finishedAt) {
    // Already finished — return existing result, do not double-write
    return buildExistingResult(attemptId);
  }

  // Server-side correctness lookup — isCorrect READ only, never returned upward
  const [chosen] = await db
    .select({ isCorrect: choices.isCorrect })
    .from(choices)
    .where(eq(choices.id, chosenChoiceId))
    .limit(1);
  if (!chosen) throw new Error(`Choice not found: ${chosenChoiceId}`);

  // Persist the answer with the audit-trail choice order
  const seed = `${attemptId}:${questionId}`;
  const allChoices = await db
    .select({ id: choices.id })
    .from(choices)
    .where(eq(choices.questionId, questionId));
  const shuffledOrder = deterministicShuffle(allChoices, seed).map((c) => c.id);

  await db.insert(attemptAnswers).values({
    attemptId,
    questionId,
    chosenChoiceId,
    isCorrect: chosen.isCorrect,
    choiceOrder: shuffledOrder,
  });

  // Did we just answer the last question?
  if (!attempt.textId) throw new Error(`Comprehension attempt ${attemptId} has no textId`);

  const totalQ = await countComprehensionQuestionsForText(attempt.textId);
  const answeredQ = await countAnswersForAttempt(attemptId);

  if (answeredQ < totalQ) {
    const nextItem = await getNextComprehensionItem(attemptId);
    return { correct: chosen.isCorrect === 1, nextItem, finalResult: null };
  }

  // All answered — close the attempt
  const [scoreRow] = await db
    .select({ total: sql<number>`sum(${attemptAnswers.isCorrect})` })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));

  const totalCorrect = Number(scoreRow?.total ?? 0);

  await db
    .update(attempts)
    .set({ finishedAt: new Date(), score: totalCorrect })
    .where(eq(attempts.id, attemptId));

  return {
    correct: chosen.isCorrect === 1,
    nextItem: null,
    finalResult: { attemptId, totalQuestions: totalQ, correctAnswers: totalCorrect },
  };
}
```

### Tashkeel stripping helper with NFC

```typescript
// src/lib/arabic.ts (new) — or in src/services/comprehension.ts if no other consumer

const TASHKEEL = /[ً-ْٰ]/g;

export function stripTashkeel(s: string): string {
  // Input may not be NFC; normalize first so combining marks are in canonical order.
  return s.normalize('NFC').replace(TASHKEEL, '');
}
```

Pair with a Vitest unit test asserting:
- Strips fatha, kasra, damma, sukun, shadda, tanween (all six).
- Preserves base letters, hamza-above (U+0654), hamza-below (U+0655), maddah (U+0653).
- Preserves Latin tokens and digits unchanged.
- Is idempotent: `stripTashkeel(stripTashkeel(s)) === stripTashkeel(s)`.

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| OpenType feature toggle to hide Tashkeel | Server-side regex stripping on NFC-normalized text | Correct behaviour; fewer client bytes for the OFF default |
| Per-Latin-token `<bdi>` wrappers inside an RTL paragraph | One outer `<bdi>` + UBA neutral resolution | Less DOM noise; spec-correct |
| Jest snapshot of choice text order | Deterministic seeded shuffle so the same attempt always renders the same order | Reproducible snapshots without re-recording |
| Client-side correctness state | Server Action returns `{ correct: boolean }` per submit | Zero answer-key on the wire |

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Vitest 3.x (unit, invariants), Playwright 1.50+ (e2e + visual) |
| Config files | `vitest.config.ts`, `playwright.config.ts` |
| Quick run command | `pnpm test` (Vitest) / `pnpm test:e2e --project=chromium-desktop` |
| Full suite command | `pnpm test && pnpm test:e2e` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|--------------|
| LIB-03 | Reader renders Noto Naskh leading 1.9, Tashkeel on for L1–10 | e2e visual + computed-style | `pnpm test:e2e -- tests/e2e/reader-visual.spec.ts` | ❌ Wave 0 |
| LIB-04 | CSS logical properties + visual regression across 4 projects | e2e visual | `pnpm test:e2e -- tests/e2e/reader-visual.spec.ts` | ❌ Wave 0 |
| LIB-05 | ≥ 30 passages at L1–10 in DB (start: ≥ 3 at L5 for Phase 4 happy path) | unit + integration | `pnpm test -- tests/unit/comprehension-bank.test.ts` | ❌ Wave 0 |
| LIB-06 | `<bdi>` wraps passage; mixed Arabic+Latin renders correctly | unit + e2e visual | `pnpm test -- tests/unit/arabic-text-bdi.test.ts` (extend) and reader-visual screenshot of a mixed passage | partial ✅ (primitive test exists) |
| COMP-01 | Each text has 4–6 comprehension questions | unit on seed | `pnpm test -- tests/unit/comprehension-bank.test.ts` | ❌ Wave 0 |
| COMP-02 | Type distribution per passage | unit on seed | same file as COMP-01 | ❌ Wave 0 |
| COMP-03 | 3–4 choices per question, exactly one correct | unit on seed + DB constraint check | same file | ❌ Wave 0 |
| COMP-04 | Question + choice order deterministic per attempt | unit on `deterministicShuffle` (exists) + e2e reload check | `pnpm test -- tests/unit/shuffle.test.ts`; e2e in `reader-visual.spec.ts` | partial ✅ |
| COMP-05 | `isCorrect` never in client bundle | invariant grep (exists) + e2e RSC payload check | `pnpm test -- tests/invariants/placement-bundle-leak.test.ts` (extend ALLOW_LIST or rename); new e2e `reader-bundle-leak.spec.ts` | partial ✅ |
| COMP-07 | Result screen shows score + back CTA | e2e | `pnpm test:e2e -- tests/e2e/reader-flow.spec.ts` | ❌ Wave 0 |
| COMP-08 | Persist in `attempts` + `attempt_answers` | integration | `pnpm test -- tests/integration/comprehension-service.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm test` (Vitest only, fast)
- **Per wave merge:** `pnpm test && pnpm test:e2e --project=chromium-desktop`
- **Phase gate:** `pnpm test && pnpm test:e2e` (full 4-project matrix) green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `src/lib/arabic.ts` (or service-local) — `stripTashkeel` helper
- [ ] `tests/unit/strip-tashkeel.test.ts` — covers LIB-03 OFF default
- [ ] `src/services/comprehension.ts` — new service module
- [ ] `tests/integration/comprehension-service.test.ts` — covers COMP-04/05/08
- [ ] `src/db/seed/comprehension-bank.ts` — covers LIB-05/COMP-01/02/03
- [ ] `tests/unit/comprehension-bank.test.ts` — distribution + count asserts
- [ ] `tests/e2e/reader-visual.spec.ts` — covers LIB-03/04/06
- [ ] `tests/e2e/reader-flow.spec.ts` — covers COMP-07 happy path
- [ ] Lift `deterministicShuffle` to `src/services/_shuffle.ts` (or `src/lib/shuffle.ts`) so both services import it (mechanical refactor; protect with existing tests)

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|------------------|
| V2 Authentication | partly | Reuse Phase 2 Supabase Auth + `requireActiveChild` — no new auth surface |
| V3 Session Management | partly | Reuse `getUser()` + `force-dynamic` invariant — no new session surface |
| V4 Access Control | **yes** | Every read/write under `/read/**` is gated by `requireActiveChild`; RLS on `attempts`/`attempt_answers` already scopes by `parent_id` chain (schema lines 312–386) |
| V5 Input Validation | **yes** | Zod schema on every service entry-point (clone Phase 3 pattern). Question/choice IDs validated as UUID strings before DB roundtrip. |
| V6 Cryptography | no | No new crypto; the only hash is `crypto.createHash('sha256')` for shuffle seed (not security-bearing) |

### Known Threat Patterns for Phase 4

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Answer-key leak via RSC payload | Information disclosure | Explicit `db.select({ id, textAr })` projection — never `select()` without projection on `choices` |
| Cross-child attempt write (parent A's session, parent B's attemptId) | Tampering | RLS on `attempts` rejects writes whose `child_id` doesn't chain to the current `auth.uid()` — already enforced |
| Forged `chosenChoiceId` (UUID that doesn't belong to this question) | Tampering | The DB roundtrip via `choices.id = chosenChoiceId` returns nothing if forged; defensive check in `recordComprehensionAnswer` for choice→question membership recommended (additive query) |
| Result-screen double-submit causes inflated score | Tampering | `finishedAt IS NOT NULL` guard at top of `recordComprehensionAnswer` |
| XSS via Arabic literal containing `<script>` | Injection | NFC normalization at write time + React's default text-node escaping. **Do not** use `dangerouslySetInnerHTML` for passages (see Pitfall 4) |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| pnpm | Build / test scripts | ✓ (assumed — Phase 1 dependency) | 9.x+ | — |
| Supabase cloud project + DIRECT_DATABASE_URL | Seed script | ✓ (Phase 1–3 baseline) | — | — |
| `drizzle-kit` migrate | Only if §E adopts Option B (enum extension) | ✓ | 0.31.x | If Option A is chosen (recommended), no new migration needed |
| Playwright browsers (Chromium + WebKit) | Visual regression | ✓ (Phase 1–3 use them) | 1.50+ | — |

No new external runtime dependencies.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | Reusing `attemptKind = 'reading'` for comprehension attempts is acceptable to the user | §E.1 | If user prefers semantic clarity → Option B (enum extension), one non-transactional migration |
| A2 | Phase 4 happy-path can ship with 3 seeded L5 passages and a tail task to reach the ≥ 30 LIB-05 target | §G.2 | If user wants LIB-05 satisfied in Phase 4 strict, seed-author effort grows significantly (30+ passages × 4–6 questions × 3–4 choices = 360–720 hand-authored items) |
| A3 | The `<ArabicText>` primitive's `diacritics: 'hide'` prop is functionally broken (does not hide Tashkeel) | §A.1 | If user has verified it works in some other way → Phase 4 must investigate before rewriting |
| A4 | No `position` column on `texts` is intentional; ordering by `created_at, id` is fine for v1 | §D.1 | If user wants explicit author-controlled ordering, an additive `position` column is required |
| A5 | The `is_placeholder` flag is sufficient distinction; no `content_status` column needed | §G.3 | If literacy specialist workflow needs richer states (draft / review / approved) sooner, plan accordingly |
| A6 | No explicit DB transaction wrapper is needed for the happy-path scoring loop | §E.4 | If a future requirement adds bulk submission, introduce `db.transaction` then; not in Phase 4 scope |

**All six should surface in `/gsd-discuss-phase` for user confirmation.**

---

## Open Questions

1. **`attemptKind` enum value for comprehension attempts**
   - What we know: Phase 1 created `['placement', 'reading']`. `'reading'` is unused.
   - What's unclear: Was `'reading'` reserved for comprehension specifically, or for a future "free-reading-without-quiz" mode?
   - Recommendation: Default to Option A (reuse `'reading'`) and confirm in discuss-phase.

2. **`force-dynamic` enforcement test**
   - What we know: Every `(authenticated)/**/page.tsx` should export it. Phase 4 will add new pages.
   - What's unclear: No invariant test currently asserts this across the whole `(authenticated)` tree.
   - Recommendation: Plan a small Phase 4 hardening task to add `tests/invariants/force-dynamic-coverage.test.ts` (grep + AST check, mirror `placement-bundle-leak.test.ts` shape).

3. **Live in-session Tashkeel toggle URL pattern**
   - What we know: Server-rendered re-fetch is the recommended approach.
   - What's unclear: Should the toggle live as `?tashkeel=on|off` query param (bookmarkable) or as a cookie (sticky across passages)?
   - Recommendation: Query-param for Phase 4 (simpler, no new cookie surface). Promote to a child-preference column in v2 if needed.

4. **Result-screen "back to library" CTA destination**
   - What we know: Library UI is deferred to Phase 4.2.
   - What's unclear: Where does the back CTA go in Phase 4 — back to the dashboard or directly into another auto-picked passage?
   - Recommendation: Back to `/dashboard` (consistent with the placement result screen). User confirms in discuss-phase.

---

## Sources

### Primary (HIGH confidence — in-repo, verified by code read)
- `src/services/placement.ts` — server-authoritative MCQ pattern (`recordPlacementAnswer`, `deterministicShuffle`, isCorrect projection discipline)
- `src/db/schema.ts` — `attempts`, `attempt_answers`, `choices`, `texts`, `questions` shape + RLS
- `src/db/seed/placement-placeholder.ts` — idempotent seed pattern with `DIRECT_DATABASE_URL` superuser
- `src/components/arabic-text.tsx` — current `<ArabicText>` primitive (and its buggy `diacritics` prop)
- `src/components/placement/question-screen.tsx`, `choice-card.tsx` — Server Component + server-bound action pattern
- `src/app/(authenticated)/placement/actions.ts` — Server Action shape
- `tests/invariants/placement-bundle-leak.test.ts` — `isCorrect` grep gate
- `tests/e2e/rtl-baseline.spec.ts` — visual-regression spec template
- `playwright.config.ts` — 4-project matrix
- `.planning/phases/03-placement-vertical/03-RESEARCH.md` — patterns this phase clones

### Secondary (HIGH–MEDIUM confidence — official docs / spec)
- [MDN `<bdi>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/bdi) — `<bdi>` ≡ `dir="auto"` with `unicode-bidi: isolate` default
- [W3C "Inline markup and bidirectional text in HTML"](https://www.w3.org/International/articles/inline-bidi-markup/) — when `<bdi>` vs `dir="auto"` apply
- [W3C ALReq](https://www.w3.org/TR/alreq/) — Arabic layout requirements (line-height, Tashkeel spacing)
- [Noto Naskh Arabic — Google Fonts](https://fonts.google.com/noto/specimen/Noto+Naskh+Arabic) — font specimen
- [notofonts/arabic issue #241](https://github.com/notofonts/arabic/issues/241) — confirms Noto Naskh diacritics are tightly positioned (informs leading recommendation)
- [Drizzle ORM transactions](https://orm.drizzle.team/docs/transactions) — `db.transaction(async tx => {...})` syntax
- [microsoft/playwright #18640](https://github.com/microsoft/playwright/issues/18640) — `document.fonts.ready` is the canonical wait pattern
- [microsoft/playwright #12839](https://github.com/microsoft/playwright/issues/12839) — known WebKit Ubuntu font-loading flakiness

### Tertiary (MEDIUM confidence — community sources, cross-checked)
- [hubail/TashkeelRemover (GitHub)](https://github.com/hubail/TashkeelRemover) — confirms U+064B–U+0652 is the harakat range
- [overdoe.com — Removing Arabic diacritics in JS](https://www.overdoe.com/javascript/2020/06/18/arabic-diacritics.html) — same range, regex pattern
- [Medium — Playwright flake-resistant visual testing](https://medium.com/@david-auerbach/how-to-conduct-visual-testing-with-playwright-a-complete-flake-resistant-guide-58714ebfbf05) — visual-regression hygiene

---

## Metadata

**Confidence breakdown:**
- Server-authoritative scoring + shuffle reuse: **HIGH** — Phase 3 already implements and tests the pattern
- Tashkeel toggle mechanism: **HIGH** — Unicode range is standard; spec-correct
- `<bdi>` sufficiency: **HIGH** — MDN + W3C spec-grade
- Auto-route picker SQL: **MEDIUM-HIGH** — straightforward Drizzle LEFT JOIN; verify against real seeded data
- Playwright visual regression: **HIGH** — matrix already configured; spec is additive
- Seed strategy: **HIGH** — mechanical clone of Phase 3 pattern
- `attemptKind` enum decision: **MEDIUM** — Option A reuses `'reading'`; user confirmation expected (A1)
- LIB-05 30-passage target satisfaction in Phase 4: **MEDIUM** — happy-path ships with fewer; tail task or Phase 4.2 fills (A2)

**Research date:** 2026-05-17
**Valid until:** 2026-06-16 (30 days — stack is stable, Phase 3 patterns are locked)
