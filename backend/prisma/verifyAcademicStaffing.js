import 'dotenv/config';
import { PrismaClient } from '../src/generated/prisma/index.js';
import { runStaffingAudit } from '../src/services/academicStaffing.service.js';

const prisma = new PrismaClient();
try {
  const schoolCode = process.argv.find((value) => value.startsWith('--schoolCode='))?.split('=')[1];
  const schools = await prisma.school.findMany({ where: { status: 'ACTIVE', ...(schoolCode ? { schoolCode } : {}) }, select: { id: true, schoolName: true } });
  for (const school of schools) {
    const session = await prisma.academicSession.findFirst({ where: { schoolId: school.id, isActive: true } });
    if (!session) { console.log(JSON.stringify({ school: school.schoolName, error: 'NO_ACTIVE_SESSION' })); continue; }
    const audit = await runStaffingAudit({ schoolId: school.id, academicSessionId: session.id });
    const teacherCategories = await prisma.teacher.groupBy({ by: ['teacherCategory'], where: { schoolId: school.id, isActive: true, deletedAt: null }, _count: { _all: true } });
    console.log(JSON.stringify({ school: school.schoolName, session: session.name, teacherCategories: Object.fromEntries(teacherCategories.map((row) => [row.teacherCategory, row._count._all])), ...audit }, null, 2));
  }
} finally {
  await prisma.$disconnect();
}
