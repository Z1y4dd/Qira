'use server';

// TODO(POLISH-04): Arabic error states for placement actions — Phase 4

import type { Route } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ACTIVE_CHILD_COOKIE } from '@/lib/active-child-cookie';
import { recordPlacementAnswer, startPlacement } from '@/services/placement';
import { AuthError, requireActiveChild } from '@/services/profiles';
import { createClient } from '@/utils/supabase/server';

/**
 * Creates a new placement attempt for the active child and redirects to the
 * placement item page. Reads the active-child cookie to scope the attempt.
 */
export async function startPlacementAction(): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let active;
  try {
    active = await requireActiveChild(supabase, cookieStore.get(ACTIVE_CHILD_COOKIE)?.value);
  } catch (err) {
    if (err instanceof AuthError) redirect('/choose-child');
    throw err;
  }

  const attemptId = await startPlacement(active.id);
  redirect(`/placement/${attemptId}` as Route);
}

/**
 * Confirms the child finished reading the passage and redirects to the
 * question screen for the same item. Uses ?showPassage=0 search param to
 * signal that the passage was already shown — the page renders QuestionScreen
 * instead of PassageScreen when this param is present.
 *
 * Server-bound args only — no user input path.
 */
export async function advanceToFirstQuestionAction(args: {
  attemptId: string;
}): Promise<void> {
  if (!args.attemptId || typeof args.attemptId !== 'string') {
    throw new Error('advanceToFirstQuestionAction: attemptId is required');
  }
  redirect(`/placement/${args.attemptId}?showPassage=0` as Route);
}

/**
 * Records the child's answer for one placement question (server-authoritative).
 * Args are server-bound via .bind(null, {...}) in choice-card.tsx — the choice
 * ID is baked in at render time, never from client formData.
 *
 * On completion (all 15 answered) → redirect to /placement/{attemptId}/result.
 * Otherwise → redirect to /placement/{attemptId} (renders next item).
 */
export async function recordPlacementAnswerAction(args: {
  attemptId: string;
  questionId: string;
  chosenChoiceId: string;
}): Promise<void> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  let active;
  try {
    active = await requireActiveChild(supabase, cookieStore.get(ACTIVE_CHILD_COOKIE)?.value);
  } catch (err) {
    if (err instanceof AuthError) redirect('/choose-child');
    throw err;
  }

  const result = await recordPlacementAnswer({
    childId: active.id,
    attemptId: args.attemptId,
    questionId: args.questionId,
    chosenChoiceId: args.chosenChoiceId,
  });

  if (result.finalResult !== null) {
    redirect(`/placement/${args.attemptId}/result` as Route);
  } else {
    redirect(`/placement/${args.attemptId}` as Route);
  }
}

// abortPlacementAction is added by Plan 05 wave 4 (escape-hatch wiring) — appended to this file.
