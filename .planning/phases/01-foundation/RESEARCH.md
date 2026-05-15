# Phase 1 Research: Foundation

**Phase:** 1 — Foundation
**Mode:** mvp (vertical slices)
**Researched:** 2026-05-14
**Confidence:** HIGH on Next.js/Tailwind/Drizzle/Supabase mechanics; MEDIUM on the precise wording of CI grep rules (multiple viable shapes — pick simplest)
**Requirements covered:** FOUND-01..09, COMP-LEGAL-01
**Domain:** RTL-first Arabic web bootstrap + Supabase RLS + CI invariants for a brand-new Next.js 16 monorepo

---

## Summary

Five load-bearing decisions the planner should anchor the plan around:

1. **Use the `app/[locale]/layout.tsx` shape, not flat `app/layout.tsx`** — even with one locale (`ar`) in v1. The `<html lang dir>` belongs in the locale layout; the route segment is "free" infrastructure and Phase 2+ multilingual (if ever) is then a route addition, not a rewrite. This is also the canonical pattern next-intl assumes.
2. **CI gates are the architecture.** Six grep/regex checks (physical-CSS-utility ban, raw-Arabic-outside-`<ArabicText>`, RLS-on-every-public-table, `getSession()` ban, `force-dynamic`-on-authenticated-layouts, SDK-allow-list) are what make every invariant in this phase actually load-bearing through Phases 2–5. Without them, drift is inevitable. They are the single highest-leverage deliverable of Phase 1.
3. **`<bdi>` is the correct wrapper inside `<ArabicText>` — not `<span dir="auto">`.** `<bdi>` performs bidi *isolation* (the content cannot perturb surrounding text direction); `dir="auto"` only sets direction heuristically. For mixed Arabic+Latin tokens like child names and Western digits inside Arabic prose, `<bdi>` is the MDN-recommended primitive.
4. **`next/font/google` self-hosts at build time** — no runtime `fonts.googleapis.com` requests, ever, when invoked correctly. This is the mechanism for FOUND-03 + COMP-LEGAL-01 simultaneously. The CI proof is a Playwright network assertion (zero requests to `fonts.googleapis.com` / `fonts.gstatic.com` during page load), not a manual inspection.
5. **Drizzle `crudPolicy()` (from `drizzle-orm/supabase`) emits RLS in the schema file itself**, co-located with the table definitions — so the schema is the single source of truth for both shape and security. The CI check then becomes "any `pgTable` without a sibling `pgPolicy` is a build failure" rather than a runtime DB query.

**Primary recommendation:** Land all eight tables, all eight CI gates, the `<ArabicText>` primitive, the empty Service Layer skeleton, the locale-segmented App Router, and a deployed "مرحباً" landing page in a single Phase 1. Defer no part of the invariant set — every invariant deferred to Phase 2+ pays interest on retrofit cost.

---

## A. Next.js 16 App Router + RTL bootstrap

### Recommendation: locale-segmented routing even though v1 is Arabic-only

**Route shape:**

```
app/
├── layout.tsx                  # Minimal root: forwards children, NO <html>/<body> here
├── [locale]/
│   ├── layout.tsx              # <html lang="ar" dir="rtl"> lives HERE
│   ├── page.tsx                # "مرحباً بكم في قِراءة" landing
│   └── (authenticated)/
│       └── layout.tsx          # Placeholder for Phase 2 — has force-dynamic
└── api/                        # /api/v1/... (Phase 5)
```

> Note: Next.js 15+ App Router places `<html>` and `<body>` in **the root `app/layout.tsx`** by spec. The "lang/dir lives in [locale]/layout.tsx" pattern works because the locale layout *re-renders* `<html lang dir>` — but you can ALSO put it in root `app/layout.tsx` and read the locale param via async server APIs. **Both are viable; pick one and document it.** The next-intl docs use the **root-layout reads locale-from-params** shape. See "Implementation detail" below.

**Implementation detail (next-intl 3.x canonical pattern):**

```tsx
// app/[locale]/layout.tsx
import { notFound } from 'next/navigation';
import { Noto_Naskh_Arabic, Cairo } from 'next/font/google';

const naskh = Noto_Naskh_Arabic({
  subsets: ['arabic'],
  weight: ['400', '500', '700'],         // Tashkeel-bearing weights
  variable: '--font-naskh',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],          // 'latin' needed only for fallback chars; safe to drop if pure-Arabic UI
  weight: ['400', '600', '700'],
  variable: '--font-cairo',
  display: 'swap',
});

const SUPPORTED_LOCALES = ['ar'] as const;
type Locale = (typeof SUPPORTED_LOCALES)[number];

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  if (!SUPPORTED_LOCALES.includes(locale)) notFound();

  return (
    <html
      lang={locale}
      dir="rtl"                          // hardcoded for v1 — Arabic-only. When v2 adds locales, derive from locale.
      className={`${naskh.variable} ${cairo.variable}`}
    >
      <body className="font-naskh antialiased">
        {children}
      </body>
    </html>
  );
}
```

**Key points the planner must enforce:**
- `params` is a **Promise** in Next.js 15+ (async dynamic APIs). Any task that destructures `params` must `await` it.
- `dir="rtl"` is **hardcoded**, not derived. v1 is Arabic-only; locking the value prevents silent direction-toggling regressions.
- `font-naskh` is set on `<body>` as the **default** body font (not `font-sans`). This overrides Tailwind's default and prevents Inter from leaking through any unstyled element.
- `next/font/google` downloads font files at build time and self-hosts them — **no `fonts.googleapis.com` request happens at runtime**, which satisfies FOUND-03 + COMP-LEGAL-01 simultaneously.

### `app/globals.css` — font precedence

```css
@import "tailwindcss";          /* Tailwind v4: single import, no @tailwind base/components/utilities */

@theme {
  --font-naskh: "var(--font-naskh)", "Noto Naskh Arabic", "Segoe UI", system-ui, sans-serif;
  --font-cairo: "var(--font-cairo)", "Cairo", system-ui, sans-serif;
  --font-sans: var(--font-naskh);   /* Tailwind's default font-sans now resolves to Naskh */
}

@layer base {
  html, body {
    font-family: var(--font-naskh);
    line-height: 1.8;             /* Pitfall #2 — Tashkeel clipping */
  }

  /* Banned in Arabic: justification breaks Tashkeel rhythm and Kashida is inconsistent across browsers */
  body {
    text-align: start;            /* logical — RTL gives right-align */
    text-rendering: optimizeLegibility;
  }

  /* Reader-specific overrides will go in <ArabicText size="reader"> styles */
}
```

