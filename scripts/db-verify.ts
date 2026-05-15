// Quick verification — list public tables and confirm RLS coverage.
// Runs against DIRECT_DATABASE_URL (un-pooled) for stability.
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

async function main() {
  const url = process.env.DIRECT_DATABASE_URL;
  if (!url) throw new Error('DIRECT_DATABASE_URL is not set');

  const sql = postgres(url, { max: 1, prepare: false });

  const tables = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    ORDER BY tablename
  `;
  console.log(`public tables (${tables.length}):`, tables.map((t) => t.tablename));

  const missingRls = await sql`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename NOT IN (SELECT tablename FROM pg_policies WHERE schemaname = 'public')
  `;
  console.log(`tables missing RLS policies: ${missingRls.length}`);

  const rlsEnabled = await sql`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY c.relname
  `;
  console.log('RLS enabled per table:');
  for (const row of rlsEnabled) console.log(`  ${row.table_name}: ${row.rls_enabled}`);

  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
