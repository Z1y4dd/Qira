---
phase: 03-placement-vertical
plan: 04
slice_name: placement-flow-ui
status: complete
completed_at: "2026-05-16T22:24:00.000Z"
requirements:
  - PLAC-01
  - PLAC-02
  - PLAC-04
  - PLAC-05
  - PLAC-06
  - PLAC-08
tags:
  - placement
  - server-actions
  - rtl
  - escape-hatch
key-decisions:
  - "advanceToFirstQuestionAction uses ?showPassage=0 search param to flip passage→question render without a DB column"
  - "Choice letter fallback '?? أ' in question-screen.tsx typed to satisfy TS union exhaustiveness"
  - "Comments referencing isCorrect were rewritten to avoid tripping the bundle-leak invariant grep"
---

# Phase 3 Plan 04: Placement Flow UI — SUMMARY

## One-liner
Kid-facing placement flow (start screen, passage+question loop, result screen) wired to Plan 03 service layer via Server Actions; bundle-leak invariant green; EscapeHatch embedded on every surface including result page (SC4/PLAC-06).

## Placement Route Tree

```
src/app/(authenticated)/placement/
├── layout.tsx                          # force-dynamic wrapper, max-w-2xl centering
├── actions.ts                          # 'use server': start, advanceToFirst, recordAnswer
├── start/
│   └── page.tsx                        # Intro card + ابدأ التقييم → startPlacementAction
├── [attemptId]/
│   ├── page.tsx                        # Passage/Question switch (questionIndex % 3 === 1)
│   └── result/
│       └── page.tsx                    # اخترنا لك المستوى X + Library CTA + EscapeHatch
```

```
src/components/placement/
├── escape-hatch.tsx                    # [Plan 01] Client Component shell — Plan 05 wires abort
├── choice-card.tsx                     # [Plan 04] form-per-choice, .bind(null, {}) server-bound
├── progress-dots.tsx                   # [Plan 04] filled/pulsing/empty dots + bdi digit counter
├── passage-screen.tsx                  # [Plan 04] passage body + أنا جاهز + EscapeHatch embed
└── question-screen.tsx                 # [Plan 04] prompt + 4 ChoiceCards + ProgressDots + EscapeHatch
```

## Server Actions (`src/app/(authenticated)/placement/actions.ts`)

Three exports (Plan 05 wave 4 appends `abortPlacementAction` to this same file):

| Action | Signature | Behavior |
|--------|-----------|----------|
| `startPlacementAction` | `(): Promise<void>` | Reads active-child cookie → calls `startPlacement(childId)` → redirect `/placement/{attemptId}` |
| `advanceToFirstQuestionAction` | `(args: { attemptId }): Promise<void>` | No service call. Redirects to `/placement/{attemptId}?showPassage=0` |
| `recordPlacementAnswerAction` | `(args: { attemptId, questionId, chosenChoiceId }): Promise<void>` | Calls `recordPlacementAnswer` with server-bound args → redirect to result on completion or next item |

## Form-per-Choice Pattern (PLAC-04 Mitigation)

The `.bind(null, {...})` pattern server-binds the choice ID at render time:

```typescript
// In choice-card.tsx
const submitAnswer = recordPlacementAnswerAction.bind(null, {
  attemptId,
  questionId,
  chosenChoiceId: choiceId,  // ← baked in at render, not from formData
});
return <form action={submitAnswer}><button type="submit">...</button></form>;
```

The entire card is a submit button. The client only triggers a form POST — the choice ID never travels as user input. This is the server-authoritative scoring mitigation for PLAC-04.

## Passage-or-Question Render Logic

`[attemptId]/page.tsx` switches screens based on two conditions:
- `item.questionIndex % 3 === 1` → first question of a new passage block (Q1, Q4, Q7, Q10, Q13)
- `showPassage === '0'` → the child already tapped "أنا جاهز" this block

```typescript
const isFirstOfPassage = item.questionIndex % 3 === 1;
const passageAlreadyRead = showPassage === '0';

if (isFirstOfPassage && !passageAlreadyRead) return <PassageScreen />;
return <QuestionScreen />;
```

`advanceToFirstQuestionAction` redirects to `?showPassage=0` — no DB column needed.

