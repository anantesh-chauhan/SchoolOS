import test from 'node:test';
import assert from 'node:assert/strict';
import { allocatePayment, calculateCharge, calculateLateFee } from '../src/modules/fees/feeCalculation.service.js';
import { hasPermission, PERMISSIONS } from '../src/config/permissions.js';
import { validatePayment } from '../src/modules/fees/fee.validation.js';

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

test('fee manager can collect but cannot configure or approve', () => {
  assert.equal(hasPermission('FEE_MANAGER', PERMISSIONS.FEES_COLLECT), true);
  assert.equal(hasPermission('FEE_MANAGER', PERMISSIONS.FEES_CONFIGURE), false);
  assert.equal(hasPermission('FEE_MANAGER', PERMISSIONS.FEES_APPROVE), false);
});

test('students and parents have view-only fee permission', () => {
  for (const role of ['STUDENT', 'PARENT']) {
    assert.equal(hasPermission(role, PERMISSIONS.FEES_VIEW), true);
    assert.equal(hasPermission(role, PERMISSIONS.FEES_COLLECT), false);
  }
});

test('teachers and general staff have no fee-data permission by default', () => {
  for (const role of ['TEACHER', 'STAFF']) assert.equal(hasPermission(role, PERMISSIONS.FEES_VIEW), false);
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
