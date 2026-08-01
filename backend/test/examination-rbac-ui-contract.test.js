import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PERMISSIONS, hasPermission, permissionScopes, SCOPES } from '../src/config/permissions.js';

test('examination leadership roles remain separated', () => {
  assert.equal(hasPermission('PRINCIPAL', PERMISSIONS.EXAMS_APPROVE), true);
  assert.equal(hasPermission('PRINCIPAL', PERMISSIONS.EXAMS_PUBLISH), true);
  assert.equal(hasPermission('PRINCIPAL', PERMISSIONS.EXAMS_CONFIGURE), false);
  assert.equal(hasPermission('EXAM_COORDINATOR', PERMISSIONS.EXAMS_CONFIGURE), true);
  assert.equal(hasPermission('EXAM_COORDINATOR', PERMISSIONS.EXAMS_PUBLISH), true);
  assert.equal(hasPermission('SCHOOL_OWNER', PERMISSIONS.EXAMS_VIEW), true);
  assert.equal(hasPermission('SCHOOL_OWNER', PERMISSIONS.EXAMS_CONFIGURE), false);
  assert.deepEqual(permissionScopes('PLATFORM_OWNER', PERMISSIONS.EXAMS_VIEW), [SCOPES.PLATFORM]);
});

test('teacher and family examination permissions are correctly scoped', () => {
  assert.equal(hasPermission('TEACHER', PERMISSIONS.EXAMS_MARK), true);
  assert.ok(permissionScopes('TEACHER', PERMISSIONS.EXAMS_MARK).includes(SCOPES.ASSIGNED));
  assert.deepEqual(permissionScopes('STUDENT', PERMISSIONS.EXAMS_VIEW), [SCOPES.SELF]);
  assert.deepEqual(permissionScopes('PARENT', PERMISSIONS.EXAMS_VIEW), [SCOPES.CHILD]);
});

test('router exposes role dashboards, governance, registers and configuration endpoints', async () => {
  const source = await readFile(new URL('../src/modules/examinations/examination.routes.js', import.meta.url), 'utf8');
  for (const path of ['/dashboard', '/audit-logs', '/configuration/grade-scales', '/configuration/rule-sets', '/:id/result-register', '/:id/report-cards/:studentId.pdf']) assert.match(source, new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('frontend route uses the role-specific examination hub', async () => {
  const [app, hub, layout] = await Promise.all([
    readFile(new URL('../../frontend/src/App.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../../frontend/src/pages/examinations/ExaminationHubPage.jsx', import.meta.url), 'utf8'),
    readFile(new URL('../../frontend/src/layouts/DashboardLayout.jsx', import.meta.url), 'utf8'),
  ]);
  assert.match(app, /ExaminationHubPage/);
  for (const role of ['PLATFORM_OWNER','SCHOOL_OWNER','PRINCIPAL','EXAM_COORDINATOR','ADMIN','CURRICULUM_MANAGER','TEACHER','PARENT','STUDENT']) assert.match(hub, new RegExp(role));
  assert.doesNotMatch(layout.slice(0, layout.indexOf('const DashboardLayout')), /roleMenuConfig\.PRINCIPAL/);
});

