// Seed script — 20 reading levels (Levels 1–20).
//
// Idempotent: re-running inserts zero rows on conflict (levels.number is UNIQUE).
// Each Arabic literal is NFC-normalized inline. The proper Zod-mediated path
// lands in Slice 4 — this transitional shortcut is acceptable here because
// the only Arabic content is the level name itself.
//
// Digit convention: Western digits per RESEARCH §I decision #1 (1..20),
// not Eastern Arabic digits (١..٢٠) — chosen for the diaspora target.

import { config } from 'dotenv';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { levels } from '../schema';

config({ path: '.env.local' });

async function main() {
  const url = process.env.DIRECT_DATABASE_URL;
  if (!url) throw new Error('DIRECT_DATABASE_URL is not set');

  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client);

  const rows = Array.from({ length: 20 }, (_, i) => {
    const number = i + 1;
    return {
      number,
      nameAr: `المستوى ${number}`.normalize('NFC'),
    };
  });

  const result = await db.insert(levels).values(rows).onConflictDoNothing({
    target: levels.number,
  });

  // postgres.js exposes count via `count` on the underlying result; drizzle's
  // result shape doesn't surface rowCount uniformly across drivers, so verify
  // via a follow-up count query.
  const counted = await db.select().from(levels);
  console.log(`Seeded ${result.count ?? rows.length} level rows. Total in DB: ${counted.length}.`);

  await client.end();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
