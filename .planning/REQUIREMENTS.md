# Requirements: Qira

**Defined:** 2026-05-14
**Core Value:** A child reads a passage at their actual level and we can tell whether they understood it.

## v1 Requirements

Thin-slice MVP. Every requirement here is a Tier-A ship-blocker per `research/FEATURES.md` and `research/SUMMARY.md`. Each maps to exactly one roadmap phase (populated in Traceability below after roadmap creation).

### Foundations

- [ ] **FOUND-01**: App ships with `<html lang="ar" dir="rtl">` at the root from commit 1
- [ ] **FOUND-02**: Tailwind v4 is configured with logical-property utilities (`ps-`, `pe-`, `text-start/end`, `border-s/e`); a CI lint rule rejects physical-direction utilities in source
- [ ] **FOUND-03**: Noto Naskh Arabic (body) and Cairo (UI chrome) are self-hosted via `next/font/google` with full Tashkeel-supporting weights
- [ ] **FOUND-04**: A single `<ArabicText>` rendering primitive exists and is used by every Arabic-rendering surface (reader, questions, choices, navigation labels)
- [ ] **FOUND-05**: Database schema is defined via Drizzle ORM and applied to Supabase Postgres; entities: `parents`, `child_profiles`, `levels`, `texts`, `questions`, `choices`, `attempts`, `attempt_answers`
- [ ] **FOUND-06**: All child-data tables have Supabase RLS policies enforced via `crudPolicy()`; a CI check fails the build if any table is missing RLS
- [ ] **FOUND-07**: Arabic text written to Postgres is NFC-normalized at write time (server-side, before insert)
- [ ] **FOUND-08**: A framework-agnostic Service Layer (`src/services/*.ts`) holds all domain logic; Server Actions and (future) Route Handlers both call it
- [ ] **FOUND-09**: An empty deployed shell is live on Vercel before any feature work begins (Phase A demo gate)

### Authentication & Accounts

- [ ] **AUTH-01**: Parent can sign up with email and password via Supabase Auth
- [ ] **AUTH-02**: Parent can sign up / sign in with Google OAuth via Supabase Auth
- [ ] **AUTH-03**: Parent receives email verification after email/password signup
- [ ] **AUTH-04**: Parent can reset password via email link
- [ ] **AUTH-05**: Parent session persists across browser refresh and is enforced server-side
- [ ] **AUTH-06**: Every authenticated route sets `export const dynamic = 'force-dynamic'` and uses `getUser()` / `getClaims()` (never `getSession()`) — verified by a Vitest unit test and a Playwright cross-user E2E test that confirms no session bleeds between users

### Child Profiles

- [ ] **PROF-01**: Parent can create one or more child profiles under their account; required fields: display name, age (5–12), grade band
- [ ] **PROF-02**: Parent can edit a child profile (name, age, grade band)
- [ ] **PROF-03**: Parent can delete a child profile (with confirmation; cascade-deletes attempt history)
- [ ] **PROF-04**: On entry, a child profile picker is shown; selecting a profile sets a signed "active child" cookie scoped to the parent session
- [ ] **PROF-05**: Switching active child is a Server Action that resets the cookie; no client-side leakage of other profiles' data
- [ ] **PROF-06**: All Server Actions and queries that touch child data are filtered by the active child's `parent_id` AND `child_id`; RLS enforces this at the DB layer

### Placement Assessment

