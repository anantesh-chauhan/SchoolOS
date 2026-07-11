import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';

const { Client } = pg;

const migrationName = process.argv[2];
if (!migrationName) {
  throw new Error('Usage: node prisma/applyMigrationFile.js <migration-folder-name>');
}

const migrationPath = path.join(process.cwd(), 'prisma', 'migrations', migrationName, 'migration.sql');
const sql = await fs.readFile(migrationPath, 'utf8');
const checksum = crypto.createHash('sha256').update(sql).digest('hex');

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const existing = await client.query(
  'select id, finished_at from _prisma_migrations where migration_name = $1',
  [migrationName],
);

if (existing.rows.some((row) => row.finished_at)) {
  console.log(`${migrationName} is already recorded as applied.`);
  await client.end();
  process.exit(0);
}

const id = crypto.randomUUID();
const startedAt = new Date();

await client.query('begin');
try {
  await client.query(
    `insert into _prisma_migrations
      (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
     values ($1, $2, null, $3, null, null, $4, 0)`,
    [id, checksum, migrationName, startedAt],
  );

  await client.query(sql);

  await client.query(
    'update _prisma_migrations set finished_at = $1, applied_steps_count = 1 where id = $2',
    [new Date(), id],
  );
  await client.query('commit');
  console.log(`${migrationName} applied successfully.`);
} catch (error) {
  await client.query('rollback');
  console.error(error);
  process.exitCode = 1;
} finally {
  await client.end();
}
