import 'dotenv/config';
if (process.env.DATABASE_URL?.includes('sslmode=require')) process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
const { default: prisma } = await import('../src/config/prisma.client.js');

const MONTHS = [3, 4, 5, 6, 7]; // April through August (the next month for the 2026-27 demo session)
const rupees = (value) => BigInt(value * 100);
const classRank = (name = '') => Number((name.match(/\d+/) || [0])[0]);
const monthLabel = (month) => new Date(Date.UTC(2026, month, 1)).toLocaleString('en-IN', { month: 'long' });

async function ensureCharge({ schoolId, student, account, structure, component, installmentName, dueDate, amountMinor, paidMinor }) {
  const existing = await prisma.studentFeeCharge.findFirst({ where: { schoolId, studentId: student.id, feeStructureId: structure.id, feeComponentId: component.id, academicSession: student.session, installmentName } });
  if (existing) return existing;
  const now = new Date();
  return prisma.studentFeeCharge.create({ data: { schoolId, studentId: student.id, feeAccountId: account.id, feeStructureId: structure.id, feeComponentId: component.id, academicSession: student.session, installmentName, dueDate, baseAmountMinor: amountMinor, paidMinor, status: paidMinor === amountMinor ? 'PAID' : paidMinor > 0n ? 'PARTIALLY_PAID' : dueDate < now ? 'OVERDUE' : 'UPCOMING', calculationSnapshot: { seededBy: 'realistic-fees', category: component.code } } });
}

async function createPaymentIfNeeded({ schoolId, student, account, charge, index, collectorId }) {
  if (BigInt(charge.paidMinor) <= 0n) return;
  const idempotencyKey = `realistic-${charge.id}`;
  const partialPayment = await prisma.feePayment.findUnique({ where: { schoolId_idempotencyKey: { schoolId, idempotencyKey } }, include: { receipt: true } });
  if (partialPayment) {
    const allocation = await prisma.feePaymentAllocation.findFirst({ where: { paymentId: partialPayment.id, chargeId: charge.id } });
    if (!allocation) await prisma.feePaymentAllocation.create({ data: { schoolId, paymentId: partialPayment.id, chargeId: charge.id, amountMinor: BigInt(charge.paidMinor) } });
    if (!partialPayment.receipt) await prisma.feeReceipt.create({ data: { schoolId, academicSession: student.session, paymentId: partialPayment.id, receiptNumber: `RFE/${student.session}/${charge.id}`, verificationCode: `rfe-${charge.id}`, snapshot: { student: { name: `${student.studentFirstName} ${student.studentLastName || ''}`.trim(), admissionNo: student.admissionNo }, payment: { amountMinor: Number(charge.paidMinor), paymentDate: partialPayment.paymentDate } } } });
    return;
  }
  const prior = await prisma.feePaymentAllocation.findFirst({ where: { chargeId: charge.id }, include: { payment: { include: { receipt: true } } } });
  if (prior) {
    if (!prior.payment.receipt) await prisma.feeReceipt.create({ data: { schoolId, academicSession: student.session, paymentId: prior.payment.id, receiptNumber: `RFE/${student.session}/${charge.id}`, verificationCode: `rfe-${charge.id}`, snapshot: { student: { name: `${student.studentFirstName} ${student.studentLastName || ''}`.trim(), admissionNo: student.admissionNo }, payment: { amountMinor: Number(prior.amountMinor), paymentDate: prior.payment.paymentDate } } } });
    return;
  }
  const amountMinor = BigInt(charge.paidMinor);
  const paymentDate = new Date(charge.dueDate); paymentDate.setDate(Math.max(1, paymentDate.getDate() - (index % 5) - 1));
  const payment = await prisma.feePayment.create({ data: { schoolId, studentId: student.id, feeAccountId: account.id, academicSession: student.session, idempotencyKey, paymentNumber: `RFE-${charge.id}`, amountMinor, method: index % 3 === 0 ? 'UPI' : index % 3 === 1 ? 'CASH' : 'BANK_TRANSFER', status: 'COMPLETED', paymentDate, collectedById: collectorId, allocations: { create: { schoolId, chargeId: charge.id, amountMinor } } } });
  await prisma.feeReceipt.create({ data: { schoolId, academicSession: student.session, paymentId: payment.id, receiptNumber: `RFE/${student.session}/${charge.id}`, verificationCode: `rfe-${charge.id}`, snapshot: { student: { name: `${student.studentFirstName} ${student.studentLastName || ''}`.trim(), admissionNo: student.admissionNo, className: student.className, section: student.section }, payment: { amountMinor: Number(amountMinor), paymentDate } } } });
}

