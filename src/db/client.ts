// Runtime: Vercel Node functions only. Edge runtime is out for v1 (PROJECT.md). postgres.js 3.x driver per RESEARCH §C.

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

// Pooler URL (...pooler.supabase.com:6543) + transaction-mode requires:
//   prepare: false  — no prepared statements (pgbouncer transaction pooling)
//   max: 1          — one connection per serverless invocation
const client = postgres(connectionString, {
  prepare: false,
  max: 1,
});

export const db = drizzle(client, { schema });
export { schema };
