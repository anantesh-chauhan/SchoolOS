import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const names = [
  '20260511030659_init',
  '20260511052040_add_about_page_model',
  '202607080000_baseline',
];
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
await client.connect();

try {
  await client.query('begin');
  for (const migrationName of names) {
    const file = await fs.readFile(path.join(process.cwd(), 'prisma', 'migrations', migrationName, 'migration.sql'), 'utf8');
    const checksum = crypto.createHash('sha256').update(file).digest('hex');
    const result = await client.query(
      `update _prisma_migrations
       set checksum = $1
       where migration_name = $2
         and finished_at is not null
         and rolled_back_at is null`,
      [checksum, migrationName],
    );
    if (result.rowCount !== 1) throw new Error(`Expected one successfully applied migration record for ${migrationName}`);
  }
  await client.query('commit');
  console.log('Prisma migration checksums reconciled. No application tables were changed.');
} catch (error) {
  await client.query('rollback');
  throw error;
} finally {
  await client.end();
}
