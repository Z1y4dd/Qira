import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ArabicTextSize = 'reader' | 'ui' | 'caption';
type ArabicTextAs = 'h1' | 'h2' | 'h3' | 'p' | 'span' | 'div';
type ArabicTextDiacritics = 'show' | 'hide';

interface ArabicTextProps {
  children: ReactNode;
  /** HTML element to render. Default 'span'. */
  as?: ArabicTextAs;
  /** Visual variant. 'reader' = Noto Naskh + generous leading for Tashkeel passages. 'ui' = Cairo for chrome. 'caption' = small UI. Default 'ui'. */
  size?: ArabicTextSize;
  /** Diacritic visibility. 'hide' disables OpenType ligature contextuals to suppress Tashkeel rendering. Default 'show'. */
  diacritics?: ArabicTextDiacritics;
  className?: string;
}

const sizeClasses: Record<ArabicTextSize, string> = {
  reader: 'font-naskh text-2xl leading-[1.9]',
  ui: 'font-cairo text-base leading-[1.6]',
  caption: 'font-cairo text-sm leading-[1.4]',
};

const diacriticsHideClass = '[font-feature-settings:"liga"_off]';

/**
 * The Arabic-text rendering primitive.
 *
 * Every Arabic literal in the app should be wrapped in <ArabicText>. The
 * `<bdi>` ensures correct bidirectional isolation when Arabic is composed
 * with Latin tokens (names, numbers, identifiers).
 *
 * Server Component — no `'use client'` needed; the primitive carries no
 * interactivity.
 */
export function ArabicText({
  children,
  as: Tag = 'span',
  size = 'ui',
  diacritics = 'show',
  className,
}: ArabicTextProps) {
  return (
    <Tag
      lang="ar"
      className={cn(sizeClasses[size], diacritics === 'hide' && diacriticsHideClass, className)}
    >
      <bdi>{children}</bdi>
    </Tag>
  );
}
