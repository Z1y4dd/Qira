import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { PassageScreen } from '@/components/placement/passage-screen';
import { QuestionScreen } from '@/components/placement/question-screen';
import type { AttemptId } from '@/services/placement';
import { getNextPlacementItem } from '@/services/placement';

export const dynamic = 'force-dynamic';

interface PlacementItemPageProps {
  params: Promise<{ attemptId: string }>;
  searchParams: Promise<{ showPassage?: string }>;
}

/**
 * Placement item page — switches between PassageScreen and QuestionScreen.
 *
 * D-02 passage-screen → one-question-per-page flow:
 * - If questionIndex % 3 === 1 (first question of a new passage) AND showPassage !== '0':
 *   render PassageScreen (child must read before answering).
 * - Otherwise: render QuestionScreen.
 *
 * The PassageScreen's "أنا جاهز" CTA posts to advanceToFirstQuestionAction which
 * redirects back here with ?showPassage=0 — flipping the render to QuestionScreen.
 *
 * If all 15 questions are answered (getNextPlacementItem returns null),
 * redirect to the result page.
 */
export default async function PlacementItemPage({ params, searchParams }: PlacementItemPageProps) {
  const { attemptId } = await params;
  const { showPassage } = await searchParams;

  const item = await getNextPlacementItem(attemptId as AttemptId);

  if (item === null) {
    // All questions answered — redirect to result
    redirect(`/placement/${attemptId}/result` as Route);
  }

  // Determine whether to show passage or question.
  // First question of a passage block = questionIndex % 3 === 1 (questions 1, 4, 7, 10, 13).
  // showPassage=0 means the child already read the passage this block.
  const isFirstOfPassage = item.questionIndex % 3 === 1;
  const passageAlreadyRead = showPassage === '0';

  if (isFirstOfPassage && !passageAlreadyRead) {
    return <PassageScreen item={item} attemptId={attemptId} />;
  }

  return <QuestionScreen item={item} attemptId={attemptId} />;
}
