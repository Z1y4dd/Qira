# Phase 1 Plan Check — 2026-05-14

## Verdict: PASS-WITH-CONCERNS

The plan will achieve the five ROADMAP success criteria as written, with the caveat that **one CI executability gap (Task 5.6) needs to be patched before/during execution** or the final E2E run on Vercel cannot pass. All ten Phase 1 requirements (FOUND-01..09 + COMP-LEGAL-01) have at least one delivering task with a runnable verification. The vertical-slice discipline holds end-to-end. Two cosmetic accuracy issues (task count mis-stated, "8 gates" prose) and two minor executability flags (CI server-start, pnpm-ci-script collision) are tractable for the executor without re-planning.

## Goal-backward analysis (5 success criteria)

### Criterion 1: Deployed shell shows `<html lang="ar" dir="rtl">`, Noto Naskh body + Cairo UI loaded same-origin, no `fonts.googleapis.com` requests

- **Coverage:** FULLY COVERED
- **Delivered by:**
  - Slice 1: Tasks 1.3 (fonts via `next/font/google` self-host), 1.4 (next-intl middleware → `/ar/` route), 1.5 (`/ar/` landing page exists), 1.7 (shadcn Button proves the Cairo chrome path)
  - Slice 5: Tasks 5.4 (`network-audit.spec.ts` — zero Google Fonts hosts), 5.5 (`rtl-baseline.spec.ts` — `<html dir/lang>` + body computed font matches `/Naskh/i`)
  - Slice 6: Task 6.4 (run all 4 Playwright projects against the live Vercel URL via `PLAYWRIGHT_BASE_URL`)
- **Verified by:**
  - `pnpm e2e --project=chromium-desktop tests/e2e/rtl-baseline.spec.ts` (and 3 other projects)
  - `curl -s https://qira-<hash>.vercel.app/ar/ | grep -E 'lang="ar"|dir="rtl"'`
  - Manual DevTools Network audit (Task 6.4)
- **Concerns:**
  - **Snapshot platform-sensitivity.** Task 5.5 commits initial baselines from the executor's local machine, but CI runs on Ubuntu. Without an explicit `pnpm e2e:update-snapshots` step *in CI on the first run*, the first PR will fail screenshot diff. Task 5.5 notes this risk but the planned mitigation is "update locally and commit"; if the executor's host font rendering differs from Ubuntu's, the first CI run will fail. **Mitigation hint:** generate baselines via a one-off CI job or `act` locally; or run `--update-snapshots` against the deployed URL after Task 6.4.

### Criterion 2: `pnpm build` blocked by CI on any physical-direction Tailwind utility OR any public-schema table missing RLS

- **Coverage:** FULLY COVERED
- **Delivered by:**
  - RTL half: Slice 2 Tasks 2.2 (`scripts/lint-rtl.sh`) + 2.3 (Vitest mirror `rtl-utilities.test.ts`) + 2.6 (workflow runs both)
  - RLS half: Slice 3 Task 3.6 (`tests/invariants/rls-coverage.test.ts` via `getTableConfig`)
  - Deliberately-bad branch demo: Slice 2 Task 2.6 verification step + Slice 2 Demo Gate
- **Verified by:**
  - `bash scripts/lint-rtl.sh` (CI step)
  - `pnpm test:run` includes `rls-coverage.test.ts` (one assertion per `pgTable`)
  - `demo/bad-rtl` PR with `ml-2` makes the workflow fail (Demo Gate, plan-02 line 33)
- **Concerns:**
  - **`getTableConfig` may or may not surface `pgPolicy()`-emitted policies the same way it surfaces `crudPolicy()`.** Task 3.1 picks a fallback path; if `pgPolicy` is chosen, Task 3.6's test assertion `config.policies.length > 0` *must* still detect policies. RESEARCH §C lines 466–488 is cited as the source but neither RESEARCH nor the plan verifies the fallback path empirically. The plan's task 3.6 will pass for `crudPolicy`; the `pgPolicy` codepath is a latent verification risk.

### Criterion 3: Every Arabic-rendering route uses `<ArabicText>`; verified by Playwright RTL screenshot baseline (Chromium + WebKit, desktop + mobile)

