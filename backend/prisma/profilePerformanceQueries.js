import 'dotenv/config';
import prisma from '../src/config/prisma.client.js';

const summarize = (label, result) => {
  const root = result?.[0]?.['QUERY PLAN']?.[0];
  const plan = root?.Plan || {};
  return {
    label,
    planningTimeMs: root?.['Planning Time'] ?? null,
    executionTimeMs: root?.['Execution Time'] ?? null,
    node: plan['Node Type'] || null,
    index: plan['Index Name'] || plan.Plans?.[0]?.['Index Name'] || null,
    actualRows: plan['Actual Rows'] ?? null,
    sharedHitBlocks: plan['Shared Hit Blocks'] ?? null,
    sharedReadBlocks: plan['Shared Read Blocks'] ?? null,
  };
};

try {
  const schools = await prisma.student.groupBy({ by: ['schoolId'], _count: { _all: true } });
  const largestSchool = schools.sort((a, b) => b._count._all - a._count._all)[0];
  const schoolId = largestSchool?.schoolId;
  if (!schoolId) throw new Error('No student data is available for profiling');
  const recent = await prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT "id", "studentFirstName", "className", "section", "createdAt"
    FROM "Student"
    WHERE "schoolId" = ${schoolId} AND "isActive" = true
    ORDER BY "createdAt" DESC
    LIMIT 25
  `;
  const placement = await prisma.$queryRaw`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    SELECT "id", "studentFirstName", "className", "section", "rollNumber"
    FROM "Student"
    WHERE "schoolId" = ${schoolId} AND "className" IS NOT NULL AND "isActive" = true
    ORDER BY "className", "section", "createdAt"
    LIMIT 25
  `;
  console.log(JSON.stringify({ schoolId, studentCount: largestSchool._count._all, profiles: [summarize('recent-students', recent), summarize('allocation-roster', placement)] }, null, 2));
} finally {
  await prisma.$disconnect();
}
