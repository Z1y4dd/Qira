---
phase: phase-1-foundation
plan: index
type: execute
wave: 0
depends_on: []
files_modified: []
autonomous: false
requirements:
  - FOUND-01
  - FOUND-02
  - FOUND-03
  - FOUND-04
  - FOUND-05
  - FOUND-06
  - FOUND-07
  - FOUND-08
  - FOUND-09
  - COMP-LEGAL-01
mode: mvp
ui_hint: yes
---

# Phase 1 Foundation — Plan Index

> **Post-execution note (2026-05-15):** After Slices 1 + 2 landed,
> next-intl was dropped entirely (commits `9bdceff` + `056addc`).
> The `/ar/` route prefix and `[locale]` segment are gone — every
> route lives at `/...`. Plans 01-04, 01-05, and 01-06 below were
> patched in-place to match. References to `next-intl`, `/ar/`,
> `getTranslations`, `messages/ar.json`, and `src/middleware.ts` in
> Slice 1 / Slice 2 historical docs are kept as-written but no
> longer reflect the current code. See `01-01-SUMMARY.md` for the
> reasoning.

## Phase summary

Phase 1 lands every expensive-to-retrofit invariant of Qira on `main` in one phase so Phases 2–5 never pay a retrofit cost. The output is a deployable Vercel URL serving a single Arabic landing page rendered through the `<ArabicText>` primitive, backed by a Drizzle-managed Supabase schema with RLS on every table, fronted by a CI pipeline that fails the build on any violation of the eight architectural gates (physical-direction Tailwind, missing RLS, missing `force-dynamic`, `getSession()` use, non-allowlisted SDK host, non-NFC Arabic write, `next/*` import inside the Service Layer, raw Arabic literal outside `<ArabicText>` — the last as a soft warning in Phase 1). The phase is MVP-mode: each of the six slices ships a runnable artifact end-to-end and is sequenced linearly (1 → 2 → 3 → 4 → 5 → 6); the final slice deploys to Vercel and proves all five ROADMAP success criteria simultaneously.

## Phase Goal (user story)

**As a** solo developer on Qira, **I want to** ensure every expensive-to-retrofit invariant (RTL, fonts, schema, RLS, NFC, SDK allow-list, ArabicText primitive, Service Layer skeleton) lives in main from commit 1, **so that** later phases never pay RTL/i18n retrofit cost or compliance debt.

## Requirement coverage

Every Phase 1 requirement is fully closed by at least one slice. "Partial" means the slice contributes a stub or scaffold the requirement will be fully validated against in a later slice within Phase 1.

| Req ID | Requirement (paraphrased) | Slice(s) | Verification |
|--------|---------------------------|----------|--------------|
| FOUND-01 | `<html lang="ar" dir="rtl">` from commit 1 | 1, 6 | Playwright `rtl-baseline.spec.ts` asserts both attributes on `/ar/` |
| FOUND-02 | Tailwind v4 logical-property utilities; CI rejects physical | 1 (config), 2 (gate) | `scripts/lint-rtl.sh` + Vitest `rtl-utilities.test.ts` |
| FOUND-03 | Noto Naskh (body) + Cairo (UI) self-hosted via `next/font/google` | 1 (load), 5 (network proof) | Playwright network audit asserts zero `fonts.googleapis.com` / `fonts.gstatic.com` requests |
| FOUND-04 | `<ArabicText>` primitive used by every Arabic surface | 4 | Landing copy goes through `<ArabicText>`; soft-warn grep in CI flags raw Arabic literals |
| FOUND-05 | Drizzle schema; 8 entities applied to Supabase | 3 | `drizzle-kit migrate` applied; Vitest schema-shape assertions |
| FOUND-06 | RLS via `crudPolicy()` on every table; CI fails if missing | 3 (policies), 2 (CI gate) | Vitest `rls-coverage.test.ts` iterates `getTableConfig` for every table |
| FOUND-07 | Arabic text NFC-normalized server-side at write | 4 | Zod `ArabicText` refinement + `nfc()` helper; unit test rejects non-NFC input |
| FOUND-08 | Framework-agnostic Service Layer; called from Server Actions and Route Handlers | 4 | `src/services/*.ts` stubs; Vitest `service-layer-purity.test.ts` (no `next/*` imports) |
| FOUND-09 | Empty deployed shell on Vercel | 6 | Live URL responds 200 on `/ar/`; all CI gates green |
| COMP-LEGAL-01 | No third-party SDKs on child-facing routes; allow-list in `src/lib/sdk-allowlist.ts` asserted in CI | 5 | Playwright `network-audit.spec.ts` asserts zero non-allowlisted host requests |