> The single most important line is `--font-sans: var(--font-naskh);` — this is what prevents Tailwind's `font-sans` default from silently substituting Inter (which has no Arabic glyphs). Per `STACK.md`, this is the documented prevention for the "Inter leaks in" trap.

### Why locale-segmented routing now (not flat)?

| Option | Pro | Con |
|--------|-----|-----|
| **Flat `app/layout.tsx` with hardcoded `<html dir="rtl" lang="ar">`** | Simplest; one file | When/if v2 multilingual happens, every route moves under `[locale]/` — a mechanical but tedious refactor touching every page |
| **`[locale]` segment, even with one locale** ✅ | next-intl integrates cleanly; v2 multilingual is a route-addition not a rewrite; matches Vercel/Next docs' canonical i18n pattern | One extra path segment in dev URLs (`/ar/page` not `/page`); requires `middleware.ts` to handle root redirect |

PROJECT.md "Out of Scope" lists multilingual as v2+, **but next-intl is already in the locked stack** explicitly to "leave an open door" for v2. The locale segment is the seam.

**Root redirect middleware:**

```ts
// middleware.ts
import createMiddleware from 'next-intl/middleware';

export default createMiddleware({
  locales: ['ar'],
  defaultLocale: 'ar',
  localePrefix: 'always',    // /ar/... — explicit, never silent
});

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
};
```

A visitor to `/` is redirected to `/ar/`. This is invisible to the user and the test asserts the redirect chain ends at a `/ar/*` page.

---

## B. Tailwind v4 RTL: logical properties

### Migration table — what is forbidden and what to use

| Forbidden (physical) | Required (logical) | Notes |
|----------------------|--------------------|-------|
| `ml-*`, `mr-*` | `ms-*`, `me-*` | margin inline-start / inline-end |
| `pl-*`, `pr-*` | `ps-*`, `pe-*` | padding inline-start / inline-end |
| `text-left`, `text-right` | `text-start`, `text-end` | text-align |
| `border-l-*`, `border-r-*` | `border-s-*`, `border-e-*` | border-inline-start / end |
| `rounded-l-*`, `rounded-r-*`, `rounded-tl-*`, `rounded-tr-*`, `rounded-bl-*`, `rounded-br-*` | `rounded-s-*`, `rounded-e-*`, `rounded-ss-*`, `rounded-se-*`, `rounded-es-*`, `rounded-ee-*` | border-radius corner-start / corner-end |
| `left-*`, `right-*` | `start-*`, `end-*` | inset-inline-start / end (positioning) |
| `float-left`, `float-right` | `float-start`, `float-end` | float |
| `clear-left`, `clear-right` | `clear-start`, `clear-end` | clear |
| `inset-l-*`, `inset-r-*` (if used) | `inset-s-*`, `inset-e-*` | shorthand inset |

> **Diagonals (`border-x-*`, `border-y-*`, `inset-x-*`, `inset-y-*`, `mx-*`, `my-*`, `px-*`, `py-*`) are direction-neutral and are permitted.** Only the single-side physical variants are forbidden.

### CI enforcement — recommended approach

**Biome 2.x has no Tailwind class-order plugin equivalent** (this is the documented gap from STACK.md). Three viable enforcement shapes; pick option (a):

**Option (a) — Project-local ripgrep script in CI** (RECOMMENDED — simplest):

Add a script `scripts/lint-rtl.sh`:

```bash
#!/usr/bin/env bash
# Fails if any src/ or app/ file uses a physical-direction Tailwind utility.
set -euo pipefail

PATTERN='\b(ml|mr|pl|pr|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|left|right|float-left|float-right|clear-left|clear-right|text-left|text-right)-[0-9a-z\[\]]+\b|(\bml-|\bmr-|\bpl-|\bpr-|\btext-left\b|\btext-right\b|\bfloat-left\b|\bfloat-right\b)'

# Search JSX/TSX/CSS files; ignore node_modules + tests fixtures
if rg --type-add 'web:*.{tsx,ts,jsx,js,css}' -t web --no-messages "$PATTERN" src/ app/ 2>/dev/null; then
  echo "ERROR: Physical-direction Tailwind utility found. Use logical properties (ms-*, pe-*, text-start, etc.)"
  exit 1
fi
echo "OK: No physical-direction utilities."
```

Run as a step in CI (GitHub Actions) before `pnpm build`. Cost: one shell file, ~5 lines of YAML.

**Option (b) — Vitest source scan as a test:**

```ts
// tests/invariants/rtl-utilities.test.ts
import { glob } from 'tinyglobby';
import { readFile } from 'node:fs/promises';
import { expect, test } from 'vitest';

const FORBIDDEN = /\b(ml|mr|pl|pr|text-left|text-right|float-left|float-right|border-l|border-r|rounded-(l|r|tl|tr|bl|br))-?\w*/g;

test('no physical-direction Tailwind utilities in source', async () => {
  const files = await glob(['src/**/*.{ts,tsx,css}', 'app/**/*.{ts,tsx,css}']);
  const offenders: Array<{ file: string; matches: string[] }> = [];
  for (const f of files) {
    const content = await readFile(f, 'utf8');
    const matches = content.match(FORBIDDEN);
    if (matches) offenders.push({ file: f, matches });
  }
  expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
});
```

Pro: integrated into `pnpm vitest run`; runs alongside other tests. Con: slightly slower than ripgrep.

**Option (c) — `eslint-plugin-tailwindcss` layered selectively:**

Run ESLint *only* for the no-restricted-classnames rule, side-by-side with Biome. Most overhead; rejected for solo-build.

**Planner default: Option (a) + Option (b).** Both are cheap and the regex is identical; (a) gives fast pre-commit feedback, (b) gives a test artifact in CI logs. The verification step in plans should check both.

### shadcn/ui `--rtl` flag (post-January-2026 release)

The January 2026 shadcn/ui release added a first-class `--rtl` init flag and a `<DirectionProvider>` from Radix. What it does:

- Scaffolds components with `start`/`end` logical classes by default (not `left`/`right`)
- Auto-flips inherently-directional icons via `rtl:rotate-180` (chevrons, arrows)
- Wraps the root in a `<DirectionProvider dir="rtl">` so Radix primitives (Dropdown, Tooltip, Popover) position correctly
- Slide animations use `slide-in-from-start` not `slide-in-from-left`

