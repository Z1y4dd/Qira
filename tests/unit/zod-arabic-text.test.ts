import { describe, test, expect } from 'vitest';
import { ArabicText } from '@/lib/zod';

describe('ArabicText schema', () => {
  test('accepts an NFC-normalized Arabic string', () => {
    const result = ArabicText.safeParse('مرحباً بكم في قِراءة');
    expect(result.success).toBe(true);
  });

  test('rejects empty string', () => {
    const result = ArabicText.safeParse('');
    expect(result.success).toBe(false);
  });

  test('rejects a known-NFD pair that differs from its NFC composed form', () => {
    // Decomposed: ALEF (U+0627) + COMBINING MADDA ABOVE (U+0653). NFC composes to U+0622.
    const decomposed = 'آ';
    expect(decomposed.normalize('NFC')).not.toBe(decomposed);

    const result = ArabicText.safeParse(decomposed);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toMatch(/NFC/);
    }
  });

  test('accepts the NFC composed form of the same letter', () => {
    const result = ArabicText.safeParse('آ');
    expect(result.success).toBe(true);
  });
});