## Success-criteria coverage (ROADMAP lines 30–35)

| # | Success criterion (paraphrased) | Slice that delivers it | Concrete verification artifact |
|---|---------------------------------|------------------------|-------------------------------|
| 1 | Deployed shell shows `<html lang="ar" dir="rtl">`; Noto Naskh body + Cairo UI loaded same-origin; no `fonts.googleapis.com` requests | 6 (deploy) + 1 (layout) + 5 (Playwright proof) | Live Vercel URL + `rtl-baseline.spec.ts` |
| 2 | `pnpm build` blocked if any physical-direction Tailwind utility or any table missing RLS | 2 (RTL gate) + 3 (RLS test) | `scripts/lint-rtl.sh` + `tests/invariants/rls-coverage.test.ts`; deliberately-bad branch in Slice 2 proves the gate fires |
| 3 | Every Arabic-rendering route uses `<ArabicText>`; verified by Playwright RTL screenshot baseline (Chromium + WebKit, desktop + mobile) | 4 (primitive) + 5 (baseline test) | `tests/e2e/rtl-baseline.spec.ts` runs on all 4 Playwright projects |
| 4 | Seed script populates Drizzle entities; Arabic text NFC-normalized server-side before insert | 3 (schema + seed) + 4 (NFC helper + Zod) | `pnpm db:seed` succeeds locally and against Supabase; `tests/unit/zod-arabic-text.test.ts` proves NFC rejection |
| 5 | `force-dynamic` declared on every authenticated layout; network audit shows zero non-Supabase, non-same-origin SDK requests | 5 (force-dynamic gate + allow-list) | `scripts/lint-force-dynamic.sh` + `tests/e2e/network-audit.spec.ts` |

## Slice list (execution order is linear: 1 → 2 → 3 → 4 → 5 → 6)

| Slice | File | One-line description |
|-------|------|----------------------|
| 1 | `01-01-PLAN.md` | Next.js 16 + Tailwind v4 + fonts + `[locale]` layout + landing page; first deployable dev artifact |
| 2 | `01-02-PLAN.md` | Biome, Vitest, GitHub Actions, two bash invariant scripts, deliberately-bad branch proves CI fires |
| 3 | `01-03-PLAN.md` | 8 Drizzle tables with `crudPolicy()`, migration applied to local Supabase, seed script, RLS-coverage Vitest |
| 4 | `01-04-PLAN.md` | `<ArabicText>` primitive, Service Layer stubs, NFC helper, Zod `ArabicText`, landing copy routed through primitive |
| 5 | `01-05-PLAN.md` | `src/lib/sdk-allowlist.ts`, Playwright config (4 projects), network audit + RTL baseline, `force-dynamic` gate |
| 6 | `01-06-PLAN.md` | Vercel project linked, env vars set, first deploy, all 5 success criteria proven on the live URL |

## Execution order and dependencies

```
Slice 1 (Repo + RTL bootstrap)
   ↓ (App Router + page must exist before CI can lint it)
Slice 2 (Lint + invariant CI)
   ↓ (CI scaffolding must exist before RLS Vitest runs in CI)
Slice 3 (Drizzle schema + RLS + seed)
   ↓ (Schema must exist before Service Layer stubs reference types)
Slice 4 (ArabicText + Service Layer skeleton)
   ↓ (Primitive must exist on a route before Playwright baselines it)
Slice 5 (SDK allow-list + Playwright)
   ↓ (All gates must be green on `main` before deploy is meaningful)
Slice 6 (Deploy + verify)
```

