---
phase: 03-placement-vertical
plan: 03
slice_name: placement-algorithm-and-service
status: complete
completed_at: "2026-05-16T22:17:00.000Z"
tests_passed: "16/16 unit + 8/8 integration"
---

# Plan 03 — Placement Algorithm & Service Layer — SUMMARY

## Exported Surface (`src/services/placement.ts`)

### Pure Functions (no DB, no async)
```typescript
function assignLevel(input: AssignLevelInput): AssignLevelOutput
function deterministicShuffle<T>(items: T[], seed: string): T[]
function computeAbortFallback(reason: 'too_hard' | 'too_easy', gradeBand: GradeBand): number
const GRADE_PRIOR: Record<GradeBand, { center: number; min: number; max: number }>
```

### Stateful Functions (Drizzle + Supabase)
```typescript
async function getPlacementState(childId: ChildId): Promise<PlacementState>
async function startPlacement(childId: ChildId): Promise<AttemptId>
async function getNextPlacementItem(attemptId: AttemptId): Promise<PlacementItem | null>
async function recordPlacementAnswer(input: RecordPlacementAnswerInput): Promise<RecordPlacementAnswerResult>
async function abortPlacement(input: { attemptId: AttemptId; reason: 'too_hard' | 'too_easy' }): Promise<PlacementResult>
async function resetPlacement(childId: ChildId): Promise<void>
```

### Key Types Exported
```typescript
type AttemptId, QuestionId, ChoiceId, PlacementState, GradeBand
interface PlacementItem     // choices: { id, labelAr }[] — NO isCorrect (T-3-bundle-leak)
interface PlacementResult
interface AssignLevelInput, AssignLevelOutput, PassageResult
type RecordPlacementAnswerInput  // Zod-validated, also exported as RecordPlacementAnswerInputSchema
```

## Test Results
- **Unit tests** (`placement.test.ts`): 16/16 pass — covers all 4 grade bands, bias-down ordering, deterministicShuffle idempotence and coverage, abort-formula edge cases
- **Integration tests** (`placement.integration.test.ts`): 8/8 pass against live Supabase DB
  - Test 4 + 6 (full 15-question loop): ~55s each against live Supabase — timeouts set to 90s
  - Test 7 (choice_order persistence): 6.5s — verified stored JSONB matches `getNextPlacementItem` shuffle order directly
- **Invariants**: `service-layer-purity` (0 `next/*` imports) + `placement-bundle-leak` (isCorrect not in app/components) — both pass

## Key Decisions Made During Execution
- `resetPlacement` uses **hard-delete** (not soft-archive) — the attempt + all `attempt_answers` are cascade-deleted; `getPlacementState` naturally returns `'not_started'` after
- Integration test `createTestChild` uses Supabase admin client directly (not `createTestParent` helper) since child insertion requires a parent row — admin client bypasses RLS
- Test 7 verification: stored `choice_order` JSONB compared directly to `item.choices.map(c => c.id)` (the order already returned by `getNextPlacementItem`) — not re-derived via a second shuffle call

## Phase 4 Note
The `mode="reader"` escape-hatch path (Phase 4) is **NOT implemented here**. The `abortPlacement` function is placement-only. Phase 4 must add a separate service function (e.g., `shiftLevelOneStep`) for the reader-mode hatch. The `EscapeHatch` component's `mode` prop API (from Plan 01) is the integration point.
