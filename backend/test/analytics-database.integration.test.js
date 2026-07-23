import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import prisma from '../src/config/prisma.client.js';

const enabled = process.env.RUN_DB_INTEGRATION_TESTS === 'true';
const integration = enabled ? test : test.skip;

after(async () => prisma.$disconnect());

integration('analytics migration created all critical tables', async () => {
  const tables = await prisma.$queryRaw`
    SELECT unnest(ARRAY[
      to_regclass('"AnalyticsConfiguration"')::text,
      to_regclass('"AnalyticsRiskRule"')::text,
      to_regclass('"StudentAnalyticsSnapshot"')::text,
      to_regclass('"AnalyticsAuditLog"')::text,
      to_regclass('"ResourceEngagementEvent"')::text
    ]) AS name
  `;
  assert.equal(tables.length, 5);
  assert.ok(tables.every((row) => row.name));
});

integration('analytics configuration remains unique per school', async () => {
  const duplicates = await prisma.$queryRaw`
    SELECT "schoolId", COUNT(*)::int AS count
    FROM "AnalyticsConfiguration"
    GROUP BY "schoolId"
    HAVING COUNT(*) > 1
  `;
  assert.deepEqual(duplicates, []);
});

integration('analytics tenant references remain internally consistent', async () => {
  const mismatches = await prisma.$queryRaw`
    SELECT COUNT(*)::int AS count
    FROM "ResourceEngagementEvent" event
    JOIN "SectionResource" resource ON resource.id = event."resourceId"
    JOIN "Student" student ON student.id = event."studentId"
    WHERE event."schoolId" <> resource."schoolId"
       OR event."schoolId" <> student."schoolId"
  `;
  assert.equal(mismatches[0].count, 0);
});