The linear order is non-negotiable in MVP-mode: each slice's demo gate must pass before the next slice begins. Within each slice, tasks may overlap (a single executor working sequentially through the task list is the expected model — there is no parallelism within Phase 1).

## Decisions locked

The 13 open decisions in RESEARCH §I are all locked in Phase 1 — no decision is passed to a downstream phase. The full list lives in `SKELETON.md` under "Architectural decisions locked by this skeleton" (20 items, superset of the 13). For traceability, the RESEARCH §I numbering maps to SKELETON-decision rows:

| RESEARCH §I # | Decision | Locked value | SKELETON row |
|---|---|---|---|
| 1 | Digit convention | Western 0–9 | 13 |
| 2 | Auth provider | Supabase Auth, `parents.id` FK to `auth.users.id` ON DELETE CASCADE | 10 |
| 3 | Locale routing | `app/[locale]/...` + `next-intl` middleware, `localePrefix: 'always'` | 2 |
| 4 | `force-dynamic` scope | Apply to `app/[locale]/(authenticated)/layout.tsx` placeholder in Phase 1 | 15 |
| 5 | Tashkeel default | `diacritics="show"` is the `<ArabicText>` default | 11 |
| 6 | NFC enforcement layer | Zod `ArabicText` refinement + `nfc()` helper at DB boundary | 12 |
| 7 | `child_profiles.age` validation | DB `CHECK age BETWEEN 5 AND 12` + Zod mirror | 14 |
| 8 | Drizzle vs Prisma | Drizzle | 8 |
| 9 | Drizzle 0.45.x vs 1.0-beta | 0.45.x | 8 |
| 10 | Font weight subsets | Naskh 400/500/700, Cairo 400/600/700 | 5 |
| 11 | shadcn Phase 1 scope | Init `--rtl` + Button only | 6 |
| 12 | Privacy Notice page | Out of Phase 1 (mapped to Phase 2) | — |
| 13 | Seed script Phase 1 scope | 8 tables + 20 `levels` rows; no texts/questions | 9 |

Two additional flagged confidences from RESEARCH §I "Tertiary / Inferred" must be verified at implementation time (Slice 3 Task 3.1 and Slice 1 Task 1.4):
- **Exact `crudPolicy` symbol name in Drizzle 0.45.x** — verify via Context7 at `/drizzle-team/drizzle-orm` before writing the schema file. If the symbol is named differently in the installed version, adjust imports.
- **Cairo Tashkeel rendering at weight 400** — visual confirmation during Slice 1; if it visibly clips Tashkeel on the landing page literal, fall back to Naskh for any Cairo headline that carries Tashkeel.

## Out of scope for Phase 1

Anything not in the ten requirements above is out of scope. Specifically: no auth UI, no profile UI, no placement, no library, no reader, no comprehension, no privacy notice page, no `/api/v1/*`, no event logging, no retention policy, no shadcn primitives beyond `Button`, no hand-authored Arabic content, no analytics. Slices that would touch these areas are explicitly *not* included; this is the discipline of MVP-mode (single phase end-to-end, defer everything not on the critical path).

## Task and commit estimates

| Metric | Estimate |
|--------|----------|
| Total task count (across 6 slices) | **31** |
| Atomic commits expected | **31** (1:1 — one task = one commit) |
| Wall-clock for solo executor | **5–8 working hours** (per RESEARCH §J "single deployable artifact") |
| Context budget per slice | **~30–45%** (well under the 50% guideline; each slice is small) |

## Per-slice plans

See:
- `01-01-PLAN.md`
- `01-02-PLAN.md`
- `01-03-PLAN.md`
- `01-04-PLAN.md`
- `01-05-PLAN.md`
- `01-06-PLAN.md`

## Recommended next step

`/gsd-plan-checker phase-1-foundation` — invariant-heavy phases benefit from a goal-backward review before the first executor commit.
