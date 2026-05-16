# Roadmap: Qira

## Overview

Qira v1 ships the Arabic-first reading-and-comprehension loop for children ages 5–12 as a deployable, demoable thin-slice MVP. The journey is dependency-ordered, vertical-MVP framed: every phase delivers a runnable end-to-end slice (UI → Server Action → Service Layer → DB), not a horizontal layer. Phase 1 puts the architectural invariants in place (RTL, fonts, Drizzle schema, RLS, COPPA SDK allow-list, NFC, ArabicText primitive) and ships an empty Arabic shell to Vercel — the highest-leverage early bet because the cost of RTL retrofit grows linearly with components shipped. Phase 2 introduces auth + child profiles, solving the Supabase SSR cookie-leak pitfall (force-dynamic + getUser + cross-user E2E) and building the parent-data-access UI required by COPPA/UK-AADC. Phase 3 ships the placement vertical — the simplest end-to-end Server Action loop, intentionally also the highest-stakes UX (bias-down on uncertainty + one-tap escape hatch + literacy-specialist piloting) because wrong-placement-day-1 is the #1 churn driver. Phase 4 delivers the core value loop (library → reader → comprehension → result) with a literacy-specialist review gate before phase exit to prevent recall-bias question pollution. Phase 5 closes out with the mobile-readiness `/api/v1/*` surface (bearer JWT alongside cookies, OpenAPI sketch) plus the pre-launch compliance posture (first-party event logging only, retention policy with scheduled cleanup).

**Cross-cutting workstream — Content authoring (parallel to engineering, NOT a phase):** ≥30 leveled Arabic passages across Levels 1–10 (target 50), a hand-authored placement bank (~15 items across 4–6 calibration passages), and per-text comprehension banks (4–6 MCQ × ≥30 texts ≈ ≥150 items with distribution literal ~30% / vocab ~25–30% / inferential ~25% / prediction-or-evaluative ~15–20%). This is a contracted Arabic literacy specialist's job (~one contractor-month), not engineering. It runs from day 1 and is a **hard dependency before public launch**: engineering ships empty containers; content fills them. If content slips, the Phase 4 demo slips and the Phase 5 launch gate cannot be met. Owner: the project's literacy specialist contractor (TBD at Phase 1 kickoff).

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - RTL-first Arabic shell deployed on Vercel with schema, RLS, fonts, ArabicText primitive, and CI gates in place
- [x] **Phase 2: Auth & Child Profiles** - Parent can sign up, manage child profiles, and exercise their data-access rights; SSR cookie leak provably impossible
- [x] **Phase 3: Placement Vertical** - New child profile takes deterministic placement assessment and lands at a calibrated level with an always-visible escape hatch
- [ ] **Phase 4: Reader & Comprehension Loop** - Child reads a leveled Arabic passage with Tashkeel and answers comprehension questions with supportive feedback, server-authoritatively scored
- [ ] **Phase 5: Mobile-Ready API & Pre-Launch Compliance** - `/api/v1/*` surface plus first-party analytics, written retention policy, and full compliance closeout

## Phase Details

### Phase 1: Foundation
**Goal:** As a solo developer on Qira, I want every expensive-to-retrofit invariant (RTL, fonts, schema, RLS, NFC, SDK allow-list, ArabicText primitive, Service Layer skeleton) live in main from commit 1, so that later phases never pay RTL/i18n retrofit cost or compliance debt
**Mode:** mvp
**Depends on:** Nothing (first phase)
**Requirements:** FOUND-01, FOUND-02, FOUND-03, FOUND-04, FOUND-05, FOUND-06, FOUND-07, FOUND-08, FOUND-09, COMP-LEGAL-01
**Success Criteria** (what must be TRUE):
  1. A visitor can load the empty deployed shell at the Vercel URL and inspect `<html lang="ar" dir="rtl">` in devtools, with Noto Naskh Arabic body + Cairo UI fonts loaded from same-origin (no `fonts.googleapis.com` requests in the network tab)
  2. A developer running `pnpm build` is blocked by CI if any source file uses a physical-direction Tailwind utility (`ml-*`, `mr-*`, `text-left`, etc.) or if any public-schema table is missing an RLS policy
  3. A developer can render any Arabic string only through the `<ArabicText>` primitive — every Arabic-rendering route in the app uses it, verified by a Playwright RTL screenshot baseline on desktop + mobile widths in Chromium and WebKit
  4. A developer running the seed script populates Drizzle-managed entities (`parents`, `child_profiles`, `levels`, `texts`, `questions`, `choices`, `attempts`, `attempt_answers`) and any Arabic text written is NFC-normalized server-side before insert
  5. A developer inspecting the deployed shell on every authenticated route layout sees `export const dynamic = 'force-dynamic'` declared (defense-in-depth ahead of Phase 2 auth) and a network-tab audit shows zero third-party SDK requests beyond Supabase and same-origin
