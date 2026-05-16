/**
 * Service Layer module — placement assessment.
 *
 * RULES (enforced by tests/invariants/service-layer-purity.test.ts):
 *   - NO `next/*` imports. Framework-agnostic.
 *   - Zod validation at every entry point.
 *   - Server-authoritative scoring (PROJECT.md Pitfall #5): the client
 *     submits a choice ID, the server returns correctness.
 *   - `isCorrect` is read here (server-side) but NEVER returned in
 *     PlacementItem.choices (T-3-bundle-leak mitigation).
 */
import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db/client';
import {
  attemptAnswers,
  attempts,
  childProfiles,
  choices,
  levels,
  questions,
  texts,
} from '@/db/schema';
import type { ChildId } from './profiles';
import { AuthError } from './profiles';

// ---------------------------------------------------------------------------
// Branded types
// ---------------------------------------------------------------------------

export type AttemptId = string & { readonly __brand: 'AttemptId' };
export type QuestionId = string & { readonly __brand: 'QuestionId' };
export type ChoiceId = string & { readonly __brand: 'ChoiceId' };

const brandedAttemptId = (id: string): AttemptId => id as AttemptId;

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface PlacementItem {
  questionId: QuestionId;
  /** Arabic prompt text, already NFC-normalized at write time. */
  promptAr: string;
  /** Choices presented in deterministic shuffled order. isCorrect is NEVER in this type. */
  choices: { id: ChoiceId; labelAr: string }[];
  level: number;
  passageTitleAr: string;
  passageBodyAr: string;
  questionIndex: number;   // 1-based
  totalQuestions: number;  // always 15
}

export interface PlacementResult {
  attemptId: AttemptId;
  assignedLevel: number;
  escapeHatched: boolean;
  escapeHatchedReason: 'too_hard' | 'too_easy' | null;
}

export type PlacementState = 'not_started' | 'in_progress' | 'completed' | 'escape_hatched';

export interface PassageResult {
  level: number;
  totalQuestions: number;
  correctAnswers: number;
}

export interface AssignLevelInput {
  passageResults: PassageResult[];
  gradeBand: GradeBand;
}

export interface AssignLevelOutput {
  assignedLevel: number;    // 1–20, clamped
  algorithmOutput: number;  // biased value before clamping, for audit
  highestPassingLevel: number | null;
}

export type GradeBand = 'k' | '1-2' | '3-4' | '5-6';

export interface RecordPlacementAnswerResult {
  correct: boolean;
  nextItem: PlacementItem | null;
  finalResult: PlacementResult | null;
}

// ---------------------------------------------------------------------------
// Grade-prior table — locked in D-01 (CONTEXT.md)
// ---------------------------------------------------------------------------

export const GRADE_PRIOR: Record<GradeBand, { center: number; min: number; max: number }> = {
  'k':   { center: 2,  min: 1,  max: 5  },
  '1-2': { center: 5,  min: 2,  max: 8  },
  '3-4': { center: 9,  min: 6,  max: 12 },
  '5-6': { center: 14, min: 11, max: 17 },
};

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

/** Server-authoritative placement answer recording. */
const RecordPlacementAnswerInput = z.object({
  childId: z.string(),
  attemptId: z.string(),
  questionId: z.string(),
  chosenChoiceId: z.string(),
});

export type RecordPlacementAnswerInput = z.infer<typeof RecordPlacementAnswerInput>;

const AbortPlacementInput = z.object({
  attemptId: z.string(),
  reason: z.enum(['too_hard', 'too_easy']),
});

// ---------------------------------------------------------------------------
// Pure functions (no DB, no async, no I/O)
// ---------------------------------------------------------------------------

/**
 * Assigns a reading level based on per-passage accuracy and grade band.
 *
 * D-01: bias-down applied BEFORE clamping.
 * Formula: max(min(highestPassingLevel - 1, clamp.max), clamp.min)
 * Falls back to grade-prior center if no passages pass the 60% threshold.
 */
export function assignLevel(input: AssignLevelInput): AssignLevelOutput {
  const prior = GRADE_PRIOR[input.gradeBand];

  // Find highest passage where accuracy >= 60%
  const passing = input.passageResults
    .filter((r) => r.totalQuestions > 0 && r.correctAnswers / r.totalQuestions >= 0.6)
    .map((r) => r.level);

  const highestPassingLevel = passing.length > 0 ? Math.max(...passing) : null;

  // Algorithm output: highest passing level, or grade-prior center if none pass
  const raw = highestPassingLevel ?? prior.center;

  // Bias-down by 1 — D-01: applied BEFORE clamping (Anti-pitfall 3)
  const biased = raw - 1;

  // Clamp within grade-prior window
  const assignedLevel = Math.max(prior.min, Math.min(prior.max, biased));

  return { assignedLevel, algorithmOutput: biased, highestPassingLevel };
}