**Phase 1 invocation:**

```bash
pnpm dlx shadcn@latest init --rtl
```

> Without `--rtl`, shadcn scaffolds the LTR-default components. Running it RTL-aware later means manually flipping every primitive — exactly the retrofit cost Phase 1 exists to prevent.

**After init**, Phase 1 should add ONE shadcn primitive (e.g., `button`) to verify the scaffold works through the full RTL stack, then defer all other shadcn components to Phase 2+ where they are actually needed.

---

## C. Drizzle ORM + Supabase RLS

### Schema scaffold for FOUND-05's eight tables

Single file: `src/db/schema.ts`. Shape (not full definitions):

```ts
import { pgTable, uuid, text, integer, timestamp, smallint, pgEnum, primaryKey, jsonb } from 'drizzle-orm/pg-core';
import { authUsers, crudPolicy, authenticatedRole } from 'drizzle-orm/supabase';

// Enums
export const attemptKind = pgEnum('attempt_kind', ['placement', 'reading']);
export const questionKind = pgEnum('question_kind', ['placement', 'comprehension']);

// 1. parents — 1:1 with auth.users (Pitfall 15 — vendor lock-in insulation)
export const parents = pgTable('parents', {
  id: uuid('id').primaryKey().references(() => authUsers.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  // RLS: parent can read/update only their own row
  policy: crudPolicy({
    role: authenticatedRole,
    read: sql`(SELECT auth.uid()) = ${table.id}`,
    modify: sql`(SELECT auth.uid()) = ${table.id}`,
  }),
}));

// 2. child_profiles — owned by a parent
export const childProfiles = pgTable('child_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  parentId: uuid('parent_id').notNull().references(() => parents.id, { onDelete: 'cascade' }),
  displayName: text('display_name').notNull(),
  age: smallint('age').notNull(),                    // CHECK 5..12 — see §I open question
  gradeBand: text('grade_band').notNull(),
  currentLevelId: uuid('current_level_id').references(() => levels.id),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  policy: crudPolicy({
    role: authenticatedRole,
    read: sql`(SELECT auth.uid()) = ${table.parentId}`,
    modify: sql`(SELECT auth.uid()) = ${table.parentId}`,
  }),
}));

// 3. levels — global reference table, RLS allows authenticated read
export const levels = pgTable('levels', {
  id: uuid('id').primaryKey().defaultRandom(),
  number: smallint('number').notNull().unique(),     // 1..20
  nameAr: text('name_ar').notNull(),
  descriptionAr: text('description_ar'),
}, (table) => ({
  policy: crudPolicy({
    role: authenticatedRole,
    read: sql`true`,
    modify: sql`false`,                              // levels are seed-only; admin-managed via service role
  }),
}));

// 4. texts — leveled passages, global read for authenticated users
export const texts = pgTable('texts', {
  id: uuid('id').primaryKey().defaultRandom(),
  levelId: uuid('level_id').notNull().references(() => levels.id),
  titleAr: text('title_ar').notNull(),              // NFC-normalized at write — §D
  bodyAr: text('body_ar').notNull(),                // NFC-normalized at write
  wordCount: integer('word_count').notNull(),
  genre: text('genre'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  policy: crudPolicy({
    role: authenticatedRole,
    read: sql`true`,
    modify: sql`false`,
  }),
}));

// 5. questions — placement or comprehension; can be text-scoped or level-scoped
export const questions = pgTable('questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  kind: questionKind('kind').notNull(),
  textId: uuid('text_id').references(() => texts.id),     // null for placement
  levelId: uuid('level_id').references(() => levels.id),  // null for comprehension
  promptAr: text('prompt_ar').notNull(),                  // NFC-normalized
  questionType: text('question_type').notNull(),          // 'literal' | 'vocab' | 'inferential' | 'predictive'
  position: integer('position').notNull(),
}, (table) => ({
  policy: crudPolicy({
    role: authenticatedRole,
    read: sql`true`,
    modify: sql`false`,
  }),
}));

// 6. choices — answer options; NOTE: correct_index is here but RLS still allows read
//    Server-authoritative scoring (Pitfall 5 / ARCHITECTURE.md Pattern 2) means the Service Layer
//    NEVER SELECTS correctIndex in queries that hydrate UI — only in scoring queries.
//    The CI grep against Service Layer code is what enforces this, NOT RLS.
export const choices = pgTable('choices', {
  id: uuid('id').primaryKey().defaultRandom(),
  questionId: uuid('question_id').notNull().references(() => questions.id, { onDelete: 'cascade' }),
  textAr: text('text_ar').notNull(),                       // NFC-normalized
  position: smallint('position').notNull(),
  isCorrect: integer('is_correct').notNull().default(0),   // 0/1; column name 'is_correct' — searchable in CI
}, (table) => ({
  policy: crudPolicy({
    role: authenticatedRole,
    read: sql`true`,                                       // ← This is intentional. Server Layer code MUST not select isCorrect into UI props.
    modify: sql`false`,
  }),
}));

// 7. attempts — unified placement + reading; parent-owned via child_id chain
export const attempts = pgTable('attempts', {
  id: uuid('id').primaryKey().defaultRandom(),
  childId: uuid('child_id').notNull().references(() => childProfiles.id, { onDelete: 'cascade' }),
  kind: attemptKind('kind').notNull(),
  textId: uuid('text_id').references(() => texts.id),
  assignedLevelId: uuid('assigned_level_id').references(() => levels.id),
  score: integer('score'),
  startedAt: timestamp('started_at', { withTimezone: true }).defaultNow().notNull(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
}, (table) => ({
  // Parent owns the child owns the attempt — RLS via subquery
  policy: crudPolicy({
    role: authenticatedRole,
    read: sql`EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = ${table.childId} AND cp.parent_id = (SELECT auth.uid()))`,
    modify: sql`EXISTS (SELECT 1 FROM child_profiles cp WHERE cp.id = ${table.childId} AND cp.parent_id = (SELECT auth.uid()))`,
  }),
}));

// 8. attempt_answers — one row per question answer
export const attemptAnswers = pgTable('attempt_answers', {
  id: uuid('id').primaryKey().defaultRandom(),
  attemptId: uuid('attempt_id').notNull().references(() => attempts.id, { onDelete: 'cascade' }),
  questionId: uuid('question_id').notNull().references(() => questions.id),
  chosenChoiceId: uuid('chosen_choice_id').notNull().references(() => choices.id),
  isCorrect: integer('is_correct').notNull(),
  answeredAt: timestamp('answered_at', { withTimezone: true }).defaultNow().notNull(),
}, (table) => ({
  policy: crudPolicy({
    role: authenticatedRole,
    read: sql`EXISTS (SELECT 1 FROM attempts a JOIN child_profiles cp ON cp.id = a.child_id WHERE a.id = ${table.attemptId} AND cp.parent_id = (SELECT auth.uid()))`,
    modify: sql`EXISTS (SELECT 1 FROM attempts a JOIN child_profiles cp ON cp.id = a.child_id WHERE a.id = ${table.attemptId} AND cp.parent_id = (SELECT auth.uid()))`,
  }),
}));
```

