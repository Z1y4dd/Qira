import { ArabicText } from '@/components/arabic-text';
import { recordPlacementAnswerAction } from '@/app/(authenticated)/placement/actions';

interface ChoiceCardProps {
  attemptId: string;
  questionId: string;
  choiceId: string;
  labelAr: string;
  letterAr: 'أ' | 'ب' | 'ج' | 'د';
}

/**
 * Server Component: a single tappable choice card.
 *
 * The entire card is a form submit button — no client JS required.
 * The choice ID is server-bound at render time via .bind(null, {...}), so the
 * server knows which choice was tapped without trusting any client-sent data.
 * This is the PLAC-04 server-authoritative scoring mitigation.
 *
 * min-h-14 = 56px — meets the kid-touch minimum from D-02.
 * ps-/pe- logical padding — RTL-safe (Tailwind v4 logical properties).
 */
export function ChoiceCard({ attemptId, questionId, choiceId, labelAr, letterAr }: ChoiceCardProps) {
  const submitAnswer = recordPlacementAnswerAction.bind(null, {
    attemptId,
    questionId,
    chosenChoiceId: choiceId,
  });

  return (
    <form action={submitAnswer}>
      <button
        type="submit"
        className="w-full min-h-14 flex items-center gap-3 rounded-lg border bg-card ps-4 pe-4 text-start hover:bg-accent focus:outline-none focus:ring-2 focus:ring-primary transition-colors"
      >
        <span className="shrink-0 text-xl font-semibold text-primary">
          <ArabicText size="ui">{letterAr}</ArabicText>
        </span>
        <ArabicText size="ui" className="flex-1 text-start">
          {labelAr}
        </ArabicText>
      </button>
    </form>
  );
}
