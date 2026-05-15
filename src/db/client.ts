// Runtime: Vercel Node functions only. Edge runtime is out for v1 (PROJECT.md). postgres.js 3.x driver per RESEARCH §C.

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Pooler URL (...pooler.supabase.com:6543) + transaction-mode requires:
//   prepare: false  — no prepared statements (pgbouncer transaction pooling)
//   max: 1          — one connection per serverless invocation
//
// Lazy: postgres() is not invoked until the first query. This keeps
// `next build` working in CI without DATABASE_URL.

type Db = ReturnType<typeof drizzle<typeof schema>>;
let _db: Db | undefined;

export function getDb(): Db {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('DATABASE_URL is not set');
  const client = postgres(connectionString, { prepare: false, max: 1 });
  _db = drizzle(client, { schema });
  return _db;
}

// Convenience getter for callers that already gated on env at startup.
export const db = new Proxy({} as Db, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});

export { schema };
