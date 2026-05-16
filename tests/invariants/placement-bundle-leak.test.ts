// T-3-bundle-leak gate — `isCorrect` MUST NOT appear in client-visible code.
//
// PROJECT.md Pitfall #5 (server-authoritative scoring): the correctness flag on
// `choices` and `attempt_answers` rows must never be serialized into the RSC
// wire payload or sent to the browser in any form. Server-side service code
// reads `isCorrect` from the DB to determine a submitted answer's correctness,
// then returns only a `correct: boolean` to the client — the answer key
// (which choice IS correct) never travels to the browser.
//
// This grep gate catches the code-level pattern. The runtime complement
// (Playwright `page.waitForResponse()` asserting the RSC payload does NOT
// contain 'isCorrect' or 'is_correct') lands in Plan 05 Task 5.3 and
// Plan 06 Task 6.3.

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { globSync } from 'tinyglobby';
import { describe, expect, test } from 'vitest';

const REPO_ROOT = process.cwd();
const ALLOW_LIST = new Set<string>([]);
const PATTERN = /\bisCorrect\b/;

const files = globSync(['src/app/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'], {
  cwd: REPO_ROOT,
  ignore: ['**/node_modules/**', '**/.next/**'],
});

describe('placement bundle leak', () => {
  test('source tree is non-empty (sanity)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    if (ALLOW_LIST.has(file)) continue;
    test(`${file} does not expose isCorrect to client bundle`, () => {
      const contents = readFileSync(join(REPO_ROOT, file), 'utf8');
      const match = contents.match(PATTERN);
      const where = match
        ? `${relative(REPO_ROOT, join(REPO_ROOT, file))}:${contents.slice(0, match.index).split('\n').length}`
        : '';
      expect(
        match,
        `${where} — isCorrect must never appear in src/app or src/components. ` +
          'Service layer code reads it server-side and returns only correct: boolean. ' +
          'See T-3-bundle-leak and PROJECT.md Pitfall #5.',
      ).toBeNull();
    });
  }
});
