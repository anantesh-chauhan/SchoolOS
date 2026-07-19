import 'dotenv/config';
import pg from 'pg';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const migrationTable = await client.query(`select to_regclass('public._prisma_migrations') as name`);
const migrations = migrationTable.rows[0].name
  ? await client.query(`
      select migration_name, finished_at, rolled_back_at
      from _prisma_migrations
      order by started_at desc
      limit 20
    `)
  : { rows: [] };

const allTables = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_type = 'BASE TABLE'
  order by table_name
`);

const advisoryLocks = await client.query(`
  select l.pid, l.granted, a.application_name, a.state
  from pg_locks l
  left join pg_stat_activity a on a.pid = l.pid
  where l.locktype = 'advisory'
  order by l.granted desc, l.pid
`);

const tables = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public'
    and table_name in ('ChapterAssessment', 'ChapterAssessmentResult', 'StudentChapterMastery', 'LearningGap', 'LearningIntervention', 'StudentAttendance', 'TeacherAttendance')
  order by table_name
`);

const types = await client.query(`
  select typname
  from pg_type
  where typname in ('AssessmentType', 'MasteryLevel', 'MasteryConfidence', 'InterventionStatus')
  order by typname
`);

const indexes = await client.query(`
  select indexname
  from pg_indexes
  where schemaname = 'public'
    and (
      indexname like 'ChapterAssessment%'
      or indexname like 'StudentChapterMastery%'
      or indexname like 'Learning%'
    )
  order by indexname
`);

const feeTables = await client.query(`
  select table_name
  from information_schema.tables
  where table_schema = 'public' and table_name like 'Fee%'
  order by table_name
`);

console.log(JSON.stringify({
  migrationTableExists: Boolean(migrationTable.rows[0].name),
  migrations: migrations.rows,
  allTables: allTables.rows,
  advisoryLocks: advisoryLocks.rows,
  tables: tables.rows,
  types: types.rows,
  indexes: indexes.rows,
  feeTables: feeTables.rows,
}, null, 2));

await client.end();
