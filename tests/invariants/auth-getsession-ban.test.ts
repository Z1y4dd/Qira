// AUTH-06 gate — `supabase.auth.getSession()` MUST NOT appear in server-side code.
//
// `getSession()` returns whatever is in cookies without re-validating the JWT;
// a spoofed or tampered cookie reads back as a valid session. Server-side code
// must use `getUser()` (or `exchangeCodeForSession`) which round-trips to
// Supabase Auth to validate the token.
//
// Allow-list: `src/utils/supabase/client.ts` is the only file where `getSession`
// is acceptable, because browser-side code's trust boundary is localStorage —
// there's no cookie to forge on that side.

import { readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { globSync } from 'tinyglobby';
import { describe, expect, test } from 'vitest';

const REPO_ROOT = process.cwd();
const ALLOW_LIST = new Set(['src/utils/supabase/client.ts']);
const PATTERN = /\bgetSession\b/;

const files = globSync(['src/**/*.{ts,tsx}'], {
  cwd: REPO_ROOT,
  ignore: ['**/node_modules/**', '**/.next/**', 'tests/**'],
});

describe('auth getSession() ban', () => {
  test('source tree is non-empty (sanity)', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  for (const file of files) {
    if (ALLOW_LIST.has(file)) continue;
    test(`${file} contains no getSession() call`, () => {
      const contents = readFileSync(join(REPO_ROOT, file), 'utf8');
      // Skip files that mention getSession only inside a comment block — but
      // simpler/safer: just fail on any occurrence in non-allow-listed files.
      const match = contents.match(PATTERN);
      const where = match
        ? `${relative(REPO_ROOT, join(REPO_ROOT, file))}:${contents.slice(0, match.index).split('\n').length}`
        : '';
      expect(
        match,
        `${where} — server-side code must use getUser() / exchangeCodeForSession(), not getSession(). See AUTH-06.`,
      ).toBeNull();
    });
  }
});
