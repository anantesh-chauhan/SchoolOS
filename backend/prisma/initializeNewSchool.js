import 'dotenv/config';
import prisma from '../src/config/prisma.client.js';
import { initializeNewSchoolAcademicSetup } from '../src/services/newSchoolAcademicSetup.service.js';

const schoolId = process.argv[2];
if (!schoolId) {
  console.error('Usage: node prisma/initializeNewSchool.js <schoolId>');
  process.exit(1);
}

try {
  const result = await initializeNewSchoolAcademicSetup(schoolId);
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