**Plans:** 5/6 plans executed
**UI hint:** yes

### Phase 2: Auth & Child Profiles
**Goal:** A parent can create an account, sign in, create and switch between child profiles, and exercise their data export/deletion rights — with the Supabase SSR cookie-leak pitfall provably impossible
**Mode:** mvp
**Depends on:** Phase 1
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06, PROF-01, PROF-02, PROF-03, PROF-04, PROF-05, PROF-06, COMP-LEGAL-03, COMP-LEGAL-04
**Success Criteria** (what must be TRUE):
  1. A parent can sign up with email/password (receiving an email verification), sign in with Google OAuth, reset their password via email link, and their session persists across browser refresh
  2. A parent can create multiple child profiles (display name, age 5–12, grade band), edit them, and delete one with confirmation — and the deletion cascades through all attempt history
  3. A parent enters the child profile picker on entry, selects a profile to set a signed "active child" cookie, and switching to a different child via a Server Action resets the cookie with no client-side leakage of the other profile's data
  4. A Playwright cross-user E2E test logs in as Parent A, then logs in as Parent B in a fresh context, and asserts no session bleed and no cross-user data visible — and a Vitest unit + grep CI check fails the build if any server file references `getSession()` or any authenticated route is missing `force-dynamic`
  5. A parent can read a short plain-language Privacy Notice page and, from the profile screen, request a JSON export of their child's data or hard-delete the child profile in one screen (deletion cascades through `attempts`, `attempt_answers`, and any derived data)
**Plans:** 0/6 plans executed
**UI hint:** yes

### Phase 3: Placement Vertical
**Goal:** A new child profile lands at a deterministically-assigned reading level via a kid-friendly placement assessment, with a one-tap "too hard / too easy" escape hatch visible at all times and parent-initiated reset available
**Mode:** mvp
**Depends on:** Phase 2
**Requirements:** PLAC-01, PLAC-02, PLAC-03, PLAC-04, PLAC-05, PLAC-06, PLAC-07, PLAC-08
**Success Criteria** (what must be TRUE):
  1. A new child profile, on first entry, is routed into a placement assessment of ~15 multiple-choice items spanning 4–6 staggered-difficulty calibration passages (Levels 1–20) before the library becomes available
  2. A child sees one item at a time, submits answers via Server Actions, and devtools inspection of the page bundle reveals zero correct-answer data shipped to the client (correctness is evaluated server-side after submit)
  3. On completion, the child sees a friendly "we picked Level X for you" screen, the parent sees the same assignment in the profile view, and the result row lives in `attempts` with `kind = 'placement'`
  4. A child or parent sees a one-tap "this is too hard / too easy" escape hatch during AND after placement; tapping it shifts the assigned level by one step, is logged, and continues to be visible on every later reader screen
  5. A parent can reset placement from the child profile screen and the child can retake it — a literacy specialist's review of the placement bank is logged in the phase exit notes (formal piloting with ≥10 real kids is reserved for Phase 5 gate)
**Plans:** 6/6 plans executed
Plans:
- [x] 03-01-PLAN.md — Wave 0: schema migration + AlertDialog install + test stubs + db-verify-columns script
- [x] 03-02-PLAN.md — Placeholder Arabic placement bank (5 passages, 15 questions, 60 choices)
- [x] 03-03-PLAN.md — Algorithm (assignLevel pure fn) + Service Layer (getPlacementState, startPlacement, recordPlacementAnswer, abortPlacement, resetPlacement)
- [x] 03-04-PLAN.md — Placement UI: route group, passage/question screens, choice cards, progress dots, Server Actions
- [x] 03-05-PLAN.md — Always-visible escape hatch with AlertDialog confirmation + Phase 4 reuse via mode prop
- [x] 03-06-PLAN.md — Placement-state gate (placement-gate route group) + parent reset on /profiles/[childId]/manage
**UI hint:** yes

