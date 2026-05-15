# Walking Skeleton: Qira v1

**Phase:** 1 — Foundation
**Mode:** MVP (vertical slices)
**Status:** To be built across Slices 1.1 → 1.6

---

## What the deployable URL serves

A single Vercel deployment at a public URL (e.g., `https://qira-<hash>.vercel.app/`) that:

1. Serves a Next.js 16 App-Router page at `/ar/` (root `/` redirects to `/ar/` via `next-intl` middleware).
2. The page is a single Arabic landing screen — copy is **"مرحباً بكم في قِراءة"** rendered through the `<ArabicText>` primitive.
3. The HTML root carries `<html lang="ar" dir="rtl">`. The `dir` attribute is hardcoded for v1 (Arabic-only).
4. Body font is **Noto Naskh Arabic** (weights 400 / 500 / 700); UI chrome font is **Cairo** (weights 400 / 600 / 700). Both are self-hosted via `next/font/google` — the browser network tab on a live load shows **zero** requests to `fonts.googleapis.com` or `fonts.gstatic.com`. Font files are served same-origin from `/_next/static/media/*.woff2`.
5. A single shadcn `<Button>` primitive is rendered on the page (scaffolded via `pnpm dlx shadcn@latest init --rtl`) — proves the RTL component pipeline works end-to-end.
6. An empty authenticated route group exists at `app/[locale]/(authenticated)/layout.tsx` carrying `export const dynamic = 'force-dynamic'` and `export const revalidate = 0`. No auth logic yet (Phase 2 fills it in) — the route group's existence is what the CI grep depends on.

## What database state must exist

A Supabase project (created in Slice 1.6) with:
- All 8 tables created via `drizzle-kit migrate` against the project's pooler URL: `parents`, `child_profiles`, `levels`, `texts`, `questions`, `choices`, `attempts`, `attempt_answers`.
- RLS enabled on every public-schema table, with policies emitted by Drizzle's `crudPolicy()` helper.
- 20 seed rows in `levels` (numbered 1–20 with placeholder Arabic names). No texts, no questions, no users — Phase 2 onwards populates everything else.

## CI checks that must pass (the "load-bearing" gates)

A GitHub Actions workflow (`.github/workflows/ci.yml`) that runs on every push and pull request and passes only when:

1. **Biome 2.x lint + format check** — `pnpm biome ci .` returns 0.
2. **TypeScript** — `pnpm tsc --noEmit` returns 0.
3. **Physical-direction Tailwind utility ban** — `bash scripts/lint-rtl.sh` returns 0 (regex over `src/` + `app/`).
4. **Force-dynamic on authenticated layouts** — `bash scripts/lint-force-dynamic.sh` returns 0 (every `layout.tsx` under `app/**/(authenticated)/` contains `export const dynamic = 'force-dynamic'`).
5. **Arabic-literal soft-warning scan** — `bash scripts/lint-arabic-wrapper.sh` exits 0 but prints any Arabic-Unicode-block characters found in source so a reviewer can confirm each is wrapped in `<ArabicText>` or sits in an i18n catalog (Phase 1 is soft-warn only — see RESEARCH §E).
6. **Vitest unit + invariant suite** — `pnpm vitest run` passes:
   - `tests/invariants/rls-coverage.test.ts` — every exported `pgTable` has policies via Drizzle `getTableConfig`.
   - `tests/invariants/service-layer-purity.test.ts` — no `from 'next/...'` import inside `src/services/**`.
   - `tests/invariants/rtl-utilities.test.ts` — Vitest mirror of the bash grep (belt-and-suspenders).
   - `tests/invariants/sdk-allowlist.test.ts` — `ALLOWED_HOST_PATTERNS` matches Supabase shapes; no analytics/ad/replay hosts present.
   - `tests/unit/zod-arabic-text.test.ts` — `ArabicText` Zod refinement rejects non-NFC input and accepts NFC input.
7. **Playwright E2E** — `pnpm playwright test` passes on all four projects (`chromium-desktop`, `webkit-desktop`, `chromium-mobile`, `webkit-mobile`):
   - `tests/e2e/rtl-baseline.spec.ts` — `<html>` has `lang="ar"` and `dir="rtl"`, body computed font matches `/Naskh/i`, zero requests to `fonts.googleapis.com` / `fonts.gstatic.com`, full-page visual baseline snapshot.
   - `tests/e2e/network-audit.spec.ts` — zero non-allowlisted host requests during landing-page load.

## What is explicitly NOT in the skeleton (deferred to Phase 2+)

