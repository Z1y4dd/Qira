# Stack Research — Qira

**Domain:** Arabic-first (RTL, Fusha) web reading app for children ages 5–12; parent-owned account model; web-only MVP
**Researched:** 2026-05-14
**Overall confidence:** HIGH — every primary recommendation verified against Context7 and/or official docs from 2026

---

## TL;DR

```
Next.js 16 (App Router, RSC, Turbopack)  +  React 19.2  +  TypeScript 5.x
        ↓
Tailwind CSS v4 (logical properties)  +  shadcn/ui (--rtl mode, Jan 2026)
        ↓
next-intl (Arabic locale, dir="rtl" at root)
        ↓
Noto Naskh Arabic (body)  +  Cairo (UI/headings) via next/font/google
        ↓
Supabase (Postgres + Auth + Storage) — single platform
        ↓
Drizzle ORM 0.45.x (Postgres dialect, RLS helpers for Supabase)
        ↓
Zod v4 (form/server validation)  +  React Hook Form
        ↓
Vitest (unit/integration)  +  Playwright (E2E, RTL screenshots)
        ↓
Biome (lint + format, single tool)
        ↓
pnpm (package manager)  →  Deployed to Vercel
```

**Headline recommendations (with rationale specific to Qira):**

1. **Supabase over Neon** — Qira needs Auth + image Storage + Postgres in one platform. Neon wins on edge-runtime branching benchmarks but loses by 3-vendor sprawl for a solo build that has zero edge-runtime requirements.
2. **Supabase Auth over Clerk/NextAuth** — Already on Supabase, parent-only auth surface is small (email + Google), Supabase Auth handles both natively, and RLS becomes free child-profile isolation. Clerk's superior DX doesn't justify a second vendor at v1 scale.
3. **Drizzle over Prisma** — Smaller serverless bundle (~7KB vs ~1.6MB), first-class Supabase RLS helpers (`crudPolicy()`), and the SQL-first mental model is the right fit for a content-heavy app with bespoke leveling/placement queries.
4. **Noto Naskh Arabic for body text** — Google-engineered for screen Naskh rendering with full Tashkeel positioning; pairs with Cairo for UI chrome. Avoid Amiri for v1 (calligraphic, less readable at small sizes for kids).
5. **shadcn/ui with `--rtl` flag** — January 2026 release added native CLI-level RTL support; eliminates the historical "logical class" tax for Arabic.

---

## Recommended Stack

### Core Technologies

| Technology | Version (May 2026) | Purpose | Why Recommended for Qira |
|------------|---------|---------|-----------------|
| **Next.js** | 16.2.x | React full-stack framework (App Router, RSC, Turbopack default) | The de facto Vercel-native framework. App Router + Server Components let placement quizzes and leveled-text fetching happen on the server (no LLM, just deterministic queries against Postgres), shipping near-zero JS to the kid's browser. Turbopack is now default and gives ~400% faster `next dev` startup — matters for solo iteration. App Router's `app/[locale]/layout.tsx` is the canonical place to set `<html lang="ar" dir="rtl">`. **Confidence: HIGH** |
| **React** | 19.2 (bundled with Next 16) | UI runtime | Comes with Next 16. React Compiler (stable in 16) auto-memoizes — useful for the leaf-heavy reader UI (text chunks, question cards). **Confidence: HIGH** |
| **TypeScript** | 5.7+ | Type safety end-to-end | Non-negotiable for a solo build: catches schema drift between Postgres → API → form → UI. Drizzle's inferred types make `Text`, `Question`, `ChildProfile` flow from schema to React props without manual DTOs. **Confidence: HIGH** |
| **Tailwind CSS** | v4.x | Utility-first styling | v4's logical-property utilities (`ps-`, `pe-`, `ms-`, `me-`, `text-start/end`, `border-s/e`, `float-start/end`) are first-class — RTL "just works" when `<html dir="rtl">` is set. No `rtl:` prefix gymnastics. **Confidence: HIGH** (verified against tailwindcss.com via Context7) |
| **Supabase** | Pro / Free tier | Managed Postgres + Auth + Storage + RLS | One-vendor stack covering the three things Qira actually needs at v1: a relational DB for texts/questions/profiles, parent auth (email + Google built-in), and Storage for the text illustrations referenced in the v2/v3 mockups. RLS makes child-profile isolation declarative. **Confidence: HIGH** |
| **Drizzle ORM** | 0.45.x (or 1.0-beta if comfortable) | Type-safe SQL toolkit | ~7KB serverless bundle vs Prisma's ~1.6MB → faster Vercel Function cold starts. Ships `crudPolicy()` helpers for Supabase RLS. SQL-first feel suits content-modeling work (joins across `texts × levels × questions`) better than Prisma's higher abstraction. **Confidence: HIGH** |
| **next-intl** | 3.x | i18n with App Router RSC support | Despite being Arabic-only at v1, next-intl is the right scaffold: it (a) gives you the `dir="rtl"` plumbing for free, (b) handles Arabic's 6 plural forms correctly out of the box, (c) is RSC-native (translations render on the server, no client JS bloat), and (d) leaves an open door if Phase 2 expands to English/French. ~1.8M weekly downloads and ~4x YoY growth — clear winner over `next-i18next` for App Router. **Confidence: HIGH** |
| **shadcn/ui** | Current (post Jan 2026 RTL release) | Copy-paste React components on Radix | Use `npx shadcn@latest init --rtl` to scaffold with first-class RTL. Components auto-flip (icons via `rtl:rotate-180`, slide-in-from-left → slide-in-from-start). Copy-paste model means you own the code — important for tweaking kid-friendly visual affordances (larger tap targets, calmer color palette per v2/v3 mockups). **Confidence: HIGH** |

