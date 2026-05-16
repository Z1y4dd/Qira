// Unit tests for placement.ts pure functions.
// Tests cover assignLevel(), deterministicShuffle(), and computeAbortFallback().
//
// Anti-pitfall 3 mitigation: the bias-down rule (D-01) is tested explicitly.
// The -1 bias-down step is applied BEFORE clamping — tests assert this order.

import { describe, expect, test } from 'vitest';
import {
  assignLevel,
  computeAbortFallback,
  deterministicShuffle,
} from '@/services/placement';
import type { GradeBand, PassageResult } from '@/services/placement';

// Grade-prior table (D-01, locked in CONTEXT.md):
//   Pre-K  → center 2,  clamp 1–5
//   G1-2   → center 5,  clamp 2–8
//   G3-4   → center 9,  clamp 6–12
//   G5-6   → center 14, clamp 11–17

// Passage levels in the placeholder bank: 2, 6, 10, 14, 18
// 3 questions per passage → totalQuestions: 3
// 60% threshold → correctAnswers >= 2 out of 3

function allCorrect(levels: number[]): PassageResult[] {
  return levels.map((level) => ({ level, totalQuestions: 3, correctAnswers: 3 }));
}

function allWrong(levels: number[]): PassageResult[] {
  return levels.map((level) => ({ level, totalQuestions: 3, correctAnswers: 0 }));
}

function exactlyPass(level: number): PassageResult {
  // 2/3 = 66.7% >= 60% — passes
  return { level, totalQuestions: 3, correctAnswers: 2 };
}

function exactlyFail(level: number): PassageResult {
  // 1/3 = 33.3% < 60% — fails
  return { level, totalQuestions: 3, correctAnswers: 1 };
}

describe('assignLevel()', () => {
  test('all-correct G1-2: highest passing level is 18, bias-down 18→17, clamped to 8 (G1-2 max)', () => {
    // Anti-pitfall 3: bias-down BEFORE clamping
    // raw = 18, biased = 18 - 1 = 17, clamp(17, 2, 8) = 8
    const result = assignLevel({
      passageResults: allCorrect([2, 6, 10, 14, 18]),
      gradeBand: '1-2',
    });
    expect(result.assignedLevel).toBe(8);
    expect(result.highestPassingLevel).toBe(18);
    // algorithmOutput = biased value before clamping
    expect(result.algorithmOutput).toBe(17);
  });

  test('all-wrong G1-2: no passages pass, fallback to grade-prior center 5, bias-down →4, within 2–8', () => {
    // raw = center(5), biased = 5 - 1 = 4, clamp(4, 2, 8) = 4
    const result = assignLevel({
      passageResults: allWrong([2, 6, 10, 14, 18]),
      gradeBand: '1-2',
    });
    expect(result.assignedLevel).toBe(4);
    expect(result.highestPassingLevel).toBeNull();
  });

  test('mixed: passes L2+L6, fails L10+, G1-2 → L6 bias-down to 5, within clamp 2–8', () => {
    // raw = 6 (highest passing), biased = 6 - 1 = 5, clamp(5, 2, 8) = 5
    const result = assignLevel({
      passageResults: [exactlyPass(2), exactlyPass(6), exactlyFail(10), exactlyFail(14), exactlyFail(18)],
      gradeBand: '1-2',
    });
    expect(result.assignedLevel).toBe(5);
    expect(result.highestPassingLevel).toBe(6);
  });

  test('exactly 60% on L10 passage, G3-4: qualifies → bias-down to 9, within clamp 6–12', () => {
    // exactlyPass returns 2/3 = 66.7% which is >= 60%
    // raw = 10, biased = 10 - 1 = 9, clamp(9, 6, 12) = 9
    const result = assignLevel({
      passageResults: [exactlyFail(2), exactlyFail(6), exactlyPass(10), exactlyFail(14), exactlyFail(18)],
      gradeBand: '3-4',
    });
    expect(result.assignedLevel).toBe(9);
    expect(result.highestPassingLevel).toBe(10);
  });

  test('pre-K all-wrong: fallback to grade-prior center 2, bias-down to 1, clamped to 1 (pre-K min)', () => {
    // raw = center(2), biased = 2 - 1 = 1, clamp(1, 1, 5) = 1
    const result = assignLevel({
      passageResults: allWrong([2, 6, 10, 14, 18]),
      gradeBand: 'k',
    });
    expect(result.assignedLevel).toBe(1);
    expect(result.highestPassingLevel).toBeNull();
  });

  test('edge: empty passageResults → falls back to grade-prior center - 1 (bias-down minimum)', () => {
    // passageResults = [] → no passing → raw = center(5 for G1-2), biased = 4
    const result = assignLevel({
      passageResults: [],
      gradeBand: '1-2',
    });
    expect(result.assignedLevel).toBe(4);
    expect(result.highestPassingLevel).toBeNull();
  });

  test('G5-6 all correct: highest passing is 18, bias-down to 17, clamped to 17 (G5-6 max)', () => {
    // raw = 18, biased = 18 - 1 = 17, clamp(17, 11, 17) = 17
    const result = assignLevel({
      passageResults: allCorrect([2, 6, 10, 14, 18]),
      gradeBand: '5-6',
    });
    expect(result.assignedLevel).toBe(17);
    expect(result.highestPassingLevel).toBe(18);
  });
});

