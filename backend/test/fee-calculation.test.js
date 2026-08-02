import test from 'node:test';
import assert from 'node:assert/strict';
import { allocatePayment, calculateCharge, calculateLateFee } from '../src/modules/fees/feeCalculation.service.js';
import { hasPermission, PERMISSIONS } from '../src/config/permissions.js';
import { validatePayment } from '../src/modules/fees/fee.validation.js';
import { annualComponentTotal, buildComponentInstallments } from '../src/modules/fees/feeSchedule.service.js';
import { installmentsForStudent } from '../src/modules/fees/feeAdvanced.service.js';

test('discounts and scholarships never exceed the base fee', () => {
  const result = calculateCharge({ baseAmountMinor: 100000, discountMinor: 70000, scholarshipMinor: 50000 });
  assert.equal(result.reductionsMinor, 100000n);
  assert.equal(result.payableMinor, 0n);
});

test('partial payment is allocated oldest-due-first without over-allocation', () => {
  const result = allocatePayment(120000, [
    { id: 'later', dueDate: '2026-08-01', baseAmountMinor: 100000 },
    { id: 'earlier', dueDate: '2026-07-01', baseAmountMinor: 100000 },
  ]);
  assert.deepEqual(result.allocations, [{ chargeId: 'earlier', amountMinor: 100000n }, { chargeId: 'later', amountMinor: 20000n }]);
  assert.equal(result.unappliedMinor, 0n);
});

test('excess payment becomes unapplied advance credit', () => {
  const result = allocatePayment(125000, [{ id: 'fee', dueDate: '2026-07-01', baseAmountMinor: 100000 }]);
  assert.equal(result.unappliedMinor, 25000n);
});

test('daily late fee honors grace period and maximum', () => {
  const result = calculateLateFee({ outstandingMinor: 100000, dueDate: '2026-07-01', gracePeriodDays: 5, asOf: '2026-07-20', rule: { type: 'DAILY', amountMinor: 1000, maximumMinor: 10000 } });
  assert.equal(result, 10000n);
});

test('fee manager can configure and collect but cannot approve', () => {
  assert.equal(hasPermission('FEE_MANAGER', PERMISSIONS.FEES_COLLECT), true);
  assert.equal(hasPermission('FEE_MANAGER', PERMISSIONS.FEES_CONFIGURE), true);
  assert.equal(hasPermission('FEE_MANAGER', PERMISSIONS.FEES_APPROVE), false);
});

test('students and parents have view-only fee permission', () => {
  for (const role of ['STUDENT', 'PARENT']) {
    assert.equal(hasPermission(role, PERMISSIONS.FEES_VIEW), true);
    assert.equal(hasPermission(role, PERMISSIONS.FEES_COLLECT), false);
  }
});

test('only class teachers receive assigned fee view/reminder permission', () => {
  assert.equal(hasPermission('TEACHER', PERMISSIONS.FEES_VIEW), false);
  assert.equal(hasPermission('TEACHER', PERMISSIONS.FEES_REMIND), false);
  assert.equal(hasPermission('TEACHER', PERMISSIONS.FEES_COLLECT), false);
  assert.equal(hasPermission('CLASS_TEACHER', PERMISSIONS.FEES_VIEW), true);
  assert.equal(hasPermission('CLASS_TEACHER', PERMISSIONS.FEES_REMIND), true);
  assert.equal(hasPermission('CLASS_TEACHER', PERMISSIONS.FEES_COLLECT), false);
  assert.equal(hasPermission('STAFF', PERMISSIONS.FEES_VIEW), false);
});

test('custom exam months generate exact session dates and amounts', () => {
  const rows = buildComponentInstallments({
    name: 'Examination Fee', amountMinor: 50000, dueDay: 10,
    frequency: 'CUSTOM', applicability: { months: [9, 2], monthAmountsMinor: { 9: 50000, 2: 65000 } },
  }, { academicSession: '2026-27' });
  assert.deepEqual(rows.map((row) => row.dueDate.toISOString().slice(0, 10)), ['2026-09-10', '2027-02-10']);
  assert.deepEqual(rows.map((row) => row.amountMinor), [50000n, 65000n]);
  assert.equal(annualComponentTotal({ name: 'Exam', amountMinor: 50000, frequency: 'CUSTOM', applicability: { months: [9, 2] } }, { academicSession: '2026-27' }), 100000n);
});

test('monthly schedules follow the April to March academic cycle', () => {
  const rows = buildComponentInstallments({ name: 'Tuition', amountMinor: 80000, frequency: 'MONTHLY', dueDay: 15 }, { academicSession: '2026-27' });
  assert.equal(rows.length, 12);
  assert.equal(rows[0].dueDate.toISOString().slice(0, 10), '2026-04-15');
  assert.equal(rows[11].dueDate.toISOString().slice(0, 10), '2027-03-15');
  assert.equal(annualComponentTotal({ name: 'Tuition', amountMinor: 80000, frequency: 'MONTHLY' }, { academicSession: '2026-27' }), 960000n);
});

test('mid-session admissions receive only eligible months when configured', () => {
  const rows = installmentsForStudent(
    { name: 'Tuition', amountMinor: 80000, frequency: 'MONTHLY', applicability: { fromAdmissionMonth: true } },
    { academicSession: '2026-27' },
    { admissionDate: new Date('2026-09-14T00:00:00.000Z') },
  );
  assert.deepEqual(rows.map((row) => row.month), [9, 10, 11, 12, 1, 2, 3]);
});

test('new-admission-only fee heads exclude students admitted before the session', () => {
  const rows = installmentsForStudent(
    { name: 'Admission', amountMinor: 200000, frequency: 'ONE_TIME', applicability: { months: [4], newAdmissionsOnly: true } },
    { academicSession: '2026-27' },
    { admissionDate: new Date('2025-06-01T00:00:00.000Z') },
  );
  assert.equal(rows.length, 0);
});

test('manual payment allocations reject duplicate charges and invalid methods', () => {
  assert.throws(() => validatePayment({ studentId: 'student', academicSession: '2026-27', amountMinor: 10000, method: 'CASH', allocations: [{ chargeId: 'charge', amountMinor: 5000 }, { chargeId: 'charge', amountMinor: 5000 }] }), /duplicate charges/);
  assert.throws(() => validatePayment({ studentId: 'student', academicSession: '2026-27', amountMinor: 10000, method: 'CRYPTO' }), /Unsupported payment method/);
});

test('payment validation preserves exact minor units and payer metadata', () => {
  const result = validatePayment({ studentId: 'student', academicSession: '2026-27', amountMinor: 10001, method: 'UPI', payerName: 'A Parent', payerRelation: 'Father', allocations: [{ chargeId: 'charge-1', amountMinor: 7500 }] });
  assert.equal(result.amountMinor, 10001n);
  assert.equal(result.allocations[0].amountMinor, 7500n);
  assert.equal(result.payerName, 'A Parent');
});
