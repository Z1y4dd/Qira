# Project Research Summary — Qira

**Project:** Qira — Arabic-first leveled reading app for children ages 5–12
**Domain:** Children's EdTech (Arabic literacy, leveled reading + comprehension, parent-owned accounts, RTL web)
**Researched:** 2026-05-14
**Confidence:** HIGH on stack/architecture/general pitfalls; MEDIUM on Arabic-specific pedagogy (placement validity, level definitions, comprehension question pedagogy in Arabic)

---

## Executive Summary

Qira is the Arabic-language equivalent of Raz-Kids for a category that does not yet exist: leveled Arabic reading + comprehension for ages 5–12, sold to diaspora parents. The four research dimensions converge on a single, opinionated build: a **Next.js 16 App Router monolith on Vercel** backed by **Supabase (Postgres + Auth + Storage)** with **Drizzle ORM**, using **Server Actions for UI mutations** and a thin **`/api/v1/*` Route Handler surface for mobile-readiness later**. Arabic typography (Noto Naskh Arabic body + Cairo UI), RTL via Tailwind v4 logical properties, and a single `<ArabicText>` rendering primitive are architectural invariants from commit 1 — not styling concerns. The shared mental model across all four research files is: **everything serves one loop — placement → leveled reader → comprehension questions → result — and v1 must not build anything else.**

The recommended approach is dependency-driven and small: ship the architectural invariants first (RTL, fonts, schema, service layer), then auth + child profiles, then a vertical placement slice (which is also the cheapest end-to-end exercise of the Server Action + Service Layer + DB pattern), then the reading + comprehension loop, then a mobile-facing `/api/v1/*` polish phase. The core engineering risk is **not technology** (the stack is well-charted and confidence is HIGH) — it is **content** (50+ leveled passages, placement bank, comprehension banks) authored in Fusha by a literacy specialist, which must run as a **parallel workstream from day 1**, not a sequel to engineering.

The dominant risks are pedagogical and regulatory, not technical: (1) **wrong placement on day 1** silently kills the product because a 6-year-old cannot recover from one frustrating session — the only known mitigation is a one-tap "too hard / too easy" escape hatch and biasing placement DOWN on uncertainty; (2) **Supabase SSR cookie caching** on Vercel can leak Parent A's session to Parent B if `dynamic = 'force-dynamic'` is missing on authenticated routes — a catastrophic privacy + COPPA breach because child data is involved; (3) **comprehension-question recall bias** (questions answerable by Ctrl-F) will pollute every level signal and parent trust; (4) **third-party SDKs** (analytics, fonts CDN, Sentry session replay) will leak child PII through the parent-account model unless inventoried and self-hosted; (5) **RTL retrofit cost** if a single component ships with physical CSS. All five mitigations are upstream architectural choices, not late-stage QA — which is why this synthesis is opinionated about phase ordering.

---

## Key Findings

### Recommended Stack

The locked stack is a one-paragraph monolith: **Next.js 16 (App Router, RSC, Turbopack) + React 19.2 + TypeScript 5.7+** on Vercel; **Supabase (Postgres + Auth + Storage + RLS)** as the single backend platform; **Drizzle ORM 0.45.x** (with `postgres.js` driver and `crudPolicy()` for Supabase RLS) as the type-safe SQL layer; **Tailwind CSS v4** with logical-property utilities (`ps-`, `pe-`, `ms-`, `me-`, `text-start/end`) and **shadcn/ui** scaffolded with the post-January-2026 `--rtl` flag; **next-intl 3.x** to set up the `<html lang="ar" dir="rtl">` plumbing (Arabic-only at v1, but the seam is free); **Zod v4 + React Hook Form** for Server Action / form validation; **Vitest + Playwright** for unit and E2E (Playwright is non-negotiable for RTL visual regression); **Biome** for lint+format; **pnpm**. **Confidence: HIGH** across the board — every primary recommendation was verified against Context7 and/or 2026 official docs.

