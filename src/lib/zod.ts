/**
 * Project-wide Zod schemas.
 *
 * Use these at every system boundary: Server Action inputs, API route
 * handlers, form validators, anything reading from the network.
 */
import { z } from 'zod';

/**
 * An Arabic-text field that must already be NFC-normalized.
 *
 * Pair with `nfc()` from `@/db/normalize` at write time: callers can
 * normalize untrusted input via `nfc(input, [...keys])` and then this
 * schema validates the result. The schema does NOT auto-normalize —
 * mismatches between client and server normalization are surfaced as
 * validation errors instead of silently coerced.
 */
export const ArabicText = z
  .string()
  .min(1, 'Arabic text must not be empty')
  .refine((s) => s.normalize('NFC') === s, {
    message: 'Arabic text must be NFC-normalized',
  });

export type ArabicText = z.infer<typeof ArabicText>;