- [ ] **PLAC-01**: New child profile is prompted to take a placement assessment before the library is available
- [ ] **PLAC-02**: Placement uses a hand-authored bank of ~15 multiple-choice items spanning 4–6 staggered-difficulty passages calibrated to Levels 1–20
- [ ] **PLAC-03**: Placement algorithm is deterministic and rules-based: parent-supplied age/grade is a strong prior; per-passage accuracy adjusts the level estimate; algorithm biases DOWN on uncertainty (per `research/PITFALLS.md` — wrong-level-day-1 is the #1 churn driver)
- [ ] **PLAC-04**: Placement scoring runs server-side; correct answers are never sent to the browser before the child submits
- [ ] **PLAC-05**: On completion, the child sees a friendly "we picked Level X for you" screen; the parent sees the same assignment in the profile view
- [ ] **PLAC-06**: A one-tap "this is too hard / too easy" escape hatch is visible during AND after placement; tapping it shifts the child's assigned level by one step and is logged
- [ ] **PLAC-07**: Parent can reset placement and retake it from the child profile screen
- [ ] **PLAC-08**: Placement results are persisted in `attempts` with type `placement` (kept for future dashboards even though dashboards are out of v1 scope)

### Leveled Library & Reader

- [ ] **LIB-01**: Library shows texts available at the child's assigned level (with adjacent-level surfacing optional via a "show one above / one below" toggle)
- [ ] **LIB-02**: Each library entry shows title, level badge, and an illustration placeholder; tapping enters the reader
- [ ] **LIB-03**: The reader renders the text in Noto Naskh Arabic at line-height ≥ 1.8, with Tashkeel ON by default for Levels 1–10 and OFF by default for Levels 11–20 (toggle present at all levels)
- [ ] **LIB-04**: The reader uses CSS logical properties throughout; verified by Playwright visual regression at desktop + mobile widths in Chromium and WebKit
- [ ] **LIB-05**: Text bodies are stored in Postgres `text` columns (one record per text); v1 ships with a hand-seeded set covering Levels 1–10 (minimum 30 passages, target 50)
- [ ] **LIB-06**: Reader handles mixed-content edge cases via `<bdi>`: any embedded Latin tokens (names, numbers) render in correct direction without breaking surrounding Arabic flow

### Comprehension Questions

- [ ] **COMP-01**: After finishing a text, the child is shown 4–6 comprehension questions for that text (hand-authored, stored in `questions` with type `comprehension`)
- [ ] **COMP-02**: Question types per text are distributed roughly: literal ~30%, vocabulary ~25–30% (vocab-weighted higher than English equivalents because vocabulary is the strongest predictor of Arabic comprehension under diglossia — per `research/FEATURES.md`), inferential ~25%, prediction/evaluative ~15–20%
- [ ] **COMP-03**: Each question is multiple-choice (3–4 choices, one correct, stored in `choices`)
- [ ] **COMP-04**: Question presentation order is randomized per attempt; choice order is randomized per question
- [ ] **COMP-05**: Scoring is server-authoritative: the browser submits the choice ID, the Server Action looks up correctness, returns feedback
- [ ] **COMP-06**: On a wrong first answer, feedback is supportive ("let's look at that again") and the child can retry once; the second attempt is scored
- [ ] **COMP-07**: After all questions are answered, the child sees a friendly result screen with the score and a single CTA back to the library
- [ ] **COMP-08**: Each completed comprehension attempt is persisted in `attempts` + `attempt_answers` (kept for future dashboards)

### Reader-Loop UX Polish

- [ ] **POLISH-01**: All interactive targets meet kid-touch minimums (≥ 44×44 CSS px); verified by a Playwright accessibility audit
- [ ] **POLISH-02**: No hover-only affordances; every hover state has a focus + tap equivalent
- [ ] **POLISH-03**: Loading states for placement, library, and reader are friendly (no spinners-only; "نُحَضِّر القصة..." copy or equivalent)
- [ ] **POLISH-04**: Error states are kid-readable and recoverable (no raw HTTP errors, no English fallback strings)

### Compliance Posture (v1)

- [ ] **COMP-LEGAL-01**: No third-party SDKs (analytics, session-replay, ad networks) run on child-facing routes; an allow-list lives in `src/lib/sdk-allowlist.ts` and is asserted in CI
- [ ] **COMP-LEGAL-02**: First-party event logging only; no automatic forwarding to third parties
- [ ] **COMP-LEGAL-03**: A short, plain-language Privacy Notice page exists (no marketing copy) explaining what's collected for parent and for child, and how to delete it
- [ ] **COMP-LEGAL-04**: Parent can request export and deletion of their child's data via a single screen (deletion cascades; export is JSON download)
- [ ] **COMP-LEGAL-05**: Data retention is documented in code (e.g., a `RETENTION_POLICY` constant) and is enforced by a scheduled job stubbed for v1, fully implemented before public launch

### Mobile-Readiness (v1, non-blocking)

- [ ] **API-01**: A thin `/api/v1/*` Route Handler surface wraps Service Layer entry points for: list-library, get-text, list-questions, submit-answer, start-placement, submit-placement-item, get-active-child
- [ ] **API-02**: `/api/v1/*` accepts both a parent session cookie AND a bearer JWT (future React Native client); same authorization rules apply
- [ ] **API-03**: An OpenAPI sketch (`docs/api/openapi.yaml`) is committed; not full coverage, but enough to scaffold a v2 mobile client

## v2 Requirements

Acknowledged, deferred. Not in v1 roadmap.

### Parent Dashboard

- **DASH-01**: Parent sees current level, recent attempts, and weak areas per child
- **DASH-02**: Parent sees a reading-streak summary (read-only, no gamification UI on the child surface)

### Gamification

- **GAME-01**: Stars awarded on completed comprehension attempts (but NOT streaks — anti-feature per `research/FEATURES.md`)
- **GAME-02**: Badges for reading milestones (e.g., "read 10 texts at Level 3")

### AI Authoring (offline)

- **AI-01**: Internal admin tool uses LLM to draft new comprehension questions; literacy specialist reviews before publishing
- **AI-02**: Internal admin tool uses LLM to estimate text reading level for new content; human confirms

### AI Read-Aloud

- **AUDIO-01**: Reader can play TTS read-aloud at a child-friendly pace
- **AUDIO-02**: Pronunciation correction via real-time speech assessment

### Content Scale

- **CONT-01**: Library expanded to ≥ 100 texts covering Levels 1–20 (v1 covers Levels 1–10)
- **CONT-02**: CMS or authoring workflow tool for the literacy specialist (until v2, content is seeded directly via SQL migrations)

### Mobile Apps

- **MOBILE-01**: React Native iOS app consuming `/api/v1/*` (v1 lays groundwork via API-01–03)
- **MOBILE-02**: React Native Android app

### School Mode (v3+)

- **SCHL-01**: Teacher accounts with bulk-licensed child rosters
- **SCHL-02**: Classroom progress reports

## Out of Scope

Explicitly excluded from v1 and v2. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Daily streaks UI | Anti-feature per `research/FEATURES.md` — streak-shame is in the Deceptive Patterns registry (Duolingo) and harms kid autonomy. No streaks at any tier. |
| LLM-driven runtime question generation | Out of v1 by decision; deferred to AI authoring (offline) in v2. Skips Arabic prompt-engineering, moderation, and per-user-cost problems |
| Verifiable parental consent flow for kid-led signup | Sidestepped by the parent-owned account model (lawful default under COPPA / UK-AADC / GDPR-K) |
| Ammiyya / Arabic dialect support | v1 is Fusha-only. Diglossia is a v2+ research problem |
| English / French / Urdu content | v1 is Arabic-only. Multilingual is post-v2 expansion per business plan |
| Native iOS / Android apps | v1 is web-only. Mobile-readiness baked into API layer (API-01–03) without building the apps |
| Parent / teacher dashboards in v1 | Reporting before the learning loop is validated is premature. v2 work — data is captured in v1 so v2 dashboards can backfill from history |
| Subscription billing | v1 validates the product, not the monetization. No payment integration in v1 |
| In-app advertising / ad networks | Anti-feature; never ship ads on a kid surface |
| Cute-mascot emotional manipulation ("Dark Patterns of Cuteness") | Anti-feature per `research/FEATURES.md`. Reader chrome is friendly but not anthropomorphized |
| Cancel-friction subscription patterns | Anti-feature per `research/FEATURES.md`. When billing ships in v2, one-click cancel is non-negotiable |
| Third-party analytics on child routes | Anti-feature for compliance; first-party event logging only |
| Self-hosted infrastructure | Outside MVP budget; managed services only |
| Eastern Arabic-Indic numerals (٠١٢٣) in UI | Diaspora-leaning Western numerals (0123) for v1; revisit per UI phase |
| AI-tutor pronunciation correction | v2+ feature per business plan |
| School / B2B portal | v2+ per business plan |

## Traceability

Every v1 requirement is mapped to exactly one roadmap phase. Coverage: 55/55.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FOUND-01 | Phase 1 | Pending |
| FOUND-02 | Phase 1 | Pending |
| FOUND-03 | Phase 1 | Pending |
| FOUND-04 | Phase 1 | Pending |
| FOUND-05 | Phase 1 | Pending |
| FOUND-06 | Phase 1 | Pending |
| FOUND-07 | Phase 1 | Pending |
| FOUND-08 | Phase 1 | Pending |
| FOUND-09 | Phase 1 | Pending |
| COMP-LEGAL-01 | Phase 1 | Pending |
| AUTH-01 | Phase 2 | Pending |
| AUTH-02 | Phase 2 | Pending |
| AUTH-03 | Phase 2 | Pending |
| AUTH-04 | Phase 2 | Pending |
| AUTH-05 | Phase 2 | Pending |
| AUTH-06 | Phase 2 | Pending |
| PROF-01 | Phase 2 | Pending |
| PROF-02 | Phase 2 | Pending |
| PROF-03 | Phase 2 | Pending |
| PROF-04 | Phase 2 | Pending |
| PROF-05 | Phase 2 | Pending |
| PROF-06 | Phase 2 | Pending |
| COMP-LEGAL-03 | Phase 2 | Pending |
| COMP-LEGAL-04 | Phase 2 | Pending |
| PLAC-01 | Phase 3 | Pending |
| PLAC-02 | Phase 3 | Pending |
| PLAC-03 | Phase 3 | Pending |
| PLAC-04 | Phase 3 | Pending |
| PLAC-05 | Phase 3 | Pending |
| PLAC-06 | Phase 3 | Pending |
| PLAC-07 | Phase 3 | Pending |
| PLAC-08 | Phase 3 | Pending |
| LIB-01 | Phase 4 | Pending |
| LIB-02 | Phase 4 | Pending |
| LIB-03 | Phase 4 | Pending |
| LIB-04 | Phase 4 | Pending |
| LIB-05 | Phase 4 | Pending |
| LIB-06 | Phase 4 | Pending |
| COMP-01 | Phase 4 | Pending |
| COMP-02 | Phase 4 | Pending |
| COMP-03 | Phase 4 | Pending |
| COMP-04 | Phase 4 | Pending |
| COMP-05 | Phase 4 | Pending |
| COMP-06 | Phase 4 | Pending |
| COMP-07 | Phase 4 | Pending |
| COMP-08 | Phase 4 | Pending |
| POLISH-01 | Phase 4 | Pending |
| POLISH-02 | Phase 4 | Pending |
| POLISH-03 | Phase 4 | Pending |
| POLISH-04 | Phase 4 | Pending |
| API-01 | Phase 5 | Pending |
| API-02 | Phase 5 | Pending |
| API-03 | Phase 5 | Pending |
| COMP-LEGAL-02 | Phase 5 | Pending |
| COMP-LEGAL-05 | Phase 5 | Pending |

**Coverage (v1):**
- FOUND: 9 → all Phase 1
- AUTH: 6 → all Phase 2
- PROF: 6 → all Phase 2
- PLAC: 8 → all Phase 3
- LIB: 6 → all Phase 4
- COMP: 8 → all Phase 4
- POLISH: 4 → all Phase 4
- COMP-LEGAL: 5 → split (01→P1, 03+04→P2, 02+05→P5)
- API: 3 → all Phase 5
- **Total v1 requirements: 55**
- Mapped to phases: 55 ✓
- Unmapped: 0 ✓

---
*Requirements defined: 2026-05-14*
*Last updated: 2026-05-14 after roadmap creation and traceability population*