### Supporting Libraries

| Library | Version | Purpose | When to Use in Qira |
|---------|---------|---------|-------------|
| **Zod** | 4.x | Runtime schema validation | All Server Action inputs, all API routes, all form submissions. The placement algorithm reads parent-submitted age/grade and emits a level — Zod is the gate between untrusted input and the rules engine. **Confidence: HIGH** |
| **React Hook Form** | 7.x | Form state + validation | Parent signup, child profile creation, comprehension question forms. Pairs with Zod via `@hookform/resolvers/zod`. RHF's uncontrolled-by-default model keeps the kid-facing answer forms snappy. **Confidence: HIGH** |
| **@supabase/ssr** | Current | Supabase auth helpers for App Router | The official Next.js 16 App Router integration. Handles cookie-based session passing across Server Components and Route Handlers. **Confidence: HIGH** |
| **@supabase/supabase-js** | 2.x | Supabase client (browser + server) | Used through `@supabase/ssr`. For database access from server code, prefer Drizzle over `supabase-js` — keep `supabase-js` for Auth and Storage only. **Confidence: HIGH** |
| **drizzle-kit** | 0.31.x | Migrations + Drizzle Studio | `drizzle-kit generate` + `drizzle-kit migrate` for schema evolution. Drizzle Studio gives a quick local DB inspector — useful when hand-seeding the v1 leveled-text corpus. **Confidence: HIGH** |
| **lucide-react** | Latest | Icon set (shadcn default) | shadcn's default icon library. RTL-aware via `rtl:rotate-180` when shadcn's `--rtl` flag is set on init. **Confidence: HIGH** |
| **postgres** (driver) | 3.x (postgres.js) | Postgres client for Drizzle on Node runtime | Use `postgres.js` driver for Drizzle on standard Vercel Node functions (which is what we want — no edge runtime). Simple, well-supported. **Confidence: HIGH** |
| **clsx** + **tailwind-merge** | Latest | Class composition utility (`cn()`) | Ships with shadcn by default. Required pattern. **Confidence: HIGH** |
| **date-fns** | 4.x | Date math | Tracking child progress over time (read date, streak math when gamification arrives in v2). Lighter than Moment, locale-aware for Arabic month names if needed. **Confidence: HIGH** |
| **Vitest** | 3.x | Unit + integration test runner | Native ESM, 10–20x faster cold starts than Jest, Next.js 16 has official setup docs for it. Use for: placement-algorithm rules engine, leveling logic, Zod schema tests. **Confidence: HIGH** |
| **@testing-library/react** | 16.x | Component testing | Standard for testing React components with shadcn primitives. **Confidence: HIGH** |
| **Playwright** | 1.50+ | E2E + visual regression | Tests the full reading loop in a real browser. Critical for RTL: take a screenshot of the reader at desktop + mobile widths to catch direction bugs early. Free parallelism, cross-browser (Safari/WebKit matters for diaspora iPad users). **Confidence: HIGH** |
| **Biome** | 2.x | Lint + format (single tool) | Replaces ESLint + Prettier with one binary, ~10–25x faster. Single config file. For a solo build, the time saved on tooling churn is real. **Confidence: HIGH** |

