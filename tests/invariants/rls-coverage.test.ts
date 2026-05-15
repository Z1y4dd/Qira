// FOUND-06 gate — every Drizzle pgTable MUST have at least one policy attached.
//
// Build-time check (no live DB needed): walks every exported pgTable in
// `@/db/schema` via getTableConfig and asserts `policies.length > 0`.
// Failure message points at the offending table by name.

import { is } from 'drizzle-orm';
import { getTableConfig, PgTable } from 'drizzle-orm/pg-core';
import { describe, expect, test } from 'vitest';
import * as schema from '@/db/schema';

const tables = (Object.values(schema) as unknown[]).filter((v): v is PgTable =>
  is(v, PgTable),
);

describe('RLS coverage', () => {
  test('schema exports at least one table', () => {
    expect(tables.length).toBeGreaterThan(0);
  });

  for (const table of tables) {
    const config = getTableConfig(table);
    test(`table ${config.name} has RLS policy`, () => {
      expect(config.policies, `Table ${config.name} is missing RLS policies`).toBeDefined();
      expect(
        config.policies.length,
        `Table ${config.name} has no RLS policies attached`,
      ).toBeGreaterThan(0);
    });
  }
});
