import 'dotenv/config';
import { randomUUID } from 'node:crypto';

// Prisma's Windows engine can fail against some Supabase certificate chains in
// `sslmode=require`. Keep the workaround local to development seeding.
if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}
const { default: prisma } = await import('../src/config/prisma.client.js');
const { assignTransport } = await import('../src/modules/fees/feeWorkflow.service.js');
const { default: bcrypt } = await import('bcryptjs');
const demoPassword = 'FeeDemo@2026';

const addMonths = (date, months) => { const copy = new Date(date); copy.setMonth(copy.getMonth() + months); return copy; };

// This is a replacement demo seed: remove only the selected school's fee-domain
// records, then rebuild one coherent structure and its financial history.
const clearFeeDemoData = async (schoolId) => prisma.$transaction([
  prisma.feeRefundAllocation.deleteMany({ where: { schoolId } }),
  prisma.feeRefund.deleteMany({ where: { schoolId } }),
  prisma.feeInvoiceItem.deleteMany({ where: { schoolId } }),
  prisma.feeInvoice.deleteMany({ where: { schoolId } }),
  prisma.feePaymentAllocation.deleteMany({ where: { schoolId } }),
  prisma.feeReceipt.deleteMany({ where: { schoolId } }),
  prisma.feeLedgerEntry.deleteMany({ where: { schoolId } }),
  prisma.feePayment.deleteMany({ where: { schoolId } }),
  prisma.studentFeeScholarship.deleteMany({ where: { schoolId } }),
  prisma.studentFeeCharge.deleteMany({ where: { schoolId } }),
  prisma.studentFeeAccount.deleteMany({ where: { schoolId } }),
  prisma.feeAssignment.deleteMany({ where: { schoolId } }),
  prisma.transportFeeAssignment.deleteMany({ where: { schoolId } }),
  prisma.transportFeeStop.deleteMany({ where: { schoolId } }),
  prisma.transportFeeRoute.deleteMany({ where: { schoolId } }),
  prisma.feeComponent.deleteMany({ where: { schoolId } }),
  prisma.feeStructure.deleteMany({ where: { schoolId } }),
  prisma.feeCategory.deleteMany({ where: { schoolId } }),
  prisma.feeScholarship.deleteMany({ where: { schoolId } }),
  prisma.feeAdjustment.deleteMany({ where: { schoolId } }),
  prisma.feeReminder.deleteMany({ where: { schoolId } }),
  prisma.feeNotificationTemplate.deleteMany({ where: { schoolId } }),
  prisma.feeDailyCashClosing.deleteMany({ where: { schoolId } }),
  prisma.feeFinancialPeriod.deleteMany({ where: { schoolId } }),
  prisma.feeDocument.deleteMany({ where: { schoolId } }),
  prisma.feeFamilyLink.deleteMany({ where: { schoolId } }),
  prisma.feeApprovalRequest.deleteMany({ where: { schoolId } }),
  prisma.feeAuditLog.deleteMany({ where: { schoolId } }),
  prisma.feeModuleSetting.deleteMany({ where: { schoolId } }),
]);

