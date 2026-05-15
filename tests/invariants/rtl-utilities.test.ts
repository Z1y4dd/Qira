import { readFile } from 'node:fs/promises';
import { glob } from 'tinyglobby';
import { expect, test } from 'vitest';

/**
 * Invariant: no physical-direction Tailwind utilities in source files.
 *
 * Permitted: logical properties — ms-*, me-*, ps-*, pe-*, text-start, text-end,
 * border-s, border-e, rounded-s*, rounded-e*, etc.
 *
 * Permitted: direction-neutral — mx-*, my-*, px-*, py-*, border-x-*, border-y-*,
 * inset-x-*, inset-y-*.
 *
 * Forbidden: physical — ml-*, mr-*, pl-*, pr-*, text-left, text-right,
 * float-left, float-right, border-l-*, border-r-*, rounded-l, rounded-r,
 * rounded-tl, rounded-tr, rounded-bl, rounded-br.
 *
 * This test is a belt-and-suspenders mirror of scripts/lint-rtl.sh.
 * Both must pass in CI.
 */

// Matches Tailwind physical-direction utilities. Uses negative lookbehind to avoid
// matching substrings inside longer words (e.g. "html" should not match "ml").
// The pattern requires the utility name to be at a class boundary:
//   - preceded by a quote, space, newline, or start of string
//   - followed by a hyphen and at least one character
const FORBIDDEN =
  /(?<=["'\s`\n^]|^)(ml|mr|pl|pr|text-left|text-right|float-left|float-right|border-l|border-r|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br)-[\w\[]/gm;

test('no physical-direction Tailwind utilities in source', async () => {
  const files = await glob(['src/**/*.{ts,tsx,css}', 'app/**/*.{ts,tsx,css}']);

  const offenders: Array<{ file: string; matches: string[] }> = [];

  for (const f of files) {
    const content = await readFile(f, 'utf8');
    const matches = content.match(FORBIDDEN);
    if (matches) {
      offenders.push({ file: f, matches });
    }
  }

  expect(offenders, JSON.stringify(offenders, null, 2)).toEqual([]);
});
