import { describe, test, expect } from 'vitest';
import { nfc, nfcString } from '@/db/normalize';

describe('nfcString', () => {
  test('passes through already-NFC strings unchanged', () => {
    const s = 'مرحباً';
    expect(nfcString(s)).toBe(s);
  });

  test('normalizes ARABIC LETTER ALEF WITH MADDA decomposed form to its NFC composed form', () => {
    // Decomposed: ALEF (U+0627) + COMBINING MADDA ABOVE (U+0653)
    const decomposed = 'آ';
    // Composed NFC: ARABIC LETTER ALEF WITH MADDA ABOVE (U+0622)
    const composed = 'آ';
    expect(nfcString(decomposed)).toBe(composed);
    // Sanity: pre-normalization, the inputs are distinct
    expect(decomposed).not.toBe(composed);
  });
});

describe('nfc(obj, fields)', () => {
  test('normalizes named string fields, leaves others untouched', () => {
    const input = {
      titleAr: 'آلف', // decomposed prefix
      bodyAr: 'مرحباً', // already NFC
      level: 5, // non-string, must pass through
    };
    const out = nfc(input, ['titleAr', 'bodyAr']);
    expect(out.titleAr).toBe('آلف');
    expect(out.bodyAr).toBe('مرحباً');
    expect(out.level).toBe(5);
  });

  test('returns a copy, does not mutate input', () => {
    const input = { titleAr: 'آ' };
    const out = nfc(input, ['titleAr']);
    expect(input.titleAr).toBe('آ'); // original unchanged
    expect(out.titleAr).toBe('آ');
  });

  test('ignores fields whose value is not a string', () => {
    const input = { mixed: 42 as unknown };
    const out = nfc(input, ['mixed' as keyof typeof input]);
    expect(out.mixed).toBe(42);
  });
});