### `crudPolicy()` — how it works

`crudPolicy` is a Drizzle helper exported from `drizzle-orm/supabase` (Supabase-specific RLS sugar). It generates four standard Postgres policies in one call: SELECT, INSERT, UPDATE (with `WITH CHECK`), DELETE. The `read` expression becomes the `USING` clause of SELECT/DELETE; the `modify` expression becomes both the `USING` of UPDATE and the `WITH CHECK` of INSERT/UPDATE. **This satisfies Pitfall 11's "every UPDATE has both `USING` and `WITH CHECK`" rule by construction.**

The policies are emitted as part of the generated migration when you run `drizzle-kit generate`.

> **Source:** Drizzle ORM docs — `drizzle-orm/supabase` module. `crudPolicy` is the Supabase-specific RLS helper added in Drizzle 0.36+. Confirm exact import path during Phase 1 with a Context7 lookup at `/drizzle-team/drizzle-orm` topic "supabase rls policies" — the helper exists per multiple 2026 community references but the exact symbol name may be `crudPolicy` or `pgPolicy` depending on version.

### Migration toolchain

```bash
# Generate migration from schema diff
pnpm drizzle-kit generate

# Apply to local Supabase emulator (started with `supabase start`)
pnpm drizzle-kit migrate

# Inspect with Studio
pnpm drizzle-kit studio
```

`drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,  // pooler URL for runtime; direct URL for migrations
  },
  verbose: true,
  strict: true,
});
```

### Driver: `postgres.js` 3.x on Node runtime (Pitfall 13)

```ts
// src/db/client.ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL!;

// For Vercel serverless: pooler URL (...pooler.supabase.com:6543) + transaction-mode
const client = postgres(connectionString, {
  prepare: false,             // required for transaction-mode pooling
  max: 1,                     // one connection per function invocation
});

export const db = drizzle(client, { schema });
```

> **Rationale:** Edge Runtime is out for v1 (PROJECT.md / ARCHITECTURE.md — "Edge runtime for v1: adds constraints; do not"). `postgres.js` 3.x on standard Vercel Node functions is the documented Drizzle+Supabase pattern.

### CI check shape: "no `pgTable` without sibling policy"

A Vitest test that imports the schema module and asserts every exported `pgTable` has policies attached:

```ts
// tests/invariants/rls-coverage.test.ts
import { describe, test, expect } from 'vitest';
import * as schema from '@/db/schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

describe('RLS coverage', () => {
  const tables = Object.values(schema).filter((v) => typeof v === 'object' && '$inferSelect' in (v as object));

  for (const table of tables) {
    test(`table ${getTableConfig(table as any).name} has RLS policy`, () => {
      const config = getTableConfig(table as any);
      expect(config.policies, `Table ${config.name} is missing RLS policies`).toBeDefined();
      expect(config.policies.length, `Table ${config.name} has no policies`).toBeGreaterThan(0);
    });
  }
});
```

This runs at `pnpm vitest run` time, costs nothing, and is the FOUND-06 gate.

> **Belt-and-suspenders:** Optionally add a SQL-level check that runs against the live Supabase migration: `SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN (SELECT tablename FROM pg_policies WHERE schemaname = 'public');`. Phase 1 plan can include this as a `supabase db check` script if time permits, but the Vitest schema-level check is the load-bearing one because it catches drift at build time, not deploy time.

---

## D. NFC normalization

### Where to normalize: at the Drizzle insert/update boundary via a typed transform

**Pattern (recommended):**

A small wrapper in `src/db/normalize.ts`:

```ts
/**
 * NFC-normalizes any string fields marked as Arabic.
 * Called by the Service Layer before any insert/update.
 */
export function nfc<T extends Record<string, unknown>>(obj: T, fields: (keyof T)[]): T {
  const out = { ...obj };
  for (const f of fields) {
    if (typeof out[f] === 'string') {
      (out as Record<string, unknown>)[f] = (out[f] as string).normalize('NFC');
    }
  }
  return out;
}
```

Used in Service Layer:

```ts
// src/services/library.ts (Phase 4 will populate; Phase 1 stubs)
import { nfc } from '@/db/normalize';

export async function insertText(input: NewText) {
  const normalized = nfc(input, ['titleAr', 'bodyAr']);
  return db.insert(texts).values(normalized).returning();
}
```

### Why NFC, not NFKC

| Form | What it does | Suitable for Arabic? |
|------|--------------|----------------------|
| **NFC** ✅ | Canonical Decomposition followed by Canonical Composition. Combines decomposable sequences (e.g., letter + combining mark) into their pre-composed form. **Preserves Tashkeel** because Tashkeel marks are canonical combining characters and recompose to a stable single-codepoint sequence. | YES — recommended |
| NFD | Decomposes only. Produces letter + combining-mark sequences. Visually identical to NFC but storage is unstable across sources. | No — write inconsistency |
| NFKC | Canonical Decomposition + **Compatibility** Composition + canonical recomposition. Compatibility decomposition collapses presentation-form variants (e.g., Arabic Presentation Forms-A and -B) into their basic letters. **Can destroy intentional Tashkeel-bearing glyph forms** if author used presentation-form codepoints. | NO — risk of data loss |
| NFKD | NFKC's decomposed cousin. Same risks. | No |

> **Bottom line:** NFC is the "round-trip safe" form that normalizes copy-paste variance from Word/PDF/web without ever altering visible content. NFKC is appropriate for search-index normalization (where you WANT presentation forms collapsed) but NOT for primary storage.

### Where to enforce: Zod refinement at the Service Layer, NOT a DB CHECK constraint

