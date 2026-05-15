/**
 * NFC normalization for Arabic text at the DB boundary.
 *
 * Arabic letters with diacritics can be represented as a single precomposed
 * codepoint (NFC) or as a base letter + combining marks (NFD). Postgres
 * comparisons and full-text search treat these as different strings.
 *
 * Together with the Zod `ArabicText` schema, the invariant
 * "any Arabic string stored in Postgres is NFC-normalized" holds.
 */

/** Normalize a single Arabic string to NFC form. */
export function nfcString(s: string): string {
  return s.normalize('NFC');
}

/**
 * Return a shallow copy of `obj` with the named string fields normalized
 * to NFC. Non-string field values pass through unchanged.
 *
 * Use at the boundary of every Drizzle insert/update that accepts Arabic
 * input from the caller.
 */
export function nfc<T extends Record<string, unknown>>(obj: T, fields: (keyof T)[]): T {
  const out = { ...obj };
  for (const f of fields) {
    const v = out[f];
    if (typeof v === 'string') {
      out[f] = v.normalize('NFC') as T[keyof T];
    }
  }
  return out;
}
