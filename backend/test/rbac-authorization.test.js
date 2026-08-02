import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasPermission,
  permissionScopes,
  permissionsForRole,
  PERMISSIONS,
  SCOPES,
} from '../src/config/permissions.js';
import { requirePermission, requireAnyPermission } from '../src/middleware/permission.middleware.js';
import { requireSchoolAccess } from '../src/middleware/scope.middleware.js';

const response = () => {
  const result = { statusCode: 200, body: null };
  return {
    result,
    status(code) { result.statusCode = code; return this; },
    json(body) { result.body = body; return this; },
  };
};

test('platform owner is strategic and has no routine attendance or fee collection grant', () => {
  assert.equal(hasPermission('PLATFORM_OWNER', PERMISSIONS.SCHOOL_STATUS_MANAGE, SCOPES.PLATFORM), true);
  assert.equal(hasPermission('PLATFORM_OWNER', PERMISSIONS.ATTENDANCE_MARK_STUDENT), false);
  assert.equal(hasPermission('TEACHER', PERMISSIONS.ATTENDANCE_MARK_STUDENT), false);
  assert.equal(hasPermission('TEACHER', PERMISSIONS.FEES_VIEW), false);
  assert.equal(hasPermission('TEACHER', PERMISSIONS.FEES_REMIND), false);
  assert.equal(hasPermission('CLASS_TEACHER', PERMISSIONS.ATTENDANCE_MARK_STUDENT), true);
  assert.equal(hasPermission('CLASS_TEACHER', PERMISSIONS.FEES_VIEW), true);
  assert.equal(hasPermission('CLASS_TEACHER', PERMISSIONS.FEES_REMIND), true);
  assert.equal(hasPermission('PLATFORM_OWNER', PERMISSIONS.FEES_COLLECT), false);
});

test('school administrator cannot access platform settings', () => {
  assert.equal(hasPermission('ADMIN', PERMISSIONS.PLATFORM_SETTINGS_MANAGE), false);
  assert.equal(hasPermission('ADMIN', PERMISSIONS.STUDENTS_CREATE, SCOPES.SCHOOL), true);
});

test('specialist roles remain separated', () => {
  assert.equal(hasPermission('CURRICULUM_MANAGER', PERMISSIONS.FEES_CONFIGURE), false);
  assert.equal(hasPermission('FEE_MANAGER', PERMISSIONS.CURRICULUM_MANAGE), false);
  assert.equal(hasPermission('FEE_MANAGER', PERMISSIONS.FEES_COLLECT, SCOPES.SCHOOL), true);
});

test('teacher, student, and parent grants carry assignment/self/child scopes', () => {
  assert.ok(permissionScopes('TEACHER', PERMISSIONS.STUDENTS_VIEW).includes(SCOPES.ASSIGNED));
  assert.deepEqual(permissionScopes('STUDENT', PERMISSIONS.STUDENTS_VIEW), [SCOPES.SELF]);
  assert.deepEqual(permissionScopes('PARENT', PERMISSIONS.STUDENTS_VIEW), [SCOPES.CHILD]);
});

test('permission middleware denies direct API access even when a UI route is hidden', () => {
  const req = { user: { role: 'FEE_MANAGER' } };
  const res = response();
  let called = false;
  requirePermission(PERMISSIONS.CURRICULUM_MANAGE)(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.result.statusCode, 403);
  assert.equal(res.result.body.code, 'FORBIDDEN');
});

test('all-permission and any-permission middleware have explicit semantics', () => {
  let called = false;
  requirePermission(PERMISSIONS.FEES_VIEW, PERMISSIONS.FEES_COLLECT)(
    { user: { role: 'FEE_MANAGER' } }, response(), () => { called = true; },
  );
  assert.equal(called, true);

  called = false;
  requireAnyPermission(PERMISSIONS.CURRICULUM_MANAGE, PERMISSIONS.FEES_VIEW)(
    { user: { role: 'FEE_MANAGER' } }, response(), () => { called = true; },
  );
  assert.equal(called, true);
});

test('tenant guard rejects a changed school id from URL/body/query', async () => {
  const req = { user: { role: 'ADMIN', schoolId: 'school-a' }, params: { schoolId: 'school-b' }, body: {}, query: {} };
  const res = response();
  let called = false;
  await requireSchoolAccess()(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.result.statusCode, 403);
  assert.equal(res.result.body.code, 'TENANT_FORBIDDEN');
});

test('permission list returned to the frontend contains no wildcard grants', () => {
  for (const role of ['PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER', 'FEE_MANAGER', 'TEACHER', 'STUDENT', 'PARENT']) {
    assert.ok(permissionsForRole(role).length > 0);
    assert.equal(permissionsForRole(role).includes('*'), false);
  }
});
