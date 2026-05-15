/**
 * Service Layer module — comprehension questions and answer evaluation.
 *
 * RULES (see profiles.ts for full rules):
 *   - NO `next/*` imports. Framework-agnostic.
 *   - listQuestionsForText must NEVER leak `isCorrect` to the client.
 *   - recordAnswer is the ONLY source of truth for correctness — the client
 *     submits a choice ID, the server resolves correctness from the DB.
 *
 * Functions throw until Phase 4 lands the comprehension vertical.
 */
import type { TextId } from './library';
import type { AttemptId, ChoiceId, QuestionId } from './placement';

export interface ComprehensionChoice {
  id: ChoiceId;
  labelAr: string;
  // isCorrect intentionally absent — never shipped to client.
}

export type QuestionKind = 'literal' | 'vocab' | 'inferential' | 'prediction' | 'evaluative';

export interface ComprehensionQuestion {
  id: QuestionId;
  textId: TextId;
  kind: QuestionKind;
  promptAr: string;
  /** Choices in randomized order. */
  choices: ComprehensionChoice[];
}

export function listQuestionsForText(_textId: TextId): Promise<ComprehensionQuestion[]> {
  throw new Error('comprehension.listQuestionsForText: not implemented until Phase 4');
}

export interface RecordAnswerInput {
  attemptId: AttemptId;
  questionId: QuestionId;
  chosenChoiceId: ChoiceId;
}

export interface RecordAnswerResult {
  correct: boolean;
  /** Kid-readable Arabic feedback. Supportive on wrong; congratulatory on right. */
  feedbackAr: string;
  /** Number of retries used so far for this question (max 1 retry per PROJECT design). */
  retriesUsed: number;
}

export function recordAnswer(_input: RecordAnswerInput): Promise<RecordAnswerResult> {
  throw new Error('comprehension.recordAnswer: not implemented until Phase 4');
}