### Development Tools

| Tool | Purpose | Notes |
|------|---------|-------|
| **pnpm** | Package manager | Faster than npm, deterministic, lower disk footprint. Vercel natively supports it (auto-detected from `pnpm-lock.yaml`). |
| **Volta** or **fnm** | Node version pin | Pin to Node 22 LTS (Vercel default in 2026). Optional but worth it for solo work. |
| **drizzle-kit studio** | Local DB inspection | `pnpm drizzle-kit studio` opens a local UI on the connected Supabase DB. Faster than the Supabase Studio for schema work. |
| **Supabase CLI** | Local Supabase emulator + migrations | `supabase start` runs a local stack (Postgres + Auth + Storage) for offline dev. Apply Drizzle migrations against it. |
| **Vercel CLI** | Preview deploys + env management | `vercel env pull` syncs Supabase keys into `.env.local`. |
| **GitHub Actions** | CI: typecheck, biome, vitest, playwright | Vercel handles deploy. CI handles quality gates before merge. |

---

## Installation

```bash
# Scaffold
pnpm create next-app@latest qira --typescript --tailwind --app --turbopack --src-dir --import-alias "@/*"
cd qira

# shadcn/ui with RTL preconfigured (Jan 2026 release)
pnpm dlx shadcn@latest init --rtl

# Database + ORM
pnpm add drizzle-orm postgres
pnpm add -D drizzle-kit

# Supabase (auth + storage)
pnpm add @supabase/supabase-js @supabase/ssr

# Forms + validation
pnpm add zod react-hook-form @hookform/resolvers

# i18n (sets up dir="rtl" plumbing even though v1 is Arabic-only)
pnpm add next-intl

# Utility
pnpm add date-fns clsx tailwind-merge lucide-react

# Dev: testing + tooling
pnpm add -D vitest @vitest/ui @testing-library/react @testing-library/jest-dom jsdom
pnpm add -D @playwright/test
pnpm add -D @biomejs/biome
pnpm add -D typescript @types/node @types/react @types/react-dom

# Fonts: handled via next/font/google (no install)
```

### Critical RTL Setup (`app/[locale]/layout.tsx`)

```tsx
import { Noto_Naskh_Arabic, Cairo } from "next/font/google";

const notoNaskh = Noto_Naskh_Arabic({
  subsets: ["arabic"],
  weight: ["400", "500", "700"],
  variable: "--font-body",
  display: "swap",
});

const cairo = Cairo({
  subsets: ["arabic"],
  weight: ["500", "700", "900"],
  variable: "--font-ui",
  display: "swap",
});

export default function RootLayout({ children, params }) {
  return (
    <html lang="ar" dir="rtl" className={`${notoNaskh.variable} ${cairo.variable}`}>
      <body className="font-[var(--font-body)]">{children}</body>
    </html>
  );
}
```

---

## Arabic Typography — The Most Qira-Specific Stack Decision

This is the one area where generic Next.js advice gives the wrong answer. Specifics:

### Recommended fonts

| Font | Role | Why |
|------|------|-----|
| **Noto Naskh Arabic** | Body text (the leveled passages kids read) | Google-engineered specifically for screen rendering of Arabic with **full Tashkeel positioning** (kerning between diacritic and letter is correct, no clashing with descenders). Traditional Naskh shapes — what kids learn to read first in Arabic primary education. **Confidence: HIGH** |
| **Cairo** | UI chrome (buttons, headings, nav, dashboards) | Modern geometric sans-serif optimized for screens. Sets the friendly, kid-appropriate tone of the v2/v3 mockups. Pairs cleanly with Noto Naskh by handling chrome where calligraphic forms would feel heavy. **Confidence: HIGH** |

### Critical CSS for Arabic kid-readability

