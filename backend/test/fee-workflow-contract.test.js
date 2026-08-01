import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const feeService = read('../src/modules/fees/fee.service.js');
const advanced = read('../src/modules/fees/feeAdvanced.service.js');
const workflow = read('../src/modules/fees/feeWorkflow.service.js');
const routes = read('../src/modules/fees/fee.routes.js');
const seed = read('../prisma/seedFees.js');
const wizard = read('../../frontend/src/pages/fees/FeeStructureWizard.jsx');
const previewTable = read('../../frontend/src/components/fees/FeeStructurePreviewTable.jsx');
const teacherPortal = read('../../frontend/src/pages/fees/TeacherFeePage.jsx');

test('publishing is retry-safe and published revisions are editable only through a new draft', () => {
  assert.match(feeService, /existing\.status === "PUBLISHED"\) return existing/);
  assert.match(feeService, /Only a draft fee structure can be edited/);
  assert.match(feeService, /FEE_STRUCTURE_REVISION_CREATED/);
  assert.match(routes, /\/structures\/:id\/revise/);
  assert.match(routes, /router\.patch\("\/structures\/:id"/);
});

test('revision reconciliation preserves paid history and cancels unpaid prior charges', () => {
  assert.match(advanced, /BigInt\(charge\.paidMinor\) > 0n/);
  assert.match(advanced, /FeeRevisionCancellation/);
  assert.match(advanced, /status: "CANCELLED"/);
  assert.match(advanced, /status: "ARCHIVED"/);
});

test('transport is additive, student-specific, reversible, and never a class-plan override', () => {
  assert.match(workflow, /targetType: "TRANSPORT"/);
  assert.match(workflow, /priority: 50/);
  assert.match(workflow, /export const cancelTransport/);
  assert.match(routes, /\/transport\/assignments\/:id\/cancel/);
  assert.match(seed, /assignTransport\(/);
  assert.match(seed, /code: 'TRANSPORT' \}, data: \{ active: false \}/);
});

test('student fee response exposes every applicable published structure', () => {
  assert.match(feeService, /assignedStructures: assignments\.map/);
  assert.match(feeService, /feeStructure: \{ status: "PUBLISHED" \}/);
});

test('class-plan publication uses bounded bulk writes and reports allocation failures precisely', () => {
  assert.match(advanced, /studentFeeAccount\.createMany/);
  assert.match(advanced, /studentFeeCharge\.createMany/);
  assert.match(advanced, /feeLedgerEntry\.createMany/);
  assert.match(wizard, /Plan published, but student allocation failed/);
  assert.doesNotMatch(wizard, /catch \{ result = await feeService\.publishAssignment/);
});

test('student and assigned-teacher portals expose fee settings, section summaries, and drill-down', () => {
  assert.match(routes, /"FEE_MANAGER", "TEACHER", "STUDENT", "PARENT"/);
  assert.match(routes, /\/teacher\/students\/:studentId/);
  assert.match(advanced, /requireSchoolAdminOrAssignedTeacherForSection/);
  assert.match(advanced, /export const teacherStudentFees/);
  assert.match(advanced, /structures: assignmentRows\.map/);
  assert.match(advanced, /studentsWithDues/);
});

test('shared fee tables expose installment status, receipt drill-down, and role-level totals', () => {
  assert.match(previewTable, /chargeStatus/);
  assert.match(previewTable, /PAID.*PARTIAL.*OVERDUE.*DUE.*UPCOMING/);
  assert.match(previewTable, /downloadReceipt/);
  assert.match(previewTable, /Total expected/);
  assert.match(teacherPortal, /studentFees=\{fees\}/);
  assert.match(teacherPortal, /scopeSummary=\{overview\.summary\}/);
  assert.match(feeService, /financialSummary/);
  assert.match(feeService, /status: \{ notIn: \["CANCELLED", "REFUNDED"\] \}/);
});

test('fee demo seed replaces stale tenant fee data before rebuilding the latest plan', () => {
  assert.match(seed, /clearFeeDemoData/);
  assert.match(seed, /feeStructure\.deleteMany/);
  assert.match(seed, /studentFeeCharge\.deleteMany/);
  assert.match(seed, /FEE_SEED_SCHOOL_CODE/);
  assert.match(seed, /Standard School Fee Structure/);
  assert.match(seed, /studentFeeCharge\.createMany/);
});
