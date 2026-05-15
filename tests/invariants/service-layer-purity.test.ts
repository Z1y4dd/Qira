import { describe, test, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Service Layer must remain framework-agnostic so Phase 5's
 * /api/v1/* Route Handlers can call through the same surface.
 *
 * Forbidden: any import that starts with `next/`.
 */

const SERVICES_DIR = join(process.cwd(), 'src', 'services');

const FORBIDDEN_IMPORT = /from\s+['"]next\//;

describe('service-layer purity', () => {
  const serviceFiles = readdirSync(SERVICES_DIR).filter((f) => f.endsWith('.ts'));

  test('the services directory is non-empty (sanity)', () => {
    expect(serviceFiles.length).toBeGreaterThan(0);
  });

  for (const file of serviceFiles) {
    test(`${file} contains no next/* imports`, () => {
      const contents = readFileSync(join(SERVICES_DIR, file), 'utf8');
      const offender = contents.match(FORBIDDEN_IMPORT);
      expect(offender, `${file} imports from next/* — service layer must be framework-agnostic`).toBeNull();
    });
  }
});