/**
 * Deterministic shuffle using SHA-256 hash of the seed.
 * Same seed always produces the same order (D-02 retake reproducibility).
 * Uses successive 4-byte windows of the hex digest as sort keys.
 */
export function deterministicShuffle<T>(items: T[], seed: string): T[] {
  if (items.length <= 1) return items.slice();
  const hash = createHash('sha256').update(seed).digest('hex');
  // Use successive 4-byte windows of the hash as sort keys
  const indexed = items.map((item, i) => ({
    item,
    key: parseInt(hash.slice((i * 4) % 60, (i * 4) % 60 + 8), 16),
  }));
  return indexed.sort((a, b) => a.key - b.key).map((x) => x.item);
}

/**
 * Computes the escape-hatch fallback level (D-03).
 * Formula: clamp(prior.center + delta, prior.min, prior.max)
 * too_hard → center - 1, too_easy → center + 1
 */
export function computeAbortFallback(
  reason: 'too_hard' | 'too_easy',
  gradeBand: GradeBand,
): number {
  const prior = GRADE_PRIOR[gradeBand];
  const delta = reason === 'too_hard' ? -1 : +1;
  return Math.max(prior.min, Math.min(prior.max, prior.center + delta));
}

// ---------------------------------------------------------------------------
// Stateful functions (DB access)
// ---------------------------------------------------------------------------

/**
 * Returns the current placement state for a child (D-06).
 * Single indexed query — no N+1.
 */
export async function getPlacementState(childId: ChildId): Promise<PlacementState> {
  const [latest] = await db
    .select({
      finishedAt: attempts.finishedAt,
      escapeHatched: attempts.escapeHatched,
    })
    .from(attempts)
    .where(and(eq(attempts.childId, childId), eq(attempts.kind, 'placement')))
    .orderBy(desc(attempts.startedAt))
    .limit(1);

  if (!latest) return 'not_started';
  if (latest.escapeHatched) return 'escape_hatched';
  if (!latest.finishedAt) return 'in_progress';
  return 'completed';
}

/**
 * Creates a new placement attempt row (D-07).
 * kind='placement', placementBankVersion=1
 */
export async function startPlacement(childId: ChildId): Promise<AttemptId> {
  const [row] = await db
    .insert(attempts)
    .values({
      childId,
      kind: 'placement',
      placementBankVersion: 1,
    })
    .returning({ id: attempts.id });

  if (!row) throw new Error('startPlacement: insert returned no row');
  return brandedAttemptId(row.id);
}

/**
 * Returns the next unanswered placement question for the attempt.
 * Choices are returned in deterministic shuffled order (seed: attemptId:questionId).
 * isCorrect is STRIPPED from the returned choices (T-3-bundle-leak mitigation).
 */
export async function getNextPlacementItem(attemptId: AttemptId): Promise<PlacementItem | null> {
  // 1. Load the attempt and verify it's in_progress
  const [attempt] = await db
    .select({ id: attempts.id, childId: attempts.childId, finishedAt: attempts.finishedAt, escapeHatched: attempts.escapeHatched })
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);

  if (!attempt) throw new AuthError('NO_ACTIVE_CHILD');
  if (attempt.finishedAt || attempt.escapeHatched) return null;

  // 2. Find which placement question IDs have already been answered
  const answeredRows = await db
    .select({ questionId: attemptAnswers.questionId })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));
  const answeredIds = new Set(answeredRows.map((r) => r.questionId));

  // 3. Fetch ALL placement questions (is_placeholder = true), ordered by level then position
  const allPlacementQuestions = await db
    .select({
      id: questions.id,
      promptAr: questions.promptAr,
      position: questions.position,
      textId: questions.textId,
    })
    .from(questions)
    .where(eq(questions.isPlaceholder, true))
    .orderBy(questions.textId, questions.position);

  // Find next unanswered question
  const nextQuestion = allPlacementQuestions.find((q) => !answeredIds.has(q.id));
  if (!nextQuestion) return null;

  // 4. Fetch the passage (text) for this question
  if (!nextQuestion.textId) throw new Error('Placement question has no textId');

  const [text] = await db
    .select({ id: texts.id, titleAr: texts.titleAr, bodyAr: texts.bodyAr, levelId: texts.levelId })
    .from(texts)
    .where(eq(texts.id, nextQuestion.textId))
    .limit(1);

  if (!text) throw new Error(`Text not found for question ${nextQuestion.id}`);

  // Resolve level number from levelId
  const [levelRow] = await db
    .select({ number: levels.number })
    .from(levels)
    .where(eq(levels.id, text.levelId))
    .limit(1);

  if (!levelRow) throw new Error(`Level not found for text ${text.id}`);

  // 5. Fetch the 4 choices for this question
  const rawChoices = await db
    .select({ id: choices.id, textAr: choices.textAr })
    .from(choices)
    .where(eq(choices.questionId, nextQuestion.id));

  // 6. Deterministic shuffle (D-02): seed = attemptId:questionId
  const seed = `${attemptId}:${nextQuestion.id}`;
  const shuffledChoices = deterministicShuffle(rawChoices, seed);

  // 7. Build PlacementItem — strip isCorrect (T-3-bundle-leak mitigation)
  const questionIndex = answeredIds.size + 1; // 1-based
  const totalQuestions = allPlacementQuestions.length;

  return {
    questionId: nextQuestion.id as QuestionId,
    promptAr: nextQuestion.promptAr,
    choices: shuffledChoices.map((c) => ({ id: c.id as ChoiceId, labelAr: c.textAr })),
    level: levelRow.number,
    passageTitleAr: text.titleAr,
    passageBodyAr: text.bodyAr,
    questionIndex,
    totalQuestions,
  };
}

