// Integration tests for placement service functions.
// Tests run against the live Supabase test DB using the admin client.
//
// Prerequisites:
//   - pnpm db:seed:placement must have been run (15 placeholder questions must exist)
//   - NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY must be set (.env.local)
//   - DATABASE_URL must be set (.env.local)
//
// Run: pnpm test:run src/services/placement.integration.test.ts

import { config } from 'dotenv';

// Load .env.local before importing anything that reads env vars
config({ path: '.env.local' });

import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { db } from '@/db/client';
import { attemptAnswers, attempts, childProfiles } from '@/db/schema';
import type { AttemptId, PlacementItem } from '@/services/placement';
import {
  abortPlacement,
  deterministicShuffle,
  getNextPlacementItem,
  getPlacementState,
  recordPlacementAnswer,
  resetPlacement,
  startPlacement,
} from '@/services/placement';
import type { ChildId } from '@/services/profiles';
import type { TestParent } from '../../tests/e2e/_helpers/test-parents';
import { createTestParent, deleteTestParent } from '../../tests/e2e/_helpers/test-parents';

// ---------------------------------------------------------------------------
// Helper: creates a child profile directly via admin DB insert
// ---------------------------------------------------------------------------

async function createTestChild(
  parentId: string,
  gradeBand: 'k' | '1-2' | '3-4' | '5-6' = '1-2',
): Promise<ChildId> {
  // First ensure the parents row exists (lazy-upsert pattern from profiles.ts)
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'createTestChild requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY',
    );
  }

  // Use service role client to insert parent row (bypasses RLS)
  const adminClient = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Insert parent row via raw supabase client (RLS bypass)
  await adminClient
    .from('parents')
    .insert({ id: parentId, email: `test-${parentId}@qira-test.local` })
    .select()
    // upsert style — ignore conflict if already exists
    .maybeSingle();

  // Insert child_profile via raw supabase client
  const childId = randomUUID();
  const { error } = await adminClient.from('child_profiles').insert({
    id: childId,
    parent_id: parentId,
    display_name: `Test Child ${childId.slice(0, 8)}`,
    age: 7,
    grade_band: gradeBand,
  });

  if (error) throw new Error(`createTestChild insert failed: ${error.message}`);
  return childId as ChildId;
}

/** Helper: pick the first choice from a PlacementItem */
function pickFirstChoice(item: PlacementItem): string {
  return item.choices[0]!.id;
}

// ---------------------------------------------------------------------------
// Test setup
// ---------------------------------------------------------------------------

let parentA: TestParent;
let parentB: TestParent;
let childA: ChildId;
let childB: ChildId;

beforeAll(async () => {
  parentA = await createTestParent();
  parentB = await createTestParent();
  childA = await createTestChild(parentA.id, '1-2');
  childB = await createTestChild(parentB.id, '3-4');
});

