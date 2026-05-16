// Integration tests for the Phase 3 placeholder placement bank.
// Asserts row counts after pnpm db:seed:placement has been run.
//
// IMPORTANT: These tests do NOT re-run the seed. They assume the seed has been
// run at least once (Task 2.1). If counts are 0, all tests will fail with a
// clear "Placement bank not seeded" message.
//
// Run: pnpm test:run src/db/seed/placement-placeholder.test.ts

import { config } from 'dotenv';
import { eq, inArray, sql } from 'drizzle-orm';
import { describe, expect, test } from 'vitest';
import { db } from '@/db/client';
import { choices, levels, questions, texts } from '@/db/schema';

// Load .env.local so DATABASE_URL is available for the db proxy.
config({ path: '.env.local' });

describe('placement placeholder bank — seed count assertions', () => {
  test('texts.isPlaceholder = true count equals 5 (one passage per level band: 2, 6, 10, 14, 18)', async () => {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(texts)
      .where(eq(texts.isPlaceholder, true));

    const count = Number(rows[0]?.count ?? 0);
    if (count === 0) {
      throw new Error('Placement bank not seeded. Run `pnpm db:seed:placement` first.');
    }

    expect(count).toBe(5);
  });

  test('questions.isPlaceholder = true count equals 15 (3 questions per passage: literal, vocabulary, inferential)', async () => {
    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(questions)
      .where(eq(questions.isPlaceholder, true));

    const count = Number(rows[0]?.count ?? 0);
    if (count === 0) {
      throw new Error('Placement bank not seeded. Run `pnpm db:seed:placement` first.');
    }

    expect(count).toBe(15);
  });

  test('choices count linked to placeholder questions equals 60 (4 choices per question)', async () => {
    const placeholderQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.isPlaceholder, true));

    if (placeholderQuestions.length === 0) {
      throw new Error('Placement bank not seeded. Run `pnpm db:seed:placement` first.');
    }

    const questionIds = placeholderQuestions.map((q) => q.id);

    const rows = await db
      .select({ count: sql<number>`count(*)` })
      .from(choices)
      .where(inArray(choices.questionId, questionIds));

    const count = Number(rows[0]?.count ?? 0);
    expect(count).toBe(60);
  });

  test('each placeholder question has exactly 1 choice with isCorrect = 1', async () => {
    const placeholderQuestions = await db
      .select({ id: questions.id })
      .from(questions)
      .where(eq(questions.isPlaceholder, true));

    if (placeholderQuestions.length === 0) {
      throw new Error('Placement bank not seeded. Run `pnpm db:seed:placement` first.');
    }

    const questionIds = placeholderQuestions.map((q) => q.id);

    // For each question, sum(is_correct) should equal 1 (exactly one correct choice per question).
    const correctPerQuestion = await db
      .select({
        questionId: choices.questionId,
        correctCount: sql<number>`sum(${choices.isCorrect})`,
      })
      .from(choices)
      .where(inArray(choices.questionId, questionIds))
      .groupBy(choices.questionId);

    expect(correctPerQuestion).toHaveLength(15);
    for (const row of correctPerQuestion) {
      expect(Number(row.correctCount)).toBe(1);
    }
  });

  test('each placeholder text level matches one of {2, 6, 10, 14, 18} — 5 distinct levels, no duplicates', async () => {
    const placeholderTexts = await db
      .select({ levelId: texts.levelId })
      .from(texts)
      .where(eq(texts.isPlaceholder, true));

    if (placeholderTexts.length === 0) {
      throw new Error('Placement bank not seeded. Run `pnpm db:seed:placement` first.');
    }

    const levelIds = placeholderTexts.map((t) => t.levelId);

    // Fetch level numbers for the found level IDs.
    const levelRows = await db
      .select({ id: levels.id, number: levels.number })
      .from(levels)
      .where(inArray(levels.id, levelIds));

    const levelNumbers = levelRows.map((l) => l.number).sort((a, b) => a - b);
    const expectedLevels = [2, 6, 10, 14, 18];

    // Confirm exactly 5 distinct levels.
    expect(levelNumbers).toHaveLength(5);

    // Confirm no duplicate level IDs.
    const uniqueIds = new Set(levelIds);
    expect(uniqueIds.size).toBe(5);

    // Confirm the levels match the expected staggered set.
    expect(levelNumbers).toEqual(expectedLevels);
  });
});
