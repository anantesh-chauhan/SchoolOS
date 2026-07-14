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

test.after(async () => { if (enabled) await (await getPrisma()).$disconnect(); });