**Recommendation:**

```ts
// src/lib/zod.ts
import { z } from 'zod';

export const ArabicText = z.string().min(1).refine(
  (s) => s.normalize('NFC') === s,
  { message: 'Arabic text must be NFC-normalized' }
);
```

Server Actions and Route Handlers parse input through Zod schemas that use `ArabicText`. The refinement fires *before* the insert. The `nfc()` helper *also* runs at the DB write boundary as a belt-and-suspenders — but Zod is the user-facing validation point with a clear error message.

**Why not a DB `CHECK` constraint:**

```sql
-- This would work but errors are opaque ("violates check constraint")
ALTER TABLE texts ADD CONSTRAINT body_ar_is_nfc CHECK (body_ar = normalize(body_ar, NFC));
```

Pros: DB-level guarantee.
Cons: Postgres's `normalize()` function exists (Postgres 13+) but error messages are unhelpful; the Service Layer needs to validate before submit anyway for UX reasons; doubling the check at both layers is wasteful.

**Verdict:** Zod refinement at the Service Layer. Add a code comment in `src/db/schema.ts` next to `bodyAr`, `titleAr`, `promptAr`, `textAr` (choices) pointing to `ArabicText` Zod schema.

---

## E. ArabicText primitive

### Component shape

```tsx
// src/components/arabic-text.tsx
import { cn } from '@/lib/utils';
import type { ComponentPropsWithoutRef } from 'react';

interface ArabicTextProps extends ComponentPropsWithoutRef<'span'> {
  size?: 'reader' | 'ui' | 'caption';
  diacritics?: 'show' | 'hide';
  as?: 'span' | 'p' | 'h1' | 'h2' | 'h3';
}

export function ArabicText({
  size = 'ui',
  diacritics = 'show',
  as: Tag = 'span',
  className,
  children,
  ...rest
}: ArabicTextProps) {
  const sizeClass = {
    reader: 'font-naskh text-xl leading-[1.9]',           // line-height 1.9 for Tashkeel-heavy
    ui:     'font-cairo text-base leading-[1.6]',
    caption:'font-cairo text-sm leading-[1.5]',
  }[size];

  const diacriticsClass = diacritics === 'hide'
    ? '[font-feature-settings:"liga"_off]'                // optional — UI-level toggle
    : '';

  return (
    <Tag
      lang="ar"
      className={cn(sizeClass, diacriticsClass, className)}
      {...rest}
    >
      <bdi>{children}</bdi>
    </Tag>
  );
}
```

> **The `<bdi>` is non-negotiable.** Per MDN: `<bdi>` ("bidirectional isolation") tells the browser to treat the contained text as a self-contained directional unit. This is the correct primitive for inserting potentially-mixed content (Arabic with embedded names, numbers, brand strings) inside a surrounding Arabic flow. `<span dir="auto">` only sets direction *heuristically* based on first strong character — it does NOT isolate, so a Latin-leading name fragment can perturb the surrounding sentence.

### Where it lives

`src/components/arabic-text.tsx`. Imported from `@/components/arabic-text`.

### CI rule: every Arabic literal goes through `<ArabicText>`

**Approach:** Scan source files for the Arabic Unicode block (U+0600–U+06FF) appearing as a JSX literal child of any element OTHER than `<ArabicText>` or one of its compositions.

This is non-trivial to express as a pure regex (would need to inspect JSX AST). Pragmatic shape:

**Option (a) — Regex heuristic** (RECOMMENDED for Phase 1):

```bash
# scripts/lint-arabic-wrapper.sh
# Fails on any .tsx file with an Arabic character NOT inside ArabicText/i18n message keys.
# Heuristic: any JSX text node matching /[؀-ۿ]/ that is NOT a direct child of ArabicText.
# Naive grep — flags candidates; human reviews.

set -euo pipefail
OFFENDERS=$(rg --type tsx '[؀-ۿ]' src/ app/ --no-heading --line-number || true)

if [[ -n "$OFFENDERS" ]]; then
  echo "Found Arabic literals in source. Verify each is inside <ArabicText> or i18n message catalog:"
  echo "$OFFENDERS"
  # Soft fail (warn) in Phase 1, hard fail in Phase 4 once content is established
  exit 0
fi
```

> **Honest constraint:** A regex cannot reliably distinguish `<p>{أهلاً}</p>` (bad) from `<ArabicText>{أهلاً}</ArabicText>` (good). The pragmatic v1 approach is a **soft warning** in CI that prints all Arabic-literal locations, with code-review enforcement. A hard AST-level check (using `@typescript-eslint/parser` walking JSX trees) is correct but adds tooling weight not yet justified in Phase 1.

**Option (b) — JSX AST scan in Vitest** (RECOMMENDED for Phase 4 when content lands):

Use `@babel/parser` to walk `.tsx` files, find JSXText nodes containing Arabic, and assert their parent JSXElement name is `ArabicText`. Defer to Phase 4.

**Phase 1 plan should ship Option (a).** Tasks that compose `<ArabicText>` should rely on TypeScript types + code review to catch misuse; the regex is a backstop, not a gate.

---

## F. Service Layer skeleton

### What the Service Layer is (recap from ARCHITECTURE.md)

A directory of plain TypeScript modules under `src/services/*.ts`:

- **No `next/*` imports** (mobile-readiness invariant)
- All domain logic, all authorization checks, all Zod validation
- Called identically from Server Actions (`'use server'`) and from Route Handlers (`app/api/v1/*`)

### Phase 1 modules — stubs only, no implementations

```
src/services/
├── profiles.ts         # Phase 2 will implement
├── library.ts          # Phase 4 will implement
├── comprehension.ts    # Phase 4 will implement
└── placement.ts        # Phase 3 will implement
```

**Stub shape — `src/services/placement.ts`:**

```ts
import { z } from 'zod';
import type { db } from '@/db/client';

const RecordAnswerInput = z.object({
  childId: z.string().uuid(),
  questionId: z.string().uuid(),
  chosenChoiceId: z.string().uuid(),
});

interface RecordAnswerResult {
  done: boolean;
  nextQuestionId?: string;
  assignedLevelNumber?: number;
}

/**
 * Records a placement answer. Implementation in Phase 3.
 * @throws NotImplementedError — stub for Phase 1 scaffolding.
 */
export async function recordPlacementAnswer(
  input: z.infer<typeof RecordAnswerInput>
): Promise<RecordAnswerResult> {
  RecordAnswerInput.parse(input);
  throw new Error('placement.recordPlacementAnswer: not implemented until Phase 3');
}
```

