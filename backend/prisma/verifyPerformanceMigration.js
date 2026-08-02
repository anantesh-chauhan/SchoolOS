import 'dotenv/config';
import prisma from '../src/config/prisma.client.js';

try {
  const rows = await prisma.$queryRawUnsafe(`
    SELECT column_name AS name
    FROM information_schema.columns
    WHERE table_name = 'School' AND column_name = 'publicationVersion'
    UNION ALL
    SELECT indexname AS name
    FROM pg_indexes
    WHERE tablename = 'Student'
      AND indexname IN (
        'Student_schoolId_isActive_createdAt_idx',
        'Student_schoolId_className_section_isActive_idx'
        , 'Student_schoolId_isActive_className_section_createdAt_idx'
      )
  `);
  const names = new Set(rows.map((row) => row.name));
  const expected = [
    'publicationVersion',
    'Student_schoolId_isActive_createdAt_idx',
    'Student_schoolId_className_section_isActive_idx',
    'Student_schoolId_isActive_className_section_createdAt_idx',
  ];
  const missing = expected.filter((name) => !names.has(name));
  if (missing.length) throw new Error(`Missing database objects: ${missing.join(', ')}`);
  console.log(JSON.stringify({ verified: expected }, null, 2));
} finally {
  await prisma.$disconnect();
}
