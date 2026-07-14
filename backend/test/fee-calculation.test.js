import test from 'node:test';
import assert from 'node:assert/strict';
import { allocatePayment, calculateCharge, calculateLateFee } from '../src/modules/fees/feeCalculation.service.js';
import { hasPermission, PERMISSIONS } from '../src/config/permissions.js';

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
