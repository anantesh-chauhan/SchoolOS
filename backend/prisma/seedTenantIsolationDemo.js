import 'dotenv/config';
import bcryptjs from 'bcryptjs';
import { pathToFileURL } from 'node:url';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const { default: prisma } = await import('../src/config/prisma.client.js');

export const seedTenantIsolationDemo = async () => {
  const password = await bcryptjs.hash('admin123', 10);
  const school = await prisma.school.upsert({
    where: { schoolCode: 'DPS002' },
    update: { status: 'ACTIVE' },
    create: {
      schoolName: 'Delhi Public School Demo',
      schoolCode: 'DPS002',
      slug: 'delhi-public-school-demo',
      address: 'Mathura Road',
      city: 'New Delhi',
      state: 'Delhi',
      phone: '+91-11-2711002',
      email: 'contact@dps-demo.example.test',
      status: 'ACTIVE',
      theme: { primaryColor: '#1d4ed8', secondaryColor: '#1e3a8a' },
      config: { academicSession: '2026-27', board: 'CBSE', demoData: true },
    },
  });

  const admin = await prisma.user.upsert({
    where: { email: 'admin.dps@schoolos.demo' },
    update: { password, schoolId: school.id, role: 'ADMIN', isActive: true, mustChangePassword: false },
    create: { email: 'admin.dps@schoolos.demo', password, name: 'DPS Demo Admin', role: 'ADMIN', schoolId: school.id, employeeId: 'ADM-DPS-001', isActive: true, mustChangePassword: false },
  });
  await prisma.user.upsert({
    where: { email: 'fee.manager.dps002@schoolos.demo' },
    update: { password, schoolId: school.id, role: 'FEE_MANAGER', isActive: true, mustChangePassword: false },
    create: { email: 'fee.manager.dps002@schoolos.demo', password, name: 'DPS Demo Fee Manager', role: 'FEE_MANAGER', schoolId: school.id, employeeId: 'FEE-DPS-001', isActive: true, mustChangePassword: false },
  });

  const classRow = await prisma.class.upsert({
    where: { schoolId_className: { schoolId: school.id, className: 'Class 6' } },
    update: {},
    create: { schoolId: school.id, className: 'Class 6', classOrder: 6 },
  });
  await prisma.section.upsert({
    where: { classId_sectionName: { classId: classRow.id, sectionName: 'A' } },
    update: {},
    create: { schoolId: school.id, classId: classRow.id, sectionName: 'A', sectionOrder: 1 },
  });

  const student = await prisma.student.upsert({
    where: { admissionNo: 'DPS002-C6-A-001' },
    update: { schoolId: school.id, isActive: true },
    create: {
      schoolId: school.id,
      admissionNo: 'DPS002-C6-A-001',
      studentFirstName: 'Riya',
      studentLastName: 'Malhotra',
      dob: new Date('2014-08-12T00:00:00Z'),
      gender: 'Female',
      className: 'Class 6',
      section: 'A',
      rollNumber: '01',
      fatherName: 'Amit Malhotra',
      motherName: 'Neha Malhotra',
      parentMobile: '9990000001',
      session: '2026-27',
      isActive: true,
    },
  });

  await prisma.feeModuleSetting.upsert({
    where: { schoolId: school.id },
    update: { enabled: true },
    create: { schoolId: school.id, enabled: true, mode: 'COMPONENT_BASED', createdById: admin.id },
  });
  const structure = await prisma.feeStructure.upsert({
    where: { schoolId_academicSession_code_version: { schoolId: school.id, academicSession: '2026-27', code: 'DPS-DEMO-2026', version: 1 } },
    update: { status: 'PUBLISHED' },
    create: {
      schoolId: school.id,
      academicSession: '2026-27',
      name: 'DPS Demo Academic Fee',
      code: 'DPS-DEMO-2026',
      mode: 'COMPONENT_BASED',
      version: 1,
      status: 'PUBLISHED',
      publishedAt: new Date(),
      createdById: admin.id,
      approvedById: admin.id,
      components: { create: { schoolId: school.id, academicSession: '2026-27', name: 'Monthly Tuition', code: 'TUITION', amountMinor: 280000, frequency: 'MONTHLY', dueDay: 10, createdById: admin.id } },
    },
    include: { components: true },
  });
  if (!await prisma.feeAssignment.findFirst({ where: { schoolId: school.id, feeStructureId: structure.id, targetType: 'SCHOOL', active: true } })) {
    await prisma.feeAssignment.create({ data: { schoolId: school.id, academicSession: '2026-27', feeStructureId: structure.id, targetType: 'SCHOOL', priority: 10, createdById: admin.id } });
  }
  const account = await prisma.studentFeeAccount.upsert({
    where: { schoolId_studentId_academicSession: { schoolId: school.id, studentId: student.id, academicSession: '2026-27' } },
    update: {},
    create: { schoolId: school.id, studentId: student.id, academicSession: '2026-27' },
  });
  const component = structure.components[0];
  await prisma.studentFeeCharge.upsert({
    where: { schoolId_studentId_feeStructureId_feeComponentId_academicSession_installmentName: { schoolId: school.id, studentId: student.id, feeStructureId: structure.id, feeComponentId: component.id, academicSession: '2026-27', installmentName: 'April Tuition' } },
    update: {},
    create: { schoolId: school.id, studentId: student.id, feeAccountId: account.id, feeStructureId: structure.id, feeComponentId: component.id, academicSession: '2026-27', installmentName: 'April Tuition', dueDate: new Date('2026-04-10T00:00:00Z'), baseAmountMinor: 280000, status: 'OVERDUE' },
  });

  console.log(`[tenant-isolation-seed] ${school.schoolName}: ready`);
};

export const disconnectTenantIsolationSeed = async () => prisma.$disconnect();

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    await seedTenantIsolationDemo();
  } finally {
    await disconnectTenantIsolationSeed();
  }
}