/**
 * Records a placement answer server-authoritatively.
 * Looks up isCorrect server-side. Stores choice_order as JSONB.
 * On the 15th answer, runs assignLevel() and closes the attempt.
 */
export async function recordPlacementAnswer(
  input: RecordPlacementAnswerInput,
): Promise<RecordPlacementAnswerResult> {
  const parsed = RecordPlacementAnswerInput.parse(input);
  const attemptId = parsed.attemptId as AttemptId;
  const questionId = parsed.questionId as QuestionId;
  const chosenChoiceId = parsed.chosenChoiceId as ChoiceId;

  // 1. Server-side correctness lookup
  const [chosenChoice] = await db
    .select({ id: choices.id, isCorrect: choices.isCorrect })
    .from(choices)
    .where(eq(choices.id, chosenChoiceId))
    .limit(1);

  if (!chosenChoice) throw new Error(`Choice not found: ${chosenChoiceId}`);

  // 2. Re-derive the shuffled order for persistence (audit trail — T-3-deterministic-retake)
  const allChoicesForQ = await db
    .select({ id: choices.id })
    .from(choices)
    .where(eq(choices.questionId, questionId));

  const seed = `${attemptId}:${questionId}`;
  const shuffledOrder = deterministicShuffle(allChoicesForQ, seed).map((c) => c.id);

  // 3. Insert attempt_answers row
  await db.insert(attemptAnswers).values({
    attemptId,
    questionId,
    chosenChoiceId,
    isCorrect: chosenChoice.isCorrect,
    choiceOrder: shuffledOrder,
  });

  // 4. Count total answers for this attempt
  const [countRow] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));

  const answerCount = Number(countRow?.count ?? 0);

  // 5. Check if we have all 15 answers
  const allPlacementQuestionsCount = await db
    .select({ count: sql<number>`count(*)` })
    .from(questions)
    .where(eq(questions.isPlaceholder, true));

  const totalQuestions = Number(allPlacementQuestionsCount[0]?.count ?? 15);

  if (answerCount < totalQuestions) {
    // Not done yet — return next item
    const nextItem = await getNextPlacementItem(attemptId);
    return { correct: chosenChoice.isCorrect === 1, nextItem, finalResult: null };
  }

  // 6. All questions answered — compute final level
  // Aggregate per-passage accuracy
  const passageAggRows = await db
    .select({
      levelNumber: levels.number,
      totalQuestions: sql<number>`count(${attemptAnswers.id})`,
      correctAnswers: sql<number>`sum(${attemptAnswers.isCorrect})`,
    })
    .from(attemptAnswers)
    .innerJoin(questions, eq(attemptAnswers.questionId, questions.id))
    .innerJoin(texts, eq(questions.textId, texts.id))
    .innerJoin(levels, eq(texts.levelId, levels.id))
    .where(eq(attemptAnswers.attemptId, attemptId))
    .groupBy(levels.number, levels.id);

  const passageResults: PassageResult[] = passageAggRows.map((r) => ({
    level: r.levelNumber,
    totalQuestions: Number(r.totalQuestions),
    correctAnswers: Number(r.correctAnswers),
  }));

  // Need child's grade band
  const [attemptRow] = await db
    .select({ childId: attempts.childId })
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);

  if (!attemptRow) throw new Error(`Attempt not found: ${attemptId}`);

  const [childRow] = await db
    .select({ gradeBand: childProfiles.gradeBand })
    .from(childProfiles)
    .where(eq(childProfiles.id, attemptRow.childId))
    .limit(1);

  if (!childRow) throw new Error(`Child not found for attempt ${attemptId}`);

  const { assignedLevel } = assignLevel({
    passageResults,
    gradeBand: childRow.gradeBand as GradeBand,
  });

  // D-07 reconciliation: look up levels.id for the assigned integer level
  const [levelRow] = await db
    .select({ id: levels.id })
    .from(levels)
    .where(eq(levels.number, assignedLevel))
    .limit(1);

  if (!levelRow) throw new Error(`Level number ${assignedLevel} not found in levels table`);

  // Count total correct
  const totalCorrectRows = await db
    .select({ total: sql<number>`sum(${attemptAnswers.isCorrect})` })
    .from(attemptAnswers)
    .where(eq(attemptAnswers.attemptId, attemptId));
  const totalCorrect = Number(totalCorrectRows[0]?.total ?? 0);

  // Update attempt: assignedLevelId + finishedAt + score
  await db
    .update(attempts)
    .set({
      assignedLevelId: levelRow.id,
      finishedAt: new Date(),
      score: totalCorrect,
    })
    .where(eq(attempts.id, attemptId));

  return {
    correct: chosenChoice.isCorrect === 1,
    nextItem: null,
    finalResult: {
      attemptId,
      assignedLevel,
      escapeHatched: false,
      escapeHatchedReason: null,
    },
  };
}