**Stub shape — `src/services/profiles.ts`:**

```ts
export async function requireParent(): Promise<{ parentId: string }> {
  throw new Error('profiles.requireParent: not implemented until Phase 2');
}

export async function requireActiveChild(): Promise<{ parentId: string; childId: string }> {
  throw new Error('profiles.requireActiveChild: not implemented until Phase 2');
}

export async function listChildProfiles(parentId: string) {
  throw new Error('profiles.listChildProfiles: not implemented until Phase 2');
}
```

Other modules follow the same pattern: typed function signatures, throw a clear `Error` with the phase that will implement it.

> **Why stubs and not "to be created"?** Phase 1 establishes the *shape* of the Service Layer (file paths, export names, return types) so that Phase 2 onwards is pure implementation, never refactoring. Type-only stubs that `throw` are the cheapest way to lock the shape.

> **CI invariant — no `next/*` imports:** Add a Vitest test that imports every file in `src/services/` and asserts none import from `next/*`:
>
> ```ts
> // tests/invariants/service-layer-purity.test.ts
> import { readFileSync } from 'node:fs';
> import { glob } from 'tinyglobby';
> import { test, expect } from 'vitest';
>
> test('Service Layer has no next/* imports', async () => {
>   const files = await glob('src/services/**/*.ts');
>   const offenders = files.filter((f) => /from ['"]next\//.test(readFileSync(f, 'utf8')));
>   expect(offenders).toEqual([]);
> });
> ```

---

## G. SDK allow-list + force-dynamic + same-origin fonts

### `src/lib/sdk-allowlist.ts`

```ts
/**
 * The complete list of third-party origins authorized to receive network requests
 * from child-facing routes. Enforced by Playwright network audit (see /tests/e2e/network-audit.spec.ts).
 *
 * COMP-LEGAL-01 — no third-party SDKs on child-facing routes other than these.
 *
 * Adding to this list requires:
 *   1. Documenting WHY in this file (purpose, data sent, retention, sub-processors)
 *   2. Updating /docs/sdk-inventory.md (Phase 5 — for now this file IS the inventory)
 *   3. Confirming the origin is not a behavioral-tracking surface
 */
export const ALLOWED_ORIGINS = [
  // Supabase project URL — read from env, hostname is project-specific
  // e.g., 'https://abcdefgh.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  // Same-origin (Vercel deployment URL + custom domain) — covered implicitly by Playwright
] as const;

export const ALLOWED_HOST_PATTERNS = [
  /\.supabase\.co$/,
  /\.supabase\.in$/,        // staging Supabase region
] as const;
```

### Enforcement: Playwright network audit

```ts
// tests/e2e/network-audit.spec.ts
import { test, expect } from '@playwright/test';
import { ALLOWED_HOST_PATTERNS } from '@/lib/sdk-allowlist';

test('child-facing routes make zero requests to non-allowlisted origins', async ({ page }) => {
  const violations: string[] = [];
  const ownOrigin = new URL(page.url() || 'http://localhost:3000').host;

  page.on('request', (req) => {
    const host = new URL(req.url()).host;
    if (host === ownOrigin) return;
    if (ALLOWED_HOST_PATTERNS.some((p) => p.test(host))) return;
    violations.push(`${req.method()} ${req.url()}`);
  });

  await page.goto('/ar/');
  await page.waitForLoadState('networkidle');
  expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
});
```

> **Belt-and-suspenders for forbidden hosts:** Explicit assertion that `fonts.googleapis.com` and `fonts.gstatic.com` get zero requests on the deployed shell. This is the FOUND-03 + COMP-LEGAL-01 cross-gate.

### `force-dynamic` on every authenticated layout

**Pattern:**

```tsx
// app/[locale]/(authenticated)/layout.tsx — Phase 1 ships this as a stub
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  // Phase 2 will add: getUser() check, redirect to /sign-in if not authed
  return <>{children}</>;
}
```

> **Why ship it in Phase 1 if there's no auth yet?** Because the CI grep below depends on the file existing. Phase 1 establishes the route group `(authenticated)` and the `force-dynamic` declaration; Phase 2 fills in the auth logic. This is the highest-leverage defense-in-depth against Pitfall 12 — by the time Phase 2 adds Supabase auth, the cookie-leak prevention is already structurally in place.

### CI grep for `force-dynamic`

```bash
# scripts/lint-force-dynamic.sh
# Fails if any layout.tsx under app/**/(authenticated)/ is missing force-dynamic.

set -euo pipefail
EXPECTED='export const dynamic = .force-dynamic.'

mapfile -t LAYOUTS < <(find app -path '*/(authenticated)/*' -name 'layout.tsx')

for layout in "${LAYOUTS[@]}"; do
  if ! grep -qE "$EXPECTED" "$layout"; then
    echo "ERROR: $layout missing 'export const dynamic = \"force-dynamic\"'"
    exit 1
  fi
done
echo "OK: All authenticated layouts have force-dynamic."
```

### Self-hosted fonts confirmation (FOUND-03)

`next/font/google` downloads font files at build time into the Next.js static asset pipeline. At runtime, browser requests go to `https://<your-domain>/_next/static/media/<font-hash>.woff2` — **same-origin, no third-party**. The Playwright network audit in this section is the runtime proof; no manual inspection needed.

> Confirm in Phase 1 by running the deployed shell, opening DevTools Network tab, filtering to "Font", and asserting all results have `Initiator: <your-domain>` and Origin in the same set. This is also what the Playwright assertion automates.

---

## H. Playwright RTL visual baseline + CI gates

### Playwright config — two viewports × two browsers

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    locale: 'ar-SA',                    // browser locale hint, not site locale
    timezoneId: 'Asia/Riyadh',
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'], viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'chromium-mobile',
      use: { ...devices['Pixel 5'] },   // ~393×851
    },
    {
      name: 'webkit-mobile',
      use: { ...devices['iPhone 13'] }, // ~390×844
    },
  ],
  webServer: process.env.CI ? undefined : {
    command: 'pnpm dev',
    port: 3000,
    reuseExistingServer: true,
  },
});
```

> **WebKit specifically matters** because diaspora users on iPads/iPhones run WebKit, not Chromium. Per PITFALLS.md: "Safari/WebKit coverage matters for diaspora iPad users." Excluding WebKit means RTL/Tashkeel bugs visible to ~30% of the target audience ship undetected.

### Visual regression baseline — `tests/e2e/rtl-baseline.spec.ts`

```ts
import { test, expect } from '@playwright/test';

