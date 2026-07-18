import test from 'node:test';
import assert from 'node:assert/strict';

const enabled = process.env.RUN_FEE_DB_TESTS === '1';
if (enabled && process.env.DATABASE_URL?.includes('sslmode=require')) process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
const getPrisma = async () => (await import('../src/config/prisma.client.js')).default;

test('fee migration created all critical accounting tables', { skip: !enabled }, async () => {
  const prisma = await getPrisma();
  const rows = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('FeeStructure','FeeAssignment','StudentFeeCharge','FeePayment','FeeReceipt','FeeLedgerEntry','FeeAdjustment','FeeFinancialPeriod')`;
  assert.equal(rows.length, 8);
});

test('seeded fee accounts remain isolated by school', { skip: !enabled }, async () => {
  const prisma = await getPrisma();
  const schools = await prisma.school.findMany({ where: { feeModuleSetting: { is: { enabled: true } } }, select: { id: true } });
  assert.ok(schools.length >= 2);
  for (const school of schools) {
    const accounts = await prisma.studentFeeAccount.findMany({ where: { schoolId: school.id }, include: { student: { select: { schoolId: true } }, charges: { select: { schoolId: true } } } });
    assert.ok(accounts.length > 0);
    assert.ok(accounts.every((account) => account.student.schoolId === school.id && account.charges.every((charge) => charge.schoolId === school.id)));
  }
});

test('database has duplicate-payment and duplicate-charge guards', { skip: !enabled }, async () => {
  const prisma = await getPrisma();
  const indexes = await prisma.$queryRaw`SELECT indexdef FROM pg_indexes WHERE schemaname = 'public' AND tablename IN ('FeePayment','StudentFeeCharge','FeeReceipt')`;
  const definitions = indexes.map((row) => row.indexdef).join('\n');
  assert.match(definitions, /idempotencyKey/);
  assert.match(definitions, /installmentName/);
  assert.match(definitions, /receiptNumber/);
});

test('fee managers can load the real class-section-student hierarchy for only their school', { skip: !enabled }, async () => {
  const prisma = await getPrisma();
  const manager = await prisma.user.findFirst({ where: { role: 'FEE_MANAGER', isActive: true } });
  assert.ok(manager?.schoolId);
  const { getFeeHierarchy } = await import('../src/modules/fees/fee.service.js');
  const hierarchy = await getFeeHierarchy(manager, '2026-27');
  const ids = hierarchy.classes.flatMap((classRow) => classRow.sections.flatMap((section) => section.students.map((student) => student.id)));
  const foreignStudents = await prisma.student.count({ where: { id: { in: ids }, schoolId: { not: manager.schoolId } } });
  assert.equal(foreignStudents, 0);
  assert.ok(hierarchy.totals.classes > 0);
  assert.ok(hierarchy.totals.students > 0);
});

test('every seeded school has a published assignment and an instant-login fee manager', { skip: !enabled }, async () => {
  const prisma = await getPrisma();
  const schools = await prisma.school.findMany({ where: { feeModuleSetting: { is: { enabled: true } } }, select: { id: true } });
  for (const school of schools) {
    assert.ok(await prisma.user.findFirst({ where: { schoolId: school.id, role: 'FEE_MANAGER', isActive: true } }));
    assert.ok(await prisma.feeAssignment.findFirst({ where: { schoolId: school.id, active: true, feeStructure: { status: 'PUBLISHED' } } }));
  }
});

test('student portal resolves and returns the assigned school fee structure', { skip: !enabled }, async () => {
  const prisma = await getPrisma();
  const student = await prisma.student.findFirst({ where: { feeAccounts: { some: {} } } });
  const { getStudentFees } = await import('../src/modules/fees/fee.service.js');
  const result = await getStudentFees({ role: 'STUDENT', schoolId: student.schoolId, studentId: student.id }, student.id, student.session);
  assert.equal(result.student.id, student.id);
  assert.ok(result.assignedStructure);
  assert.ok(result.assignedStructure.components.length > 0);
});

test('demo-account response exposes the Fee Managers instant-login group', { skip: !enabled }, async () => {
  const { getDemoAccounts } = await import('../src/controllers/auth.controller.js');
  let payload; let statusCode = 200;
  await getDemoAccounts({}, { status(code) { statusCode = code; return this; }, json(value) { payload = value; return value; } });
  assert.equal(statusCode, 200);
  const group = payload.data.find((item) => item.role === 'Fee Managers');
  assert.ok(group);
  assert.ok(group.users.length > 0);
  assert.ok(group.users.every((user) => user.accountKey.startsWith('user:')));
});

test.after(async () => { if (enabled) await (await getPrisma()).$disconnect(); });
