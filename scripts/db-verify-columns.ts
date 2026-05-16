// Phase 3 schema verification — confirms all new columns and the escape_hatch_reason
// enum landed in the live Supabase DB after `pnpm db:migrate`.
// Runs against DIRECT_DATABASE_URL (un-pooled) for DDL stability.
import { config } from 'dotenv';
import postgres from 'postgres';

config({ path: '.env.local' });

async function main() {
  const url = process.env.DIRECT_DATABASE_URL;
  if (!url) throw new Error('DIRECT_DATABASE_URL is not set');

  const sql = postgres(url, { max: 1, prepare: false });

  // Expected columns: table_name → column_name
  const expectedColumns: Array<{ table: string; column: string }> = [
    { table: 'attempts', column: 'escape_hatched' },
    { table: 'attempts', column: 'escape_hatched_at' },
    { table: 'attempts', column: 'escape_hatched_reason' },
    { table: 'attempts', column: 'placement_bank_version' },
    { table: 'attempt_answers', column: 'choice_order' },
    { table: 'texts', column: 'is_placeholder' },
    { table: 'questions', column: 'is_placeholder' },
  ];

  const columns = await sql`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('attempts', 'attempt_answers', 'texts', 'questions')
  `;

  const found = new Set(columns.map((r) => `${r.table_name}.${r.column_name}`));

  const missing: string[] = [];
  for (const { table, column } of expectedColumns) {
    const key = `${table}.${column}`;
    if (found.has(key)) {
      console.log(`  ✓ ${key}`);
    } else {
      console.error(`  ✗ MISSING: ${key}`);
      missing.push(key);
    }
  }

  // Check the escape_hatch_reason enum exists in pg_type
  const enumRows = await sql`
    SELECT typname FROM pg_type
    WHERE typname = 'escape_hatch_reason'
      AND typtype = 'e'
  `;

  if (enumRows.length > 0) {
    console.log('  ✓ enum: escape_hatch_reason');
  } else {
    console.error('  ✗ MISSING: enum escape_hatch_reason');
    missing.push('enum:escape_hatch_reason');
  }

  await sql.end();

  if (missing.length > 0) {
    console.error(`\nPhase 3 schema verification FAILED — ${missing.length} item(s) missing.`);
    console.error('Run `pnpm db:migrate` and retry.');
    process.exit(1);
  }

  console.log('\nPhase 3 schema verified — all 7 columns + escape_hatch_reason enum present.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
