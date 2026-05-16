// Unit tests for placement.ts pure functions.
// Stubs for Wave 1 — Plan 03 fills assignLevel() + deterministicShuffle() bodies.
// All test cases are test.todo() until the implementation lands.

import { describe, test } from 'vitest';

// These imports will be used when Plan 03 implements the functions:
// import { assignLevel, deterministicShuffle, abortPlacement } from '@/services/placement';
// import type { PassageResult } from '@/services/placement';

// Grade-prior table (D-01):
//   Pre-K  → center 2,  clamp 1–5
//   G1-2   → center 5,  clamp 2–8
//   G3-4   → center 9,  clamp 6–12
//   G5-6   → center 14, clamp 11–17

describe('assignLevel()', () => {
  test.todo('all-correct G1-2: returns highest passage level (18) - 1 = 17, clamped to 8 (G1-2 max)');

  test.todo('all-wrong G1-2: returns grade-prior center (5) - 1 = 4, clamped within 2–8');

  test.todo('mixed L2+L6 correct, L10+ wrong, G1-2: highest-60%-band is L6 → 6 - 1 = 5, within clamp 2–8');

  test.todo('exactly-60% on L10 passage, G3-4: qualifies → 10 - 1 = 9, within clamp 6–12');

  test.todo('pre-K all-wrong: fallback to grade-prior center 2 - 1 = 1, clamped to 1 (pre-K min)');

  test.todo('edge: empty passageResults array → falls back to grade-prior center - 1 (bias-down minimum)');
});

describe('deterministicShuffle()', () => {
  test.todo('same seed produces same order on repeated calls (idempotent / retake reproducibility)');

  test.todo('different seeds → different item orders for the same input array');

  test.todo('all original items are preserved in output (no duplicates, no omissions)');
});

describe('abortPlacement() fallback formula', () => {
  test.todo("too_hard: assigned level = grade-prior center - 1, clamped inside grade-prior window");

  test.todo("too_easy: assigned level = grade-prior center + 1, clamped inside grade-prior window");

  test.todo("too_easy at window max: result is clamped to window max (no overflow above grade band)");
});