test('home page renders RTL with Arabic body font, no fonts.googleapis.com requests', async ({ page }) => {
  const fontHostsHit: string[] = [];
  page.on('request', (req) => {
    const host = new URL(req.url()).host;
    if (host === 'fonts.googleapis.com' || host === 'fonts.gstatic.com') {
      fontHostsHit.push(req.url());
    }
  });

  await page.goto('/ar/');
  await page.waitForLoadState('networkidle');

  // 1. <html> has correct attributes
  await expect(page.locator('html')).toHaveAttribute('dir', 'rtl');
  await expect(page.locator('html')).toHaveAttribute('lang', 'ar');

  // 2. No Google Fonts hot-link requests
  expect(fontHostsHit, JSON.stringify(fontHostsHit)).toEqual([]);

  // 3. Body uses Naskh font (computed style)
  const bodyFont = await page.evaluate(() =>
    window.getComputedStyle(document.body).fontFamily
  );
  expect(bodyFont).toMatch(/Naskh/i);

  // 4. Visual baseline
  await expect(page).toHaveScreenshot('home-rtl.png', {
    fullPage: true,
    maxDiffPixelRatio: 0.01,
  });
});
```

Run `pnpm playwright test --update-snapshots` once on a known-good build; commit baselines to `tests/e2e/__screenshots__/`.

### CI workflow shape (GitHub Actions)

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v3
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile

      # Static invariants — fast feedback
      - run: pnpm biome ci .
      - run: pnpm tsc --noEmit
      - run: bash scripts/lint-rtl.sh
      - run: bash scripts/lint-force-dynamic.sh

      # Unit + integration tests (includes RLS-coverage, service-layer-purity)
      - run: pnpm vitest run

      # E2E — RTL baseline + network audit
      - run: pnpm playwright install --with-deps
      - run: pnpm build
      - run: pnpm playwright test
```

**Phase 1 success criterion: this CI passes on the first commit that includes a "مرحباً" landing page.**

---

## I. Open decisions for the planner to surface

These are decisions the plan should make explicitly in Phase 1 (with the recommended default), so Phase 2+ doesn't get stuck:

| # | Decision | Recommended default | Where it lives |
|---|----------|---------------------|----------------|
| 1 | Digit convention (UI chrome and content) | **Western (0–9)** per STATE.md / PITFALLS.md diaspora-leaning default | `src/lib/config.ts` constant `DIGIT_STYLE = 'western' as const`; revisit per UI phase |
| 2 | Auth provider | **Supabase Auth**, schema-wise: `parents.id` is a UUID FK to `auth.users.id` with `ON DELETE CASCADE`. This is the path of least resistance; matches STACK; reuses Supabase RLS naturally. | `src/db/schema.ts` — `parents.id` already references `authUsers.id` per §C scaffold |
| 3 | Locale routing | **`app/[locale]/...` with `next-intl` middleware**, even though v1 is Arabic-only. Section A covers this. | `app/[locale]/layout.tsx` + `middleware.ts` + `i18n.ts` (next-intl config) |
| 4 | `force-dynamic` scope | **Apply to `app/[locale]/(authenticated)/layout.tsx` only** in Phase 1 (placeholder route group). Phase 1 has no authenticated routes yet, but ships the route group + layout + dynamic flag so Phase 2 adds Supabase logic into a structurally-correct skeleton. | `app/[locale]/(authenticated)/layout.tsx` |
| 5 | Tashkeel default in `<ArabicText>` | **`diacritics="show"` is the default**; matches Levels 1–10 reading default. Phase 4 will add per-text override. | `src/components/arabic-text.tsx` default prop |
| 6 | NFC enforcement layer | **Zod refinement at Service Layer + `nfc()` helper at DB boundary**. Section D explains why this beats DB CHECK constraints. | `src/lib/zod.ts` (Zod schema) + `src/db/normalize.ts` (helper) |
| 7 | Age validation for `child_profiles.age` | **CHECK constraint at DB level: `age BETWEEN 5 AND 12`**, also enforced at Zod boundary. Belt-and-suspenders. | `src/db/schema.ts` table-level check |
| 8 | Drizzle vs Prisma final lock | **Drizzle 0.45.x** per STACK.md. Confirmed; no decision pending. | `package.json` |
| 9 | Drizzle 1.0-beta vs 0.45.x | **0.45.x stable.** 1.0-beta is viable per STACK.md but adds risk on a foundation phase. | `package.json` |
| 10 | Font weight subsets | **Noto Naskh: 400, 500, 700. Cairo: 400, 600, 700.** Three weights per family is the minimum for readable type hierarchy without bloating the font payload. | `app/[locale]/layout.tsx` font imports |
| 11 | shadcn primitive scope for Phase 1 | **Init only + one verification primitive (Button)**. Defer the rest to Phase 2+. Phase 1's deployed shell is a landing page; one button proves the `--rtl` flag works end-to-end. | `components/ui/button.tsx` (shadcn-generated) |
| 12 | Privacy notice page existence | **Out of Phase 1.** COMP-LEGAL-03 (Privacy Notice page) is mapped to Phase 2 in REQUIREMENTS.md traceability. Phase 1 does NOT need it. | n/a |
| 13 | Seed script in Phase 1 | **Empty seed script that creates the 8 tables, inserts 20 `levels` rows (level numbers 1–20 with placeholder Arabic names), and exits.** No texts, no questions in Phase 1 — those are Phase 3 (placement) and Phase 4 (reader) content. | `src/db/seed/index.ts` |
| 14 | `.env.example` shape | Ship: `DATABASE_URL` (pooler), `DIRECT_DATABASE_URL` (for migrations), `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (server-only). | `.env.example` |
| 15 | Cookie-leak E2E test in Phase 1 | **Defer to Phase 2** (where actual auth exists). Phase 1's CI is grep + Playwright RTL baseline; the cross-user E2E is Phase 2 territory. | `tests/e2e/cross-user.spec.ts` (Phase 2) |

---

## J. Phase 1 task surface (for the planner's vertical slicing)

For the MVP-mode planner: Phase 1 is not a "feature" slice — it is an **infrastructure slice that ends in a single deployable artifact**: a Vercel URL that returns an Arabic landing page passing every CI invariant. Suggested vertical slices (each runnable end-to-end):

| Slice | What ships | Demo gate |
|-------|------------|-----------|
| **Slice 1.1 — Repo + RTL bootstrap** | Next.js 16 scaffold, `app/[locale]/layout.tsx` with fonts + `<html lang dir>`, Tailwind v4, `globals.css`, "مرحباً" landing page | `pnpm dev` shows Arabic page; DevTools shows `<html lang="ar" dir="rtl">` |
| **Slice 1.2 — Lint + invariant CI** | Biome config, `scripts/lint-rtl.sh`, `scripts/lint-force-dynamic.sh`, GitHub Actions workflow, Vitest setup | CI fails on a deliberately-bad PR (adds `ml-2`) and passes on the main branch |
| **Slice 1.3 — Drizzle schema + RLS** | `src/db/schema.ts` with all 8 tables and `crudPolicy`, `drizzle.config.ts`, first migration, seed script for `levels`, Supabase local emulator wired | `pnpm drizzle-kit migrate` against `supabase start` succeeds; Vitest `rls-coverage.test.ts` passes |
| **Slice 1.4 — `<ArabicText>` + Service Layer skeleton** | `src/components/arabic-text.tsx`, four stub modules in `src/services/`, NFC helper + Zod schema, Service Layer purity Vitest test | Landing page renders "مرحباً" through `<ArabicText>`; purity test passes |
| **Slice 1.5 — SDK allow-list + Playwright baseline** | `src/lib/sdk-allowlist.ts`, `tests/e2e/network-audit.spec.ts`, `tests/e2e/rtl-baseline.spec.ts`, Playwright config | All 4 Playwright projects (chromium-desktop, webkit-desktop, chromium-mobile, webkit-mobile) green; no `fonts.googleapis.com` requests |
| **Slice 1.6 — Deploy + verify** | Vercel project linked, env vars set, first deploy, `(authenticated)` route group + force-dynamic placeholder | Live Vercel URL passes all five Phase 1 success criteria |

> The planner will adjust granularity but the **slices must end in runnable artifacts** (per MVP mode). Slices 1.1, 1.4, 1.6 each produce a deployable page; Slices 1.2, 1.3, 1.5 produce CI gates that must pass on the existing page.

---

## Sources

### Primary (HIGH confidence — Context7 + official docs already cited in STACK.md)
- Context7 `/vercel/next.js` — Next.js 16 App Router, async `params`, route groups
- Context7 `/websites/tailwindcss` — v4 logical property utilities (`ps-`, `pe-`, `text-start`, `border-s`, `rounded-s`, `start-*`, `end-*`, `float-start`)
- Context7 `/drizzle-team/drizzle-orm` — `crudPolicy` import from `drizzle-orm/supabase`; `pgPolicy` for custom policies
- Context7 `/supabase/supabase` — RLS, `auth.uid()`, transaction-mode pooling at `pooler.supabase.com:6543`
- [Next.js Internationalization docs](https://nextjs.org/docs/app/guides/internationalization) — `[locale]` segment + middleware pattern
- [next-intl App Router setup](https://next-intl.dev/docs/getting-started/app-router) — canonical `[locale]/layout.tsx` shape with async `params`
- [shadcn/ui RTL announcement (Jan 2026)](https://ui.shadcn.com/docs/changelog/2026-01-rtl) — `--rtl` CLI flag, `DirectionProvider`, auto icon flipping
- [MDN: `<bdi>` element](https://developer.mozilla.org/en-US/docs/Web/HTML/Element/bdi) — bidi isolation semantics; the correct primitive for mixed-script content
- [MDN: String.prototype.normalize](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/String/normalize) — NFC vs NFD vs NFKC vs NFKD semantics
- [next/font docs](https://nextjs.org/docs/app/api-reference/components/font) — build-time self-hosting, no runtime third-party requests
- `/home/ziyad/Qira/.planning/research/ARCHITECTURE.md` — Service Layer pattern, route group split, `<ArabicText>` primitive
- `/home/ziyad/Qira/.planning/research/PITFALLS.md` — Pitfalls 1, 2, 3, 6, 11, 12 (RTL, Tashkeel, Bidi, SDK leaks, RLS, SSR cache)
- `/home/ziyad/Qira/.planning/research/STACK.md` — locked stack picks

### Secondary (MEDIUM confidence — community/blog consensus on 2026 patterns)
- Multiple Drizzle + Supabase + Next 15+ integration guides (orm.drizzle.team/docs/rls + Supabase community forum) — `crudPolicy` helper pattern
- [Supabase SSR Advanced Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide) — `force-dynamic` requirement on authenticated routes
- [Tailwind v4 logical properties — official guide](https://tailwindcss.com/docs/padding) — confirms `ps-*`/`pe-*` are first-class

### Tertiary / Inferred (LOW confidence — flagged for Phase 1 verification)
- Exact `crudPolicy` symbol name in Drizzle 0.45.x — confirm via Context7 lookup during Phase 1 (could be `crudPolicy` or `pgPolicy` depending on version pinned)
- Whether Cairo's Tashkeel rendering at weight 400 is acceptable at UI sizes — confirm with a designer/literacy review during Phase 1 (per STACK.md Open Items)
- Biome 2.x compatibility with the Tailwind v4 class-order plugin gap — the bash script in §B is the recommended workaround; verify no Biome plugin has shipped since Jan 2026

---

## Metadata

**Confidence breakdown:**
- App Router + RTL bootstrap: **HIGH** — official Next.js + next-intl docs are canonical
- Tailwind v4 logical properties: **HIGH** — confirmed in Context7
- Drizzle + Supabase RLS via `crudPolicy`: **MEDIUM-HIGH** — confirmed pattern but exact symbol name should be verified at implementation time
- NFC normalization: **HIGH** — Unicode standard + MDN
- `<ArabicText>` primitive shape: **HIGH** — MDN `<bdi>` + ARCHITECTURE.md
- Service Layer skeleton: **HIGH** — ARCHITECTURE.md is explicit
- SDK allow-list + Playwright network audit: **HIGH** — Playwright API is stable
- CI gate regex shapes: **MEDIUM** — multiple viable regexes; pick the simplest

**Research date:** 2026-05-14
**Valid until:** 2026-08-14 (stack is stable; revisit if Next.js 17 or Drizzle 1.0 ships)