| Area | Where it ships |
|------|----------------|
| Supabase Auth setup, `@supabase/ssr` integration, `getUser()` / `getClaims()` use | Phase 2 |
| Parent signup, sign-in, password reset, Google OAuth flows | Phase 2 |
| Child-profile create/edit/delete UI, active-child cookie | Phase 2 |
| Privacy Notice page (COMP-LEGAL-03), data export/delete UI (COMP-LEGAL-04) | Phase 2 |
| Cross-user Playwright E2E (`tests/e2e/cross-user.spec.ts`) | Phase 2 (no real users exist yet in Phase 1) |
| Placement assessment screens, deterministic placement algorithm, escape-hatch | Phase 3 |
| Library list, reader UI, comprehension question flow, server-authoritative scoring | Phase 4 |
| Hand-authored placement bank + comprehension banks (content) | Cross-cutting workstream — literacy specialist |
| Hand-authored leveled passages | Cross-cutting workstream — literacy specialist |
| `/api/v1/*` Route Handlers, OpenAPI sketch, bearer-JWT path | Phase 5 |
| First-party event logging, `RETENTION_POLICY` constant, scheduled cleanup | Phase 5 |
| `<ArabicText>` AST-level wrapping enforcement (current Phase 1 check is soft-warn regex) | Phase 4 (when content lands and matters) |
| Additional shadcn primitives beyond `Button` | Phase 2+ as needed |

## Walking-skeleton smoke test

A reviewer with the deployed URL and the repo checked out runs `git pull && pnpm install --frozen-lockfile && pnpm playwright test` locally against the **deployed** URL (export `PLAYWRIGHT_BASE_URL=https://qira-<hash>.vercel.app`) and observes all four Playwright projects passing. They then open the deployed URL in a real browser, open DevTools, and verify in the Network tab that (a) zero requests to `fonts.googleapis.com` or `fonts.gstatic.com` appear during initial paint, (b) the only non-same-origin host hit is the Supabase project URL (and only if a server component needs it — Phase 1 makes none), and (c) the `<html>` element carries `lang="ar"` and `dir="rtl"`. They close DevTools and visually confirm the landing copy renders right-to-left in Noto Naskh Arabic with a kid-friendly Cairo-font button beneath it. That is the skeleton: a deployed, type-checked, lint-clean, RTL-verified, RLS-secured, font-self-hosted shell that every later phase will build into without paying any retrofit cost.

---

## Architectural decisions locked by this skeleton

These decisions are settled by Phase 1 and not reopened in Phases 2–5 without an explicit revisit:

| # | Decision | Locked value |
|---|----------|--------------|
| 1 | **Framework** | Next.js 16 App Router (Turbopack default), Node 22 LTS runtime — no Edge runtime |
| 2 | **Routing shape** | `app/[locale]/...` with `next-intl` middleware; `localePrefix: 'always'`; v1 locale list is `['ar']` |
| 3 | **`<html lang dir>` placement** | In `app/[locale]/layout.tsx`; `dir="rtl"` is hardcoded for v1 |
| 4 | **Styling** | Tailwind CSS v4 with `@import "tailwindcss"`; logical-property utilities only |
| 5 | **Fonts** | Noto Naskh Arabic (body, weights 400 / 500 / 700) + Cairo (UI, weights 400 / 600 / 700), both via `next/font/google` self-host |
| 6 | **Component library** | shadcn/ui scaffolded with `--rtl`; only `Button` added in Phase 1 |
| 7 | **Database** | Supabase Postgres; runtime via pooler URL on port 6543, transaction mode; migrations via direct URL |
| 8 | **ORM** | Drizzle ORM 0.45.x with `postgres.js` 3.x driver; `prepare: false`, `max: 1` for serverless |
| 9 | **RLS** | Drizzle `crudPolicy()` from `drizzle-orm/supabase`, co-located in `src/db/schema.ts` |
| 10 | **Auth provider** | Supabase Auth — `parents.id` FK to `auth.users.id` with `ON DELETE CASCADE` (locked; Phase 2 implements the flows) |
| 11 | **Bidi primitive** | `<bdi>` inside `<ArabicText>`; not `<span dir="auto">` |
| 12 | **NFC enforcement layer** | Zod refinement at Service Layer (`ArabicText` schema in `src/lib/zod.ts`) + `nfc()` helper at DB write boundary (`src/db/normalize.ts`) |
| 13 | **Digit convention** | Western digits 0–9 in both UI and content (diaspora default); `DIGIT_STYLE = 'western'` constant in `src/lib/config.ts` |
| 14 | **Age constraint** | `child_profiles.age` Postgres CHECK constraint `age BETWEEN 5 AND 12`, mirrored at Zod boundary |
| 15 | **Service Layer** | `src/services/*.ts`, no `next/*` imports, called identically from Server Actions and (Phase 5) Route Handlers |
| 16 | **Test runner** | Vitest 3.x for unit/invariant; Playwright 1.50+ for E2E (4 projects: chromium-desktop, webkit-desktop, chromium-mobile, webkit-mobile) |
| 17 | **Lint** | Biome 2.x for general JS/TS; project-local bash scripts for the gaps Biome doesn't cover (physical-direction utilities, force-dynamic, Arabic-literal soft warn) |
| 18 | **Package manager** | pnpm; lockfile committed |
| 19 | **CI** | GitHub Actions on `push` + `pull_request`; Vercel handles deploys |
| 20 | **SDK allow-list** | `src/lib/sdk-allowlist.ts` — only Supabase host patterns; enforced by Playwright network audit |

These twenty decisions are the trellis everything in Phases 2–5 grows on. Reopening any of them requires an explicit research note and an updated SKELETON.md.