- **Coverage:** FULLY COVERED (in Phase 1's narrow surface)
- **Delivered by:**
  - Slice 4 Tasks 4.1 (primitive with `<bdi>`), 4.3 (landing page wired through `<ArabicText as="h1" size="reader">`)
  - Slice 5 Task 5.5 (visual baseline on 4 projects)
  - Slice 2 Task 2.5 (soft-warn `lint-arabic-wrapper.sh` for forward enforcement)
- **Verified by:**
  - `pnpm e2e` across 4 projects; `tests/e2e/__screenshots__/home-rtl-*.png` baselines committed
  - `grep -c '<bdi>' src/components/arabic-text.tsx` returns 1 (Task 4.1 verification)
- **Concerns:**
  - Phase 1 has exactly one Arabic-rendering literal (the welcome heading). "Every" is trivially satisfied; the FOUND-04 invariant is forward-protected only by the soft-warn (exit 0 + print). That is the deliberate Phase 1 scope choice — documented honestly in SKELETON.md line 61 and plan-02 Task 2.5 comments. **Not a blocker** because the upgrade path to AST-level enforcement in Phase 4 is explicit.

### Criterion 4: Seed script populates Drizzle entities; Arabic text NFC-normalized server-side before insert

- **Coverage:** FULLY COVERED
- **Delivered by:**
  - Schema: Slice 3 Task 3.2 (8 `pgTable` definitions), 3.4 (migration generated + applied locally), 3.5 (`pnpm db:seed` populates 20 levels)
  - NFC enforcement: Slice 4 Task 4.2 (Zod `ArabicText` refinement + `nfc()` helper), 4.5 (unit tests for both)
  - Phase 1 seed: inline `.normalize('NFC')` (transitional shortcut — plan-03 Task 3.5 line 116 explicitly notes Zod-mediated path lands in Slice 4)
  - Live verification: Slice 6 Task 6.2 (migration + seed against cloud DB)
- **Verified by:**
  - `pnpm test:run` → `tests/unit/zod-arabic-text.test.ts` + `tests/unit/nfc-normalize.test.ts` green
  - `psql "$DIRECT_DATABASE_URL" -c "SELECT count(*) FROM levels"` returns `20`
- **Concerns:**
  - `tests/unit/zod-arabic-text.test.ts` (plan-04 line 178) has a self-guarded codepath: "if (nfd === nfd.normalize('NFC')) { return; }" — meaning if the chosen ALEF+FATHA pair happens to be NFC-stable, the negative-case assertion silently passes without testing anything. The author flagged this but did not provide a known-NFD-only pair. **Minor.** Recommend swapping in a known-bad pair like `U+0622` (ALEF WITH MADDA ABOVE) vs `U+0627 U+0653` (ALEF + MADDA combining), where decomposed form differs from NFC.

### Criterion 5: `force-dynamic` declared on every authenticated layout (defense-in-depth before Phase 2 auth); network audit shows zero non-Supabase non-same-origin SDK requests

- **Coverage:** FULLY COVERED
- **Delivered by:**
  - force-dynamic: Slice 1 Task 1.6 (placeholder `app/[locale]/(authenticated)/layout.tsx`) + Slice 2 Task 2.4 (`scripts/lint-force-dynamic.sh` — fails if zero authenticated layouts OR any missing the export)
  - SDK allow-list: Slice 5 Tasks 5.1 (`src/lib/sdk-allowlist.ts` — Supabase-only) + 5.2 (Vitest shape test) + 5.4 (Playwright network-audit on `/ar/`)
  - Live proof: Slice 6 Task 6.4 (manual DevTools confirmation + Playwright on the live URL)
- **Verified by:**
  - `bash scripts/lint-force-dynamic.sh` (CI step)
  - `pnpm e2e tests/e2e/network-audit.spec.ts` across 4 projects
- **Concerns:** none

## Plan-quality findings

| Check | Result | Detail |
|-------|--------|--------|
| Task count | actual **36** | vs claimed **31** in PLAN.md line 122 and Phase summary table line 28 → 122. The planner summary's "36" was correct; PLAN.md's "31" is wrong. Slices break down: 1=8, 2=6, 3=6, 4=5, 5=6, 6=5 = 36. |
| Atomic commits | mostly pass | One borderline: plan-03 Task 3.4 (Wire Supabase emulator + generate migration + apply migration + edit `.env.example` + add 6 scripts) is a wide commit. Defensible because the demo gate requires all of it to land together. Plan-01 Task 1.1 also large (scaffold + tsconfig strict + next.config flag). All other tasks are clean 1:1. |
| Vertical slices end in runnable artifacts | pass | Slice 1: `pnpm dev` renders `/ar/`. Slice 2: CI demo (good + bad branch). Slice 3: `pnpm db:seed` + emulator running. Slice 4: `<ArabicText>` on landing page + tests green. Slice 5: 4 Playwright projects green locally. Slice 6: live Vercel URL passing all 5 criteria. All six slices satisfy the MVP-mode "ends in a runnable artifact" rule. |
| Linear dependency claim accurate | pass | All `depends_on` arrays are transitive-closed and chained: 02→[01], 03→[01,02], 04→[01,02,03], 05→[01..04], 06→[01..05]. The "linear 1→6, no parallelism" claim is enforced by the frontmatter. |
| All 13 RESEARCH §I decisions wired into tasks | pass-with-note | RESEARCH §I actually has **15** decisions, not 13. PLAN.md "Decisions locked" table only enumerates 1–13. Decisions 14 (`.env.example` shape — covered in plan-01 Task 1.8) and 15 (cookie-leak E2E deferred to Phase 2 — noted in SKELETON.md line 50–54) ARE wired/honored, just not in PLAN.md's table. Nothing is silently dropped; the table is just under-counted. |
| Random requirements spot-check (3 reqs) | pass | **FOUND-04** (ArabicText primitive used everywhere): plan-04 Task 4.1 creates it, 4.3 wires landing page, soft-warn protects forward — trivially full in Phase 1 (one literal exists). **FOUND-06** (RLS via `crudPolicy()` + CI gate): plan-03 Task 3.2 (policies on every table) + 3.6 (Vitest assertion). Latent risk if `pgPolicy` fallback chosen (see Criterion 2 concerns). **FOUND-08** (Service Layer no `next/*`): plan-04 Task 4.4 (4 stub files) + 4.5 (purity test). All three fully closed in code or via verifiable assertion. |
| FOUND-04 soft-warn callout is honest | pass | Explicit in three places: SKELETON.md line 61 (deferred to Phase 4), plan-02 Task 2.5 comments (lines 141, 149, 155 — "Phase 1: soft fail. Phase 4 will harden to exit 1"), PLAN.md line 28 ("as a soft warning in Phase 1"). The plan does not silently weaken FOUND-04 — it acknowledges the deferred AST-level enforcement and documents the upgrade path. |
| 8 CI gates each have a task | concern | PLAN.md line 28 lists eight gates but **only 7 fire in Phase 1**. The "getSession() use" gate has no Phase 1 task — it cannot, because no auth code exists yet to scan. SKELETON.md correctly defers `getUser()`/`getClaims()`/`getSession()` to Phase 2 (line 50). PLAN.md's phase-summary prose claim "fails the build on any violation of the eight architectural gates" overstates Phase 1's scope. Not a blocker (the gate is genuinely deferred, not silently dropped); but the prose should say "seven enforced in Phase 1; eighth lands in Phase 2 with auth." |

## Executability red flags

1. **CI Playwright step has no web server.** `playwright.config.ts` (RESEARCH §H line 879) sets `webServer: process.env.CI ? undefined : { ... }` — so in CI the config does NOT start `pnpm dev`. Plan-05 Task 5.6 then runs `pnpm build` followed by `pnpm e2e` with only `PLAYWRIGHT_BASE_URL: http://localhost:3000` in env, but nothing actually starts a Node server on port 3000 in CI. The E2E step will fail with connection refused. **Fix in execution:** either (a) change the workflow to `pnpm start &` + `npx wait-on http://localhost:3000` before `pnpm e2e`, or (b) change `playwright.config.ts` to keep `webServer` enabled in CI with `command: 'pnpm start'`. This needs to be patched before the first CI green or Slice 5 will not actually demonstrate its demo gate end-to-end.

2. **Snapshot baseline platform mismatch.** Task 5.5 commits baselines from the executor's local OS, but CI runs Ubuntu. The `maxDiffPixelRatio: 0.01` (1%) is tight for font anti-aliasing variance across macOS/Windows/Linux. First CI run will likely fail. **Fix in execution:** generate baselines inside a Docker Ubuntu image matching the GitHub Actions runner (e.g., `mcr.microsoft.com/playwright:v1.50.0-focal`), or generate them via a one-off CI workflow with `--update-snapshots` and commit the result back.

3. **`pnpm ci` script vs pnpm built-in collision.** Plan-02 Task 2.1 defines `"ci": "biome ci ."` and Task 2.6 invokes `run: pnpm ci`. pnpm has a built-in `ci` alias for `install --frozen-lockfile`. User scripts in `package.json` *do* take precedence, but the collision is documented as a risk in Task 2.6 itself without being resolved. **Fix in execution:** rename the script to `lint:ci` or `biome:ci` to remove ambiguity. Single character change; low risk.

4. **Context7/MCP availability for Task 3.1.** Plan-03 Task 3.1 instructs the executor to use `mcp__context7__resolve-library-id` to verify the exact `crudPolicy` symbol. If MCP is unavailable the plan provides a `ctx7@latest` CLI fallback — good. But if the executor is running without either, the schema author goes ahead blind. **Fix in execution:** even with neither available, the executor can read the installed `node_modules/drizzle-orm/supabase/index.d.ts` directly post-`pnpm add`. Plan should mention this as a third fallback.

5. **`tests/unit/zod-arabic-text.test.ts` self-guarded NFC negative test.** Plan-04 line 180 has `if (nfd === nfd.normalize('NFC')) return;` — the negative-case test silently no-ops if the chosen codepoint pair happens to be NFC-stable. **Fix in execution:** swap to a known-decomposable pair, e.g., compare `'آ'` (NFC ALEF-WITH-MADDA) against `'آ'` (decomposed ALEF + MADDA combining). The test should fail-loud rather than skip-silent.

6. **Manual Vercel + Supabase steps in Slice 6 are correctly human-gated.** Plan-06 frontmatter sets `autonomous: false` and the Checkpoint section lists Tasks 6.1/6.3/6.4 as human-in-loop. **No fix needed** — the plan handles this honestly.

7. **`pnpm dlx shadcn@latest init --rtl` requires a post-January-2026 shadcn release.** Plan-01 Task 1.7 + STACK.md note the flag exists. Today's date in CLAUDE.md is 2026-05-14, so this is post-release. **Not a blocker**, but worth a sanity `pnpm dlx shadcn@latest --version` before invocation in case the CLI shape has drifted again.

## Recommendation

**PASS-WITH-CONCERNS** — plan is ready for `/gsd-execute-phase 1` if the executor:

1. **Patches the CI workflow during Slice 5 Task 5.6** to actually start a server (`pnpm start &` + `wait-on`, OR set `webServer` in `playwright.config.ts` to be defined in both local AND CI modes). Without this, Slice 5's CI demo gate cannot pass and Slice 6 cannot deploy.
2. **Generates Playwright baselines on Ubuntu (Docker or one-off CI)** rather than committing local-host baselines, OR pre-emptively re-runs `--update-snapshots` from CI after the first failed run.
3. **Renames `"ci": "biome ci ."` to `"lint:ci"` or `"biome:ci"`** to avoid the pnpm built-in shadow.
4. **Swaps the NFC negative-test codepoint pair in `zod-arabic-text.test.ts`** to a known-decomposable pair so the test cannot silently no-op.

These are mechanical edits during execution, not re-planning. The PLAN.md task-count number (31) should also be corrected to 36 and the "8 gates" prose softened to "7 enforced in Phase 1; 8th lands in Phase 2 with auth," but those are documentation hygiene, not execution blockers.

If the executor will be running unattended (no human to patch CI), reclassify as **NEEDS-REPLAN** for Slice 5 Task 5.6 only (the server-start gap is silent failure). For an attended/iterative execution, **PASS-WITH-CONCERNS** is the right call.
