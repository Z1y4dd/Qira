---
phase: 3
slug: placement-vertical
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-16
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 3.x (unit + integration); Playwright 1.50+ (E2E) |
| **Config file** | `vitest.config.ts`, `playwright.config.ts` |
| **Quick run command** | `pnpm test:unit -- src/services/placement.test.ts` (single algorithm file) |
| **Full suite command** | `pnpm test && pnpm test:e2e` |
| **Estimated runtime** | Unit ~10s, integration ~30s, Playwright ~90s |

---

## Sampling Rate

- **After every task commit:** Run targeted Vitest file for the task's surface (algorithm task → `placement.test.ts`; migration task → `pnpm db:verify` post-push)
- **After every plan wave:** Run `pnpm test` (full Vitest) + relevant Playwright spec
- **Before `/gsd-verify-work`:** Full suite must be green AND `pnpm typecheck` AND `pnpm lint`
- **Max feedback latency:** 30 seconds for unit, 90 seconds for E2E

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD | TBD | 0 | PLAC-01..08 | — | Wave 0 test stubs and fixtures | unit | `pnpm test:unit` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PLAC-01 | — | assignLevel() returns deterministic level for combinatoric input | unit | `pnpm test:unit src/services/placement.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PLAC-02 | T-3-bundle-leak | Page bundle ships zero correct-answer data | invariant | `pnpm test tests/invariants/placement-bundle-leak.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PLAC-03 | — | Completion writes attempts row with kind='placement' + assignedLevelId set | integration | `pnpm test src/services/placement.integration.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PLAC-04 | — | Escape hatch tap persists escape_hatched + reason, returns to result | integration | `pnpm test src/services/placement.integration.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PLAC-05 | T-3-rls-cross-parent | Parent A cannot read Parent B's child placement state | e2e | `pnpm test:e2e tests/e2e/placement-cross-parent.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PLAC-06 | — | Escape hatch visible on every placement screen (passage + question + result) | e2e | `pnpm test:e2e tests/e2e/placement-escape-hatch.spec.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PLAC-07 | — | Parent reset from /profiles/[childId]/manage soft-archives prior, allows new attempt | integration | `pnpm test src/services/placement.integration.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | PLAC-08 | — | Placeholder bank seeded (5 passages, 15 items, all is_placeholder=true) | integration | `pnpm test src/db/seed/placement-placeholder.test.ts` | ❌ W0 | ⬜ pending |
| TBD | TBD | 1 | — | T-3-schema-drift | Migration applied to live DB matches schema.ts | post-push | `pnpm db:verify-columns` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

*Task IDs and plan IDs are TBD — populated when gsd-planner produces `03-NN-PLAN.md` files in step 8.*

---

## Wave 0 Requirements

Per RESEARCH §"Seven Wave 0 test files", the planner must create these files in Wave 0 before any implementation tasks run:

- [ ] `src/services/placement.test.ts` — pure-function tests for `assignLevel()` (covers PLAC-01)
- [ ] `src/services/placement.integration.test.ts` — full placement loop, escape hatch, reset (covers PLAC-03, PLAC-04, PLAC-07)
- [ ] `src/db/seed/placement-placeholder.test.ts` — seed correctness (covers PLAC-08)
- [ ] `tests/invariants/placement-bundle-leak.test.ts` — grep the rendered HTML for correct-choice IDs (covers PLAC-02)
- [ ] `tests/e2e/placement-cross-parent.spec.ts` — Playwright cross-parent RLS (covers PLAC-05)
- [ ] `tests/e2e/placement-escape-hatch.spec.ts` — Playwright escape-hatch visibility on every placement screen (covers PLAC-06)
- [ ] `scripts/db-verify-columns.sh` (or `.ts`) — SELECT against information_schema.columns to confirm migration applied to live DB

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Arabic content readability — Tashkeel rendering at passage levels 2/6/10 | — (smoke test, not gate) | Visual fidelity per device cannot be automated reliably; Playwright snapshots are flaky on Arabic glyphs | Open `/placement` in Chrome desktop + Safari iOS; eyeball Tashkeel positioning on passage 1 |
| Result screen friendliness ("اخترنا لك المستوى X") tone check | — | Subjective copy review | Designer/specialist reviews phase exit notes — `.planning/phases/03-placement-vertical/EXIT.md` |
| Literacy-specialist review of placeholder bank | PLAC-08 (phase exit gate) | Per CONTEXT §Bank seeding strategy: "Claude is explicit ... this Arabic content is a smoke-test prop, not a pedagogically-calibrated instrument" | Specialist signs off in `EXIT.md` before phase is marked complete |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 90s (E2E budget)
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
