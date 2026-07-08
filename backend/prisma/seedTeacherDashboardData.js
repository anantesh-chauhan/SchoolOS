import { PrismaClient } from '@prisma/client';
import { disconnectAcademicSeed, seedTeacherDashboardDemoDataForSchool } from './seedAcademicData.js';

const prisma = new PrismaClient();

try {
  const schools = await prisma.school.findMany({
    select: { id: true, schoolName: true, schoolCode: true },
  });

  for (const school of schools) {
    await seedTeacherDashboardDemoDataForSchool(school);
    console.log(`[teacher-dashboard-seed] ${school.schoolName}: completed`);
  }
} finally {
  await prisma.$disconnect();
  await disconnectAcademicSeed();
}