## EscapeHatch Embeds (SC4 / PLAC-06 — Hatch Visible After Placement)

EscapeHatch is embedded on three surfaces:

| Surface | File | Delivery |
|---------|------|----------|
| PassageScreen | `src/components/placement/passage-screen.tsx` | During placement |
| QuestionScreen | `src/components/placement/question-screen.tsx` | During placement |
| Result page | `src/app/(authenticated)/placement/[attemptId]/result/page.tsx` | **After placement** (SC4) |

The EscapeHatch `handleConfirm` body is a `console.warn` stub from Plan 01 Wave 0. **Plan 05 wave 4 replaces that stub body with the real `abortPlacementAction({ attemptId, reason })` call — no edits needed in any of Plan 04's files at that point.** The JSX embed here is the integration point.

## Bundle-Leak Invariant (T-3-bundle-leak)

`pnpm test:run tests/invariants/placement-bundle-leak.test.ts` — **59/59 PASS**

`isCorrect` appears nowhere in `src/app/` or `src/components/`. A comment in `question-screen.tsx` was reworded from "no isCorrect in this component" to "correctness flag never exposed to client" to avoid tripping the grep.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] TypeScript typed-routes error on dynamic redirect paths**
- **Found during:** Task 4.1
- **Issue:** `redirect(\`/placement/${attemptId}\`)` failed TS with `RouteImpl<...>` overload mismatch — dynamic template literals are not auto-inferred as typed routes.
- **Fix:** Added `import type { Route } from 'next'` and cast all dynamic redirects as `redirect(... as Route)`.
- **Files modified:** `src/app/(authenticated)/placement/actions.ts`, `src/app/(authenticated)/placement/[attemptId]/page.tsx`, `src/app/(authenticated)/placement/[attemptId]/result/page.tsx`

**2. [Rule 1 - Bug] Bundle-leak invariant tripped by comment text**
- **Found during:** Task 4.3 verification
- **Issue:** A JSDoc comment in `question-screen.tsx` read "no isCorrect in this component" — the word-boundary regex `/\bisCorrect\b/` matched it.
- **Fix:** Reworded the comment to "correctness flag never exposed to client".
- **Files modified:** `src/components/placement/question-screen.tsx`

**3. [Rule 1 - Bug] TypeScript union exhaustiveness on CHOICE_LETTERS indexing**
- **Found during:** Task 4.3
- **Issue:** `CHOICE_LETTERS[i]` typed as `'أ' | 'ب' | 'ج' | 'د' | undefined` — TypeScript cannot guarantee 4 choices; the `undefined` case fails the `letterAr` prop union.
- **Fix:** Added `?? 'أ'` fallback: `CHOICE_LETTERS[i] ?? 'أ'`.
- **Files modified:** `src/components/placement/question-screen.tsx`

## Plan 05 Note

Plan 05 wave 4 **appends** `abortPlacementAction` to `src/app/(authenticated)/placement/actions.ts` and modifies the `handleConfirm` body in `src/components/placement/escape-hatch.tsx`. No changes required in any Plan 04 files.

## Self-Check

### Files created:
- `/home/ziyad/Qira/src/app/(authenticated)/placement/actions.ts` — exists
- `/home/ziyad/Qira/src/app/(authenticated)/placement/layout.tsx` — exists
- `/home/ziyad/Qira/src/app/(authenticated)/placement/start/page.tsx` — exists
- `/home/ziyad/Qira/src/app/(authenticated)/placement/[attemptId]/page.tsx` — exists
- `/home/ziyad/Qira/src/app/(authenticated)/placement/[attemptId]/result/page.tsx` — exists
- `/home/ziyad/Qira/src/components/placement/choice-card.tsx` — exists
- `/home/ziyad/Qira/src/components/placement/progress-dots.tsx` — exists
- `/home/ziyad/Qira/src/components/placement/passage-screen.tsx` — exists
- `/home/ziyad/Qira/src/components/placement/question-screen.tsx` — exists

### Commits:
- `35f05aa3` feat(03-04): implement placement server actions
- `358282e8` feat(03-04): add placement layout + progress-dots + choice-card components
- `a0f30056` feat(03-04): add placement pages (start, item, result) and screens (passage, question)

## Self-Check: PASSED