try {
  const seedAllSchools = process.env.FEE_SEED_ALL_SCHOOLS === 'true';
  const targetSchoolCode = process.env.FEE_SEED_SCHOOL_CODE || 'GVS001';
  const schools = await prisma.school.findMany({ where: seedAllSchools ? {} : { schoolCode: targetSchoolCode }, include: { users: { where: { role: { in: ['SCHOOL_OWNER', 'ADMIN'] } }, take: 1 }, students: { where: { isActive: true }, orderBy: [{ className: 'asc' }, { section: 'asc' }, { studentFirstName: 'asc' }] } } });
  if (!schools.length) throw new Error(`No school found for fee replacement seed (${targetSchoolCode})`);
  for (const school of schools) {
    const admin = school.users[0]; if (!admin || !school.students.length) continue;
    await clearFeeDemoData(school.id);
    console.log(`Cleared existing fee data for ${school.schoolName}`);
    const managerEmail = `fee.manager.${school.schoolCode.toLowerCase()}@schoolos.demo`;
    const feeManager = await prisma.user.upsert({ where: { email: managerEmail }, create: { email: managerEmail, password: await bcrypt.hash(demoPassword, 10), name: 'Demo Fee Manager', role: 'FEE_MANAGER', schoolId: school.id, employeeId: `FEE-${school.schoolCode}`, mustChangePassword: false }, update: { role: 'FEE_MANAGER', schoolId: school.id, isActive: true } });
    await prisma.feeModuleSetting.upsert({ where: { schoolId: school.id }, create: { schoolId: school.id, enabled: true, createdById: admin.id }, update: { enabled: true } });
    const structure = await prisma.feeStructure.create({ data: { schoolId: school.id, academicSession: school.students[0].session, name: 'Standard School Fee Structure', code: 'DEMO-COMPONENT', mode: 'COMPONENT_BASED', status: 'PUBLISHED', version: 1, createdById: admin.id, approvedById: admin.id, publishedAt: new Date(), components: { create: [
      { schoolId: school.id, academicSession: school.students[0].session, name: 'Tuition Fee', code: 'TUITION', amountMinor: 150000, frequency: 'MONTHLY', dueDay: 10, gracePeriodDays: 5, lateFeeRule: { type: 'DAILY', amountMinor: 1000, maximumMinor: 50000 }, applicability: { months: [4,5,6,7,8,9,10,11,12,1,2,3], fromAdmissionMonth: true }, createdById: admin.id },
      { schoolId: school.id, academicSession: school.students[0].session, name: 'Annual & Development Fee', code: 'ANNUAL', amountMinor: 300000, frequency: 'ANNUAL', dueDay: 10, applicability: { months: [4] }, createdById: admin.id },
      { schoolId: school.id, academicSession: school.students[0].session, name: 'Examination Fee', code: 'EXAM', amountMinor: 80000, frequency: 'QUARTERLY', dueDay: 10, applicability: { months: [4,7,10,1] }, createdById: admin.id },
      { schoolId: school.id, academicSession: school.students[0].session, name: 'Activity Fee', code: 'ACTIVITY', amountMinor: 30000, frequency: 'MONTHLY', dueDay: 10, applicability: { months: [4,5,6,7,8,9,10,11,12,1,2,3] }, createdById: admin.id },
    ] } }, include: { components: true } });
    await prisma.feeComponent.updateMany({ where: { feeStructureId: structure.id, code: 'TRANSPORT' }, data: { active: false } });
    const components = await prisma.feeComponent.findMany({ where: { feeStructureId: structure.id, active: true } });
    if (!await prisma.feeAssignment.count({ where: { schoolId: school.id, academicSession: structure.academicSession, feeStructureId: structure.id, targetType: 'SCHOOL', active: true } })) {
      await prisma.feeAssignment.create({ data: { schoolId: school.id, academicSession: structure.academicSession, feeStructureId: structure.id, targetType: 'SCHOOL', priority: 10, createdById: admin.id } });
    }
    await prisma.studentFeeAccount.createMany({ data: school.students.map((student) => ({ schoolId: school.id, studentId: student.id, academicSession: student.session })) });
    const accounts = await prisma.studentFeeAccount.findMany({ where: { schoolId: school.id, studentId: { in: school.students.map((student) => student.id) } } });
    const accountByStudentSession = new Map(accounts.map((account) => [`${account.studentId}:${account.academicSession}`, account]));
    const seededCharges = [];
    for (const [index, student] of school.students.entries()) {
      const account = accountByStudentSession.get(`${student.id}:${student.session}`);
      const sessionStartYear = Number(String(student.session).match(/\d{4}/)?.[0]) || new Date().getUTCFullYear();
      for (const component of components) {
        const months = component.applicability?.months || [4];
        for (const monthNumber of months) {
          const year = Number(monthNumber) < 4 ? sessionStartYear + 1 : sessionStartYear;
          const dueDate = new Date(Date.UTC(year, Number(monthNumber) - 1, component.dueDay || 10));
          const amountMinor = BigInt(component.amountMinor);
          const isFirstInstallment = Number(monthNumber) === 4;
          const paidMinor = index % 3 === 0 && isFirstInstallment ? amountMinor : index % 3 === 1 && isFirstInstallment && component.code === 'TUITION' ? amountMinor / 2n : 0n;
          seededCharges.push({ id: randomUUID(), schoolId: school.id, studentId: student.id, feeAccountId: account.id, feeStructureId: structure.id, feeComponentId: component.id, academicSession: student.session, installmentName: `${dueDate.toLocaleString('en', { month: 'long', timeZone: 'UTC' })} ${component.name}`, dueDate, baseAmountMinor: amountMinor, paidMinor, status: paidMinor === amountMinor ? 'PAID' : paidMinor > 0n ? 'PARTIALLY_PAID' : dueDate < new Date() ? 'OVERDUE' : dueDate <= addMonths(new Date(), 1) ? 'DUE' : 'UPCOMING' });
        }
      }
    }
    await prisma.studentFeeCharge.createMany({ data: seededCharges });
    // Create real payment, allocation and receipt rows for the seeded charges.
    // This makes the student fee history screens useful immediately after seeding.
    const paymentRows = []; const allocationRows = []; const receiptRows = [];
    for (const [index, student] of school.students.entries()) {
      const account = accountByStudentSession.get(`${student.id}:${student.session}`);
      const charges = seededCharges.filter((charge) => charge.feeAccountId === account.id);
      for (const [chargeIndex, charge] of charges.entries()) {
        const amountMinor = BigInt(charge.paidMinor);
        if (!amountMinor) continue;
        const paymentId = randomUUID(); const paymentDate = new Date(charge.dueDate.getTime() - 5 * 86400000);
        paymentRows.push({ id: paymentId, schoolId: school.id, studentId: student.id, feeAccountId: account.id, academicSession: student.session, idempotencyKey: `seed-${student.id}-${charge.id}`, paymentNumber: `DEMO-PAY-${index + 1}-${chargeIndex + 1}`, amountMinor, method: chargeIndex % 2 ? 'UPI' : 'CASH', status: 'COMPLETED', paymentDate, collectedById: feeManager.id });
        allocationRows.push({ id: randomUUID(), schoolId: school.id, paymentId, chargeId: charge.id, amountMinor });
        receiptRows.push({ id: randomUUID(), schoolId: school.id, academicSession: student.session, paymentId, receiptNumber: `DEMO/${student.session}/${String(index + 1).padStart(2, '0')}${String(chargeIndex + 1).padStart(2, '0')}`, verificationCode: `seed-${school.id.slice(-8)}-${student.id.slice(-8)}-${chargeIndex}`, snapshot: { student: { name: `${student.studentFirstName} ${student.studentLastName || ''}`.trim(), admissionNo: student.admissionNo }, payment: { amountMinor: Number(amountMinor), paymentDate } } });
      }
    }
    if (paymentRows.length) await prisma.feePayment.createMany({ data: paymentRows });
    if (allocationRows.length) await prisma.feePaymentAllocation.createMany({ data: allocationRows });
    if (receiptRows.length) await prisma.feeReceipt.createMany({ data: receiptRows });
    const template = await prisma.feeNotificationTemplate.upsert({ where: { schoolId_name: { schoolId: school.id, name: 'Overdue fee reminder' } }, create: { schoolId: school.id, name: 'Overdue fee reminder', type: 'OVERDUE', title: 'Fee payment reminder', body: 'Dear {{parentName}}, {{dueAmount}} is pending for {{studentName}} and was due on {{dueDate}}.', createdById: admin.id }, update: {} });
    const scholarship = await prisma.feeScholarship.upsert({ where: { schoolId_academicSession_code: { schoolId: school.id, academicSession: school.students[0].session, code: 'MERIT-DEMO' } }, create: { schoolId: school.id, academicSession: school.students[0].session, name: 'Merit Scholarship', code: 'MERIT-DEMO', type: 'PERCENTAGE', valueBasisPoints: 2500, maximumMinor: 100000, requiresDocument: true, createdById: admin.id }, update: {} });
    const first = school.students[0];
    const familyRows = [];
    for (const parentStudent of school.students.filter((student) => student.parentUserId)) {
      const linkedChildren = school.students.filter((student) => student.parentMobile === parentStudent.parentMobile);
      for (const child of linkedChildren) familyRows.push({ schoolId: school.id, parentUserId: parentStudent.parentUserId, studentId: child.id });
    }
    if (familyRows.length) await prisma.feeFamilyLink.createMany({ data: [...new Map(familyRows.map((row) => [`${row.parentUserId}:${row.studentId}`, row])).values()], skipDuplicates: true });
    if (!await prisma.feeReminder.count({ where: { schoolId: school.id, studentId: first.id } })) await prisma.feeReminder.create({ data: { schoolId: school.id, studentId: first.id, academicSession: first.session, type: template.type, title: template.title, message: `Dear ${first.fatherName}, this is a demo fee reminder for ${first.studentFirstName}.`, sentById: feeManager.id } });
    if (!await prisma.studentFeeScholarship.count({ where: { schoolId: school.id, studentId: first.id, scholarshipId: scholarship.id } })) await prisma.studentFeeScholarship.create({ data: { schoolId: school.id, studentId: first.id, scholarshipId: scholarship.id, academicSession: first.session, amountMinor: 37500, status: 'APPROVED', requestedById: admin.id, approvedById: admin.id, approvedAt: new Date(), reason: 'Demo merit award' } });
    const refundStudent = school.students[1] || first;
    if (!await prisma.feeAdjustment.count({ where: { schoolId: school.id, studentId: refundStudent.id, type: 'CREDIT_NOTE' } })) await prisma.feeAdjustment.create({ data: { schoolId: school.id, studentId: refundStudent.id, academicSession: refundStudent.session, type: 'CREDIT_NOTE', amountMinor: 10000, reason: 'Demo manual concession request', requestedById: feeManager.id } });
    const categorySeeds = [['ACADEMIC', 'Academic'], ['TRANSPORT', 'Transport'], ['EXAMINATION', 'Examination'], ['ADMISSION', 'Admission'], ['ACTIVITY', 'Activity'], ['FINE', 'Fine'], ['ADJUSTMENT', 'Adjustment']];
    await prisma.feeCategory.createMany({ data: categorySeeds.map(([code, name]) => ({ schoolId: school.id, code, name, createdById: admin.id })) });
    const categoryRows = await prisma.feeCategory.findMany({ where: { schoolId: school.id } }); const categoryIdByCode = new Map(categoryRows.map((row) => [row.code, row.id]));
    await prisma.feeComponent.createMany({ data: [['TUITION-MASTER', 'Tuition Fee', 'ACADEMIC', 'MONTHLY', 250000], ['EXAM-MASTER', 'Examination Fee', 'EXAMINATION', 'PER_EXAMINATION', 80000], ['ADMISSION-MASTER', 'Admission Fee', 'ADMISSION', 'ONE_TIME', 1000000], ['LATE-MASTER', 'Late Fee', 'FINE', 'ONE_TIME', 0]].map(([code, name, categoryCode, frequency, amountMinor]) => ({ schoolId: school.id, categoryId: categoryIdByCode.get(categoryCode), name, code, frequency, amountMinor, mandatory: code !== 'LATE-MASTER', createdById: admin.id })) });
    const route = await prisma.transportFeeRoute.upsert({ where: { schoolId_code: { schoolId: school.id, code: 'DEMO-R1' } }, create: { schoolId: school.id, code: 'DEMO-R1', name: 'Central City Route', vehicleNumber: `BUS-${school.schoolCode}-01`, createdById: admin.id }, update: { active: true } });
    await prisma.transportFeeStop.createMany({ data: [[1, 'School Gate', 80000], [2, 'City Centre', 120000], [3, 'Outer Ring', 180000]].map(([sequence, name, monthlyMinor]) => ({ schoolId: school.id, routeId: route.id, name, sequence, monthlyMinor })) });
    const routeStops = await prisma.transportFeeStop.findMany({ where: { schoolId: school.id, routeId: route.id }, orderBy: { sequence: 'asc' } });
    for (const [index, student] of school.students.slice(0, 2).entries()) {
      const hasTransportCharges = await prisma.studentFeeCharge.count({ where: { schoolId: school.id, studentId: student.id, academicSession: student.session, feeComponent: { feeType: 'TRANSPORT' }, status: { not: 'CANCELLED' } } });
      if (!hasTransportCharges) await assignTransport({ user: { id: admin.id, role: admin.role, schoolId: school.id }, ip: 'seed', get: () => 'SchoolOS ERP fee seed' }, { studentId: student.id, academicSession: student.session, routeId: route.id, pickupStopId: routeStops[index + 1].id, dropStopId: routeStops[index + 1].id, monthlyMinor: Number(routeStops[index + 1].monthlyMinor), startDate: `${student.session.slice(0, 4)}-04-01T00:00:00.000Z`, tripType: 'TWO_WAY', prorationRule: 'NONE' });
    }
    for (const student of school.students.slice(0, 4)) {
      const chargeRows = await prisma.studentFeeCharge.findMany({ where: { schoolId: school.id, studentId: student.id, academicSession: student.session, invoiceItem: null }, include: { feeComponent: true }, orderBy: { dueDate: 'asc' }, take: 2 });
      if (!chargeRows.length) continue; const invoiceKey = `seed-invoice-${school.id}-${student.id}`; const gross = chargeRows.reduce((sum, row) => sum + BigInt(row.baseAmountMinor) + BigInt(row.lateFeeMinor), 0n); const discount = chargeRows.reduce((sum, row) => sum + BigInt(row.discountMinor) + BigInt(row.scholarshipMinor), 0n); const waiver = chargeRows.reduce((sum, row) => sum + BigInt(row.waiverMinor), 0n); const net = gross - discount - waiver; const paid = chargeRows.reduce((sum, row) => sum + BigInt(row.paidMinor) - BigInt(row.refundedMinor), 0n); const outstanding = net > paid ? net - paid : 0n;
      await prisma.feeInvoice.upsert({ where: { schoolId_idempotencyKey: { schoolId: school.id, idempotencyKey: invoiceKey } }, create: { schoolId: school.id, studentId: student.id, academicSession: student.session, invoiceNumber: `DEMO-INV-${school.schoolCode}-${student.admissionNo || student.id.slice(-6)}`, billingPeriod: 'April-May 2026', issueDate: new Date('2026-04-01T00:00:00Z'), dueDate: chargeRows.at(-1).dueDate, classSnapshot: student.className, sectionSnapshot: student.section, grossAmountMinor: gross, discountMinor: discount, waiverMinor: waiver, netPayableMinor: net, amountPaidMinor: paid, outstandingMinor: outstanding, status: outstanding === 0n ? 'PAID' : paid > 0n ? 'PARTIALLY_PAID' : 'OVERDUE', idempotencyKey: invoiceKey, issuedById: admin.id, items: { create: chargeRows.map((row) => ({ schoolId: school.id, studentId: student.id, chargeId: row.id, componentNameSnapshot: row.feeComponent?.name || row.installmentName, componentCodeSnapshot: row.feeComponent?.code || 'CUSTOM', originalAmountMinor: row.baseAmountMinor, discountMinor: BigInt(row.discountMinor) + BigInt(row.scholarshipMinor), waiverMinor: row.waiverMinor, fineMinor: row.lateFeeMinor, finalAmountMinor: BigInt(row.baseAmountMinor) + BigInt(row.lateFeeMinor) - BigInt(row.discountMinor) - BigInt(row.scholarshipMinor) - BigInt(row.waiverMinor), paidMinor: BigInt(row.paidMinor) - BigInt(row.refundedMinor) })) } }, update: {} });
    }
    const bouncedStudent = school.students[2] || first; const bouncedAccount = await prisma.studentFeeAccount.findUnique({ where: { schoolId_studentId_academicSession: { schoolId: school.id, studentId: bouncedStudent.id, academicSession: bouncedStudent.session } } }); const bouncedCharge = bouncedAccount && await prisma.studentFeeCharge.findFirst({ where: { feeAccountId: bouncedAccount.id }, orderBy: { dueDate: 'asc' } });
    if (bouncedAccount && bouncedCharge && !await prisma.feePayment.count({ where: { schoolId: school.id, idempotencyKey: `seed-bounced-${bouncedStudent.id}` } })) await prisma.feePayment.create({ data: { schoolId: school.id, studentId: bouncedStudent.id, feeAccountId: bouncedAccount.id, academicSession: bouncedStudent.session, idempotencyKey: `seed-bounced-${bouncedStudent.id}`, paymentNumber: `DEMO-BOUNCE-${bouncedStudent.admissionNo || bouncedStudent.id.slice(-6)}`, amountMinor: 50000, method: 'CHEQUE', status: 'BOUNCED', paymentDate: new Date('2026-05-05T00:00:00Z'), instrumentNumber: '000123', instrumentDate: new Date('2026-05-04T00:00:00Z'), collectedById: feeManager.id, metadata: { seededScenario: 'BOUNCED_CHEQUE', statusReason: 'Insufficient funds' }, allocations: { create: { schoolId: school.id, chargeId: bouncedCharge.id, amountMinor: 50000 } } } });
    const refundablePayment = await prisma.feePayment.findFirst({ where: { schoolId: school.id, status: 'COMPLETED', amountMinor: { gte: 10000 }, allocations: { some: { amountMinor: { gte: 10000 } } } }, include: { allocations: true, receipt: true, feeAccount: true } });
    if (refundablePayment && !await prisma.feeRefund.count({ where: { schoolId: school.id, idempotencyKey: `seed-refund-${refundablePayment.id}` } })) await prisma.$transaction(async (tx) => { const refundAmount = 10000n; const allocation = refundablePayment.allocations.find((row) => BigInt(row.amountMinor) >= refundAmount); const charge = await tx.studentFeeCharge.findUnique({ where: { id: allocation.chargeId } }); const refund = await tx.feeRefund.create({ data: { schoolId: school.id, studentId: refundablePayment.studentId, paymentId: refundablePayment.id, receiptId: refundablePayment.receipt?.id, refundNumber: `DEMO-RF-${school.schoolCode}-${refundablePayment.id.slice(-6)}`, amountMinor: refundAmount, method: 'BANK_TRANSFER', status: 'PROCESSED', reason: 'Demo excess-payment refund', referenceNumber: `UTR-DEMO-${school.schoolCode}`, requestedById: admin.id, approvedById: admin.id, processedById: admin.id, approvedAt: new Date(), processedAt: new Date(), idempotencyKey: `seed-refund-${refundablePayment.id}`, allocations: { create: { schoolId: school.id, chargeId: charge.id, amountMinor: refundAmount, source: 'ALLOCATION' } } } }); await tx.studentFeeCharge.update({ where: { id: charge.id }, data: { refundedMinor: { increment: refundAmount }, status: 'PARTIALLY_REFUNDED' } }); await tx.feeInvoiceItem.updateMany({ where: { schoolId: school.id, chargeId: charge.id, paidMinor: { gte: refundAmount } }, data: { paidMinor: { decrement: refundAmount } } }); await tx.feePayment.update({ where: { id: refundablePayment.id }, data: { status: 'PARTIALLY_REFUNDED' } }); const last = await tx.feeLedgerEntry.findFirst({ where: { feeAccountId: refundablePayment.feeAccountId }, orderBy: { createdAt: 'desc' } }); await tx.feeLedgerEntry.create({ data: { schoolId: school.id, studentId: refundablePayment.studentId, feeAccountId: refundablePayment.feeAccountId, academicSession: refundablePayment.academicSession, entryType: 'REFUND', referenceType: 'FeeRefund', referenceId: refund.id, referenceNumber: refund.refundNumber, description: refund.reason, debitMinor: refundAmount, balanceMinor: BigInt(last?.balanceMinor || 0) + refundAmount, createdById: admin.id } }); });
    console.log(`Seeded fee demo data for ${school.schoolName}`);
    console.log(`  Fee Manager: ${managerEmail} / ${demoPassword}`);
  }
} finally {
  await prisma.$disconnect();
}