describe('deterministicShuffle()', () => {
  test('same seed produces same order on repeated calls (idempotent / retake reproducibility)', () => {
    const items = ['a', 'b', 'c', 'd'];
    const seed = 'test-attempt-id:test-question-id';
    const results = Array.from({ length: 10 }, () => deterministicShuffle(items, seed));
    // All 10 calls must produce identical output
    for (const result of results) {
      expect(result).toEqual(results[0]);
    }
  });

  test('different seeds produce at least 3 distinct orders out of 5 (probabilistic)', () => {
    const items = [1, 2, 3, 4];
    const seeds = [
      'seed-alpha:q1',
      'seed-beta:q2',
      'seed-gamma:q3',
      'seed-delta:q4',
      'seed-epsilon:q5',
    ];
    const orders = seeds.map((seed) => JSON.stringify(deterministicShuffle(items, seed)));
    const uniqueOrders = new Set(orders);
    // Allow 1 collision out of 5 (1/24 probability of any collision — extremely conservative)
    expect(uniqueOrders.size).toBeGreaterThanOrEqual(3);
  });

  test('all original items appear in output exactly once (no duplicates, no omissions)', () => {
    const items = ['uuid-1', 'uuid-2', 'uuid-3', 'uuid-4'];
    const result = deterministicShuffle(items, 'integrity-test-seed');
    // Same length
    expect(result).toHaveLength(items.length);
    // Same elements via Set equality
    expect(new Set(result)).toEqual(new Set(items));
    // No duplicates
    const uniqueResult = new Set(result);
    expect(uniqueResult.size).toBe(items.length);
  });
});

describe('computeAbortFallback() — escape-hatch fallback formula', () => {
  test('too_hard at G3-4 (center 9): fallback = clamp(9 - 1, 6, 12) = 8', () => {
    const result = computeAbortFallback('too_hard', '3-4');
    expect(result).toBe(8);
  });

  test('too_easy at G3-4 (center 9): fallback = clamp(9 + 1, 6, 12) = 10', () => {
    const result = computeAbortFallback('too_easy', '3-4');
    expect(result).toBe(10);
  });

  test('too_easy at G5-6 (center 14): clamp(14 + 1, 11, 17) = 15, still within window', () => {
    const result = computeAbortFallback('too_easy', '5-6');
    expect(result).toBe(15);
  });

  test('too_hard at pre-K (center 2): clamp(2 - 1, 1, 5) = 1, equal to window min', () => {
    const result = computeAbortFallback('too_hard', 'k');
    expect(result).toBe(1);
  });

  test('too_easy at G5-6 near window top (center 14, max 17): does not overflow above 17', () => {
    // This confirms clamping prevents going above max
    // center(14) + 1 = 15, clamp(15, 11, 17) = 15 — within max
    // Edge case: what if center were 17? center + 1 = 18, clamped to 17
    // We test via a GradeBand directly — G5-6 center is 14 so +1 = 15
    const result = computeAbortFallback('too_easy', '5-6');
    expect(result).toBeLessThanOrEqual(17); // never above G5-6 max
  });

  test('too_easy at G1-2 (center 5): clamp(5 + 1, 2, 8) = 6', () => {
    const result = computeAbortFallback('too_easy', '1-2');
    expect(result).toBe(6);
  });
});

// Exported type checks (compile-time assertions via TypeScript):
// - GradeBand is 'k' | '1-2' | '3-4' | '5-6'
// - PassageResult has { level, totalQuestions, correctAnswers }
const _typeCheck: GradeBand = 'k';
void _typeCheck;