/**
 * Aborts placement with an escape-hatch reason (D-03).
 * Computes fallback level from grade-prior center ± 1 (clamped).
 */
export async function abortPlacement(input: {
  attemptId: AttemptId;
  reason: 'too_hard' | 'too_easy';
}): Promise<PlacementResult> {
  const parsed = AbortPlacementInput.parse(input);
  const attemptId = parsed.attemptId as AttemptId;
  const reason = parsed.reason as 'too_hard' | 'too_easy';

  // Load attempt + child profile for grade band
  const [attemptRow] = await db
    .select({ childId: attempts.childId })
    .from(attempts)
    .where(eq(attempts.id, attemptId))
    .limit(1);

  if (!attemptRow) throw new Error(`Attempt not found: ${attemptId}`);

  const [childRow] = await db
    .select({ gradeBand: childProfiles.gradeBand })
    .from(childProfiles)
    .where(eq(childProfiles.id, attemptRow.childId))
    .limit(1);

  if (!childRow) throw new Error(`Child not found for attempt ${attemptId}`);

  const fallbackLevel = computeAbortFallback(reason, childRow.gradeBand as GradeBand);

  // D-07 reconciliation: look up levels.id for fallback integer level
  const [levelRow] = await db
    .select({ id: levels.id })
    .from(levels)
    .where(eq(levels.number, fallbackLevel))
    .limit(1);

  if (!levelRow) throw new Error(`Level number ${fallbackLevel} not found in levels table`);

  // Update attempt: escape-hatch fields + assignedLevelId + finishedAt
  await db
    .update(attempts)
    .set({
      escapeHatched: true,
      escapeHatchedAt: new Date(),
      escapeHatchedReason: reason,
      assignedLevelId: levelRow.id,
      finishedAt: new Date(),
      score: null,
    })
    .where(eq(attempts.id, attemptId));

  return {
    attemptId,
    assignedLevel: fallbackLevel,
    escapeHatched: true,
    escapeHatchedReason: reason,
  };
}

/**
 * Resets placement by hard-deleting the latest completed/escape-hatched attempt.
 * Cascade deletes attempt_answers. After delete, getPlacementState returns 'not_started'.
 * Hard-delete chosen over soft-archive: simpler, parent must confirm before reset.
 */
export async function resetPlacement(childId: ChildId): Promise<void> {
  // Find the latest completed or escape-hatched placement attempt
  const [latest] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(
      and(
        eq(attempts.childId, childId),
        eq(attempts.kind, 'placement'),
      ),
    )
    .orderBy(desc(attempts.startedAt))
    .limit(1);

  if (!latest) return; // Nothing to reset

  // Hard-delete (attempt_answers cascade via FK)
  await db.delete(attempts).where(eq(attempts.id, latest.id));
}

// Re-export AuthError for callers that need it
export { AuthError };

// Keep RecordPlacementAnswerInput exported (used by Plan 04 Server Actions)
export { RecordPlacementAnswerInput as RecordPlacementAnswerInputSchema };