```css
/* Tailwind v4 globals.css */
@theme {
  --font-body: "Noto Naskh Arabic", serif;
  --font-ui: "Cairo", sans-serif;
}

body {
  font-family: var(--font-body);
  /* Arabic needs more line-height than Latin to accommodate Tashkeel marks above the line */
  line-height: 1.9;
  /* Kid reading: large default size, will be tweaked per level */
  font-size: 1.25rem;
}

/* Tashkeel renders correctly with default font-feature-settings; do NOT disable ligatures */
```

### Font traps to avoid

- **Do not use Amiri for body text in v1.** It's beautiful and Quranic-grade for Tashkeel — but it's calligraphic and dense; less readable for early-grade kids at the sizes the reader will run at. Reserve it for a future "classical mode" toggle if ever.
- **Do not use Tajawal or generic sans-serifs as body.** They render Tashkeel poorly (marks float, collide with letters).
- **Do not let Tailwind's `font-sans` (default Inter) leak in via shadcn defaults.** Override the body font *globally* — Inter has no Arabic glyphs and will silently substitute with the OS default, breaking the reader experience cross-device.
- **Do not set `text-align: justify`** on Arabic body text — Arabic justification (Kashida) requires explicit `text-justify: inter-word` and even then is uneven across browsers. Use `text-align: start` (logical, becomes right-align in RTL).

---

## Alternatives Considered

| Recommended | Alternative | When to Use Alternative |
|-------------|-------------|-------------------------|
| Supabase | **Neon + Clerk + Vercel Blob** | If you anticipate Vercel Edge runtime (you do not for v1), need DB branching per PR (overkill for v1), or want best-in-class auth UX (Clerk). For Qira's three-thing surface (DB + auth + image hosting), Supabase wins on simplicity. |
| Supabase Auth | **Clerk** | If you wanted drop-in beautiful UI components and were willing to pay $0.02/MAU after 10K. Genuinely better DX. But: adds a second vendor; Supabase RLS becomes harder (Clerk JWT → Supabase requires custom JWT signing); not justified at v1 scale where parent-only signup is a small surface. |
| Supabase Auth | **Auth.js (NextAuth)** | If you wanted maximum provider flexibility and database independence. Costs more code (build your own UI, manage sessions) — not worth it when email + Google is the entire matrix. |
| Drizzle | **Prisma** | If you wanted the highest-DX option with type-safe migrations and a more "ActiveRecord-y" feel. Prisma 7 (2026) is excellent. But the bundle size and serverless cold-start cost (1100ms → 400ms with Drizzle per published benchmarks) is real on Vercel Functions. Pick Prisma only if the team is already fluent in it. |
| Tailwind v4 + shadcn/ui | **Mantine** or **Chakra UI** | If you needed a richer component library out-of-box with built-in RTL. Both work; both add weight; both make kid-friendly customization harder than copy-paste shadcn primitives. |
| Noto Naskh Arabic | **Cairo as body too** | Cairo for body works if you want a uniformly modern look. It loses fidelity for Tashkeel-heavy passages. Acceptable for Level 1–3 (mostly no Tashkeel anyway); revisit for higher levels. |
| Vitest | **Jest** | Only if you have existing Jest infrastructure or need a specific Jest plugin. New Next.js 16 projects: Vitest, period. |
| Playwright | **Cypress** | If your team has Cypress muscle memory or specifically needs Cypress's time-travel debugger. For new builds in 2026 with RTL visual regression needs, Playwright wins (free parallel, WebKit/Safari coverage, ~40-60% lower CI cost). |
| Biome | **ESLint + Prettier** | If you depend on an ESLint plugin Biome doesn't have (e.g., `eslint-plugin-tailwindcss` class-order checking). Otherwise: Biome. |
| next-intl | **react-i18next** | If you want Translation Management System auto-reporting (`saveMissing`). Not needed at v1 with one locale. |
| Zod v4 | **Valibot** | If you ship validation code to the browser at high frequency and the 16KB → 2KB difference matters. For Qira: validation is mostly server-side (Server Actions), so Zod's ergonomics win. |
| pnpm | **npm** or **bun** | npm is fine but slower. Bun is fast but introduces a second runtime/risk surface; not worth it for v1. |

---

## What NOT to Use

