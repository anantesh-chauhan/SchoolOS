import 'dotenv/config';
import pg from 'pg';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const PRISMA_MIGRATION_LOCK_ID = 72707369;
const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

try {
  const result = await client.query(
    `select l.pid, pg_terminate_backend(l.pid) as terminated
     from pg_locks l
     where l.locktype = 'advisory'
       and l.granted = true
       and l.classid = 0
       and l.objid = $1
       and l.pid <> pg_backend_pid()`,
    [PRISMA_MIGRATION_LOCK_ID],
  );

  if (result.rowCount === 0) {
    console.log('No abandoned Prisma migration lock was present.');
  } else if (result.rows.every((row) => row.terminated)) {
    console.log(`Released ${result.rowCount} abandoned Prisma migration lock session(s).`);
  } else {
    throw new Error('PostgreSQL did not terminate every Prisma migration lock session.');
  }
} finally {
  await client.end();
}
