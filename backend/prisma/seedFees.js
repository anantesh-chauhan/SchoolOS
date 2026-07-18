import 'dotenv/config';

// Prisma's Windows engine can fail against some Supabase certificate chains in
// `sslmode=require`. Keep the workaround local to development seeding.
if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}
const { default: prisma } = await import('../src/config/prisma.client.js');
const { default: bcrypt } = await import('bcryptjs');
const demoPassword = 'FeeDemo@2026';

const addMonths = (date, months) => { const copy = new Date(date); copy.setMonth(copy.getMonth() + months); return copy; };

try {
  const schools = await prisma.school.findMany({ include: { users: { where: { role: { in: ['SCHOOL_OWNER', 'ADMIN'] } }, take: 1 }, students: { where: { isActive: true }, take: 8 } } });
  for (const school of schools) {
    const admin = school.users[0]; if (!admin || !school.students.length) continue;
    const managerEmail = `fee.manager.${school.schoolCode.toLowerCase()}@schoolos.demo`;
    const feeManager = await prisma.user.upsert({ where: { email: managerEmail }, create: { email: managerEmail, password: await bcrypt.hash(demoPassword, 10), name: 'Demo Fee Manager', role: 'FEE_MANAGER', schoolId: school.id, employeeId: `FEE-${school.schoolCode}`, mustChangePassword: false }, update: { role: 'FEE_MANAGER', schoolId: school.id, isActive: true } });
    await prisma.feeModuleSetting.upsert({ where: { schoolId: school.id }, create: { schoolId: school.id, enabled: true, createdById: admin.id }, update: { enabled: true } });
    const existing = await prisma.feeStructure.findFirst({ where: { schoolId: school.id, academicSession: school.students[0].session, code: 'DEMO-COMPONENT', version: 1 } });
    const structure = existing || await prisma.feeStructure.create({ data: { schoolId: school.id, academicSession: school.students[0].session, name: 'Standard Component Fee', code: 'DEMO-COMPONENT', mode: 'COMPONENT_BASED', status: 'PUBLISHED', version: 1, createdById: admin.id, approvedById: admin.id, publishedAt: new Date(), components: { create: [
      { schoolId: school.id, academicSession: school.students[0].session, name: 'Tuition Fee', code: 'TUITION', amountMinor: 150000, frequency: 'MONTHLY', gracePeriodDays: 5, lateFeeRule: { type: 'DAILY', amountMinor: 1000, maximumMinor: 50000 }, createdById: admin.id },
      { schoolId: school.id, academicSession: school.students[0].session, name: 'Transport Fee', code: 'TRANSPORT', amountMinor: 50000, frequency: 'MONTHLY', mandatory: false, createdById: admin.id },
    ] } }, include: { components: true } });
    const components = await prisma.feeComponent.findMany({ where: { feeStructureId: structure.id } });
    if (!await prisma.feeAssignment.count({ where: { schoolId: school.id, academicSession: structure.academicSession, feeStructureId: structure.id, targetType: 'SCHOOL', active: true } })) {
      await prisma.feeAssignment.create({ data: { schoolId: school.id, academicSession: structure.academicSession, feeStructureId: structure.id, targetType: 'SCHOOL', priority: 10, createdById: admin.id } });
    }
    for (const [index, student] of school.students.entries()) {
      const account = await prisma.studentFeeAccount.upsert({ where: { schoolId_studentId_academicSession: { schoolId: school.id, studentId: student.id, academicSession: student.session } }, create: { schoolId: school.id, studentId: student.id, academicSession: student.session }, update: {} });
      if (await prisma.studentFeeCharge.count({ where: { feeAccountId: account.id } })) continue;
      for (let month = 0; month < 3; month += 1) {
        const component = components[0]; const dueDate = addMonths(new Date('2026-04-10T00:00:00Z'), month);
        const paidMinor = index % 3 === 0 ? 150000n : index % 3 === 1 && month === 0 ? 75000n : 0n;
        await prisma.studentFeeCharge.create({ data: { schoolId: school.id, studentId: student.id, feeAccountId: account.id, feeStructureId: structure.id, feeComponentId: component.id, academicSession: student.session, installmentName: `${dueDate.toLocaleString('en', { month: 'long' })} Tuition`, dueDate, baseAmountMinor: 150000, paidMinor, status: paidMinor === 150000n ? 'PAID' : paidMinor > 0n ? 'PARTIALLY_PAID' : dueDate < new Date() ? 'OVERDUE' : 'UPCOMING' } });
      }
    }
    // Create real payment, allocation and receipt rows for the seeded charges.
    // This makes the student fee history screens useful immediately after seeding.
    for (const [index, student] of school.students.entries()) {
      const account = await prisma.studentFeeAccount.findUnique({ where: { schoolId_studentId_academicSession: { schoolId: school.id, studentId: student.id, academicSession: student.session } } });
      if (!account || await prisma.feePayment.count({ where: { feeAccountId: account.id } })) continue;
      const charges = await prisma.studentFeeCharge.findMany({ where: { feeAccountId: account.id }, orderBy: { dueDate: 'asc' } });
      for (const [chargeIndex, charge] of charges.entries()) {
        const amountMinor = BigInt(charge.paidMinor);
        if (!amountMinor) continue;
        const paymentDate = addMonths(new Date('2026-04-05T00:00:00Z'), chargeIndex);
        const payment = await prisma.feePayment.create({ data: {
          schoolId: school.id, studentId: student.id, feeAccountId: account.id, academicSession: student.session,
          idempotencyKey: `seed-${student.id}-${charge.id}`, paymentNumber: `DEMO-PAY-${student.admissionNo || index}-${chargeIndex + 1}`,
          amountMinor, method: chargeIndex % 2 ? 'UPI' : 'CASH', status: 'COMPLETED', paymentDate, collectedById: feeManager.id,
          allocations: { create: { schoolId: school.id, chargeId: charge.id, amountMinor } },
        } });
        await prisma.feeReceipt.create({ data: {
          schoolId: school.id, academicSession: student.session, paymentId: payment.id,
          receiptNumber: `DEMO/${student.session}/${String(index + 1).padStart(2, '0')}${String(chargeIndex + 1).padStart(2, '0')}`,
          verificationCode: `seed-${school.id.slice(-8)}-${student.id.slice(-8)}-${chargeIndex}`,
          snapshot: { student: { name: `${student.studentFirstName} ${student.studentLastName || ''}`.trim(), admissionNo: student.admissionNo }, payment: { amountMinor: Number(amountMinor), paymentDate } },
        } });
      }
    }
    const template = await prisma.feeNotificationTemplate.upsert({ where: { schoolId_name: { schoolId: school.id, name: 'Overdue fee reminder' } }, create: { schoolId: school.id, name: 'Overdue fee reminder', type: 'OVERDUE', title: 'Fee payment reminder', body: 'Dear {{parentName}}, {{dueAmount}} is pending for {{studentName}} and was due on {{dueDate}}.', createdById: admin.id }, update: {} });
    const scholarship = await prisma.feeScholarship.upsert({ where: { schoolId_academicSession_code: { schoolId: school.id, academicSession: school.students[0].session, code: 'MERIT-DEMO' } }, create: { schoolId: school.id, academicSession: school.students[0].session, name: 'Merit Scholarship', code: 'MERIT-DEMO', type: 'PERCENTAGE', valueBasisPoints: 2500, maximumMinor: 100000, requiresDocument: true, createdById: admin.id }, update: {} });
    const first = school.students[0];
    for (const parentStudent of school.students.filter((student) => student.parentUserId)) {
      const linkedChildren = school.students.filter((student) => student.parentMobile === parentStudent.parentMobile);
      for (const child of linkedChildren) await prisma.feeFamilyLink.upsert({ where: { schoolId_parentUserId_studentId: { schoolId: school.id, parentUserId: parentStudent.parentUserId, studentId: child.id } }, create: { schoolId: school.id, parentUserId: parentStudent.parentUserId, studentId: child.id }, update: { active: true } });
    }
    if (!await prisma.feeReminder.count({ where: { schoolId: school.id, studentId: first.id } })) await prisma.feeReminder.create({ data: { schoolId: school.id, studentId: first.id, academicSession: first.session, type: template.type, title: template.title, message: `Dear ${first.fatherName}, this is a demo fee reminder for ${first.studentFirstName}.`, sentById: feeManager.id } });
    if (!await prisma.studentFeeScholarship.count({ where: { schoolId: school.id, studentId: first.id, scholarshipId: scholarship.id } })) await prisma.studentFeeScholarship.create({ data: { schoolId: school.id, studentId: first.id, scholarshipId: scholarship.id, academicSession: first.session, amountMinor: 37500, status: 'APPROVED', requestedById: admin.id, approvedById: admin.id, approvedAt: new Date(), reason: 'Demo merit award' } });
    const refundStudent = school.students[1] || first;
    if (!await prisma.feeAdjustment.count({ where: { schoolId: school.id, studentId: refundStudent.id, type: 'REFUND' } })) await prisma.feeAdjustment.create({ data: { schoolId: school.id, studentId: refundStudent.id, academicSession: refundStudent.session, type: 'REFUND', amountMinor: 10000, reason: 'Demo excess payment refund request', requestedById: feeManager.id } });
    console.log(`Seeded fee demo data for ${school.schoolName}`);
    console.log(`  Fee Manager: ${managerEmail} / ${demoPassword}`);
  }
} finally {
  await prisma.$disconnect();
}