| Avoid | Why | Use Instead |
|-------|-----|-------------|
| **Pages Router (Next.js)** | Deprecated as the default in Next 16. App Router is the standard, has RSC for server-rendered Arabic text (no client JS bloat), and is what shadcn/ui's RTL CLI targets. | App Router (`app/[locale]/...`) |
| **Patching LTR-first design with `rtl:` Tailwind variants everywhere** | Known anti-pattern explicitly called out in PROJECT.md ("RTL is non-negotiable architecturally from day one"). Leads to forgotten-in-mirror bugs (icons, scrollbars, animations) that compound over time. | Set `dir="rtl"` at `<html>`, use Tailwind v4 logical properties (`ps-`, `pe-`, `text-start`), shadcn with `--rtl` flag. |
| **Amiri font for the kid reader body text** | Calligraphic, dense, designed for adult readers of classical texts. Not what 5–7 year olds need to decode at large sizes. | Noto Naskh Arabic (Google-engineered for screen Naskh) |
| **System fonts / Tahoma / Arial for Arabic** | Tashkeel renders poorly: diacritics collide with letters, line-height defaults are wrong, glyphs vary wildly across Windows/Mac/iOS/Android. | Self-host Noto Naskh Arabic + Cairo via `next/font/google` — same render everywhere. |
| **Disabling font-feature-settings / OpenType ligatures** | Arabic is fundamentally a connecting script. Disabling ligatures (e.g., `font-variant-ligatures: none`) breaks letter joining entirely. | Leave defaults alone; only override per-component if a specific issue arises. |
| **Prisma + Vercel Functions without Accelerate** | Cold starts in the 1000ms+ range due to bundle size. Either pay for Prisma Accelerate or accept the latency. | Drizzle ORM (7KB, no Accelerate needed). |
| **Supabase realtime / WebSockets in v1** | Not needed (no live multiplayer reading, no live dashboards). Adds connection overhead and complicates Vercel deployment. | Defer until v2 needs it (e.g., teacher-live-session features). |
| **Storing comprehension question banks as JSON blobs** | Hand-authored questions need editorial tooling. JSON blobs in code make content updates a code deploy. | Postgres tables (`questions`, `question_choices`) with Supabase Studio as the authoring UI for v1. |
| **CSS-in-JS (styled-components, emotion)** | RSC compatibility is fragile, runtime cost, no first-class RTL story. | Tailwind v4 utilities + shadcn. |
| **MUI / Ant Design as the v1 component library** | Heavy bundles, opinionated theming, RTL exists but is not the primary maintenance focus, harder to customize for kid UX. | shadcn/ui (copy-paste, RTL-first via Jan 2026 release). |
| **Edge runtime for v1** | Adds constraints (no Node APIs, no TCP) and complicates Drizzle driver choice. Qira has no edge-runtime requirements. | Standard Vercel Node functions. |
| **Native mobile work in v1** | PROJECT.md explicit out-of-scope. Don't introduce React Native / Expo / Capacitor "just in case." | Web only. Reassess for v2. |
| **An LLM in the runtime path** | PROJECT.md explicit out-of-scope. Rules engine + pre-authored banks only. | Deterministic TypeScript module for placement algorithm; Postgres-stored question banks. |
| **next-i18next** | Not designed for App Router; maintainers steer users elsewhere. | next-intl. |
| **Jest** for new test files | Slow, painful ESM, more config than the project has lines of code. | Vitest. |

---

## Stack Patterns by Variant

**If v2 adds gamification (stars, streaks, badges):**
- Add **Drizzle** tables (`achievements`, `child_streaks`) — no new infra
- Add **date-fns-tz** for correct streak math across diaspora timezones (a US parent and a UK parent see midnight differently)
- Still no new vendor

**If v2 introduces AI read-aloud / pronunciation correction:**
- Re-evaluate edge runtime (Whisper/STT may want streaming)
- Likely add **Vercel AI SDK** for model orchestration
- Probably keep Supabase, add object storage for audio recordings

**If v2 expands to teacher dashboards (B2B):**
- Multi-tenant pattern: add `organizations` table, RLS by `organization_id`
- Drizzle's `crudPolicy()` Supabase RLS helpers shine here
- Consider **Clerk Organizations** at this point — Supabase Auth's org model is weaker

**If you need to support native mobile (v2+):**
- Next.js → React Native bridge is non-trivial. The realistic path is **Expo Router** with a shared schema/types package (Drizzle types reuse), but the UI is rewritten.
- Do not try to make a single codebase work web + native at the cost of compromising v1's web experience.

