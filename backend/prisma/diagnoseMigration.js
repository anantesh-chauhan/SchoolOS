import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

const client = new Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

await client.connect();

const migrations = await client.query(`
  select migration_name, finished_at, rolled_back_at
  from _prisma_migrations
  order by started_at desc
  limit 10
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

console.log(JSON.stringify({ migrations: migrations.rows, tables: tables.rows, types: types.rows, indexes: indexes.rows, feeTables: feeTables.rows }, null, 2));

await client.end();
