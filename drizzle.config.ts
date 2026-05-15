// drizzle-kit reads .env / .env.local automatically via dotenv when run as `drizzle-kit migrate`.
// We still load it here so `drizzle-kit generate` (which does NOT auto-load envs in 0.31.x)
// works without a wrapper script.
import { config } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

config({ path: '.env.local' });

// DIRECT_DATABASE_URL: pgbouncer transaction-mode pooling does not support DDL,
// so migrations must hit the unpooled (port 5432) endpoint.
const directUrl = process.env.DIRECT_DATABASE_URL;
if (!directUrl) {
  throw new Error('DIRECT_DATABASE_URL is required to run drizzle-kit');
}

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: directUrl,
  },
  verbose: true,
  strict: true,
});