### Phase 4: Reader & Comprehension Loop
**Goal:** A child can browse the library at their level, read a leveled Arabic passage in a kid-friendly reader, answer comprehension questions, and see a supportive result — the core value loop end-to-end
**Mode:** mvp
**Depends on:** Phase 3
**Requirements:** LIB-01, LIB-02, LIB-03, LIB-04, LIB-05, LIB-06, COMP-01, COMP-02, COMP-03, COMP-04, COMP-05, COMP-06, COMP-07, COMP-08, POLISH-01, POLISH-02, POLISH-03, POLISH-04
**Success Criteria** (what must be TRUE):
  1. A child opens the library and sees texts at their assigned level (with an optional "show one above / one below" toggle); tapping an entry — which displays title, level badge, and an illustration placeholder — enters the reader
  2. A child reads an Arabic passage rendered in Noto Naskh Arabic at line-height ≥ 1.8, with Tashkeel ON by default for Levels 1–10 and OFF by default for Levels 11–20 (toggle present at all levels), with mixed Arabic+Latin tokens (names, numbers) rendering correctly via `<bdi>` — verified by Playwright visual regression at desktop + mobile widths in Chromium and WebKit
  3. A child sees 4–6 comprehension questions per text in randomized order with randomized choice order, submits a choice via a Server Action whose response is server-authoritative (the browser submits a choice ID, the server returns correctness), and on a wrong first answer gets supportive feedback ("let's look at that again") and a single retry that is then scored
  4. A child finishes a session and sees a kid-readable result screen with score and a single CTA back to the library — and the attempt is persisted in `attempts` + `attempt_answers` with the question-type distribution (literal ~30% / vocab ~25–30% / inferential ~25% / prediction-or-evaluative ~15–20%) tracked per-answer
  5. A child's entire interactive surface meets kid-touch minimums (≥ 44×44 CSS px, no hover-only affordances, friendly Arabic loading copy, recoverable Arabic error states with no raw HTTP / no English fallback strings) — verified by a Playwright accessibility audit AND a literacy-specialist sign-off on the seed comprehension bank (recall ≤ 40% of items, no Ctrl-F-able answers) is logged as a phase exit gate
**Plans:** TBD
**UI hint:** yes

### Phase 5: Mobile-Ready API & Pre-Launch Compliance
**Goal:** Ship the `/api/v1/*` surface that unblocks a future React Native client and close out the pre-launch compliance posture (first-party event logging only, written retention policy with scheduled cleanup, full SDK inventory, placement piloting with ≥10 real kids)
**Mode:** mvp
**Depends on:** Phase 4
**Requirements:** API-01, API-02, API-03, COMP-LEGAL-02, COMP-LEGAL-05
**Success Criteria** (what must be TRUE):
  1. A future mobile client (simulated by `curl` or a Playwright API test) can call `/api/v1/library`, `/api/v1/texts/[id]`, `/api/v1/texts/[id]/questions`, `/api/v1/answers`, `/api/v1/placement/start`, `/api/v1/placement/items`, and `/api/v1/active-child` and receive the same Service Layer results that the web app's Server Actions produce
  2. A developer can authenticate any `/api/v1/*` call with either a parent session cookie OR a bearer JWT in the `Authorization` header, and the same authorization rules apply in both cases (parent owns the child, RLS enforces it at DB)
  3. A developer can read `docs/api/openapi.yaml` and use it to scaffold a React Native client against `/api/v1/*` — coverage is sufficient for the v2 mobile thin slice (library, text, questions, submit, placement, active child)
  4. A network-tab audit of every child-facing route shows zero third-party SDK requests beyond Supabase and same-origin (`src/lib/sdk-allowlist.ts` enforced in CI) AND first-party event logs are written server-side with no automatic forwarding to third parties
  5. A `RETENTION_POLICY` constant is committed in code, a scheduled cleanup job runs against expired placement and comprehension data (stubbed for v1 acceptance, fully implemented before public launch), and ≥10 real kids have piloted placement with session-completion ≥ 90% and post-placement comprehension in the 50–95% range
**Plans:** TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 6/6 | Complete   | 2026-05-15 |
| 2. Auth & Child Profiles | 6/6 | Complete   | 2026-05-15 |
| 3. Placement Vertical | 1/6 | In Progress|  |
| 4. Reader & Comprehension Loop | 0/TBD | Not started | - |
| 5. Mobile-Ready API & Pre-Launch Compliance | 0/TBD | Not started | - |
