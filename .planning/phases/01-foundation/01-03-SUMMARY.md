---
phase: 01-foundation
plan: 03
slice_name: drizzle-schema-rls
status: complete
completed_date: "2026-05-15"
duration_minutes: 50
tasks_completed: 6
tasks_total: 6
files_created: 7
files_modified: 5
commits: 3
key_decisions:
  - drizzle-orm 0.45.2 does not export crudPolicy from drizzle-orm/supabase; fell back to explicit pgPolicy() 4-entry pattern per Plan 01-03 Task 3.1 fallback
  - Cloud Supabase used as the migration target (no local emulator — Docker unavailable in this WSL distro)
  - src/db/client.ts uses a Proxy-wrapped lazy postgres() so `next build` succeeds without DATABASE_URL in CI
  - Western digits for level labels per RESEARCH §I decision #1 (الرس_توى 1..20, not ١..٢٠)
  - dotenv loaded inside drizzle.config.ts so `drizzle-kit generate` works without a wrapper script
tags:
  - drizzle
  - postgres
  - supabase
  - rls
  - migrations
  - vitest
  - ci
requires:
  - next.js-16-app-router-scaffold
  - vitest-infrastructure
  - biome-lint-format
provides:
  - drizzle-schema-eight-entities
  - rls-coverage-test
  - postgres-js-client-lazy
  - levels-seed-idempotent
  - cloud-migration-applied
affects:
  - slice-4-arabic-text
  - slice-5-playwright
  - slice-6-deploy
  - phase-2-auth
  - phase-3-placement
  - phase-4-reader
tech_stack_added:
  - "drizzle-orm@0.45.2"
  - "drizzle-kit@0.31.10"
  - "postgres@3.4.9"
  - "tsx@4.22.0"
  - "dotenv@17.4.2"
tech_patterns:
  - 4-explicit-pgPolicy-per-table fallback when crudPolicy unavailable
  - UPDATE policy always carries both USING and WITH CHECK (Pitfall 11 satisfied by construction)
  - Proxy-wrapped lazy DB client so build-time imports do not require DATABASE_URL
  - drizzle-kit generate against DIRECT_DATABASE_URL (pgbouncer transaction-mode pooling does not support DDL)
  - Vitest source-scan invariant using `is(v, PgTable)` from drizzle-orm to detect tables at runtime
key_files_created:
  - src/db/schema.ts
  - src/db/client.ts
  - src/db/seed/index.ts
  - drizzle.config.ts
  - drizzle/migrations/0000_workable_trauma.sql
  - drizzle/migrations/meta/_journal.json
  - tests/invariants/rls-coverage.test.ts
key_files_modified:
  - package.json
  - pnpm-lock.yaml
  - .env.example
  - .github/workflows/ci.yml
---

# Phase 1 Plan 03: Drizzle Schema + RLS Summary

**8 Drizzle entities with 32 explicit pgPolicy RLS policies applied to the cloud Supabase project; idempotent 20-level seed; build-time RLS-coverage Vitest test; CI wired with `pnpm build` after Vitest.**

## Performance
- **Duration:** ~50 min
- **Tasks:** 6/6 complete
- **Files created:** 7
- **Files modified:** 5
- **Commits:** 3

## Accomplishments
- Authored `src/db/schema.ts` with 8 entities (`parents`, `child_profiles`, `levels`, `texts`, `questions`, `choices`, `attempts`, `attempt_answers`) totaling 24 columns of business state plus 2 enums.
- Resolved Drizzle 0.45.2's missing `crudPolicy` export by switching to the documented Plan 03 fallback: 4 explicit `pgPolicy` entries per table (SELECT / INSERT / UPDATE / DELETE). UPDATE always emits both USING and WITH CHECK — Pitfall 11 satisfied.
- `child_profiles.age` carries a `CHECK (age BETWEEN 5 AND 12)` table-level constraint.
- Generated `drizzle/migrations/0000_workable_trauma.sql` (8 CREATE TABLE, 8 ENABLE ROW LEVEL SECURITY, 32 CREATE POLICY, 16 WITH CHECK clauses) and applied it to the live Supabase project via `DIRECT_DATABASE_URL`.
- Verified: `SELECT tablename FROM pg_tables ... NOT IN (SELECT tablename FROM pg_policies ...)` returns 0 rows; RLS enabled on all 8 tables.
- `pnpm db:seed` inserts 20 `levels` rows (`المستوى 1` .. `المستوى 20`, NFC-normalized). Idempotent: re-run inserts 0.
- `tests/invariants/rls-coverage.test.ts` walks every `pgTable` via `is(v, PgTable)` + `getTableConfig` and asserts `policies.length > 0` per table. 9 tests pass.
- CI: appended `pnpm build` after the Vitest step.
- `pnpm test:run`: 6 files, 30 tests passing. `pnpm build`: success.

