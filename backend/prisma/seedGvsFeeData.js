import 'dotenv/config';
if (process.env.DATABASE_URL?.includes('sslmode=require')) process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
const { default: prisma } = await import('../src/config/prisma.client.js');

const session = '2026-27';
const amountForClass = (className = '') => { const rank = Number((className.match(/\d+/) || [0])[0]); return (rank || 1) <= 5 ? 180000 : (rank || 1) <= 8 ? 260000 : 360000; };
const months = [3, 4, 5, 6, 7];

try {
  const school = await prisma.school.findFirst({ where: { OR: [{ schoolCode: 'GVS001' }, { schoolName: { contains: 'Green Valley', mode: 'insensitive' } }] }, include: { users: { where: { role: { in: ['FEE_MANAGER', 'ADMIN', 'SCHOOL_OWNER'] }, isActive: true }, take: 1 } } });
  if (!school) throw new Error('Green Valley School was not found');
  const operator = school.users[0]; if (!operator) throw new Error('Green Valley has no active fee/admin user');
  await prisma.student.updateMany({ where: { schoolId: school.id, isActive: true }, data: { session } });
  const students = await prisma.student.findMany({ where: { schoolId: school.id, isActive: true }, orderBy: [{ className: 'asc' }, { section: 'asc' }, { studentFirstName: 'asc' }] });
  const structure = await prisma.feeStructure.upsert({ where: { schoolId_academicSession_code_version: { schoolId: school.id, academicSession: session, code: 'GVS-REALISTIC-2026', version: 1 } }, create: { schoolId: school.id, academicSession: session, name: 'GVS 2026-27 Academic Fee Schedule', code: 'GVS-REALISTIC-2026', mode: 'COMPONENT_BASED', status: 'PUBLISHED', version: 1, createdById: operator.id, approvedById: operator.id, publishedAt: new Date(), components: { create: [{ schoolId: school.id, academicSession: session, name: 'Monthly Academic Fee', code: 'TUITION', amountMinor: 180000, frequency: 'MONTHLY', dueDay: 10, createdById: operator.id }, { schoolId: school.id, academicSession: session, name: 'Transport Fee', code: 'TRANSPORT', amountMinor: 90000, frequency: 'MONTHLY', dueDay: 7, createdById: operator.id }] } }, update: {}, include: { components: true } });
  const tuition = structure.components.find((c) => c.code === 'TUITION'); const transport = structure.components.find((c) => c.code === 'TRANSPORT');
  await prisma.studentFeeAccount.createMany({ data: students.map((s) => ({ schoolId: school.id, studentId: s.id, academicSession: session })), skipDuplicates: true });
  const accounts = await prisma.studentFeeAccount.findMany({ where: { schoolId: school.id, academicSession: session } }); const accountId = new Map(accounts.map((a) => [a.studentId, a.id]));
  const charges = [];
  students.forEach((student, index) => months.forEach((month) => {
    const dueDate = new Date(Date.UTC(2026, month, 10)); const amount = BigInt(amountForClass(student.className)); const paid = month < 6 && index % 4 === 0 ? amount : month === 5 && index % 4 === 1 ? amount / 2n : 0n;
    charges.push({ schoolId: school.id, studentId: student.id, feeAccountId: accountId.get(student.id), feeStructureId: structure.id, feeComponentId: tuition.id, academicSession: session, installmentName: `${new Date(Date.UTC(2026, month, 1)).toLocaleString('en-IN', { month: 'long' })} Academic Fee`, dueDate, baseAmountMinor: amount, paidMinor: paid, status: paid === amount ? 'PAID' : paid > 0n ? 'PARTIALLY_PAID' : dueDate < new Date() ? 'OVERDUE' : 'UPCOMING', calculationSnapshot: { seededBy: 'gvs-focused-realistic-seed', classFeeMinor: Number(amount) } });
    if (index % 3 === 0) { const transportAmount = BigInt([90000, 125000, 165000][index % 3]); charges.push({ schoolId: school.id, studentId: student.id, feeAccountId: accountId.get(student.id), feeStructureId: structure.id, feeComponentId: transport.id, academicSession: session, installmentName: `${new Date(Date.UTC(2026, month, 1)).toLocaleString('en-IN', { month: 'long' })} Transport`, dueDate: new Date(Date.UTC(2026, month, 7)), baseAmountMinor: transportAmount, paidMinor: 0n, status: month < 6 ? 'OVERDUE' : 'UPCOMING', calculationSnapshot: { seededBy: 'gvs-focused-realistic-seed', routeBand: index % 3 + 1 } }); }
  }));
  const created = await prisma.studentFeeCharge.createMany({ data: charges, skipDuplicates: true });
  const accountCount = await prisma.studentFeeAccount.count({ where: { schoolId: school.id, academicSession: session } }); const chargeCount = await prisma.studentFeeCharge.count({ where: { schoolId: school.id, academicSession: session } });
  console.log(JSON.stringify({ school: school.schoolName, session, activeStudents: students.length, feeAccounts: accountCount, chargesCreated: created.count, totalCharges: chargeCount }, null, 2));
} finally { await prisma.$disconnect(); }