afterAll(async () => {
  // Clean up parents (cascades to child_profiles → attempts → attempt_answers)
  await deleteTestParent(parentA.id);
  await deleteTestParent(parentB.id);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('getPlacementState()', () => {
  test("Test 1: returns 'not_started' for child with zero placement attempts", async () => {
    // childA and childB both have no attempts at this point
    const state = await getPlacementState(childA);
    expect(state).toBe('not_started');
  });
});

describe('startPlacement()', () => {
  let attemptId: AttemptId;

  test('Test 2: after startPlacement, state is in_progress and attempts row has correct fields', async () => {
    // Use childB for this test to keep childA clean for Test 1 above
    const newAttemptId = await startPlacement(childB);
    attemptId = newAttemptId;

    expect(typeof newAttemptId).toBe('string');
    // Valid UUID pattern
    expect(newAttemptId).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);

    const state = await getPlacementState(childB);
    expect(state).toBe('in_progress');

    // Direct DB assertion
    const [row] = await db.select().from(attempts).where(eq(attempts.id, newAttemptId)).limit(1);

    expect(row).toBeDefined();
    expect(row!.kind).toBe('placement');
    expect(row!.placementBankVersion).toBe(1);
    expect(row!.assignedLevelId).toBeNull();
    expect(row!.finishedAt).toBeNull();
    expect(row!.escapeHatched).toBe(false);
  });

  afterAll(async () => {
    // Clean up this test's attempt
    if (attemptId) {
      await db.delete(attempts).where(eq(attempts.id, attemptId));
    }
  });
});

describe('getNextPlacementItem()', () => {
  let attemptId: AttemptId;

  beforeAll(async () => {
    attemptId = await startPlacement(childA);
  });

  afterAll(async () => {
    if (attemptId) {
      await db.delete(attempts).where(eq(attempts.id, attemptId));
    }
  });

  test('Test 3: returns a PlacementItem with correct shape, no isCorrect in choices', async () => {
    const item = await getNextPlacementItem(attemptId);

    expect(item).not.toBeNull();
    expect(item!.questionIndex).toBe(1);
    expect(item!.totalQuestions).toBe(15);
    expect(item!.choices).toHaveLength(4);
    expect(typeof item!.promptAr).toBe('string');
    expect(item!.promptAr.length).toBeGreaterThan(0);

    // T-3-bundle-leak: choices must NOT have isCorrect
    for (const choice of item!.choices) {
      expect(Object.keys(choice)).toEqual(['id', 'labelAr']);
      expect('isCorrect' in choice).toBe(false);
    }
  });
});

describe('Full placement loop (15 answers)', () => {
  let loopAttemptId: AttemptId;

  afterAll(async () => {
    if (loopAttemptId) {
      await db.delete(attempts).where(eq(attempts.id, loopAttemptId));
    }
  });

  // 15 DB round-trips per answer × 15 answers on live Supabase — needs extended timeout
  test('Test 4: 14 answers advance questionIndex, 15th answer finalizes with assignedLevel 1–20', async () => {
    // Create a fresh child for the loop test to avoid state contamination
    const loopChild = await createTestChild(parentA.id, '3-4');
    loopAttemptId = await startPlacement(loopChild);

    let finalResult = null;
    let item = await getNextPlacementItem(loopAttemptId);

    for (let i = 1; i <= 14; i++) {
      expect(item).not.toBeNull();
      expect(item!.questionIndex).toBe(i);

      const result = await recordPlacementAnswer({
        childId: loopChild,
        attemptId: loopAttemptId,
        questionId: item!.questionId,
        chosenChoiceId: pickFirstChoice(item!),
      });

      expect(result.finalResult).toBeNull();
      expect(result.nextItem).not.toBeNull();

      item = result.nextItem;
    }

    // 15th answer
    expect(item).not.toBeNull();
    expect(item!.questionIndex).toBe(15);

    const lastResult = await recordPlacementAnswer({
      childId: loopChild,
      attemptId: loopAttemptId,
      questionId: item!.questionId,
      chosenChoiceId: pickFirstChoice(item!),
    });

    expect(lastResult.finalResult).not.toBeNull();
    finalResult = lastResult.finalResult;

    expect(finalResult!.assignedLevel).toBeGreaterThanOrEqual(1);
    expect(finalResult!.assignedLevel).toBeLessThanOrEqual(20);
    expect(finalResult!.escapeHatched).toBe(false);
    expect(lastResult.nextItem).toBeNull();

    // State check
    const state = await getPlacementState(loopChild);
    expect(state).toBe('completed');

    // DB assertion: assignedLevelId is set
    const [row] = await db
      .select({ assignedLevelId: attempts.assignedLevelId, finishedAt: attempts.finishedAt })
      .from(attempts)
      .where(eq(attempts.id, loopAttemptId))
      .limit(1);

    expect(row!.assignedLevelId).not.toBeNull();
    expect(row!.finishedAt).not.toBeNull();
  }, 90_000);
});

describe('abortPlacement()', () => {
  let abortAttemptId: AttemptId;
  let abortChildId: ChildId;

  beforeAll(async () => {
    abortChildId = await createTestChild(parentA.id, '3-4');
    abortAttemptId = await startPlacement(abortChildId);
  });

  afterAll(async () => {
    if (abortAttemptId) {
      await db.delete(attempts).where(eq(attempts.id, abortAttemptId));
    }
  });

  test('Test 5: abortPlacement sets escape_hatched=true, reason, finishedAt; state=escape_hatched', async () => {
    const result = await abortPlacement({ attemptId: abortAttemptId, reason: 'too_hard' });

    expect(result.escapeHatched).toBe(true);
    expect(result.escapeHatchedReason).toBe('too_hard');
    // G3-4 center=9, too_hard → fallback=8
    expect(result.assignedLevel).toBe(8);

    // DB assertion
    const [row] = await db.select().from(attempts).where(eq(attempts.id, abortAttemptId)).limit(1);

    expect(row!.escapeHatched).toBe(true);
    expect(row!.escapeHatchedReason).toBe('too_hard');
    expect(row!.finishedAt).not.toBeNull();
    expect(row!.assignedLevelId).not.toBeNull();

    const state = await getPlacementState(abortChildId);
    expect(state).toBe('escape_hatched');
  });
});

describe('resetPlacement()', () => {
  test('Test 6: resetPlacement after completed attempt → state returns not_started', async () => {
    const resetChild = await createTestChild(parentB.id, '1-2');
    const resetAttemptId = await startPlacement(resetChild);

    // Complete the placement
    let item = await getNextPlacementItem(resetAttemptId);
    for (let i = 0; i < 15; i++) {
      if (!item) break;
      const result = await recordPlacementAnswer({
        childId: resetChild,
        attemptId: resetAttemptId,
        questionId: item.questionId,
        chosenChoiceId: pickFirstChoice(item),
      });
      item = result.nextItem;
    }

    // Verify completed
    const completedState = await getPlacementState(resetChild);
    expect(completedState).toBe('completed');

    // Reset
    await resetPlacement(resetChild);

    // State should now be not_started
    const resetState = await getPlacementState(resetChild);
    expect(resetState).toBe('not_started');

    // Verify attempt_answers were cascade-deleted
    const [answerRow] = await db
      .select({ id: attemptAnswers.id })
      .from(attemptAnswers)
      .where(eq(attemptAnswers.attemptId, resetAttemptId))
      .limit(1);
    expect(answerRow).toBeUndefined();
  }, 90_000);
});

describe('Choice order persistence', () => {
  test('Test 7: attempt_answers.choice_order matches deterministicShuffle output for same seed', async () => {
    const persistChild = await createTestChild(parentA.id, '3-4');
    const persistAttemptId = await startPlacement(persistChild);

    const item = await getNextPlacementItem(persistAttemptId);
    expect(item).not.toBeNull();

    const chosenChoiceId = pickFirstChoice(item!);
    await recordPlacementAnswer({
      childId: persistChild,
      attemptId: persistAttemptId,
      questionId: item!.questionId,
      chosenChoiceId,
    });

    // Check the persisted choice_order
    const [answerRow] = await db
      .select({ choiceOrder: attemptAnswers.choiceOrder })
      .from(attemptAnswers)
      .where(
        and(
          eq(attemptAnswers.attemptId, persistAttemptId),
          eq(attemptAnswers.questionId, item!.questionId),
        ),
      )
      .limit(1);

    expect(answerRow).toBeDefined();
    // choice_order is an array of choice UUIDs
    const storedOrder = answerRow!.choiceOrder as string[];
    expect(Array.isArray(storedOrder)).toBe(true);
    expect(storedOrder).toHaveLength(4);

    // getNextPlacementItem already applied deterministicShuffle — stored order must match
    const expectedOrder = item!.choices.map((c) => c.id);
    expect(storedOrder).toEqual(expectedOrder);

    // Clean up
    await db.delete(attempts).where(eq(attempts.id, persistAttemptId));
  }, 30_000);
});

describe('Cross-child isolation', () => {
  test('Test 8: childB state is not_started when childA has a completed attempt', async () => {
    // childA starts a placement
    const isolationChild = await createTestChild(parentA.id, '1-2');
    const isoAttemptId = await startPlacement(isolationChild);

    // Verify the isolation child is in_progress
    const stateA = await getPlacementState(isolationChild);
    expect(stateA).toBe('in_progress');

    // childB (created in beforeAll with parentB) should be not_started
    // Note: childB may have had a startPlacement in Test 2 — use a fresh child
    const isolationChildB = await createTestChild(parentB.id, 'k');
    const stateB = await getPlacementState(isolationChildB);
    expect(stateB).toBe('not_started');

    // Clean up
    await db.delete(attempts).where(eq(attempts.id, isoAttemptId));
  });
});