---

## Version Compatibility

| Package A | Compatible With | Notes |
|-----------|-----------------|-------|
| Next.js 16 | React 19.2 (bundled), TypeScript ≥5.7, Node ≥20 (22 LTS recommended) | Turbopack default. Webpack still available via `--turbopack=false` if a plugin breaks. |
| Tailwind CSS v4 | PostCSS 8+, Vite-compatible | v4 is a major rewrite — Tailwind v3 plugins generally need updates. shadcn/ui has been v4-ready since Q4 2025. |
| Drizzle ORM 0.45.x | drizzle-kit 0.31.x, postgres.js 3.x or @neondatabase/serverless | If you switch to Neon later, swap driver; schema definitions are driver-agnostic. |
| @supabase/ssr | Next.js 13+ App Router | Use this, not the deprecated `@supabase/auth-helpers-nextjs`. |
| next-intl 3.x | Next.js 13+ App Router with RSC | 4.x release-candidate exists; 3.x is the stable choice today. |
| shadcn/ui (post Jan 2026) | Tailwind v4, React 19, Next 15+ | `--rtl` CLI flag requires post-January-2026 version. |
| Vitest 3.x | Node ≥20, ESM-first projects | Works with Next.js 16 via official guide. |
| Biome 2.x | TS 5.x, JSX, JSON | Does NOT lint Tailwind class order (no plugin equivalent); accept this limitation or layer `eslint-plugin-tailwindcss` selectively. |
| Playwright 1.50+ | Node ≥20 | Run in CI with sharding; ~40-60% cheaper than Cypress Cloud at scale. |

---

## Confidence Assessment

| Recommendation | Confidence | Verification Source |
|----------------|------------|----------------------|
| Next.js 16 App Router | **HIGH** | Context7 `/vercel/next.js` + nextjs.org/blog/next-16 + 16.2 release notes |
| Tailwind v4 logical properties for RTL | **HIGH** | Context7 `/websites/tailwindcss` confirms `ps-`, `pe-`, `text-start/end`, `border-s/e` |
| Supabase over Neon for Qira's profile | **HIGH** | Multi-source comparison; Neon better for edge+branching (not Qira's needs), Supabase better for bundled DB+Auth+Storage |
| Supabase Auth over Clerk for parent-only signup | **HIGH** | Multiple 2026 comparisons; consensus is "if you're on Supabase, use Supabase Auth unless you have a UX-specific reason for Clerk" |
| Drizzle over Prisma | **HIGH** | Drizzle docs + 2026 benchmarks; bundle size and cold-start argument is solid for Vercel Functions |
| shadcn/ui `--rtl` flag (Jan 2026) | **HIGH** | shadcn/ui official changelog 2026-01-rtl + creator's announcement |
| Noto Naskh Arabic for body, Cairo for UI | **HIGH** | Google Fonts spec + multiple Arabic typography sources; matches educational publishing convention |
| next-intl for App Router | **HIGH** | next-intl.dev + maintainer guidance + 2026 i18n comparison consensus |
| Vitest over Jest | **HIGH** | Next.js 16 official docs include Vitest guide; community consensus 2026 |
| Playwright over Cypress | **HIGH** | Independent 2026 benchmarks + community shift; WebKit/Safari coverage matters for diaspora iPad users |
| Biome over ESLint+Prettier | **MEDIUM-HIGH** | Speed and DX clear; one caveat — no first-class Tailwind class-order plugin equivalent yet |
| Zod v4 over Valibot | **MEDIUM-HIGH** | Both viable; recommendation hinges on validation being server-side (Server Actions). If validation moves to the browser at scale, reconsider Valibot |
| pnpm over npm/bun | **HIGH** | Industry standard for monorepos and Vercel-deployed projects 2026 |

---

## Sources

### Context7 (HIGH confidence, current docs)
- `/vercel/next.js` — Next.js 16 App Router, Server Components, Turbopack
- `/websites/tailwindcss` — RTL logical properties verified (`ps-`, `pe-`, `text-start/end`, `border-s/e`, `float-start/end`, `clear-start/end`)
- `/supabase/supabase` — Postgres + Auth + Storage platform
- `/drizzle-team/drizzle-orm` — Drizzle ORM 0.45.x current, 1.0-beta roadmap
- `/clerk/clerk-docs` — Clerk auth (considered, not selected for v1)
- `/websites/neon` — Neon serverless Postgres (considered, not selected for v1)

