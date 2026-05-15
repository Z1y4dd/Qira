---
phase: 01-foundation
plan: 01
slice_name: repo-rtl-bootstrap
status: complete
completed_date: "2026-05-15"
duration_minutes: 20
tasks_completed: 8
tasks_total: 8
files_created: 19
files_modified: 10
commits: 8
key_decisions:
  - Next.js 16 scaffolded with src/ directory; paths are src/app/ not app/ (standard create-next-app behavior)
  - shadcn/ui initialized manually (components.json + Button) due to interactive CLI prompt not supporting --yes with preset selection
  - next-intl@3.26.5 installed (peer dep warning for Next.js 16 is non-breaking; middleware API is stable)
  - .gitignore updated from broad .env* to explicit patterns (.env, .env.local, .env*.local) to allow .env.example tracking
tags:
  - next.js
  - tailwind
  - rtl
  - fonts
  - next-intl
  - shadcn
  - scaffold
requires: []
provides:
  - next.js-16-app-router-scaffold
  - tailwind-v4-rtl-config
  - noto-naskh-cairo-fonts
  - locale-segmented-routing
  - ar-landing-page
  - shadcn-button-rtl
  - env-shape
affects:
  - slice-2-lint-ci
  - slice-3-drizzle
  - slice-4-arabic-text
  - slice-5-playwright
  - slice-6-deploy
tech_stack_added:
  - next@16.2.6
  - next-intl@3.26.5
  - tailwindcss@4.3.0
  - class-variance-authority@0.7.1
  - clsx@2.1.1
  - tailwind-merge@3.6.0
  - lucide-react@1.16.0
  - "@radix-ui/react-slot@1.2.4"
tech_patterns:
  - src/app/[locale]/layout.tsx owns <html lang dir="rtl"> — locale layout pattern
  - next/font/google self-hosts at build time (no runtime cdn requests)
  - globals.css @theme override sets --font-sans to Naskh to prevent Inter leakage
  - Tailwind v4 logical properties throughout (no physical ml-/mr-/text-left/text-right)
  - force-dynamic on (authenticated) layout established before Phase 2 adds auth
key_files_created:
  - src/app/[locale]/layout.tsx
  - src/app/[locale]/page.tsx
  - src/app/[locale]/(authenticated)/layout.tsx
  - src/app/globals.css
  - src/middleware.ts
  - src/i18n.ts
  - messages/ar.json
  - src/components/ui/button.tsx
  - src/lib/utils.ts
  - src/lib/config.ts
  - components.json
  - .env.example
key_files_modified:
  - package.json
  - pnpm-lock.yaml
  - tsconfig.json
  - next.config.ts
  - postcss.config.mjs
  - .gitignore
  - src/app/layout.tsx
---

# Phase 1 Plan 01: Repo + RTL Bootstrap Summary

One-liner: Next.js 16 App Router scaffold with Tailwind v4 logical properties, Noto Naskh Arabic + Cairo self-hosted fonts, next-intl locale routing, shadcn RTL Button primitive, and /ar/ landing page rendering Arabic welcome text.

## Tasks Completed

| Task | Description | Commit | Key Files |
|------|-------------|--------|-----------|
| 1.1 | Scaffold Next.js 16 with pnpm, TypeScript strict, Turbopack | 1d0ff5c | package.json, tsconfig.json, next.config.ts |
| 1.2 | Tailwind v4 with Naskh font-sans override and logical text-align | 052492c | src/app/globals.css |
| 1.3 | Self-host Noto Naskh Arabic + Cairo via next/font/google | 42b42f8 | src/app/[locale]/layout.tsx, src/app/layout.tsx |
| 1.4 | next-intl middleware for / → /ar/ redirect | 804aa82 | src/middleware.ts, src/i18n.ts, messages/ar.json, next.config.ts |
| 1.5 | /ar/ landing page with Arabic welcome message | 90f1496 | src/app/[locale]/page.tsx |
| 1.6 | (authenticated) route group with force-dynamic placeholder | d4baeb6 | src/app/[locale]/(authenticated)/layout.tsx |
| 1.7 | shadcn/ui RTL init + Button primitive + DIGIT_STYLE | 277b85b | components.json, src/components/ui/button.tsx, src/lib/utils.ts, src/lib/config.ts |
| 1.8 | .env.example with Supabase env var shape | 07703a4 | .env.example, .gitignore |

