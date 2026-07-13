import prisma from '../src/config/prisma.client.js';
import { ensureSchoolSecurityCurriculumDefaults } from '../src/services/schoolSecurityCurriculumSeed.service.js';
import bcryptjs from 'bcryptjs';

if (process.env.NODE_ENV === 'production' && !process.env.CURRICULUM_MANAGER_SEED_PASSWORD) {
  throw new Error('Set CURRICULUM_MANAGER_SEED_PASSWORD before running this seed in production');
}

try {
  const schools = await prisma.school.findMany({ select: { id: true, schoolName: true, schoolCode: true } });
  await prisma.$executeRawUnsafe(`ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CURRICULUM_MANAGER'`);
  const readiness = await prisma.$queryRaw`
    SELECT
      to_regclass('public."Curriculum"') IS NOT NULL AS "hasCurriculum",
      to_regclass('public."AcademicCalendarDay"') IS NOT NULL AS "hasCalendar",
      to_regclass('public."Book"') IS NOT NULL AS "hasBooks",
      to_regclass('public."Publisher"') IS NOT NULL AS "hasPublishers",
      to_regclass('public."UserSecurityQuestion"') IS NOT NULL AS "hasSecurityQuestions",
      EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'User' AND column_name = 'sessionVersion'
      ) AS "hasSecurityColumns"
  `;
  const extensionsReady = Boolean(readiness[0]?.hasCurriculum && readiness[0]?.hasCalendar && readiness[0]?.hasBooks && readiness[0]?.hasPublishers && readiness[0]?.hasSecurityQuestions && readiness[0]?.hasSecurityColumns);
  const temporaryPassword = process.env.CURRICULUM_MANAGER_SEED_PASSWORD || 'Curriculum@2026!';
  const passwordHash = await bcryptjs.hash(temporaryPassword, 12);
  for (const school of schools) {
    const safeCode = String(school.schoolCode).toLowerCase().replace(/[^a-z0-9]+/g, '');
    const loginId = `curriculum.manager@${safeCode}.schoolos`;
    if (extensionsReady) {
      const result = await ensureSchoolSecurityCurriculumDefaults(school.id);
      console.log(`${school.schoolCode}: ${result.calendarEvents} calendar events, ${result.books} books, ${result.chapters} linked chapters; Curriculum Manager ${result.curriculumManager.loginId}`);
    } else {
      await prisma.$executeRaw`
        INSERT INTO "User" ("id", "email", "password", "name", "role", "schoolId", "contactEmail", "employeeId", "isActive", "mustChangePassword", "createdAt", "updatedAt")
        VALUES (${`curriculum_${school.id}`}, ${loginId}, ${passwordHash}, ${'Curriculum Manager'}, CAST('CURRICULUM_MANAGER' AS "Role"), ${school.id}, NULL, NULL, true, true, NOW(), NOW())
        ON CONFLICT DO NOTHING
      `;
      console.log(`${school.schoolCode}: Curriculum Manager ${loginId} ensured; extended curriculum/calendar seed deferred until migration deployment.`);
    }
  }
  const coverage = await prisma.$queryRaw`
    SELECT s."schoolCode", COUNT(u."id")::int AS "managerCount"
    FROM "School" s
    LEFT JOIN "User" u ON u."schoolId" = s."id" AND u."role" = CAST('CURRICULUM_MANAGER' AS "Role") AND u."isActive" = true
    GROUP BY s."id", s."schoolCode"
    ORDER BY s."schoolCode"
  `;
  const missing = coverage.filter((row) => row.managerCount < 1);
  coverage.forEach((row) => console.log(`VERIFY ${row.schoolCode}: ${row.managerCount} active Curriculum Manager(s)`));
  if (missing.length) throw new Error(`Curriculum Manager coverage failed for: ${missing.map((row) => row.schoolCode).join(', ')}`);
  if (!extensionsReady) console.warn('Security/curriculum/calendar migration is not fully deployed; manager accounts were seeded successfully, but extended defaults were skipped.');
} finally {
  await prisma.$disconnect();
}
