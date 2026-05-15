# Phase 3: Placement Vertical - Context

**Gathered:** 2026-05-15
**Status:** Ready for planning

<domain>
## Phase Boundary

A new child profile lands at a deterministically-assigned reading level (Levels 1–20) via a kid-friendly placement assessment. The kid reads ~5 staggered-difficulty Arabic passages and answers ~15 MCQs total (3 per passage), scored server-authoritatively. Algorithm biases DOWN on uncertainty (PROJECT Pitfall #4 — wrong-level-day-1 is the #1 churn driver). A one-tap "too hard / too easy" escape hatch is always visible (during AND after placement) and aborts the assessment when tapped, falling back to a sensible level derived from the parent-supplied age/grade prior. Parent can reset placement from the child profile screen to retake.

**In scope:**
- `(authenticated)/placement` route group, gated on "child has no completed placement attempt"
- ~5 calibration passages + ~15 MCQ items hand-authored in Arabic by Claude as placeholders (`is_placeholder: true`); swap-on-content-arrival without code changes
- Fixed 15-item exam with bias-down scoring (algorithm in `src/services/placement.ts`)
- Passage screen → one-question-per-page UX with 4 big tappable choice cards + persistent escape hatch + progress dots
- Server Actions for: start placement, get next item, record answer (server-authoritative correctness eval), abort via escape hatch, reset
- "We picked Level X for you" result screen with friendly Arabic copy and CTA back to library (route placeholder — library is Phase 4)
- Parent-facing surface on `/profiles/[childId]/manage`: shows current assigned level + escape-hatched flag + "Reset placement" button
- Placement-attempt rows in `attempts` table with `kind = 'placement'` + new columns: `assigned_level`, `escape_hatched`, `escape_hatched_at`, `is_placeholder_bank` (snapshot of bank version)
- Library entry redirects to placement if the active child has no completed placement attempt
- Reset placement = soft-archive prior attempt, allow new one (deterministic retake replays same items in same order, since algorithm is fixed; no anti-cheat seeding)

**Out of scope (deferred):**
- Real Arabic placement content authored by literacy specialist (parallel workstream; placeholder bank ships now, real bank swaps in pre-launch via DB update)
- Adaptive / CAT-style placement (Phase 3 is deterministic fixed-order; revisit in v2 if validity data demands)
- Continuous recalibration based on later reading sessions (PROJECT Pitfall #4 mentions this as future work — Phase 5 or v2)
- Piloting with ≥10 real kids (Phase 5 launch gate — Phase 3 just makes piloting possible)
- Library / reader / comprehension screens (Phase 4)
- Mobile-ready `/api/v1/placement/*` surface (Phase 5)

**Requirements covered:** PLAC-01, PLAC-02, PLAC-03, PLAC-04, PLAC-05, PLAC-06, PLAC-07, PLAC-08

</domain>

<decisions>
## Implementation Decisions

### Algorithm shape
- **D-01:** **Fixed 15-item exam with bias-down scoring.** Every kid sees all 15 items in the same order (one passage block at a time, easiest passage first). At the end, server computes per-passage accuracy and assigns the highest passage-level where accuracy ≥ 60%, then shifts DOWN by 1 level (Pitfall #4 bias-down rule). Parent-supplied age/grade is a hard guardrail: assigned level is clamped to grade-prior ± 3 levels. Algorithm lives in `src/services/placement.ts` as a pure function — ~30–50 lines + Vitest unit tests covering: all-correct → top band − 1, all-wrong → grade-prior − 1, mixed → highest-band-with-60% − 1, escape-hatch fallback path, grade-prior clamping.
- **Grade-prior mapping (Claude's discretion, locked here for downstream clarity):**
  | Grade band (parent-supplied) | Prior level (center) | Clamp window |
  |-------------------------------|----------------------|--------------|
  | التمهيدي (pre-K) | 2 | 1–5 |
  | ١–٢ (Grades 1–2) | 5 | 2–8 |
  | ٣–٤ (Grades 3–4) | 9 | 6–12 |
  | ٥–٦ (Grades 5–6) | 14 | 11–17 |
  Final assigned level = max(min(algorithm_output − 1, clamp.max), clamp.min). Bias-down is applied BEFORE clamping.

### Quiz UX flow
- **D-02:** **Passage screen → one-question-per-page flow.** Per calibration passage: (1) full-screen "read this" page rendered in Noto Naskh Arabic + a single "أنا جاهز" ("I'm ready") CTA, (2) then 3 question pages, one at a time, each with the question + 4 choices as big tappable cards (min-height ≥ 56px each per kid-touch minimums) + persistent escape hatch + bottom strip of progress dots (filled = done, current = pulsing, future = empty). Kid never sees passage + question simultaneously — forces actual reading, not Ctrl-F-able scanning. Choice order is randomized per render (server-side seed: `attemptId + questionId`) so retakes show identical order (deterministic) but cross-children variation prevents trivial sharing.
- **Progress indication:** A horizontal dot strip at the bottom — N dots for N items (~15). No "1 of 15" numeral (avoids math anxiety for 5–7yo). Passage screens show a small "قراءة" (read) icon above the strip; question screens show "سؤال" (question).

### Escape-hatch behavior
- **D-03:** **Tap during placement = immediate abort + fallback level from age/grade prior.** Server records the partial attempt with `escape_hatched: true`, computes fallback level = grade-prior clamp center − 1 (for "هذا صعب جداً" / "too hard") or grade-prior clamp center + 1 (for "هذا سهل جداً" / "too easy"), and routes to the result screen. Both fallback paths still clamp inside the grade-prior window (D-01). Attempts row stays for audit. Parent's `/profiles/[childId]/manage` shows "تم تخطي التقييم — المستوى مُعيَّن مبدئياً" ("assessment skipped — level assigned tentatively") and the reset button is more prominent for escape-hatched cases.
- **D-04:** **Hatch is visible from item 1 on every placement screen** (passage screens AND question screens) — single floating Arabic button bottom-end of viewport ("هذا صعب" / "هذا سهل" — short form, two buttons stacked, both visible at once). Tap opens a small Arabic confirmation modal ("هل أنت متأكد؟" — "are you sure?") before aborting; this prevents single accidental taps from ending the assessment but a determined kid can still escape in 2 taps.
- **Same hatch component reused on Phase 4 reader screens** (per PLAC-06 "during AND after"). Component lives in `src/components/placement/escape-hatch.tsx` and accepts a `mode` prop (`'placement' | 'reader'`) that controls what the tap does (abort placement vs. shift-one-level for an already-assigned child).

### Bank seeding strategy
- **D-05:** **Claude hand-authors placeholder Arabic content** in the planning artifacts during planning (5 passages, 15 items) and the executor seeds them into Postgres via `src/db/seed/placement-placeholder.ts`. Schema decisions:
  - All rows tagged `is_placeholder: true` (new column on `texts`, `questions`, or a dedicated `placement_bank_version` table — planner picks the cleanest shape). Specialist replaces them via a single SQL transaction (delete-where-placeholder + insert-real).
  - Levels staggered: passage 1 → Level 2, passage 2 → Level 6, passage 3 → Level 10, passage 4 → Level 14, passage 5 → Level 18. Each passage 30–80 words, Fusha, Tashkeel on for passages 1–3 (Levels 2/6/10), off for 4–5 (Levels 14/18) per ROADMAP Phase 4 criterion 2.
  - Items per passage: 1 literal recall, 1 vocabulary, 1 inferential (mirrors the ROADMAP Phase 4 distribution 30/25/25/15 — placement bank biases toward literal because the test is short and we want low-noise signal).
  - Claude is explicit in the CONTEXT/plan that **this Arabic content is a smoke-test prop, not a pedagogically-calibrated instrument** — the bank cannot be used for the PROJECT Pitfall #4 "pilot with ≥10 real kids" requirement (Phase 5 gate). Specialist's deliverable is the launch-blocking content.

### Routing + gating
- **D-06:** New `(authenticated)/placement` route group. After parent picks child on `/choose-child`, the active-child cookie is set; if the active child's `placement_state` is `'not_started'` or `'escape_hatched'` and the user hits `/dashboard` (or anything outside `/profiles` + `/placement`), Server-Component-side redirect routes them to `/placement`. The placement service exposes `getPlacementState(childId)` returning `'not_started' | 'in_progress' | 'completed' | 'escape_hatched'`; gating is one if/else in the `(authenticated)` layout, layered on top of the existing `getUser()` + email-verification gates from Phase 2.

### Persistence
- **D-07:** `attempts.kind = 'placement'`. New nullable columns on `attempts`: `assigned_level` (integer 1–20, set on completion or escape-hatch), `escape_hatched` (boolean, default false), `escape_hatched_reason` (enum: `'too_hard' | 'too_easy' | null`), `placement_bank_version` (integer FK, optional — defaults to current placeholder version). Migration is additive (no breaking change to Phase 2 attempt rows — those just have these columns null). `attempt_answers` rows already exist; placement reuses them with `is_correct` evaluated server-side at submit time and stored.

### Claude's Discretion
- **Placeholder Arabic content** for the 5 passages + 15 items — Claude drafts in plan, user reviews in plan if desired before execution. Content is a smoke-test prop; final Arabic is the specialist's job.
- **Progress-dot component** — reuses the design language of Phase 2 forms (Tailwind logical properties, no JS-side direction logic).
- **Result-screen copy** — Claude drafts kid-friendly Fusha ("اخترنا لك المستوى X — هيا نقرأ معاً!" or similar). User can edit in the plan.
- **Server Action error states** — Arabic-only error strings via `src/lib/supabase-error-ar.ts` pattern from Phase 2.
- **Choice randomization seed** — `attemptId + questionId` hash, server-side deterministic. Stored randomized order in `attempt_answers.choice_order` (new nullable JSONB column) so the result screen can show the kid the same order they saw.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project-level
- `.planning/PROJECT.md` Pitfall #4 (wrong-level-day-1, bias-down rule, escape-hatch primacy)
- `.planning/PROJECT.md` Pitfall #5 (server-authoritative scoring — correctness never client-side)
- `.planning/PROJECT.md` Pitfall #11 (RLS USING + WITH CHECK for any new mutations)
- `.planning/PROJECT.md` "Out of Scope (v1)" — confirms no LLM, no dashboards, no gamification in v1
- `.planning/REQUIREMENTS.md` §Placement (PLAC-01..08) — locked requirement text
- `.planning/ROADMAP.md` Phase 3 section (lines 53–65) — five success criteria
- `.planning/research/PITFALLS.md` Pitfall 4 full text (deeper rationale, Raz-Kids precedent, escape-hatch as relief valve)
- `CLAUDE.md` — Tech stack table (Drizzle, Zod 4, RHF, shadcn primitives, Vitest, Playwright)

### Phase 1 + 2 outputs Phase 3 builds on
- `src/db/schema.ts` — `attempts`, `attempt_answers`, `questions`, `choices`, `texts`, `levels` tables with RLS already live; Phase 3 ADDS columns to `attempts` via additive migration, ADDS `is_placeholder` to `texts` + `questions`, and a placement-bank version table
- `src/db/client.ts` — Proxy-wrapped lazy `db` export; placement service imports from here
- `src/services/placement.ts` — Service stubs already typed (`startPlacement`, `getNextPlacementItem`, `recordPlacementAnswer`, `resetPlacement`, `PlacementItem`, `PlacementResult` types); Phase 3 fills in real bodies and adds `getPlacementState`, `abortPlacement` (escape hatch), `assignLevel` (pure scoring function)
- `src/services/profiles.ts` — `requireParent()`, `requireActiveChild()` are the entry points; placement service composes with `requireActiveChild()` for all reads/writes
- `src/utils/supabase/server.ts` — `createServerClient` for `getUser()` in placement layouts
- `src/app/(authenticated)/layout.tsx` — already has `force-dynamic` + `getUser()`; Phase 3 adds the placement-state gate one level deeper (or in a child layout)
- `src/lib/active-child-cookie.ts` — signed cookie helper; Phase 3 reads `active_child_id` via this
- `src/lib/zod.ts` — `ArabicText` schema for any user-visible Arabic literals
- `src/db/normalize.ts` — `nfc()` at every Server Action boundary
- `src/lib/sdk-allowlist.ts` — no new third-party SDKs; placement is fully internal
- `src/components/ArabicText.tsx` — size="ui" for buttons + escape-hatch text, size="reader" for passage body
- `scripts/lint-force-dynamic.sh`, `tests/invariants/auth-getsession-ban.test.ts` — gates that stay green; placement layouts use the same patterns

### Phase 2 CONTEXT decisions that carry forward
- `.planning/phases/02-auth-child-profiles/02-CONTEXT.md` D-05/D-06 — `/choose-child` picker behavior + avatar chip nav (placement must coexist with these on `(authenticated)/`)
- `.planning/phases/02-auth-child-profiles/02-CONTEXT.md` "Claude's discretion" — Server Action pattern (thin route-file actions calling service-layer), Zod input validation, Arabic error messages

### External docs
- shadcn `Button` + `Card` primitives — `https://ui.shadcn.com/docs/components/button`, `https://ui.shadcn.com/docs/components/card` (used for big tappable choice cards)
- Drizzle migration docs — additive ALTER TABLE pattern (`https://orm.drizzle.team/docs/migrations`)
- `https://supabase.com/docs/guides/database/postgres/row-level-security` — RLS USING + WITH CHECK pattern (Pitfall #11)

### Compliance posture
- Placement responses are child data → covered by Phase 2 COMP-LEGAL-04 export/delete cascade (already in place via `attempts → attempt_answers` cascade)
- No third-party SDK on placement routes (allow-list gate stays green)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **`<ArabicText>`** (`src/components/ArabicText.tsx`) — passage body uses `size="reader"`, questions/choices use `size="ui"`, escape-hatch buttons use `size="ui"` with `weight="medium"`
- **`<Button>`** (`src/components/ui/button.tsx`) — shadcn primitive; placement uses `variant="default"` for "I'm ready" CTA, `variant="outline"` for "too hard / too easy" hatch, `variant="ghost"` for choice cards (wrapped in a custom `<ChoiceCard>` for the larger tap surface)
- **`<Card>`** (`src/components/ui/card.tsx`) — choice cards extend this with min-height ≥ 56px + RTL-safe padding
- **`db` proxy** (`src/db/client.ts`) — placement service queries placement texts/questions/choices via Drizzle
- **`nfc()`** (`src/db/normalize.ts`) — applied to any user-typed Arabic (none in Phase 3 actually — kid only taps choices — but seed script NFC-normalizes placeholder content)
- **`requireActiveChild()`** (`src/services/profiles.ts`) — every placement Server Action calls this to get the active child + verify parent ownership in one shot
- **`getUser()` + force-dynamic gate** — placement routes inherit Phase 2's layout-level gate; nothing new to add
- **Active-child cookie** (`src/lib/active-child-cookie.ts`) — read in placement Server Actions to scope queries

### Established Patterns
- **App Router route groups** — Phase 3 adds `src/app/(authenticated)/placement/` with `start/`, `[attemptId]/page.tsx` (current item), `[attemptId]/result/page.tsx`
- **Service Layer purity** — `src/services/placement.ts` has NO `next/*` imports; all DB access via `db`; pure functions for scoring; Server Actions in route files call into services
- **Pure-form Server Actions** — `actions.ts` co-located with route, calls service, returns serializable result or redirects
- **Logical RTL utilities** — Tailwind v4 `ps-*`, `pe-*`, `text-start`; bottom-end positioning for hatch via `end-4 bottom-4`
- **Vitest + RHF + Zod 4** — placement service unit tests (algorithm), Server Action input tests, no RHF needed (no forms — only tap-to-submit choices, single hidden form-action button per choice)
- **Cross-user E2E pattern** — placement gets a Playwright spec verifying Parent A's child cannot see Parent B's child's placement state or items

### Integration Points
- **`attempts` table** — additive migration adds `assigned_level`, `escape_hatched`, `escape_hatched_reason`, `placement_bank_version` (all nullable on existing rows). Drizzle migration generated via `drizzle-kit generate`; applied via `pnpm db:migrate` against cloud Supabase
- **`texts` + `questions` tables** — additive `is_placeholder boolean default false` column on both. Placeholder seed script populates the placement bank
- **`(authenticated)/layout.tsx`** — Phase 3 adds placement-state check inside the existing `requireParent` flow; if active child needs placement, redirect to `/placement/start`
- **`/profiles/[childId]/manage`** — Phase 2 surface; Phase 3 adds a "placement status" section + "إعادة التقييم" (Reset placement) button calling `resetPlacement` Server Action
- **No new tables required** — placement bank versioning can be a single integer column or a tiny `placement_bank_versions` table (planner picks)

</code_context>

<specifics>
## Specific Ideas

- **Passage display style:** centered max-width container (~36em / ~60ch — passage feels like a book page, not edge-to-edge mobile text), generous line-height (1.9 for Levels 1–3, 1.8 for higher), Tashkeel ON for passages 1–3 (Levels 2/6/10), OFF for 4–5 (Levels 14/18) per ROADMAP Phase 4 default but applied here for staggered preview.
- **Choice card pattern:** 4 cards stacked vertically (NOT a 2×2 grid — vertical stack scans better in RTL and avoids accidentally implying "Arabic-first column" ordering). Each card: large Arabic glyph for the choice letter (أ / ب / ج / د) on the start side, choice text on the end side, full-width tap target ≥ 56px tall.
- **Escape-hatch styling:** two small floating buttons bottom-end of viewport — "هذا صعب 😟" / "هذا سهل 😊" with emoji to make them feel low-stakes and friendly (these are Latin emoji, not Arabic — emoji are language-neutral; user can swap for non-emoji icons if they prefer).
- **Result screen tone:** big "اخترنا لك المستوى ٤" with a friendly illustration placeholder (Phase 1 placeholder pattern), then a sentence in Fusha ("هيا نقرأ معاً قصصاً ممتعة!" — "let's read fun stories together!"), CTA "اذهب إلى المكتبة" (go to library) which routes to `/library` (Phase 4 placeholder route — Phase 3 ships a `/library` stub that says "coming soon" until Phase 4 lands).
- **Parent-side status:** on `/profiles/[childId]/manage`, between "تصدير البيانات" and "حذف الملف الشخصي" cards, add a "حالة التقييم" (placement status) card with three states: not started ("لم يبدأ بعد"), in progress ("جاري التقييم"), completed ("المستوى المُعيَّن: ٤"), escape-hatched ("تم تخطي التقييم — المستوى التقريبي: ٣").

</specifics>

<deferred>
## Deferred Ideas

- **Continuous recalibration** (auto-suggest level changes after 3+ texts at >95% or <40% accuracy) — PROJECT Pitfall #4 mentions this. Phase 5 or v2 (needs reader + comprehension data to exist first).
- **Adaptive / CAT-style placement** — Phase 3 is fixed-order deterministic. If post-launch data shows the fixed-15-item exam is too long/short for some kids, revisit in v2.
- **Pilot with ≥10 real kids** — Phase 5 launch gate per ROADMAP. Phase 3 makes piloting possible; doesn't gate-test it.
- **Real specialist-authored Arabic bank** — Parallel content workstream; swaps in via SQL update without code change.
- **Multi-language placement** (English / French diaspora variants) — out of v1 entirely.
- **Parent-facing analytics on placement quality** ("X% of your child's peers placed at this level") — needs aggregate data + dashboards (out of v1).
- **Voice/audio placement items** (kid hears a passage instead of reading it — useful for Level 1–2 pre-readers) — interesting but adds audio infra to v1. Reconsider after first real-user contact.
- **"How sure are we?" confidence display** for parents (e.g., "we placed at Level 4, but only 60% confident — try a few texts and reset if needed") — adds UI surface; the escape hatch + reset button already serve this need adequately for v1.

</deferred>

---

*Phase: 3-Placement Vertical*
*Context gathered: 2026-05-15*
