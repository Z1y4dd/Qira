import { ArabicText } from '@/components/arabic-text';
import { advanceToFirstQuestionAction } from '@/app/(authenticated)/placement/actions';
import { Button } from '@/components/ui/button';
import { EscapeHatch } from '@/components/placement/escape-hatch';
import type { PlacementItem } from '@/services/placement';

interface PassageScreenProps {
  item: PlacementItem;
  attemptId: string;
}

/**
 * Server Component: shows the full Arabic passage for the current passage block.
 * The child taps "أنا جاهز" when done reading — this POSTs to
 * advanceToFirstQuestionAction which redirects to ?showPassage=0, triggering
 * QuestionScreen on the next render.
 *
 * D-02: passage and question are NEVER shown simultaneously.
 * D-05: diacritics shown for level < 14, hidden for level >= 14.
 *
 * EscapeHatch (D-04): always visible. Plan 05 wires the abort action inside
 * the EscapeHatch component itself — no changes needed here.
 */
export function PassageScreen({ item, attemptId }: PassageScreenProps) {
  const showDiacritics = item.level >= 14 ? 'hide' : 'show';
  const advanceAction = advanceToFirstQuestionAction.bind(null, { attemptId });

  return (
    <div className="space-y-6" dir="rtl">
      <ArabicText as="h2" size="reader" className="text-3xl block text-center">
        {item.passageTitleAr}
      </ArabicText>

      <ArabicText
        as="p"
        size="reader"
        diacritics={showDiacritics}
        className="block leading-loose max-w-prose mx-auto mt-6"
      >
        {item.passageBodyAr}
      </ArabicText>

      <form action={advanceAction} className="mt-8">
        <Button type="submit" size="lg" className="w-full">
          <ArabicText size="ui">أنا جاهز</ArabicText>
        </Button>
      </form>

      <EscapeHatch mode="placement" attemptId={attemptId} />
    </div>
  );
}
