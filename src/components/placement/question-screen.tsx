import { ArabicText } from '@/components/arabic-text';
import { ChoiceCard } from '@/components/placement/choice-card';
import { EscapeHatch } from '@/components/placement/escape-hatch';
import { ProgressDots } from '@/components/placement/progress-dots';
import type { PlacementItem } from '@/services/placement';

interface QuestionScreenProps {
  item: PlacementItem;
  attemptId: string;
}

const CHOICE_LETTERS = ['أ', 'ب', 'ج', 'د'] as const;

/**
 * Server Component: renders one question with 4 tappable ChoiceCards + progress dots.
 *
 * D-02: vertical stack (flex-col gap-3) — never 2×2 grid. RTL scans vertically better.
 * PLAC-04: choice IDs are server-bound in ChoiceCard; correctness flag never exposed to client.
 * D-04: EscapeHatch always visible. Plan 05 wires the abort action inside the component.
 */
export function QuestionScreen({ item, attemptId }: QuestionScreenProps) {
  return (
    <div className="space-y-6" dir="rtl">
      <ArabicText as="h2" size="ui" className="text-2xl font-semibold block text-center mb-6">
        {item.promptAr}
      </ArabicText>

      <div className="flex flex-col gap-3">
        {item.choices.map((choice, i) => (
          <ChoiceCard
            key={choice.id}
            attemptId={attemptId}
            questionId={item.questionId}
            choiceId={choice.id}
            labelAr={choice.labelAr}
            letterAr={CHOICE_LETTERS[i] ?? 'أ'}
          />
        ))}
      </div>

      <div className="mt-8">
        <ProgressDots total={item.totalQuestions} current={item.questionIndex} />
      </div>

      <EscapeHatch mode="placement" attemptId={attemptId} />
    </div>
  );
}
