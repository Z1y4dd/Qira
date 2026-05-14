# Architecture Research

**Domain:** Arabic-first children's leveled-reading web app (Qira v1)
**Researched:** 2026-05-14
**Confidence:** HIGH

## TL;DR

Build Qira v1 as a **single Next.js 15 App Router monolith** deployed on Vercel against a **managed Postgres** (Supabase or Neon) using a **shared-database / shared-schema** model keyed on `parent_id` and `child_id`. Use **Server Actions for internal UI mutations** (placement answers, comprehension submissions, profile switching), and **Route Handlers (`/api/v1/...`)** for the small set of operations that v2 mobile clients will eventually call. Treat RTL and Arabic typography as a **platform-wide invariant** (not page-level CSS) — `dir="rtl"` on `<html>`, CSS logical properties only, Arabic-aware text storage (NFC-normalized), and a single `<ArabicText>` primitive that owns Tashkeel and font rendering.

Do **not** build: microservices, a separate API server, GraphQL, tRPC, Redis caching, a monorepo, an event bus, a CMS layer, or RLS-based row security. All of these are reasonable at 100k+ users — they are premature at ≤10k.

## Standard Architecture

### System Overview

```
┌──────────────────────────────────────────────────────────────────┐
│                      BROWSER (RTL, Arabic)                        │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  React 19 components (Server + Client)                     │  │
│  │  - Reader (client: needs scroll/timer state)               │  │
│  │  - Placement quiz (client: needs answer state)             │  │
│  │  - Dashboards, level list (server: read-only render)       │  │
│  │  - <ArabicText> primitive (handles dir + font + Tashkeel)  │  │
│  └─────────────────────┬───────────────────────────────────────┘  │
└────────────────────────┼──────────────────────────────────────────┘
                         │ HTTPS (same origin, cookie auth)
┌────────────────────────▼──────────────────────────────────────────┐
│                   VERCEL — Next.js 15 App Router                  │
│  ┌──────────────────────────┐   ┌──────────────────────────────┐  │
│  │  Server Components       │   │  Server Actions              │  │
│  │  (RSC fetch direct       │   │  (mutations from UI:         │  │
│  │   from DB on render)     │   │   submit answer, switch      │  │
│  │                          │   │   profile, finalize attempt) │  │
│  └──────────┬───────────────┘   └──────────────┬───────────────┘  │
│             │                                  │                  │
│  ┌──────────▼──────────────────────────────────▼───────────────┐  │
│  │              SERVICE LAYER (plain TS modules)               │  │
│  │  ┌─────────────┐ ┌───────────────┐ ┌────────────────────┐   │  │
│  │  │ auth/       │ │ placement/    │ │ reading/           │   │  │
│  │  │ session.ts  │ │ rules.ts      │ │ attempt.ts         │   │  │
│  │  └─────────────┘ └───────────────┘ └────────────────────┘   │  │
│  │  ┌─────────────────────────────────────────────────────┐    │  │
│  │  │ db/  (Drizzle or Prisma schema + typed queries)     │    │  │
│  │  └─────────────────────────────────────────────────────┘    │  │
│  └─────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │  Route Handlers — /api/v1/*  (mobile-ready, JSON in/out)     │ │
│  │  Thin wrappers over the same service layer above.            │ │
│  │  v1: optional / minimal. v2: mobile clients call these.      │ │
│  └──────────────────────────────────────────────────────────────┘ │
└────────────────────────┬──────────────────────────────────────────┘
                         │ TCP (pgbouncer/pooled)
┌────────────────────────▼──────────────────────────────────────────┐
│           Managed Postgres (Supabase or Neon)                     │
│  parents, children, levels, texts, questions, attempts,           │
│  attempt_answers, placement_runs                                  │
└───────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Implementation |
|-----------|----------------|----------------|
| **Server Components (RSC)** | Render initial HTML, fetch read-only data on the server, ship zero JS for non-interactive screens (level grid, story list, dashboard read views) | `app/(parent)/dashboard/page.tsx` — async function that calls service layer directly |
| **Client Components** | Handle interactive state: reader scroll/timer, placement answer selection, comprehension question UI, profile-picker animations | `'use client'` boundary at the leaf level (don't make whole pages client) |
| **Server Actions** | UI-triggered mutations: submit comprehension answer, finalize attempt, switch active child profile, create child profile | Co-located with the page that uses them: `app/.../actions.ts` |
| **Route Handlers (`/api/v1/*`)** | Stable JSON contract for mobile (v2) and any external caller. v1 uses sparingly; v2 mobile uses heavily. | `app/api/v1/[resource]/route.ts` — thin handlers that import the same service layer |
| **Service Layer** | Domain logic: placement algorithm, attempt scoring, level assignment, content filtering by level. **Framework-agnostic** — no Next.js imports, only DB and pure functions | `src/services/*.ts` — plain functions |
| **DB Layer** | Typed queries, schema, migrations. Single source of truth for data shape. | Drizzle ORM (recommended for type-safety + raw-SQL ejection) or Prisma |
| **Auth** | Parent session (cookie), parent→children authorization, active-child-profile selection (cookie or signed token) | Supabase Auth or NextAuth, plus a thin "active child" middleware |
| **`<ArabicText>` primitive** | The ONLY component that emits Arabic body text. Owns font family, line-height, Tashkeel display, mixed-script (numbers/Latin) rendering | One client/server component, used everywhere |

### What Talks to What (Boundaries)

```
Client Component ─[Server Action]──┐
Server Component ─[direct call]────┼──► Service Layer ──► DB Layer ──► Postgres
Mobile (v2) ─────[Route Handler]───┘
```

**Hard rule:** UI never talks to DB directly. UI talks to a Server Action or a Route Handler, which calls the Service Layer, which calls the DB Layer. The Service Layer is the only place that knows about domain rules. This is the single decision that keeps mobile-readiness cheap.

## Public vs Auth-Gated Surface

| Surface | Route shape | Auth | Notes |
|---------|-------------|------|-------|
| Marketing / landing | `app/(public)/page.tsx` | none | Static, RSC, fast LCP |
| Parent sign-up / sign-in | `app/(public)/auth/*` | none | Handled by auth provider |
| Parent-only area (manage profiles, billing later) | `app/(parent)/*` | parent session required | Layout-level guard via middleware |
| Child-active area (reader, placement, level list) | `app/(child)/*` | parent session + active child profile required | Active-child stored in signed cookie; switched via Server Action |
| Mobile API (v2-ready) | `app/api/v1/*` | bearer or session token | Stable contract — version with `/v1/` |

The two route groups (`(parent)` and `(child)`) share a parent session but enforce different invariants at the layout boundary. This means **one auth, two contexts** — much simpler than separate apps.

## Recommended Project Structure

```
qira/
├── app/
│   ├── (public)/                      # Landing, sign-up, sign-in
│   │   ├── page.tsx
│   │   └── auth/
│   ├── (parent)/                      # Parent-only: profile management
│   │   ├── layout.tsx                 # Guard: requires parent session
│   │   ├── profiles/
│   │   │   ├── page.tsx               # List + create child profiles
│   │   │   └── actions.ts             # Server Actions: create/switch profile
│   │   └── settings/
│   ├── (child)/                       # Child-active context (reader, quiz)
│   │   ├── layout.tsx                 # Guard: requires active child profile
│   │   ├── placement/
│   │   │   ├── page.tsx
│   │   │   └── actions.ts             # submit placement answer
│   │   ├── library/
│   │   │   └── page.tsx               # texts at child's level
│   │   ├── read/[textId]/
│   │   │   ├── page.tsx               # reader
│   │   │   └── actions.ts             # start attempt, submit answers
│   │   └── result/[attemptId]/page.tsx
│   ├── api/
│   │   └── v1/                        # Mobile-facing JSON API
│   │       ├── children/route.ts
│   │       ├── placement/route.ts
│   │       ├── texts/route.ts
│   │       └── attempts/route.ts
│   └── layout.tsx                     # ROOT: <html dir="rtl" lang="ar">
├── src/
│   ├── services/                      # Domain logic — framework-agnostic
│   │   ├── auth.ts                    # session helpers
│   │   ├── placement.ts               # rules-based level assignment
│   │   ├── attempt.ts                 # scoring, persistence
│   │   ├── content.ts                 # text / question queries
│   │   └── profile.ts                 # parent/child profile logic
│   ├── db/
│   │   ├── schema.ts                  # Drizzle schema (or prisma/schema.prisma)
│   │   ├── client.ts                  # connection (pooled)
│   │   └── seed/                      # seed texts + placement questions
│   ├── lib/
│   │   ├── arabic.ts                  # NFC normalize, tashkeel strip, dir helpers
│   │   └── auth-cookie.ts             # signed-cookie helpers for active child
│   └── components/
│       ├── arabic-text.tsx            # THE Arabic primitive
│       ├── reader/                    # client components for reading flow
│       └── ui/                        # shared (buttons, cards) — Tailwind + shadcn/ui
├── public/
│   └── fonts/                         # self-hosted Arabic font (Tajawal, Noto Naskh)
├── drizzle.config.ts                  # or prisma
└── package.json
```

### Structure Rationale

- **`app/(parent)` vs `app/(child)`:** route groups give two distinct auth contexts without two apps. Parents land in `(parent)` to manage profiles; selecting a child sets a cookie and routes into `(child)`. Switching kids = clearing/resetting that cookie via a Server Action.
- **`src/services/` is framework-agnostic on purpose.** No `next/*` imports allowed. This is the layer mobile will reuse — either by being called from Route Handlers (most likely) or, if you ever choose tRPC, by being wrapped in procedures.
- **`src/db/schema.ts` as single source of truth.** Drizzle generates types; the Service Layer imports those types; the UI consumes Service Layer return types. Type integrity end-to-end without tRPC.
- **`src/components/arabic-text.tsx`** is intentionally singled out. Every body-Arabic render goes through this component. This is your enforcement point for Tashkeel handling, font fallback, and `lang="ar"`.

## Data Model (sketch — informs architecture, not the schema research)

```
parents          (id, email, oauth_provider, created_at)
children         (id, parent_id FK, display_name, age_band, current_level_id, created_at)
levels           (id, level_number 1..20, name_ar, description_ar)
texts            (id, level_id FK, title_ar, body_ar, body_normalized, word_count, genre)
questions        (id, kind enum['placement','comprehension'],
                  text_id FK nullable, level_id FK nullable,
                  prompt_ar, choices_ar jsonb, correct_choice_index, position int)
attempts         (id, child_id FK, kind enum['placement','reading'],
                  text_id FK nullable, started_at, finished_at, score,
                  assigned_level_id FK nullable)
attempt_answers  (id, attempt_id FK, question_id FK, chosen_index,
                  is_correct, answered_at)
```

**Architectural note:** `attempt` unifies placement and reading. Same table, `kind` discriminator. Avoids two parallel scoring pipelines. Placement-attempt produces `assigned_level_id`; reading-attempt produces `score`.

## Data Flow

### Flow 1: Placement Run (end-to-end)

```
[1] Parent selects child profile from /profiles
        ↓ (Server Action: setActiveChild)
        cookie set: active_child_id=<uuid>

[2] Child navigates to /placement
        ↓
[3] (child)/placement/page.tsx (Server Component)
        ↓ direct call → services/placement.ts::loadPlacementSequence()
        ↓ → db: SELECT questions WHERE kind='placement' ORDER BY position
        ↓
        HTML rendered with first question + remaining count
        ↓
[4] Client component handles question UI (radio selection)
        ↓ on submit → Server Action: submitPlacementAnswer(questionId, choiceIdx)
        ↓ → services/placement.ts::recordAnswer()
        ↓   - inserts attempt_answer
        ↓   - if last question: run deterministic rules → assigns level_id
        ↓   - updates children.current_level_id
        ↓ revalidatePath('/placement') → next question rendered

[5] On final question:
        ↓ services/placement.ts::finalize()
        ↓ writes attempt.assigned_level_id, attempt.finished_at
        ↓ redirect → /placement/result
```

**Why this shape:** placement is server-authoritative (the rules engine never runs in the browser — a child cannot reverse-engineer how to game it). Server Actions co-locate the mutation with the UI that triggers it. No JSON API needed for v1; mobile can call `/api/v1/placement/submit` later, which is a 5-line wrapper around `services/placement.ts::recordAnswer`.

### Flow 2: Reading Session (end-to-end)

```
[1] Child on /library (Server Component)
        ↓ services/content.ts::textsForLevel(activeChild.current_level_id)
        ↓ rendered grid of texts
        ↓
[2] Child clicks text → /read/[textId]
        ↓ Server Component renders the Arabic text + metadata
        ↓ Server Action: startAttempt(textId) → inserts attempts row, returns id
        ↓
[3] Reader (Client Component) handles scroll, timer, "I'm done reading"
        ↓ on done → navigate to /read/[textId]/questions
        ↓
[4] Comprehension questions rendered (Server Component fetches questions,
    Client Component manages answer state)
        ↓ each answer → Server Action: submitComprehensionAnswer(attemptId, qId, choiceIdx)
        ↓   - inserts attempt_answer, is_correct computed server-side
        ↓
[5] Last question → Server Action: finalizeAttempt(attemptId)
        ↓ services/attempt.ts computes score, writes attempt.score + finished_at
        ↓ redirect → /result/[attemptId]
        ↓
[6] /result/[attemptId] (Server Component) shows score + next-text CTA
```

**Why this shape:** the entire reading loop is a sequence of small Server Actions that mutate `attempt_answers` and one final action that closes the `attempt`. No background jobs. No client-side scoring (a child could otherwise inspect the bundle to see correct answers — the v3 prototype does this and it's an MVP-only acceptable shortcut you must NOT carry forward).

**Critical:** correct answers MUST NOT ship to the client. Server Components and Server Actions render only the question prompt + choices; correctness is evaluated server-side after the answer arrives.

## State Management

There is **no client-side global state library** in v1 (no Redux, Zustand, Jotai).

```
Server (DB)
    │
    │ (Server Component fetch on render)
    ▼
Page HTML + minimal Client Components
    │
    │ (local useState for transient UI)
    │ (Server Action for any mutation)
    ▼
revalidatePath / redirect → fresh server render
```

Local component state covers reader scroll, currently selected choice, "submitting" spinner. Cross-page state (active child, parent session) lives in cookies. Domain state lives in Postgres. That is the entire state model.

## RTL & Arabic — Architectural (not CSS) Implications

These are the items you MUST architect for from day one. Patching them on later is the documented anti-pattern that breaks Arabic apps.

### 1. Root-level direction is a layout invariant, not a page concern

```tsx
// app/layout.tsx — set ONCE, never overridden
<html lang="ar" dir="rtl">
```

No conditional `dir=`. No locale switcher in v1. If you later add English, it becomes `<html lang={locale} dir={getDir(locale)}>` — but v1 ships as Arabic-only and that simplification is intentional.

### 2. CSS uses logical properties only

The codebase must forbid `left`, `right`, `margin-left`, `padding-right`, `text-align: left|right`. Use `inline-start`, `inline-end`, `margin-inline-start`, `text-align: start`. Enforce via a Tailwind config that disables `ml-*`/`mr-*` in favor of `ms-*`/`me-*` (Tailwind v3.3+ supports logical-property variants natively), plus an ESLint rule or a stylelint check.

Why: physical properties mean any future LTR locale or LTR-quoted code snippet inside Arabic content breaks layout. Logical properties never need to be re-thought.

### 3. Arabic text storage is normalized at the boundary

```
INPUT (anywhere Arabic text enters the system)
   ↓ NFC normalize → strip ZWJ/ZWNJ where invisible → store
   ↓
DB: text.body_ar (display form, with Tashkeel if authored)
DB: text.body_normalized (no diacritics, NFC, for any future search/match)
```

Authors will paste Arabic from Word, web pages, and PDFs — three sources that produce different combining-mark sequences for the *same word*. Without NFC normalization at write-time, identical words won't match identical words. PostgreSQL 14+ supports the `unaccent` extension; the application layer (`src/lib/arabic.ts`) should still NFC-normalize before writing, because `unaccent` doesn't handle all Arabic diacritic variations.

**v1 doesn't need full-text search.** But you must normalize on write anyway — retro-normalizing later means rewriting all stored content.

### 4. The `<ArabicText>` primitive owns rendering policy

```tsx
<ArabicText size="reader" diacritics="show">
  {text.body_ar}
</ArabicText>
```

This component is the only place that:
- sets `lang="ar"` on the wrapper (assistive-tech and Web Speech)
- chooses font (Tajawal for UI, Noto Naskh / Amiri for reader body)
- sets `line-height` (Arabic needs ~1.8–2.0, never the LTR default of 1.5)
- decides whether to render Tashkeel (toggle per-text or per-child)
- handles mixed-script numerals (Arabic-Indic 0-9 vs Western digits — pick one and enforce; v1 should use Western digits in UI chrome and Arabic-Indic in story body if the source has them)
- handles `unicode-bidi: isolate` for any inline LTR fragments (e.g., a child's name typed in Latin letters embedded in an Arabic sentence)

If a designer or developer writes `<p>{arabicString}</p>` directly anywhere, that's a code-review failure. Lint or grep CI for raw Arabic-containing JSX outside the primitive.

### 5. Web Speech / TTS is locale-specific

The v3 prototype uses `utt.lang = 'ar-SA'` — that's fine for v1 demo audio, but architecturally TTS should be hidden behind a `useSpeech()` hook so v2 can swap to a higher-quality Arabic TTS provider (ElevenLabs, Google Cloud TTS Arabic voices) without touching components. v1 keeps it free and browser-native; the seam exists.

### 6. Form inputs need explicit `dir="rtl"` and `inputMode`

Even though `<html dir="rtl">` cascades, native form elements re-derive direction. For Arabic-only inputs (child name, search) keep `dir="rtl"`. For phone numbers / emails, set `dir="ltr"` explicitly. The Input component should have a `direction` prop that defaults to RTL.

## Architectural Patterns

### Pattern 1: Service Layer is the API

**What:** Domain logic lives in `src/services/*.ts` as plain TypeScript functions. UI calls them via Server Actions, Route Handlers wrap them for mobile. The service layer is identical for both callers.

**When to use:** Always — this is non-negotiable for mobile readiness.

**Trade-offs:** Adds one indirection over "Server Action talks to DB directly." Worth it from day one because rewriting actions to extract services later is painful and routinely skipped.

**Example:**
```ts
// src/services/placement.ts
export async function recordPlacementAnswer(
  childId: string,
  questionId: string,
  chosenIndex: number
): Promise<{ done: boolean; nextQuestionId?: string; assignedLevel?: number }> {
  // 1. validate child ownership against parent session (caller passes context)
  // 2. insert attempt_answer
  // 3. if last question: run rules, update children.current_level_id
  // 4. return next-step instruction
}

// app/(child)/placement/actions.ts  — Server Action wrapper
'use server'
export async function submitPlacementAnswer(qId: string, choice: number) {
  const { childId } = await requireActiveChild()
  return recordPlacementAnswer(childId, qId, choice)
}

// app/api/v1/placement/route.ts  — mobile-facing wrapper
export async function POST(req: Request) {
  const { childId } = await requireBearerAuth(req)
  const { questionId, chosenIndex } = await req.json()
  return Response.json(await recordPlacementAnswer(childId, questionId, chosenIndex))
}
```

### Pattern 2: Server-Authoritative Scoring

**What:** Correct answers and scoring logic live exclusively on the server. The client receives `{ prompt, choices }` — never `{ prompt, choices, correctIndex }`. After submission, the server responds with `{ correct: bool, explanation? }`.

**When to use:** Every quiz-style interaction. Placement and comprehension both.

**Trade-offs:** One server round-trip per answer (negligible at MVP scale). Eliminates entire class of cheating / over-fitting / accidental client-side state leakage. The v2/v3 prototypes do client-side scoring — that's a prototype-only shortcut.

### Pattern 3: Route Groups for Auth Contexts

**What:** `app/(parent)/layout.tsx` and `app/(child)/layout.tsx` each enforce their own auth invariant at the layout boundary. Pages inside don't re-check.

**When to use:** Whenever the app has more than one "you are now operating as X" context.

**Trade-offs:** Slightly more complex middleware. Vastly clearer than per-page guards.

```ts
// app/(child)/layout.tsx
export default async function ChildLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getActiveChildContext()
  if (!ctx) redirect('/profiles')
  return <ChildContextProvider value={ctx}>{children}</ChildContextProvider>
}
```

### Pattern 4: Cookie-based Active Child (not URL or local state)

**What:** Which child is "playing right now" is a server-readable signed cookie. URL routes (`/library`, `/read/123`) do not include `childId`.

**When to use:** When the same routes are scoped to a context that the user toggles between sessions.

**Trade-offs:** Slightly less shareable URLs (a child can't deep-link a sibling's progress). Massively simpler routing and avoids accidentally rendering Sibling A's progress while Sibling B is signed in. Cookie is signed via NextAuth/Supabase session secret — no client-side tampering.

## Anti-Patterns (Do NOT do these in v1)

### Anti-Pattern 1: Separate API server (Express/Fastify) alongside Next.js

**What people do:** Spin up a separate Node API process "for the mobile app later" or "for cleaner separation." Deploy it separately on Render/Railway.

**Why it's wrong:** Doubles the deploy surface, doubles the auth wiring, doubles the env-var management, and the "for mobile later" justification is solved by Route Handlers inside the same Next.js app. Vercel scales Route Handlers per-request the same way; there is no perf benefit.

**Do this instead:** Single Next.js app. Route Handlers under `/api/v1/*` for the mobile contract. One deploy.

### Anti-Pattern 2: tRPC or GraphQL "for type safety"

**What people do:** Add tRPC to get end-to-end types and a "real" API.

**Why it's wrong:** Server Actions already give end-to-end types within the Next.js app. tRPC's main value (web + RN sharing typed procedures) only matters once mobile exists. Adding it pre-mobile is extra build complexity, an extra mental model, and an extra layer between Service Layer and HTTP that you'll need to undo if you ever want plain REST for partners.

**Do this instead:** Server Actions for v1. If v2 mobile exists and proves out, reconsider tRPC at that point (it integrates fine with an existing Service Layer). Until then, stable REST under `/api/v1/*` is sufficient.

### Anti-Pattern 3: Monorepo from day one

**What people do:** Turborepo with `apps/web`, `apps/mobile`, `packages/api`, `packages/ui` before the first commit.

**Why it's wrong:** v1 has no mobile app. The monorepo overhead (pnpm workspaces, build orchestration, shared tsconfig surgery) buys nothing for ≤10k users on web-only. T3 Turbo and similar templates are great — when you actually have two apps.

**Do this instead:** Single repo, single `package.json`. Refactor to a monorepo the week you start the mobile app. Migration is a few hours of mechanical work; pre-paying that cost is weeks of friction.

### Anti-Pattern 4: Row-Level Security (RLS) for parent→child isolation

**What people do:** Use Supabase RLS policies to enforce that a parent can only read their own children's data.

**Why it's wrong:** RLS is excellent for direct-to-Postgres clients (e.g., a frontend hitting Supabase REST directly). v1 never does that — every query goes through the Service Layer with a known parent context. RLS adds debugging complexity (failing-row errors are opaque), forces every query to carry session metadata, and protects against a threat (compromised connection string used by an attacker) that the architecture already prevents.

**Do this instead:** Authorization in the Service Layer. Every service function takes `parentId` and asserts ownership. Plain `WHERE parent_id = $1` clauses. Revisit RLS if you ever expose Supabase REST/PostgREST directly to clients.

### Anti-Pattern 5: Pre-emptive caching (Redis, Upstash, KV)

**What people do:** Add Redis "for session storage" or "for hot text caching."

**Why it's wrong:** Postgres at <10k users serves a level's text list in <5ms. Vercel + Next.js already caches Server Component renders. Sessions go in signed cookies, not a session store.

**Do this instead:** Nothing. Postgres + Next.js cache + cookies. Measure before optimizing. Add caching when a real query exceeds 100ms in production logs.

### Anti-Pattern 6: Generating placement/comprehension content client-side

**What people do:** Ship the placement question bank as a `const QUESTIONS = [...]` in the bundle "to skip a fetch."

**Why it's wrong:** Reveals correct answers to anyone who opens devtools. Couples content updates to deploys. The v3 prototype does this (legitimate for a static demo, fatal for production).

**Do this instead:** Questions in Postgres. Server Components fetch on render. Correctness validated server-side.

### Anti-Pattern 7: One big "user" table for parents and children

**What people do:** Single `users` table with a `role` enum.

**Why it's wrong:** Parents have auth credentials; children don't. Parents have billing; children don't. COPPA / GDPR-K logic differs sharply. Mixing them invites mistakes like accidentally exposing a child PII field through a parent profile API.

**Do this instead:** `parents` and `children` are distinct tables with a FK from `children.parent_id`. Conforms to the legal model the project chose.

### Anti-Pattern 8: Page-level RTL toggling

**What people do:** `<div dir="rtl">` inside individual components, conditional Tailwind classes for RTL.

**Why it's wrong:** Inevitable inconsistency. Some component renders LTR-by-default and looks fine in isolation but breaks when nested in RTL context. The bug surface is unbounded.

**Do this instead:** `<html dir="rtl">` once, logical CSS properties everywhere, never touch `dir` again in v1.

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0–1k users (v1 launch) | Single Vercel project, Postgres on Supabase free or Neon free. No caching. No analytics infra. Manual content authoring. |
| 1k–10k users | Same architecture. Add Vercel Analytics + Sentry. Move Postgres to paid tier with pooled connections. Maybe add a CDN for static texts if content scale grows. |
| 10k–100k users | Now consider: (a) read replicas for `texts`/`questions`, (b) CDN-cached `/api/v1/texts/*` GET endpoints (Route Handlers with `revalidate`), (c) extract content authoring to a separate CMS workflow, (d) introduce monorepo if mobile app is shipping. |
| 100k+ users | Real scaling work: content service split, dedicated search infra (Meilisearch/Postgres FTS), background workers for analytics aggregations, regional DB replicas. **Out of scope for this research.** |

### Scaling Priorities (what breaks first)

1. **Postgres connection count.** Serverless functions on Vercel can exhaust the connection pool. Use a pooled connection string (Supabase's pgBouncer, Neon's pooled endpoint) from day one. Cost: one config line. Save: future emergency.
2. **Initial-load JS bundle.** Reader screens that are accidentally fully client-side will balloon. The route-group split + leaf-level `'use client'` is the prevention.
3. **Arabic font payload.** Self-host one Arabic font subset (Tajawal for UI, optionally Noto Naskh Arabic for reader). Don't load 8 weights × 2 families. WOFF2 + `font-display: swap`.

## Integration Points

### External Services

| Service | Integration Pattern | Notes |
|---------|---------------------|-------|
| Supabase / Neon (Postgres) | Direct connection from Server Components, Server Actions, Route Handlers via `src/db/client.ts` | Use pooled endpoint; one client per request lifecycle |
| Supabase Auth or NextAuth or Clerk | Session via cookie; helpers in `src/services/auth.ts` | Pick ONE; don't multi-provider in v1. Supabase Auth wins if Postgres is Supabase (same dashboard). NextAuth wins if you want provider independence. Clerk is fastest to ship but adds vendor lock. |
| Google OAuth | Through chosen auth provider | Free; required by the parent-auth requirement |
| Vercel (hosting) | `git push` → deploy. Env vars in dashboard. | No custom server config needed |
| Browser Web Speech API | Behind `useSpeech()` hook | Free; swap to paid TTS in v2 if needed |

### Internal Boundaries

| Boundary | Communication | Notes |
|----------|---------------|-------|
| UI ↔ Service Layer (server-side) | Direct function call | No serialization tax; type-safe |
| UI ↔ Service Layer (Server Action) | Serialized over implicit RPC | Next.js handles transport |
| Mobile (v2) ↔ Service Layer | HTTPS JSON via `/api/v1/*` Route Handlers | Versioned URL prefix |
| Service Layer ↔ DB | Drizzle/Prisma typed queries | One ORM only; don't mix |
| Content authoring ↔ DB | v1: hand-written SQL seed scripts in `src/db/seed/`. v2: small admin UI under `(parent)/admin` gated by a hardcoded admin email list. | Don't build a CMS in v1 |

## Suggested Build Order (Phase Mapping for Roadmap)

These phases are sized to be thin slices that each end with a runnable, demoable app. Order is dependency-driven: each phase requires only what prior phases shipped.

### Phase A — Foundation (1 phase, ~1–2 weeks)

**Goal:** Deployable empty shell with the architectural invariants locked in.

- Next.js 15 App Router project on Vercel
- `<html dir="rtl" lang="ar">` and Arabic font self-hosted
- Tailwind config with logical-property variants only
- `src/components/arabic-text.tsx` primitive
- Drizzle (or Prisma) + Postgres connection, migration tooling
- Schema for `parents`, `children`, `levels`, `texts`, `questions`, `attempts`, `attempt_answers`
- One placeholder seed text and a 3-question placement bank
- Empty Service Layer scaffolding (`src/services/{auth,placement,attempt,content,profile}.ts`)
- A "Hello Qira" public landing page in Arabic to prove the RTL + font stack works end-to-end

**Why first:** all later phases depend on the RTL invariants and the Service Layer skeleton. Catching `dir="rtl"` on day one is the highest-leverage decision in the whole project.

### Phase B — Auth + Profiles (1 phase, ~1 week)

**Goal:** Parent can sign up, sign in (email + Google), create child profiles, switch between them.

- Pick auth provider (recommend Supabase Auth if using Supabase Postgres; else NextAuth)
- `(public)/auth/*` routes (sign-in, sign-up, OAuth callback)
- `(parent)/profiles` — list + create child profiles
- Active-child cookie + `setActiveChild` Server Action
- `(parent)` and `(child)` layout guards
- Authorization helpers in Service Layer (`requireParent`, `requireActiveChild`)

**Why second:** every subsequent feature is gated by these contexts. Without an active-child cookie, you can't even prove the reading loop works for multiple kids.

### Phase C — Placement (1 phase, ~1 week)

**Goal:** A child can take placement and receive an assigned level.

- Hand-authored placement question bank (seed)
- `services/placement.ts` with deterministic rules
- `(child)/placement/*` UI: one question at a time, Server Actions per answer
- Result screen showing assigned level

**Why third:** placement is the simplest end-to-end vertical slice that exercises the Server Action + Service Layer + DB pattern. Lessons learned here transfer to the reading loop.

### Phase D — Reading + Comprehension (1 phase, ~2 weeks)

**Goal:** Child sees library at their level, reads a text, answers comprehension questions, sees score.

- `(child)/library` — texts filtered by `current_level_id`
- `(child)/read/[textId]` — reader screen rendered through `<ArabicText size="reader">`
- Comprehension flow: Server Components for prompts, Server Actions per answer, finalize attempt
- `(child)/result/[attemptId]` — score + next-text CTA
- ~5–10 seed texts across 3 levels

**Why fourth:** this is the core value loop. Everything before exists to make this phase possible. Demo this at end of phase.

### Phase E — Mobile-Ready API + Polish (1 phase, ~1 week)

**Goal:** Stable v1-launch state with a documented mobile-facing API and production polish.

- `/api/v1/*` Route Handlers wrapping the Service Layer (children, placement, texts, attempts)
- Bearer-token auth for the API surface (in addition to cookie auth for web)
- Error handling, loading states, Arabic copy review
- Sentry + Vercel Analytics
- Lighthouse + Arabic typography QA pass

**Why last:** the API surface is only worth designing once the Service Layer it wraps is stable. Designing it earlier means redesigning it.

### What's explicitly NOT in v1 (per `PROJECT.md`)

- Parent dashboards (defer to v2)
- Gamification (defer to v2)
- AI features (defer to v2)
- Native mobile (defer to v2 — but architecture above keeps the door open)
- Subscription billing (defer)
- Content authoring UI (v1 uses seed SQL)

The roadmap should NOT add phases for these. The architecture supports them without rework when they come.

## Mobile-Readiness Checklist (what v1 must NOT preclude)

These are the minimum things v1 must get right so v2 mobile doesn't require a rewrite. None of them add v1 work; they are constraints on how v1 is structured.

- [ ] **Service Layer is framework-agnostic** — no `next/*` imports in `src/services/*`
- [ ] **All domain logic reachable from a Route Handler** — Server Actions and Route Handlers both call the same service functions
- [ ] **Stable URL contract under `/api/v1/`** — versioned prefix; never break v1 contracts
- [ ] **Auth tokens transportable over HTTP headers** — not exclusively cookie-bound. Pick an auth provider that issues JWTs or session tokens consumable from a `Authorization: Bearer` header (Supabase Auth, NextAuth with credentials provider, or Clerk all qualify)
- [ ] **No HTML-shaped responses where mobile would need them** — every domain operation returns plain JSON-serializable values from the Service Layer
- [ ] **Arabic text always NFC-normalized at storage** — mobile won't have a different normalizer; one normalization at write time
- [ ] **No critical features that depend on browser APIs** — TTS via Web Speech is fine because it's a nice-to-have; placement and comprehension must be pure data flows

What v1 deliberately does NOT do for mobile-readiness:
- ❌ Build a monorepo
- ❌ Add tRPC
- ❌ Build a separate API service
- ❌ Add OpenAPI/Swagger generation
- ❌ Build a token refresh dance for cookie sessions

These are appropriate v2 investments once the mobile app actually exists.

## Sources

- [Next.js 15 Server Actions vs Route Handlers: When to Use Each](https://dev.to/whoffagents/nextjs-15-server-actions-vs-route-handlers-when-to-use-each-i-got-this-wrong-for-3-months-49hm) — confirms the rule: humans → Server Actions, machines → Route Handlers
- [Route Handlers documentation (Next.js)](https://nextjs.org/docs/app/getting-started/route-handlers) — official spec for `/api/*` routes
- [Server Actions vs Route Handlers (Makerkit)](https://makerkit.dev/blog/tutorials/server-actions-vs-route-handlers) — practical guide on choosing
- [Supporting RTL layouts in Next.js (Lingo.dev)](https://lingo.dev/en/nextjs-i18n/right-to-left-languages) — `dir="rtl"` placement, logical properties
- [Next.js i18n + RTL (Medium, Francisco Barros)](https://medium.com/wtxhq/next-js-i18n-support-and-rtl-layouts-87144ad727c9) — architectural patterns for Arabic in Next.js
- [Arabic Text Normalization Challenges in Databases (Medium, Mohamed Elsaed)](https://medium.com/@m.ashraf.saed/addressing-arabic-text-normalization-challenges-in-databases-df0cc0b9e313) — NFC + Tashkeel handling at the DB layer
- [Full-text search in Postgres (Misraj)](https://misraj.sa/en/blog/full-text-search-in-postgres) — Arabic-specific Postgres considerations
- [Multi-Tenant Database Architecture Patterns (Bytebase)](https://www.bytebase.com/blog/multi-tenant-database-architecture-patterns-explained/) — confirms shared-schema with `tenant_id` (here: `parent_id`) is the right fit at this scale
- [T3 Turbo vs T3 Stack 2026 (StarterPick)](https://starterpick.com/guides/t3-turbo-vs-t3-stack-2026) — confirms monorepo + tRPC is for the moment you have ≥2 apps, not before
- [Monorepo with React Native + Next.js (tRPC issue #775)](https://github.com/trpc/trpc/issues/775) — confirms migration to monorepo at the point you add mobile is a tractable refactor, not a rewrite
- `/home/ziyad/Qira/.planning/PROJECT.md` — locked constraints (Vercel + managed Postgres, parent-owned accounts, RTL, Fusha-only, web-first)
- `/home/ziyad/Qira/qira-mvp-v3.html` — design intent for home → story → result → dashboard flow; useful as UX reference, NOT as an architectural blueprint (it's client-side-only, scoring in the bundle)

---
*Architecture research for: Arabic-first children's leveled-reading web app (Qira v1)*
*Researched: 2026-05-14*