### Official documentation
- [Next.js 16 release notes](https://nextjs.org/blog/next-16) — Turbopack default, React 19.2, React Compiler stable
- [Next.js 16.2 release](https://nextjs.org/blog/next-16-1) — perf improvements
- [Next.js Internationalization guide](https://nextjs.org/docs/app/guides/internationalization) — App Router locale routing
- [Next.js Vitest testing guide](https://nextjs.org/docs/app/guides/testing/vitest) — official Next 16 Vitest setup
- [shadcn/ui RTL announcement (Jan 2026)](https://ui.shadcn.com/docs/changelog/2026-01-rtl) — `--rtl` CLI flag, automatic icon flipping
- [shadcn/ui RTL docs](https://ui.shadcn.com/docs/rtl) — DirectionProvider pattern
- [Tailwind CSS v4 logical property utilities](https://tailwindcss.com/docs/padding) — confirmed `ps-`, `pe-`, etc.
- [next-intl App Router docs](https://next-intl.dev/docs/getting-started/app-router) — Arabic RTL, plural forms
- [Drizzle ORM docs](https://orm.drizzle.team/) — versioning, Supabase RLS helpers
- [Drizzle Latest Releases](https://orm.drizzle.team/docs/latest-releases) — 0.45.x current, 1.0-beta-2
- [Vercel Blob pricing](https://vercel.com/docs/vercel-blob/usage-and-pricing) — $0.023/GB-month storage
- [Noto Naskh Arabic on Google Fonts](https://fonts.google.com/noto/specimen/Noto+Naskh+Arabic) — official spec, screen optimization
- [Amiri on Google Fonts](https://fonts.google.com/specimen/Amiri) — calligraphic, considered then deferred

### WebSearch (MEDIUM confidence, verified against multiple sources)
- [Neon vs Supabase 2026 comparisons](https://www.bytebase.com/blog/neon-vs-supabase/) — multi-vendor comparison consensus
- [Supabase vs Neon Serverless Postgres 2026](https://getautonoma.com/blog/supabase-vs-neon) — feature/pricing analysis
- [Drizzle vs Prisma 2026 benchmarks](https://www.bytebase.com/blog/drizzle-vs-prisma/) — bundle size, cold start data
- [6 Prisma vs Drizzle Patterns — Cold Start 700ms](https://dev.to/jsgurujobs/6-prisma-vs-drizzle-patterns-that-cut-serverless-cold-starts-by-700ms-5dl5) — verified perf claim
- [Auth Stack Guide 2026](https://vibeorigin.dev/auth-stack-guide) — Clerk/Supabase/NextAuth tradeoffs
- [Comparing Auth providers](https://blog.hyperknot.com/p/comparing-auth-providers) — broad survey
- [Vitest vs Jest for Next.js 2026](https://dev.to/whoffagents/vitest-vs-jest-for-nextjs-in-2026-setup-speed-and-when-to-switch-224a) — perf claims and migration paths
- [Playwright vs Cypress 2026](https://getautonoma.com/blog/playwright-vs-cypress) — benchmark data
- [Biome Review 2026](https://trybuildpilot.com/433-biome-review-2026) — perf and DX
- [Zod v4 vs Valibot 2026](https://www.pkgpulse.com/guides/valibot-vs-zod-v4-typescript-validator-2026) — bundle size comparison
- [next-intl vs next-i18next 2026](https://intlpull.com/blog/next-intl-complete-guide-2026) — App Router compatibility
- [TPTQ Arabic: Fonts in children's books](https://tptq-arabic.com/blog/our_fonts_in_childrens_books) — type design for Arabic-reading kids
- [Vercel Blob pricing on X](https://x.com/vercel/status/1925632672488968683) — pricing confirmation

---

*Stack research for: Arabic-first kid web reading app (Qira)*
*Researched: 2026-05-14*
*All recommendations specifically calibrated to PROJECT.md locked constraints (web-only, Vercel+managed-Postgres, no LLM, parent-owned accounts, RTL/Fusha-first).*
