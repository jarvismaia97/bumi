import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Pool } from 'pg';

/**
 * Applies neon/schema.sql. Every statement in that file is written to be safe to run twice —
 * `create table if not exists`, `add column if not exists` — so this is the migration story:
 * edit the schema, run it, done.
 *
 *   DATABASE_URL=… npm run db:schema
 *
 * The URL is the Neon connection string, the same one Vercel holds; `npx vercel env pull` is
 * the shortest way to get a local copy of it.
 */
async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('Set DATABASE_URL to the Neon connection string');

  const sql = readFileSync(resolve('neon/schema.sql'), 'utf8');
  const pool = new Pool({ connectionString: databaseUrl });

  try {
    // One round trip: the file's statements depend on each other's order.
    await pool.query(sql);
    console.log('Applied neon/schema.sql');
  } finally {
    await pool.end();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
