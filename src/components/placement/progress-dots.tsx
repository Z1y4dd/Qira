import { ArabicText } from '@/components/arabic-text';

interface ProgressDotsProps {
  total: number;
  current: number; // 1-based
}

/**
 * Horizontal progress dot strip for the placement quiz.
 * Filled = answered, pulsing = current, empty = upcoming.
 *
 * NO direction-specific logic — `flex` reverses naturally under dir="rtl".
 * Western digits rendered inside <bdi dir="ltr"> per CONTEXT §Specific Ideas.
 */
export function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <div className="flex flex-col items-center gap-2">
      <ArabicText size="caption" className="text-muted-foreground">
        سؤال{' '}
        <bdi dir="ltr" className="font-cairo">
          {current}
        </bdi>
      </ArabicText>
      <div className="flex justify-center gap-1.5" aria-hidden="true">
        {Array.from({ length: total }, (_, i) => {
          const isAnswered = i < current - 1;
          const isCurrent = i === current - 1;
          return (
            <span
              key={i}
              className={[
                'h-2 w-2 rounded-full',
                isAnswered ? 'bg-primary' : '',
                isCurrent ? 'bg-primary animate-pulse' : '',
                !isAnswered && !isCurrent ? 'bg-muted' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            />
          );
        })}
      </div>
    </div>
  );
}
