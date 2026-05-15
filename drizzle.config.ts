import { defineConfig } from 'drizzle-kit';

// drizzle-kit reads .env / .env.local automatically via dotenv when run as `drizzle-kit migrate`.
// We still load it here so `drizzle-kit generate` (which does NOT auto-load envs in 0.31.x)
// works without a wrapper script.
import { config } from 'dotenv';
config({ path: '.env.local' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    // DIRECT_DATABASE_URL: pgbouncer transaction-mode pooling does not support DDL,
    // so migrations must hit the unpooled (port 5432) endpoint.
    url: process.env.DIRECT_DATABASE_URL!,
  },
  verbose: true,
  strict: true,
});
