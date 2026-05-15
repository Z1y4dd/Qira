# Phase 3: Placement Vertical - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-15
**Phase:** 3-Placement Vertical
**Areas discussed:** Algorithm shape, Quiz UX flow, Escape-hatch behavior during placement, Bank seeding strategy

---

## Algorithm shape

| Option | Description | Selected |
|--------|-------------|----------|
| Fixed 15-item exam, bias-down scoring | Every kid sees all ~15 items in same order, easiest passage first. Server computes per-passage accuracy → highest passage with accuracy ≥ 60% → shift DOWN by 1 level. Age/grade is hard guardrail (±3 levels). Simplest, deterministic, ~30 lines + tests. | ✓ |
| Adaptive (start at age prior, escalate/de-escalate) | Picks next passage based on prior accuracy. May stop early on clear signal. Harder to validate, complex stop-rule, doesn't add value with only 5 passages. | |
| Tiered blocks (3 items per level, gate to next) | 3 items at L; ≥2/3 right → next 3 at L+1; <2/3 → stop, assign L−1. Feels gamey (Duolingo-style), variable length, kid pressured to "level up". | |

**User's choice:** Fixed 15-item exam, bias-down scoring
**Notes:** Lined up with PROJECT Pitfall #4 ("don't over-engineer algorithmic precision, build the escape hatch instead"). Bias-down + age-prior clamping covers the asymmetry between too-hard-rage-quit and too-easy-baby-feel.

---

## Quiz UX flow

| Option | Description | Selected |
|--------|-------------|----------|
| Passage screen → one-question-per-page | Per passage: full-screen "read this" → "I'm ready" → 3 question pages with 4 big tap cards each + escape hatch + progress dots. Kid never sees passage + question together (forces actual reading). | ✓ |
| Combined passage + all questions on one page | Passage on top, 3 Qs below, scroll-to-answer. Fewer transitions but allows passage re-skim ("find-the-answer" not "understand-and-remember"). | |
| One question per page with passage as collapsed toggle | Each Q has the passage tucked behind a "show passage" toggle. Bridges the others but adds a UI surface for 6yo to discover. | |

**User's choice:** Passage screen → one-question-per-page
**Notes:** Prevents Ctrl-F-style gaming, simplest mental model for the kid, kindest to small screens. Choice randomization is server-side deterministic (seeded by `attemptId + questionId`).

---

## Escape-hatch behavior during placement

| Option | Description | Selected |
|--------|-------------|----------|
| Abort + assign fallback from age prior, mark escape-hatched | Tap = immediate end. Server computes fallback = grade-prior ±1 (depending on hatch direction), records `escape_hatched: true`, routes to result. Honors kid's signal, gets them reading fast. | ✓ |
| Skip current passage, shift difficulty, continue | Tap shifts the next passage's level but keeps placement running. Algorithmically clever but branches the algorithm (hurts determinism) and a frustrated kid is still tapping through items. | |
| Abort + route to parent "pick your own level" screen | Tap routes to a parent-facing screen. Most honest about uncertainty but assumes parent is at the device the moment kid taps. | |

**User's choice:** Abort + fallback from age prior, mark escape-hatched
**Notes:** Hatch visible from item 1 on every screen (passage + question), with a tiny "are you sure?" confirmation modal to prevent single accidental taps. Same hatch component reused on Phase 4 reader screens via a `mode` prop.

---

## Bank seeding strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Claude-authored placeholder Arabic, kid-testable | ~5 Arabic passages (30–80 words each, Fusha, Tashkeel on for low levels) + ~15 MCQ items, all tagged `is_placeholder: true`. Specialist replaces via SQL transaction. Enables internal kid smoke-tests before launch gate. | ✓ |
| Minimal stub (3–4 items across 2 levels) | Just enough for E2E and click-through. Faster but no kid demo. | |
| Procedural lorem-style Arabic | Generated obvious-placeholder text. Code-testing only. Cleanest "this is placeholder" signal to specialist. | |

**User's choice:** Claude-authored placeholder Arabic, kid-testable
**Notes:** Explicitly NOT pedagogically calibrated — smoke-test prop. The launch-blocking Phase 5 "pilot with ≥10 real kids" gate requires the specialist's real bank.

---

## Claude's Discretion

- **Grade-prior → level mapping table** (التمهيدي→2, ١–٢→5, ٣–٤→9, ٥–٦→14) with ±3 clamp windows. Locked in CONTEXT D-01 so planner doesn't re-decide.
- **Choice randomization seed** = hash(`attemptId + questionId`). Server-side, deterministic per retake.
- **Choice card layout:** vertical stack of 4 (not 2×2 grid) for cleaner RTL scan.
- **Escape-hatch confirmation modal copy** ("هل أنت متأكد؟") — drafted; user reviews at plan stage if desired.
- **Result-screen copy** ("اخترنا لك المستوى X — هيا نقرأ معاً قصصاً ممتعة!") — drafted; user reviews at plan stage.
- **Progress indicator:** dot strip, no "X of Y" numeral (avoids math-anxiety for 5–7yo).
- **`is_placeholder` schema:** Claude chooses cleanest shape (column on `texts`/`questions` vs dedicated version table) at planning time.

## Deferred Ideas

- Continuous recalibration based on later reading sessions (Phase 5 or v2 — needs reader data first).
- Adaptive / CAT-style placement (revisit if fixed-15 proves wrong post-launch).
- Pilot with ≥10 real kids (Phase 5 launch gate — Phase 3 enables but doesn't run it).
- Real specialist-authored Arabic bank (parallel content workstream, swaps in via SQL).
- Multi-language placement variants (out of v1).
- Parent-facing analytics on placement quality (needs aggregate data + dashboards — out of v1).
- Voice/audio placement items for pre-readers (Level 1–2) — adds audio infra; reconsider post-launch.
- "How sure are we?" confidence display for parents — escape hatch + reset already cover this need for v1.
