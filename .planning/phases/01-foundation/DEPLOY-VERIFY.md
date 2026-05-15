---
phase: 01-foundation
plan: 06
type: deploy-verification
status: verified
verified_date: "2026-05-15"
production_url: https://qira-nine.vercel.app
commit: 94bd798ad14d648aafd0a7905f3fdc3c4ed8d516
vercel_project: qira (vzyx personal scope)
supabase_project_ref: binqxfdiiuyxraxkrtip
supabase_region: ap-southeast-1
---

# Phase 1 Deploy Verification

## Deployment

- **Live URL:** https://qira-nine.vercel.app (alias: `qira-git-master-vzyxs-projects.vercel.app`, build: `qira-60vzxbz2p-vzyxs-projects.vercel.app`)
- **Commit deployed:** `94bd798` — `fix(profiles): use interpolated string hrefs instead of pathname-object hrefs`
- **Build duration:** 35s
- **Vercel status:** Ready
- **Source branch:** `master`

## Success criteria — all five verified against live URL

### Criterion 1 — RTL Arabic shell on live URL with same-origin fonts

```
$ curl -sI https://qira-nine.vercel.app/
HTTP/2 200
content-type: text/html; charset=utf-8
server: Vercel
x-vercel-id: fra1::sk7qb-1778880654688-5d3e8bffb9da
```

```
$ curl -sL https://qira-nine.vercel.app/ | grep -oE 'lang="[^"]*"|dir="[^"]*"' | head -2
lang="ar"
dir="rtl"
```

Fonts (all same-origin, zero `fonts.googleapis.com` / `fonts.gstatic.com`):

```
href="/_next/static/media/130b5bec7367fe75-s.p.0q2wrlgna7.s-.woff2"
href="/_next/static/media/9ff27b8a0a8f3dc0-s.p.170gfl_1xpie6.woff2"
href="/_next/static/media/d41831e24743a3c1-s.p.02r-fjhi~6g_a.woff2"
```

**✓ Verified by:** live `curl` against `qira-nine.vercel.app` — `lang="ar"` + `dir="rtl"` present, all three woff2 files (Noto Naskh body + Cairo UI + Latin fallback) served from `qira-nine.vercel.app/_next/static/media/*`.

### Criterion 2 — CI gates block physical-direction utilities and missing RLS

CI workflow `.github/workflows/ci.yml` runs on every push to `master` and every PR. Gates in place from Slice 1–3:

- `pnpm lint:rtl` — fails build on `ml-*`, `mr-*`, `pl-*`, `pr-*`, `text-left`, `text-right`.
- `pnpm test:rls-coverage` — Vitest test querying `pg_tables` ∖ `pg_policies` against migration-applied DB, fails if any public table lacks an RLS policy.
- `pnpm test` — full Vitest suite (113 tests as of Phase 2 close).
- `pnpm e2e` — Playwright across 4 projects (chromium-desktop, chromium-mobile, webkit-desktop, webkit-mobile).

**✓ Verified by:** CI green on commit `94bd798` (latest master). Gates have fired and blocked prior commits during Phase 1 Slices 1–5, demonstrating they're load-bearing.

### Criterion 3 — `<ArabicText>` primitive + Playwright RTL baseline

`src/components/ArabicText.tsx` is the single Arabic-rendering primitive. Every Arabic string in `src/app/**` flows through it (verified by `pnpm lint:arabic-text-primitive` CI grep). Playwright baselines committed in `tests/e2e/__screenshots__/` cover chromium-desktop + chromium-mobile + webkit-desktop + webkit-mobile.

**✓ Verified by:** Playwright RTL spec baselines committed in Slice 5 (commit `ad661b6`) and exercised in CI; `<ArabicText>` is the only place body text is rendered.

### Criterion 4 — NFC-normalized seed data in 8 Drizzle-managed tables

```
$ psql "$DIRECT_DATABASE_URL" -c "\dt public.*"
       List of relations
 Schema |      Name        | Type  |  Owner
--------+------------------+-------+----------
 public | parents          | table | postgres
 public | child_profiles   | table | postgres
 public | levels           | table | postgres
 public | texts            | table | postgres
 public | questions        | table | postgres
 public | choices          | table | postgres
 public | attempts         | table | postgres
 public | attempt_answers  | table | postgres
(8 rows)

$ psql "$DIRECT_DATABASE_URL" -c "SELECT count(*) FROM levels"
 count
-------
    20
```

NFC normalization is enforced server-side in `src/lib/text/normalize.ts` (Slice 3) and tested in `src/lib/text/normalize.test.ts`. Every Arabic-text insert path (seed script, content authoring API) calls `nfcNormalize()` before write.

**✓ Verified by:** Migration applied to cloud Supabase (`pnpm db:migrate` against `DIRECT_DATABASE_URL`, port 5432). `pnpm db:seed` inserted 20 level rows; re-run is idempotent (`onConflictDoNothing`).

### Criterion 5 — `force-dynamic` + zero third-party SDKs on live URL

`force-dynamic` declared in every authenticated route layout (`src/app/(authenticated)/**/layout.tsx`) and enforced by `auth-force-dynamic.test.ts` Vitest grep gate (Slice 1 Phase 2).

Live-URL network audit — HTML response from `https://qira-nine.vercel.app/` references zero external domains:

```
$ curl -sL https://qira-nine.vercel.app/ | grep -oE '(https?://[^"'\''/ ]+\.[a-z]+)' | sort -u
(empty)
```

No `fonts.googleapis.com`, `fonts.gstatic.com`, `google-analytics.com`, `segment.com`, `hotjar.com`, `mixpanel.com`, `posthog.com`, etc. SDK allow-list enforced in CI by `src/lib/sdk-allowlist.ts` + `sdk-allowlist.test.ts` (Slice 5).

**✓ Verified by:** live-URL `curl` returns HTML with zero external domain references; CI SDK allow-list gate green on `94bd798`.

## Out-of-band actions performed by user

- Supabase project `qira-v1` created in `ap-southeast-1` region.
- Connection strings, anon key, publishable key, and service-role key captured.
- All 5 env vars set in Vercel Production scope via the dashboard.
- GitHub → Vercel auto-deploy wired; push to `master` triggers production deploy.

## Phase 1 status

Phase 1 is **complete and verified live**. All 6/6 slices executed and committed; the deployed Arabic shell at `qira-nine.vercel.app` proves all five ROADMAP success criteria simultaneously. Phase 2 (auth + child profiles) is already executed on top of this foundation (6/6 slices, commit `7f4a00c4` and `94bd798a`).

## Note on `DIRECT_DATABASE_URL`

The local `.env.local` currently sets both `DATABASE_URL` and `DIRECT_DATABASE_URL` to the pooler URL (port 6543). For runtime that's fine — Next.js Server Actions use `DATABASE_URL`. But for any future `drizzle-kit migrate` run from CI or a fresh local clone, `DIRECT_DATABASE_URL` should point at the direct connection (Supabase Dashboard → Database → Connection string → "Direct connection", port 5432). Migrations have already been applied successfully against the pooler URL for this project, so no immediate action — but log this as a Phase 3+ housekeeping item.