**Core technologies:**
- **Next.js 16 App Router** — RSC renders Arabic text server-side (near-zero JS to kid's browser); App Router is the only place `<html dir="rtl">` belongs
- **Supabase (single vendor)** — Postgres + Auth (email + Google OAuth, parent-only matrix is small) + Storage (for v2 illustrations) + RLS — beats Neon+Clerk+Vercel-Blob on 3-vendor-sprawl for a solo build with zero edge-runtime needs
- **Drizzle ORM over Prisma** — 7KB vs 1.6MB serverless bundle, ~700ms cold-start delta on Vercel Functions, SQL-first feel suits content-heavy join workload
- **Noto Naskh Arabic (body) + Cairo (UI)** — Google-engineered for screen Naskh with full Tashkeel positioning; pairs with Cairo for chrome. **Do NOT use Amiri (calligraphic), Cairo-as-body (Tashkeel quality unverified per weight), or any Latin-default fallback that leaks Inter into Arabic** — self-host via `next/font/google`, same render everywhere
- **Tailwind v4 + shadcn/ui `--rtl`** — logical properties are first-class in v4; shadcn's January 2026 `--rtl` init flag auto-flips icons and slide animations
- **Vitest + Playwright** — Vitest for placement rules engine and leveling logic; Playwright for RTL screenshots at desktop + mobile widths (Safari/WebKit coverage matters for diaspora iPad users)

**Open stack picks (the planning phase must lock these):**
- ORM final pick is **Drizzle-leaning** but not locked — confidence HIGH on Drizzle; the only reason to pick Prisma is existing team fluency (no factor here)
- Specific Arabic font final pick — Noto Naskh Arabic is the recommendation, but a designer/literacy review of fully-vocalized text in a real reader fixture is required before locking. PITFALLS adds Amiri, Markazi Text as alternates worth testing if Noto Naskh's Tashkeel rendering disappoints in QA
- Eastern (٠١٢٣) vs Western (0123) numerals — diaspora-leaning suggests Western, but a UI-phase decision

### Expected Features

FEATURES.md uses an explicit 4-tier model (A = thin-slice ship-blockers, B = category table-stakes deferred to v2, C = differentiators, D = anti-features). For this synthesis, the **only tier the roadmap can spend engineering on is Tier A**. Tier C differentiators are mostly *architectural commitments* (RTL, Fusha, deterministic placement) already absorbed into the stack and architecture decisions.

**Must have — Tier A v1 thin-slice (one-to-one with REQUIREMENTS):**
- Parent email/password + Google OAuth signup (Supabase Auth)
- Child profile(s) under parent account; child profile picker on entry
- **Rules-based placement assessment**, ~10–15 min, ~15 MCQ over 4–6 staggered passages, biased DOWN on uncertainty, with parent-supplied age/grade as a strong prior
- Library browse filtered to child's assigned level (Levels 1–20)
- **Kid-friendly Arabic reader** — RTL, Fusha, Noto Naskh Arabic body, **line-height ≥ 1.8**, Tashkeel-on by default for Levels 1–10
- 4–6 hand-authored comprehension MCQs per text — distribution **literal ~30%, vocabulary ~25–30% (bumped vs English because vocabulary is the strongest predictor of Arabic reading comprehension under diglossia), inferential ~25%**
- Immediate per-question feedback (no penalties on first miss — UX framed as "let's look at that again")
- Session result screen + progress persistence (child returns to same level, last-read state)

**Arabic-specific demands surfaced as first-class items (NOT generic i18n):**
- **Tashkeel-on by default for Levels 1–10**, toggle infrastructure built v1 even if UI hidden until Levels 11+ content exists
- **Line-height 1.6–1.8 minimum** for body Arabic (vs 1.4–1.5 for Latin) to clear diacritic stacking
- **Vocabulary-weighted comprehension** (~25–30%) — diglossia makes Fusha vocabulary recognition the strongest comprehension predictor; do not copy English's ~15–20% weighting
- **Bidi isolation** (`<bdi>`) on every user-generated string (child names, mixed Arabic+Latin labels like "السؤال 3 من 10")
- **Fusha-only commitment** — UI strings AND content both Fusha (no diglossic mixing); requires native-speaker copy review pre-launch
- **NFC text normalization at storage boundary** — authors paste from Word/PDF/web; without NFC, identical words won't match identical words
- **Deterministic placement, no LLM in v1** — parents distrust opaque AI for Arabic; explicability is itself a differentiator

**Should have — Tier C differentiators (mostly architectural, not feature work):**
- Native RTL-first architecture (already absorbed into ARCHITECTURE)
- Tashkeel-on-by-default with toggle (infrastructure v1, UI v1.5)
- Qira's own Levels 1–20 scale calibrated to its own content (no Lexile/Miqyas Al Dhad licensing dependency)
- Hand-authored Arabic questions (not translated English) — content workstream

**Defer (v2+):**
- Parent dashboards, gamification (streaks, badges, level-up), audio narration, word-tap definitions, native mobile apps, subscription billing, larger library, constructed-response, running-record/oral reading, AI question generation, AI placement, school/B2B portal, multilingual content, diglossia/Ammiyya support

**Anti-features — explicitly NOT built (load-bearing scope guards):**
Daily streaks (Duolingo-style shame design, UK-AADC violation), ads/ad-supported tier (COPPA behavioral-ad ban), in-app cosmetic purchases, endless-scroll, push notifications to children, social/leaderboard features between kids, animated mascots that "cry" on miss, difficulty selector overriding placement, hidden cancel flow, account merge across providers.

### Architecture Approach

Build Qira v1 as a **single Next.js 16 App Router monolith** deployed on Vercel against Supabase Postgres, using a **shared-database / shared-schema model** keyed on `parent_id` and `child_id`. Server Components fetch on render; **Server Actions handle all internal UI mutations** (placement answers, comprehension submissions, profile switching); a thin **`/api/v1/*` Route Handler surface** wraps the same service-layer functions for v2 mobile clients. The single load-bearing architectural decision is **a framework-agnostic Service Layer** (`src/services/*.ts`, no `next/*` imports) — this is what keeps mobile-readiness cheap without paying monorepo or tRPC complexity in v1.

**Major components:**
1. **`<ArabicText>` primitive** — the ONLY component that emits Arabic body text; owns font choice, line-height, Tashkeel rendering, `lang="ar"`, mixed-script `<bdi>` handling. Any raw `<p>{arabicString}</p>` outside this primitive is a code-review failure
2. **Route groups `(parent)` vs `(child)`** — one parent session, two auth contexts enforced at layout boundary; active-child stored in a signed cookie (NOT in URL), switched via Server Action
3. **Service Layer** (`src/services/{auth,placement,attempt,content,profile}.ts`) — domain logic, framework-agnostic, called identically from Server Actions and Route Handlers
4. **DB layer** — Drizzle schema as single source of truth (`parents`, `children`, `levels`, `texts`, `questions`, `attempts`, `attempt_answers`); `attempts` unifies placement and reading via a `kind` discriminator (one scoring pipeline, not two)
5. **`/api/v1/*` Route Handlers** — thin JSON wrappers over the Service Layer; bearer-token auth in addition to cookies; the versioned URL prefix is the mobile contract

**Non-negotiable architectural invariants (these MUST be in place from day 1):**
- `<html lang="ar" dir="rtl">` set at root layout, **never overridden, no per-page `dir=`**
- **CSS logical properties only** — ban `ml-*`, `mr-*`, `text-left`, `left`, `right` at lint level (Tailwind v3.3+ logical variants + stylelint-use-logical)
- **Server-authoritative scoring** — correct answers NEVER ship to the client; placement rules and comprehension correctness evaluated server-side after submit (the v3 prototype's client-side scoring is a prototype-only shortcut that must NOT carry forward)
- **`export const dynamic = 'force-dynamic'`** on every authenticated route (prevents Supabase SSR session-cookie leak — see Pitfall #2 below)
- **RLS enabled on every public-schema table** at creation time (CI lint enforces); `WITH CHECK` on every UPDATE policy; `users` table separate from `auth.users` (FK 1:1, avoids future auth-vendor migration pain)
- **NFC normalization** on every Arabic text write
- **Service Layer has NO `next/*` imports** — mobile-readiness invariant

**What v1 must NOT build** (explicit anti-patterns from ARCHITECTURE):
Separate API server (Express/Fastify alongside Next.js), tRPC/GraphQL, monorepo from day 1, RLS as the primary authorization mechanism (use Service Layer authorization with RLS as defense-in-depth, NOT primary — but DO enable RLS on every table), Redis/Upstash caching, client-side question bundles, single `users` table for parents and children, page-level `dir` toggling, CMS authoring UI.

### Critical Pitfalls

PITFALLS catalogs 15. The five that **must shape phase ordering** and that the roadmapper cannot defer:

1. **Pitfall 4 — Wrong placement on day 1 → child rage-quits.** Even Raz-Kids (20+ years, millions of users) explicitly calls placement "not an assessment, just a starting hint" and ships a reset button as a first-class feature. Arabic has no Lexile/Miqyas Al Dhad validity to lean on. **Prevention:** bias placement DOWN on uncertainty; one-tap "too hard / too easy" escape hatch visible on every reader screen (not buried in settings); use parental-supplied grade as a strong prior (placement refines within ±2 levels, never starts a 6-year-old at Level 10); pilot the placement test with ≥10 real kids before any public launch; consider deferring full placement to v1.5 and letting parents pick the level explicitly in the absolute thinnest slice. **Phase to address:** the placement-vertical phase + a pre-launch piloting gate. **Gate:** placement session-completion rate ≥ 90% and post-placement comprehension within 50–95% in pilot.

2. **Pitfall 12 — Supabase SSR session cookie leak on Vercel = catastrophic cross-user auth breach.** `@supabase/ssr` refreshes JWTs by writing `Set-Cookie` on the response; if the response is edge-cached (Vercel default for many fetches), Parent B's browser ends up authenticated as Parent A — a COPPA/UK-AADC catastrophe because child data is involved. **Prevention:** `export const dynamic = 'force-dynamic'` on every authenticated route (enforce via default layout/middleware); NEVER use `auth.getSession()` in server code — use `auth.getUser()` or `getClaims()`; canonical `@supabase/ssr` middleware refreshing on every request; E2E test in CI that logs in as User A then User B and asserts no cross-user data. **Phase to address:** the auth + accounts phase. **Gate:** cross-user E2E test green in CI; no `getSession()` reference in server code; lint rule enforcing `force-dynamic` on `(parent)` and `(child)` layouts.

3. **Pitfall 1 — RTL retrofit cost.** Building LTR-first and patching `dir="rtl"` later produces hundreds of one-line bugs (icons mirrored wrong, drop-shadows offset, animations going backward, progress bars filling backward). Cost grows roughly linearly with components shipped. **Prevention:** `<html dir="rtl">` from commit 1, no LTR mode, lint-ban physical CSS properties (`ml-*`, `pr-*`, `text-left`, raw `left`/`right`) in favor of `ps-*`, `pe-*`, `text-start`. shadcn `--rtl` flag on init. The HTML mockups (v2/v3) are DESIGN references only — their CSS is not contract. **Phase to address:** the foundation phase (commit 1 lint rule). **Gate:** lint rule active in CI; `dir="rtl"` set in root layout; manual RTL screenshot pass on every route at phase end.

4. **Pitfall 6 — Third-party SDKs leak child data despite parent-account model.** Parent-owned accounts sidestep verifiable parental consent, but **do NOT exempt the product** from data minimization. Default-config analytics SDKs (GA, Mixpanel, PostHog, Amplitude) collect IP+device IDs = persistent identifiers = personal information under COPPA (Apitor 2024 FTC enforcement; April 22, 2026 rule effective). Google Fonts hot-linking transmits IP+UA to a third party (EU consent issue). Sentry session replay on a child profile is non-compliant. **Prevention:** SDK inventory document from first deployed dependency; first-party analytics only on child-facing routes; self-host fonts (no `fonts.googleapis.com` from authenticated routes); Sentry `beforeSend` redacts URLs with child profile IDs and disables session replay on auth routes; written retention policy (placement responses 12 months, level history 24 months after last activity); parent-data-access UI (view + hard-delete child profile + derived data) from v1. **Phase to address:** auth + accounts phase (data-access UI scaffold) and a pre-launch compliance review phase. **Gate:** network-tab inspection on child reader page shows zero third-party hosts beyond Supabase + own CDN; retention policy written and cron-scheduled; SDK inventory current.

5. **Pitfall 5 — Comprehension questions test memorization, not understanding.** Hand-authored questions are NOT immune; recall is the easiest type to write at scale and pollutes leveling signal. A child who scores 90% by Ctrl-F'ing is learning to test-take, not read. **Prevention:** question-type distribution policy set BEFORE authoring (literal ~30%, vocabulary ~25–30%, inferential ~25%); author from question-type backward, not passage-forward; **a literacy specialist (not the engineer-founder)** writes or reviews every question; the "answerable by Ctrl-F" test rejects items whose answer is the word right after the question's keyword in the passage; show qualitative framing ("did you get it?") not 0–100% scores. **Phase to address:** content & question-authoring workstream (parallel to engineering, not after). **Gate:** literacy specialist signs off on the v1 question bank; recall ≤ 40% by item count; per-question-type accuracy tracked separately in attempt schema (already supported by the unified `attempts`/`attempt_answers` model).

**Other pitfalls** (still preventable but with lower phase-ordering pressure):
- Pitfall 2 — Tashkeel rendering (font choice + line-height 1.8+ + voweled-text fixtures in component tests)
- Pitfall 3 — Bidi mixed content (`<bdi>` at template level for user-generated strings)
- Pitfall 7 — Punitive feedback UX (no red-X, no sad sound, "let's try again" framing)
- Pitfall 8 — Mobile-port blockers (touch targets ≥44px, no hover-only, clean `/api/v1/*` boundary)
- Pitfall 9 — Premature CMS (v1 content = Markdown/sheet/seed SQL, no CMS UI)
- Pitfall 10 — Premature dashboards/gamification (PROJECT.md OOS is load-bearing)
- Pitfall 11 — Supabase RLS misconfig (RLS-on-every-table CI check; `WITH CHECK` on UPDATE; never put auth-relevant flags in `user_metadata`)
- Pitfall 13 — Vercel cold-start latency on placement entry (Edge runtime for read paths; transaction-mode pooler URL)
- Pitfall 14 — Content variety (≥ 50 passages across Levels 1–10 as a v1 launch gate; parallel content workstream)
- Pitfall 15 — Supabase Auth vendor lock-in (separate `users` table 1:1 to `auth.users`)

---

## Cross-Cutting Workstreams

Two streams must run **in parallel** with engineering, not sequentially:

### Content Authoring (parallel from Phase 0/A)
The four research files converge sharply on this: **content is in the critical path of demo**, and engineering ships empty containers but cannot demo without:
- **~50 leveled Arabic passages across Levels 1–10** (Pitfall 14's launch gate: ≥5 distinct passages per level for non-repetitive UX). Diverse topics, mixed narrative/expository/poem/dialogue, pulled from across the Arab world (not Levantine-only or Gulf-only — diaspora kids are from everywhere).
- **Placement question bank** — 4–6 calibration passages × 2–3 MCQ each = ~15 items, hand-authored, piloted on ≥10 real kids before public launch.
- **Comprehension question banks** — 4–6 MCQ per text × ~50 texts = ~250 items, distribution literal ~30% / vocab ~25–30% / inferential ~25%, **every item reviewed by an Arabic literacy specialist**.
- **All passages authored with Tashkeel** for Levels 1–10; storage NFC-normalized at write boundary.

This is **a contracted Arabic literacy specialist's job, ~one contractor-month**, not an engineering deliverable. Engineering scope: schemas, seed scripts, the `<ArabicText>` primitive. Content scope: actually writing the text and questions. The roadmap must surface this as an owned, scheduled workstream — not "we'll figure out content later."

### Literacy Specialist Review (non-engineering dependency, pre-launch gate)
Distinct from authoring: a separate review pass on the assembled v1 question bank to enforce the question-type distribution policy and reject Ctrl-F-able items. **This is a non-engineering blocker on launch.** The roadmap must reserve calendar time and budget; treating it as a stretch goal is how recall-only banks ship.

---

## Implications for Roadmap

The four research files **converge on a 5-phase dependency-ordered sequence** that aligns with ARCHITECTURE.md's Phases A–E but absorbs feature-tier guards and pitfall-prevention gates. Phase count is at the upper end of the Standard granularity config (5–7 phases acceptable). **This is a suggestion, not a prescription** — the roadmapper should refine names, gate criteria, and weekly granularity, but the **dependency order is load-bearing**.

### Phase 1 — Foundation (architectural invariants in place; empty shell deployable)
**Rationale:** Every later phase depends on RTL invariants, the Service Layer skeleton, and the Drizzle schema. Catching `dir="rtl"` and logical-CSS on day 1 is the highest-leverage decision in the whole project (Pitfall 1). All architectural invariants that are expensive to retrofit live here.
**Delivers:** Next.js 16 + Tailwind v4 + Supabase wired; `<html lang="ar" dir="rtl">` at root; self-hosted Noto Naskh Arabic + Cairo via `next/font/google`; Drizzle schema migrated (`parents`, `children`, `levels`, `texts`, `questions`, `attempts`, `attempt_answers`); empty Service Layer modules; `<ArabicText>` primitive; lint rules banning physical CSS + `getSession()` + raw `auth.users` refs; CI check for RLS-on-every-public-table; one Arabic "Hello Qira" landing page rendering through the full RTL + font stack.
**Addresses:** Tier A scaffolding only.
**Avoids:** Pitfalls 1 (RTL retrofit), 2 (Tashkeel rendering — font picked + line-height 1.8 set), 11 (RLS-on-every-table CI), 15 (auth-vendor lock-in via separate `users` table).
**Gate:** lint-CI green; Arabic landing page renders Tashkeel-bearing text correctly on desktop + mobile + Safari/WebKit (Playwright RTL screenshot baseline); `dynamic = 'force-dynamic'` default present in `(parent)` and `(child)` layouts even before they have content.

### Phase 2 — Auth + Child Profiles (parent session, active-child context, data-access scaffold)
**Rationale:** Every subsequent feature is gated by parent-session and active-child contexts (ARCHITECTURE's route-group split). The Supabase SSR cookie pitfall (Pitfall 12) must be solved here — getting it wrong means rebuilding every authenticated page later.
**Delivers:** Supabase Auth (email + Google OAuth) integrated via `@supabase/ssr` canonical middleware; `(public)/auth/*` sign-in/sign-up/OAuth callback; `(parent)/profiles` for child profile CRUD; signed-cookie active-child + `setActiveChild` Server Action; `(parent)` and `(child)` layout guards; `requireParent` / `requireActiveChild` Service Layer helpers; parent-data-access UI scaffold (view + hard-delete child profile + cascade) for COPPA/UK-AADC compliance.
**Addresses:** Tier A auth + profile features.
**Avoids:** Pitfall 12 (SSR session leak — `force-dynamic` + `getUser`/`getClaims` only, cross-user E2E test in CI), Pitfall 6 (data-access UI built v1 not deferred), Pitfall 11 (RLS policies on `parents`, `children` with `WITH CHECK` on UPDATE).
**Gate:** cross-user E2E test green; OAuth redirects work in a Vercel preview deploy (not just local + prod); parent can hard-delete a child profile and cascade through all rows; no `getSession()` in server code.

### Phase 3 — Placement Vertical (rules engine + first end-to-end Server Action loop)
**Rationale:** Placement is the simplest end-to-end vertical slice that exercises the Server Action + Service Layer + DB pattern, and the lessons learned transfer directly to the reading + comprehension flow. It is also the highest-risk UX in the product (Pitfall 4 — wrong placement kills the product), so concentrating attention here pays off.
**Delivers:** Hand-authored placement question bank seeded; `services/placement.ts` deterministic rules engine (parental-grade-as-prior + bias-down-on-uncertainty); `(child)/placement/*` one-question-at-a-time UI with Server Action per answer; result screen with assigned level; the "too hard / too easy" one-tap escape hatch visible from the placement result and on every later reader screen.
**Addresses:** Tier A placement assessment.
**Avoids:** Pitfall 4 (escape hatch + bias-down + parental-prior), Anti-Pattern 6 (correct answers never ship to client — server-authoritative scoring is the foundation lesson here).
**Gate:** placement run produces a level deterministically; server-authoritative scoring verified via devtools inspection (no `correctIndex` in client bundle); escape-hatch one-tap-away UX in place; pre-launch piloting reserved for Phase 5 gate.

### Phase 4 — Reader + Comprehension Loop (the core value loop)
**Rationale:** This IS the product. Everything before exists to make this phase possible. Demo at the end of this phase = v1 functional.
**Delivers:** `(child)/library` filtered by `current_level_id`; `(child)/read/[textId]` rendering through `<ArabicText size="reader">` with Tashkeel-on default for Levels 1–10; comprehension flow (Server Components fetch prompts, Server Actions per answer, finalize attempt); `(child)/result/[attemptId]` with qualitative ("nice reading!") framing and next-text CTA; ~5–10 seed texts × 4–6 questions each across 3 levels (engineering ships the surface; content workstream fills it).
**Addresses:** Tier A reader, comprehension MCQ flow, feedback, result screen, progress persistence.
**Avoids:** Pitfall 5 (literacy-specialist review of seed questions in this phase, NOT post-launch), Pitfall 7 (no red-X / no sad sound feedback UX — designed as "let's look at that again"), Pitfall 2 (line-height ≥1.8 verified in reader with fully-vocalized fixtures), Pitfall 8 (touch targets ≥44px, no hover-only, responsive at 360px).
**Gate:** end-to-end demo: pick child → placement → library → read → answer → result; passes RTL Playwright screenshot regression; literacy-specialist sign-off on seed comprehension questions (recall ≤40%); reader works on a 360px viewport phone browser.

### Phase 5 — Mobile-Ready API + Pre-Launch Compliance + Pilot (launch-ready polish)
**Rationale:** The `/api/v1/*` Route Handler surface is only worth designing once the Service Layer it wraps is stable. Designing it earlier means redesigning it. This is also where compliance, content-variety, and placement-piloting gates land — collectively the difference between "code works" and "v1 launchable."
**Delivers:** `/api/v1/{children,placement,texts,attempts}` Route Handlers as thin wrappers; bearer-token auth alongside cookies; Sentry + Vercel Analytics configured with PII scrubbing and `beforeSend` redacting child-profile-bearing URLs; written retention policy + scheduled cleanup; SDK inventory document; Arabic copy review by native Fusha speaker; Lighthouse + Tashkeel QA pass; placement piloting with ≥10 real kids; content workstream delivers the **≥50-passage launch bar across Levels 1–10**.
**Addresses:** Mobile-readiness checklist; pre-launch compliance review; content-variety launch gate.
**Avoids:** Pitfall 6 (SDK inventory final pass; first-party-only analytics on child routes; self-hosted fonts verified via network tab on auth routes), Pitfall 13 (Vercel cold-start p95 budget set; transaction-mode pooler URL; Edge runtime for passage-read paths), Pitfall 14 (≥50-passage launch bar enforced as a real gate, not a stretch), Pitfall 4 (placement piloting with real kids before public launch).
**Gate:** SDK inventory complete; cross-user E2E test still green; p95 latency on placement and reader entry < 800ms after a 5-minute idle period; ≥50 passages live; literacy specialist sign-off on full question bank; pilot session-completion ≥90% and post-placement comprehension in 50–95% range.

### Phase Ordering Rationale
- **Foundation first** is dependency-driven: every later phase imports the Service Layer skeleton, the schema, and the `<ArabicText>` primitive. RTL/CSS-logical lint MUST exist before the first real component (Pitfall 1's retrofit cost grows linearly with components shipped).
- **Auth before placement** is dependency-driven: placement writes a level back to a child profile that doesn't exist without Phase 2.
- **Placement before reader** is risk-driven: placement is the lower-stakes vertical slice that teaches the Server Action + server-authoritative scoring pattern. The reader phase inherits the pattern.
- **API + compliance + pilot last** is integration-driven: the `/api/v1/*` surface needs a stable Service Layer behind it; compliance review needs the full SDK list visible; placement piloting needs the full reader loop to test against.
- **Content workstream is parallel from Phase 1**, not Phase 4 — engineering ships empty containers, content fills them. If content slips, the Phase 4 demo slips.

### Research Flags

Phases likely needing **deeper research** during planning (`/gsd-research-phase`):
- **Phase 3 (Placement Vertical):** the placement rules engine design is **MEDIUM confidence** because no validated Arabic psychometric framework exists. The rules-based approach is correct per PROJECT.md, but the specific calibration of "X correct out of Y in band B places at level N" needs piloting data the v1 cannot have until it runs. Research phase should map the rules-engine design to documented English equivalents (Lexia's 90%/66%/65% thresholds) and pilot-instrumentation hooks.
- **Phase 4 (Reader + Comprehension Loop):** Arabic comprehension question pedagogy is **MEDIUM confidence** — there's limited academic work and the vocabulary-weighting bump (~25–30% vs English's ~15–20%) is from a small set of Frontiers papers. Research phase should validate the question-type distribution against a literacy specialist's expert view BEFORE authoring begins, not after.
- **Phase 5 (Compliance + Pilot):** the April 22, 2026 COPPA final rule is **live** by Qira's build window; specific clauses on third-party monetization need a direct read of the regulation, not secondhand summaries. Research phase should produce a compliance checklist mapped to the SDK inventory.

Phases with **standard, well-documented patterns** (skip deep research):
- **Phase 1 (Foundation):** Next.js 16 / Tailwind v4 / shadcn `--rtl` / Drizzle / Supabase setup is well-charted; STACK confidence is HIGH across the board.
- **Phase 2 (Auth + Profiles):** Supabase Auth + App Router pattern has a canonical Supabase template; follow the SSR Advanced Guide literally.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | **HIGH** | Every primary recommendation cross-verified via Context7 + 2026 official docs. Headline picks (Next.js 16, Supabase, Drizzle, Noto Naskh + Cairo, shadcn `--rtl`, next-intl, Vitest, Playwright, Biome, pnpm) are all HIGH confidence. Open items: final Arabic font (designer QA pass), final ORM lock-in (Drizzle-leaning, Prisma viable), digit convention (Eastern vs Western — UI-phase decision). |
| Features | **MEDIUM-HIGH** | HIGH on English-equivalent category features (Raz-Kids, Lexia, Epic!, Lalilo all well-documented) and Arabic typography requirements (multiple converging sources). MEDIUM on Arabic placement (only one production framework exists — Miqyas Al Dhad, licensed/proprietary) and Arabic comprehension QG (limited academic work). The 4-tier model is opinionated and load-bearing. |
| Architecture | **HIGH** | Single Next.js monolith + Service Layer + `/api/v1/*` for mobile-readiness is a well-charted pattern in 2026. Anti-patterns (separate API server, tRPC pre-mobile, monorepo from day 1, RLS as primary auth) all have explicit "don't do this in v1" guidance. The `<ArabicText>` primitive concept is opinionated but the cost of NOT having it is unambiguous (Pitfall 1, 2, 3). |
| Pitfalls | **HIGH** | 15 pitfalls cross-confirmed by official docs (Supabase, FTC COPPA 2025, ICO AADC) + community sources. Pitfalls 12 (Supabase SSR cache) and 11 (RLS misconfig) are documented Supabase + Vercel + Next.js gotchas with canonical mitigations. Pitfall 4 (wrong placement) is acknowledged by the category leader (Raz-Kids) in their own FAQ. |

**Overall confidence:** **HIGH** on engineering decisions (stack, architecture, technical pitfalls); **MEDIUM** on pedagogical decisions (placement validity, comprehension question pedagogy in Arabic, level-1-through-20 definitions). The MEDIUM pedagogical confidence is the reason **placement piloting with real kids is a non-negotiable Phase 5 gate** — it is the cheapest way to convert MEDIUM to validated MEDIUM-HIGH before public launch.

### Gaps to Address

These could not be resolved at research time and **must be addressed during phase planning**:

- **Arabic font final pick** — Noto Naskh Arabic is the recommendation; designer QA pass on fully-vocalized fixtures in the reader is required before locking. PITFALLS suggests Amiri, Markazi Text as fallbacks if Noto Naskh's Tashkeel rendering in production reader sizes disappoints. **Address in:** Phase 1 (font picked) with re-test in Phase 4 (reader fixtures with real authored content).
- **ORM final lock-in** — Drizzle is recommended (HIGH confidence on bundle/cold-start advantages); the alternative Prisma is only justified by existing team fluency (no factor here). **Address in:** Phase 1, before first migration.
- **Digit convention** — Western (0123) vs Eastern Arabic-Indic (٠١٢٣). Diaspora-leaning suggests Western; PITFALLS warns mixing is non-professional and Bidi-confusing. **Address in:** Phase 1 (lock decision in app config) + UI phase (numerals in UI chrome vs body content).
- **Level 1–20 text-complexity definitions** — sentence length, vocabulary frequency band, sentence structures, topical complexity, Tashkeel density, text length per level — is a **head-of-content / literacy-specialist deliverable**, not engineering. **Address in:** content workstream kickoff at Phase 1, working draft acceptable; refinements re-level texts later.
- **Placement-test count + thresholds** — exact passage count (4–6) and per-passage MCQ count (2–3) for the placement bank, plus the score-to-level threshold rule (Lexia uses 90%/66%/65% — adapt for Arabic?), **need piloting data**. **Address in:** Phase 3 design + Phase 5 piloting gate.
- **Illustration storage** — v2/v3 mockups reference illustrations; Supabase Storage is the right home, but a decision on whether v1 ships illustrations at all (vs text-only thin-slice) is not in PROJECT.md. **Address in:** UI phase + Phase 4 scope decision.
- **Re-attempt policy** — whether children can re-attempt comprehension MCQs within a session (pedagogically valuable but gameable). Default proposal: no re-attempts within a session, can re-read the text. **Address in:** Phase 4 UX lock.
- **Tashkeel toggle exposure** — infrastructure built v1, but should the toggle UI ship in v1 or wait until Level 11+ content exists? Default proposal: infrastructure v1, UI surface deferred to v1.5. **Address in:** Phase 4 + content workstream coordination.
- **Compliance review owner** — who runs the COPPA/AADC pre-launch checklist? Solo-builder context suggests external counsel review of the privacy policy + retention schedule at minimum. **Address in:** Phase 5 planning.

---

## Sources

(Aggregated from STACK.md, FEATURES.md, ARCHITECTURE.md, PITFALLS.md; see those files for full lists.)

### Primary (HIGH confidence)
- Context7 libraries: `/vercel/next.js`, `/websites/tailwindcss`, `/supabase/supabase`, `/drizzle-team/drizzle-orm`
- Next.js 16 release notes and Vitest/RTL guides (nextjs.org)
- Supabase docs: SSR Advanced Guide, RLS, Next.js setup
- shadcn/ui January 2026 RTL announcement + DirectionProvider docs
- Tailwind CSS v4 logical-property utilities
- Google Fonts: Noto Naskh Arabic, Cairo specifications
- W3C Internationalization: BiDi in HTML, Arabic & Persian Layout Requirements; MDN CSS Logical Properties
- FTC COPPA 2025 final rule (effective April 22, 2026); ICO Age-Appropriate Design Code
- Raz-Kids Reading Placement Tool FAQ (placement = hint, not assessment)
- Lexia Core5 Auto Placement specs (90%/66%/65% thresholds)
- Reading Rockets / Shanahan on instructional vs frustration reading levels; ScienceDirect 2015 peer-reviewed
- Lexia: 3 Types of Reading Comprehension (literal, inferential, evaluative)

### Secondary (MEDIUM confidence — multi-source consensus)
- 2026 web comparisons: Drizzle vs Prisma (bundle / cold-start benchmarks), Supabase vs Neon, Vitest vs Jest, Playwright vs Cypress, Biome review, Zod v4 vs Valibot, next-intl vs next-i18next, Auth Stack 2026
- RTL & Arabic typography: aivensoft, conveythis, codeguru (line-height 1.6–1.8 convergence), UAE Design System 2.0
- Arabic vocabulary as strongest predictor of reading comprehension (Frontiers 2022, 2024)
- Miqyas Al Dhad announcement (MetaMetrics × Alef Education) — only production Arabic leveling framework
- Common Sense Media / Screenwise reviews of Epic! (cancel-friction dark pattern)
- Hundley & Tulu 2024 — Dark Patterns of Cuteness (ResearchGate)
- Deceptive Patterns registry — Duolingo streak-shame flag
- Supabase RLS best practices, multi-tenant patterns (Makerkit, Bytebase)
- Vercel + Supabase + Next.js gotchas (Kuberns 2026)

### Tertiary (LOW confidence — single source / inference)
- Specific child-app cold-start UX claims (placement-entry 2s tolerance for 6yos) — inferred from general kid-attention research, not a published benchmark
- Specific question-type distribution percentages — derived from English literacy research adapted with Arabic vocabulary weight bump; needs literacy-specialist validation in planning

---

*Research synthesis for: Qira — Arabic-first leveled-reading web app for children 5–12*
*Synthesized: 2026-05-14*
*Ready for: REQUIREMENTS.md → ROADMAP.md*
