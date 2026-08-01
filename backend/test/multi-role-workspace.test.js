import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentIsValid, chooseActiveAssignment, serializeAssignment } from '../src/services/workspace.service.js';
import { enforceSeparationOfDuties } from '../src/services/separationOfDuties.service.js';
import { hasPermission } from '../src/config/permissions.js';

const assignment = (overrides = {}) => ({
  id: overrides.id || 'role_1',
  userId: 'user_1', schoolId: 'school_1', role: 'TEACHER',
  isActive: true, isDefault: false, validFrom: null, validUntil: null,
  ...overrides,
});

test('single valid role is selected directly', () => {
  assert.equal(chooseActiveAssignment([assignment()], null).id, 'role_1');
});

test('last-used valid role wins over default', () => {
  const roles = [assignment({ id: 'teacher', isDefault: true }), assignment({ id: 'exam', role: 'EXAM_CONTROLLER' })];
  assert.equal(chooseActiveAssignment(roles, 'exam').id, 'exam');
});

test('default wins when last-used role is expired or revoked', () => {
  const roles = [assignment({ id: 'teacher', isDefault: true }), assignment({ id: 'old', role: 'ADMIN', validUntil: new Date('2020-01-01') })];
  assert.equal(chooseActiveAssignment(roles, 'old').id, 'teacher');
  assert.equal(assignmentIsValid(roles[1]), false);
});

test('lowest-risk operational role is the safe fallback', () => {
  const roles = [assignment({ id: 'admin', role: 'ADMIN' }), assignment({ id: 'teacher', role: 'TEACHER' }), assignment({ id: 'exam', role: 'EXAM_CONTROLLER' })];
  assert.equal(chooseActiveAssignment(roles, null).id, 'teacher');
});

test('inactive and not-yet-effective assignments are excluded', () => {
  assert.equal(assignmentIsValid(assignment({ isActive: false })), false);
  assert.equal(assignmentIsValid(assignment({ validFrom: new Date('2999-01-01') })), false);
});

test('serialized roles never expose internal scope records', () => {
  const value = serializeAssignment(assignment({ scopes: [{ subjectId: 'secret' }] }));
  assert.equal(value.assignmentId, 'role_1');
  assert.equal('scopes' in value, false);
});

test('permissions stay isolated to the active workspace', () => {
  assert.equal(hasPermission('TEACHER', 'exams.publish'), false);
  assert.equal(hasPermission('EXAM_CONTROLLER', 'exams.publish'), true);
  assert.equal(hasPermission('EXAM_CONTROLLER', 'exams.mark'), false);
  assert.equal(hasPermission('CLASS_TEACHER', 'exams.verify'), true);
  assert.equal(hasPermission('CLASS_TEACHER', 'exams.publish'), false);
  assert.equal(hasPermission('FEE_MANAGER', 'hr.manage'), false);
});

test('strict separation prevents approval by the same person across roles', () => {
  const result = enforceSeparationOfDuties({ actorUserId: 'ravi', makerUserId: 'ravi', policy: { mode: 'STRICT' } });
  assert.equal(result.allowed, false);
  assert.equal(result.code, 'SELF_APPROVAL_BLOCKED');
});

test('exception mode requires a reason and principal approval when configured', () => {
  const missingReason = enforceSeparationOfDuties({ actorUserId: 'ravi', makerUserId: 'ravi', policy: { mode: 'PRINCIPAL_APPROVAL' } });
  assert.equal(missingReason.code, 'EXCEPTION_REASON_REQUIRED');
  const missingApproval = enforceSeparationOfDuties({ actorUserId: 'ravi', makerUserId: 'ravi', policy: { mode: 'PRINCIPAL_APPROVAL' }, reason: 'Small school coverage' });
  assert.equal(missingApproval.code, 'PRINCIPAL_APPROVAL_REQUIRED');
  const approved = enforceSeparationOfDuties({ actorUserId: 'ravi', makerUserId: 'ravi', policy: { mode: 'PRINCIPAL_APPROVAL' }, reason: 'Small school coverage', principalApprovalId: 'approval_1' });
  assert.equal(approved.allowed, true);
  assert.equal(approved.exception, true);
});