## Decisions Made

### D1: src/ directory layout
The `create-next-app@16 --src-dir` flag places app code under `src/app/` instead of `app/`. Plan references to `app/` paths were adapted to `src/app/`. The `@/*` alias resolves to `./src/*` in tsconfig.json — consistent with this layout.

### D2: shadcn/ui initialized manually
The `pnpm dlx shadcn@latest init --rtl --yes` command presents an interactive multi-step prompt that does not support non-interactive mode with the `--yes` flag when preset selection is required. Resolution: created `components.json` manually with `"rtl": true`, installed dependencies directly (`class-variance-authority`, `clsx`, `tailwind-merge`, `@radix-ui/react-slot`, `lucide-react`), and hand-crafted `src/components/ui/button.tsx` using shadcn's RTL-safe logical class pattern. No physical-direction classes present.

### D3: next-intl@3.26.5 peer dependency warning
next-intl@3 declares peer dependency on `next@"^10..^15"` but is installed against Next.js 16. This is a semver warning only — the middleware API (`createMiddleware`) and server-side translation API (`getTranslations`) work correctly against Next.js 16. The warning will resolve when next-intl publishes a v3.x or v4.x release explicitly declaring Next.js 16 compatibility.

### D4: .gitignore updated to allow .env.example
The create-next-app scaffold writes `.env*` which would exclude `.env.example` from git. Updated to explicit patterns: `.env`, `.env.local`, `.env*.local`. This allows `.env.example` to be committed as a template while still excluding all actual secret files.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] shadcn CLI interactive prompt not automatable**
- **Found during:** Task 1.7
- **Issue:** `pnpm dlx shadcn@latest init --rtl --yes` still presents a multi-step interactive prompt (component library, preset selection) that cannot be non-interactively satisfied with `--yes`
- **Fix:** Manual creation of `components.json` with `"rtl": true` and hand-crafted `src/components/ui/button.tsx` following shadcn's RTL conventions (logical properties, no ml-/mr-/text-left/text-right). All required dependencies installed via `pnpm add`.
- **Files modified:** components.json (new), src/components/ui/button.tsx (new), src/lib/utils.ts (new)
- **Commit:** 277b85b

**2. [Rule 1 - Bug] .next cache stale validator.ts after page.tsx deletion**
- **Found during:** Task 1.5 TypeScript check
- **Issue:** After deleting `src/app/page.tsx` in Task 1.4, the `.next/types/validator.ts` (generated from prior build/type-gen run) still referenced the deleted file, causing `TS2307: Cannot find module '../../src/app/page.js'`
- **Fix:** Removed `.next/` directory before running `pnpm tsc --noEmit`
- **Files modified:** None (cache deletion)
- **Commit:** N/A (non-code fix)

## Known Stubs

- `src/app/[locale]/page.tsx` renders the welcome string directly without `<ArabicText>` wrapper. This is intentional and documented in the plan — the `<ArabicText>` component wrap is deferred to Slice 4 (Task 4.3). The text is served via next-intl message catalog, which the plan accepts as equivalent to the "wrapped" state for Phase 1 CI checks.
- `src/app/[locale]/(authenticated)/layout.tsx` has no auth logic — intentional stub for Phase 2.
- `src/services/` directory does not exist in this slice — deferred to Slice 4 per the plan's "Out of scope" section.

## Demo Gate Status

The following can be verified by running `pnpm dev`:
- `http://localhost:3000/` → HTTP 307 redirect to `/ar/`
- `/ar/` page: `<html lang="ar" dir="rtl">` in inspector
- Body computed font-family: Noto Naskh Arabic (loaded from `/_next/static/media/*.woff2`, zero requests to fonts.googleapis.com)
- Page renders "مرحباً بكم في قِراءة" heading at text-4xl
- shadcn Button renders "ابدأ" beneath the heading

## Threat Flags

None. This plan creates no network endpoints, auth paths, file access patterns, or schema changes. All added surface is static file serving + client-side redirect (handled by Next.js middleware).

## Self-Check: PASSED

All 19 plan files verified to exist. All 8 commits verified in git log.
