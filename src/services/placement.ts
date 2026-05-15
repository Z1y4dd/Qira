/**
 * Service Layer module — placement assessment.
 *
 * RULES (see profiles.ts for full rules):
 *   - NO `next/*` imports. Framework-agnostic.
 *   - Zod validation at every entry point.
 *   - Server-authoritative scoring (PROJECT.md Pitfall #5): the client
 *     submits a choice ID, the server returns correctness.
 *
 * Functions throw until Phase 3 lands the placement vertical.
 */
import { z } from 'zod';
import type { ChildId } from './profiles';

export type AttemptId = string & { readonly __brand: 'AttemptId' };
export type QuestionId = string & { readonly __brand: 'QuestionId' };
export type ChoiceId = string & { readonly __brand: 'ChoiceId' };

export interface PlacementItem {
  questionId: QuestionId;
  /** Arabic prompt text, already NFC-normalized at write time. */
  promptAr: string;
  /** Choices presented in randomized order. Correctness is NEVER shipped to the client. */
  choices: { id: ChoiceId; labelAr: string }[];
  level: number;
}

export interface PlacementResult {
  attemptId: AttemptId;
  assignedLevel: number;
}

export function startPlacement(_childId: ChildId): Promise<AttemptId> {
  throw new Error('placement.startPlacement: not implemented until Phase 3');
}

export function getNextPlacementItem(_attemptId: AttemptId): Promise<PlacementItem | null> {
  throw new Error('placement.getNextPlacementItem: not implemented until Phase 3');
}

/** Server-authoritative placement answer recording. */
const RecordPlacementAnswerInput = z.object({
  childId: z.string(),
  attemptId: z.string(),
  questionId: z.string(),
  chosenChoiceId: z.string(),
});

export type RecordPlacementAnswerInput = z.infer<typeof RecordPlacementAnswerInput>;

export interface RecordPlacementAnswerResult {
  correct: boolean;
  nextItem: PlacementItem | null;
  finalResult: PlacementResult | null;
}

export function recordPlacementAnswer(
  input: RecordPlacementAnswerInput,
): Promise<RecordPlacementAnswerResult> {
  RecordPlacementAnswerInput.parse(input);
  throw new Error('placement.recordPlacementAnswer: not implemented until Phase 3');
}

export function resetPlacement(_childId: ChildId): Promise<void> {
  throw new Error('placement.resetPlacement: not implemented until Phase 3');
}
