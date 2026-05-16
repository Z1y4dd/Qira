// Seed correctness tests for the Phase 3 placeholder placement bank.
// Stubs for Wave 1 — Plan 02 seeds the data; these tests verify the seed counts.
// All test cases are test.todo() until the seed script runs.

import { describe, test } from 'vitest';

// These imports will be used when Plan 02 seeds the data:
// import { db } from '@/db/client';
// import { texts, questions } from '@/db/schema';
// import { eq, and, count } from 'drizzle-orm';

describe('placement placeholder bank — seed count assertions', () => {
  test.todo(
    'texts.isPlaceholder = true count equals 5 (one passage per level band: 2, 6, 10, 14, 18)',
  );

  test.todo(
    'questions.isPlaceholder = true count equals 15 (3 questions per passage: literal, vocabulary, inferential)',
  );
});