try {
  const schools = await prisma.school.findMany({ include: { students: { where: { isActive: true }, orderBy: [{ className: 'asc' }, { section: 'asc' }, { studentFirstName: 'asc' }] }, users: { where: { role: { in: ['ADMIN', 'SCHOOL_OWNER', 'FEE_MANAGER'] }, isActive: true }, take: 3 } } });
  for (const school of schools) {
    const collector = school.users.find((u) => u.role === 'FEE_MANAGER') || school.users[0];
    if (!collector || !school.students.length) continue;
    const byClass = new Map(); for (const student of school.students) { const key = `${student.session}:${student.className}`; byClass.set(key, [...(byClass.get(key) || []), student]); }
    let chargesCreated = 0;
    for (const [key, students] of byClass) {
      const [session, className] = key.split(':'); const rank = classRank(className); const tuition = rank <= 5 ? 1800 : rank <= 8 ? 2600 : 3600;
      const code = `RFE-${session.replace(/[^0-9]/g, '')}-${String(rank || 99).padStart(2, '0')}`;
      const structure = await prisma.feeStructure.upsert({ where: { schoolId_academicSession_code_version: { schoolId: school.id, academicSession: session, code, version: 1 } }, create: { schoolId: school.id, academicSession: session, name: `${className} Academic Fee Plan`, code, mode: 'COMPONENT_BASED', status: 'PUBLISHED', version: 1, createdById: collector.id, approvedById: collector.id, publishedAt: new Date(), components: { create: [{ schoolId: school.id, academicSession: session, name: 'Monthly Tuition', code: 'TUITION', amountMinor: rupees(tuition), frequency: 'MONTHLY', dueDay: 10, createdById: collector.id }, { schoolId: school.id, academicSession: session, name: 'Smart Class & Activity', code: 'ACTIVITY', amountMinor: rupees(rank <= 5 ? 250 : 400), frequency: 'MONTHLY', dueDay: 10, createdById: collector.id }] } }, update: {} , include: { components: true } });
      const tuitionComponent = structure.components.find((c) => c.code === 'TUITION'); const activityComponent = structure.components.find((c) => c.code === 'ACTIVITY');
      for (const [studentIndex, student] of students.entries()) {
        const expectedRealisticCharges = studentIndex % 5 < 2 ? 15 : 10;
        const existingRealisticCharges = await prisma.studentFeeCharge.count({
          where: { studentId: student.id, feeStructure: { code: { startsWith: 'RFE-' } } },
        });
        if (existingRealisticCharges >= expectedRealisticCharges) continue;
        const account = await prisma.studentFeeAccount.upsert({ where: { schoolId_studentId_academicSession: { schoolId: school.id, studentId: student.id, academicSession: session } }, create: { schoolId: school.id, studentId: student.id, academicSession: session }, update: {} });
        for (const month of MONTHS) for (const component of [tuitionComponent, activityComponent]) {
          const amount = BigInt(component.amountMinor); const paid = month < 6 ? (studentIndex % 5 === 0 ? amount : studentIndex % 5 === 1 && month === 5 ? amount / 2n : 0n) : 0n;
          const charge = await ensureCharge({ schoolId: school.id, student, account, structure, component, installmentName: `${monthLabel(month)} ${component.name}`, dueDate: new Date(Date.UTC(2026, month, 10)), amountMinor: amount, paidMinor: paid }); chargesCreated += 1; await createPaymentIfNeeded({ schoolId: school.id, student, account, charge, index: month * 10 + studentIndex, collectorId: collector.id });
        }
        // About 40% of students use transport; route bands make their individual amount realistic.
        if (studentIndex % 5 < 2) {
          const transport = rupees([900, 1250, 1650][studentIndex % 3]); const transportCode = `RFE-TRANSPORT-${student.id.slice(-10)}`;
          const transportStructure = await prisma.feeStructure.upsert({ where: { schoolId_academicSession_code_version: { schoolId: school.id, academicSession: session, code: transportCode, version: 1 } }, create: { schoolId: school.id, academicSession: session, name: `Transport plan · ${student.studentFirstName}`, code: transportCode, mode: 'COMPONENT_BASED', status: 'PUBLISHED', version: 1, createdById: collector.id, approvedById: collector.id, publishedAt: new Date(), components: { create: { schoolId: school.id, academicSession: session, name: 'Transport Fee', code: 'TRANSPORT', amountMinor: transport, frequency: 'MONTHLY', dueDay: 7, createdById: collector.id } } }, update: {}, include: { components: true } });
          const component = transportStructure.components[0]; for (const month of MONTHS) { const paid = month < 6 && studentIndex % 5 === 0 ? transport : 0n; const charge = await ensureCharge({ schoolId: school.id, student, account, structure: transportStructure, component, installmentName: `${monthLabel(month)} Transport`, dueDate: new Date(Date.UTC(2026, month, 7)), amountMinor: transport, paidMinor: paid }); await createPaymentIfNeeded({ schoolId: school.id, student, account, charge, index: 100 + month + studentIndex, collectorId: collector.id }); }
        }
      }
    }
    console.log(`${school.schoolName}: prepared realistic fees for ${school.students.length} students (${chargesCreated} academic charge checks).`);
  }
} finally { await prisma.$disconnect(); }
