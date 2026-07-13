import 'dotenv/config';
import prisma from '../src/config/prisma.client.js';
import { initializeNewSchoolAcademicSetup } from '../src/services/newSchoolAcademicSetup.service.js';
import bcryptjs from 'bcryptjs';

const stamp = Date.now().toString(36).toUpperCase();
let schoolId;
try {
  const hash = await bcryptjs.hash('Smoke!Pass9', 10);
  const school = await prisma.$transaction(async (tx) => {
    const created = await tx.school.create({ data: { schoolName: `Setup Smoke ${stamp}`, schoolCode: `SMK${stamp}`.slice(0, 16), slug: `setup-smoke-${stamp.toLowerCase()}`, address: 'Temporary test address', city: 'Test City', state: 'Test State', phone: '9999999999', email: `smoke-${stamp.toLowerCase()}@example.test`, status: 'ACTIVE', theme: { primaryColor: '#0f766e', secondaryColor: '#0f172a' }, config: {} } });
    await tx.schoolSettings.create({ data: { schoolId: created.id, schoolName: created.schoolName, email: created.email, phone: created.phone, addressLine1: created.address, city: created.city, state: created.state, country: 'India' } });
    await tx.user.createMany({ data: [
      { email: `owner-${stamp.toLowerCase()}@example.test`, password: hash, name: 'Smoke Owner', role: 'SCHOOL_OWNER', schoolId: created.id, mustChangePassword: true },
      { email: `admin-${stamp.toLowerCase()}@example.test`, password: hash, name: 'Smoke Admin', role: 'ADMIN', schoolId: created.id, mustChangePassword: true },
    ] });
    return created;
  });
  schoolId = school.id;
  const result = await initializeNewSchoolAcademicSetup(school.id);
  const retryResult = await initializeNewSchoolAcademicSetup(school.id);
  console.log(JSON.stringify({ success: true, result, retryResult }, null, 2));
} catch (error) {
  console.error(JSON.stringify({ success: false, name: error.name, code: error.code, message: error.message, meta: error.meta, stack: error.stack }, null, 2));
  process.exitCode = 1;
} finally {
  if (schoolId) {
    await prisma.user.deleteMany({ where: { schoolId } });
    await prisma.school.delete({ where: { id: schoolId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
}