## Task Commits
1. Task 3.1 — drizzle deps + pgPolicy fallback decision — `6a7cb31`
2. Tasks 3.2, 3.3 — schema + drizzle.config + lazy client — `5d46c50`
3. Tasks 3.4, 3.5, 3.6 — migration applied + seed + RLS test + CI build gate — `5674b8c`

## Files Created/Modified
- `src/db/schema.ts` — 8 pgTable definitions with 4-entry pgPolicy RLS each, plus 2 pgEnums and the age check.
- `src/db/client.ts` — Proxy-wrapped lazy `postgres()` driver so build-time imports do not require `DATABASE_URL`.
- `src/db/seed/index.ts` — idempotent 20-level seed with inline NFC.
- `drizzle.config.ts` — uses `DIRECT_DATABASE_URL`; loads `.env.local` via dotenv.
- `drizzle/migrations/0000_workable_trauma.sql` — generated initial migration.
- `tests/invariants/rls-coverage.test.ts` — schema-level FOUND-06 gate.
- `.github/workflows/ci.yml` — `pnpm build` step appended.
- `package.json` — `db:generate`, `db:migrate`, `db:studio`, `db:seed` scripts.
- `.env.example` — local-emulator override block (commented; for future Docker setup).
- `scripts/db-verify.ts` — ad-hoc cloud-DB verifier used during this slice.

## Decisions & Deviations

### D1: crudPolicy unavailable → 4-entry pgPolicy fallback
`drizzle-orm@0.45.2` exports from `drizzle-orm/supabase` are limited to roles + realtime helpers (no `crudPolicy`). Plan 01-03 Task 3.1 anticipated this and prescribed the `pgPolicy` 4-entry pattern as the explicit fallback. Followed it verbatim. `pgPolicy('<table>_update', { using, withCheck })` satisfies Pitfall 11 by construction.

### D2: Cloud Supabase as migration target (no local emulator)
Docker Desktop WSL integration is disabled, so `supabase start` cannot run. The plan's local-emulator path is unavailable. Migration applied directly against the user's cloud Supabase via `DIRECT_DATABASE_URL`. Verified post-apply with `scripts/db-verify.ts`: 8 tables, RLS enabled, 0 uncovered. Plan task 3.6 cross-Supabase verification (`supabase db check`) was originally a "if time permits" suggestion — skipped because Docker is the missing dependency, not time.

### D3: Lazy db client via Proxy
The original client.ts threw at module-load if `DATABASE_URL` was missing. That would break `next build` in CI environments without a runtime DB. Refactored to a Proxy that delegates to a lazy `getDb()` so the connection is opened only on first query. Type signature preserved — callers see the same `db` export.

### D4: dotenv inside drizzle.config.ts
`drizzle-kit generate` (v0.31.x) does not auto-load `.env.local`; only `drizzle-kit migrate` does. Loading dotenv inside `drizzle.config.ts` itself means both commands behave the same and the dev does not need a wrapper script.

## Next Slice Readiness
- Slice 4 (ArabicText + Service Layer skeleton) can import `@/db/schema` types directly (`typeof attempts.$inferSelect`, etc.) and wire the NFC Zod schema to the actual schema columns.
- Slice 5 (SDK allow-list + Playwright baseline) can build on `pnpm build` working in CI.
- Slice 6 (Deploy + Verify) — when the user is ready: link Vercel, mirror `.env.local` keys into Vercel env vars, and `vercel deploy --prod`. The cloud DB is already migrated.
- Phase 3 (Placement) and Phase 4 (Reader+Comprehension) can begin populating `questions`, `choices`, `texts` once content authoring contracts land.

## What is NOT done
- Local Supabase emulator (blocked by Docker availability — environmental, not a planning gap).
- Cloud Supabase project creation/linking (was already done by the user before this session).
- Production env vars in Vercel (Slice 6).
- `supabase` CLI install (skipped — without Docker the CLI cannot start the local stack).
