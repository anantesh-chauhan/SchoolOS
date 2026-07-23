import test from 'node:test';
import assert from 'node:assert/strict';
import { assertStudentAccess, filterForRole } from '../src/modules/analytics/analytics.permissions.js';
import analyticsRoutes from '../src/modules/analytics/analytics.routes.js';

const student = { id: 'student-1', schoolId: 'school-1', className: '8', section: 'A' };

test('analytics tenant isolation rejects a student from another school before querying details', async () => {
  await assert.rejects(
    () => assertStudentAccess({ role: 'ADMIN', schoolId: 'school-2' }, student),
    (error) => error.status === 404,
  );
});

test('student self-access is restricted to the token-linked student', async () => {
  const allowed = await assertStudentAccess({ role: 'STUDENT', schoolId: 'school-1', studentId: 'student-1' }, student);
  assert.equal(allowed.scope, 'SELF');
  await assert.rejects(
    () => assertStudentAccess({ role: 'STUDENT', schoolId: 'school-1', studentId: 'student-2' }, student),
    (error) => error.status === 403,
  );
});

test('parent direct-child access uses the linked student identity', async () => {
  const allowed = await assertStudentAccess({ role: 'PARENT', schoolId: 'school-1', studentId: 'student-1' }, student);
  assert.equal(allowed.redactInternal, true);
});

test('school admin access remains tenant scoped', async () => {
  const allowed = await assertStudentAccess({ role: 'ADMIN', schoolId: 'school-1' }, student);
  assert.equal(allowed.scope, 'SCHOOL');
});

test('student and parent payloads redact internal intervention notes and risk evidence', () => {
  const payload = filterForRole({
    teacherObservations: [{ strengths: 'Careful work', weaknesses: 'Internal note', recommendation: 'Practice', submittedAt: new Date() }],
    interventions: [
      { id: 'public', parentVisible: true, confidentialNotes: 'private', notes: 'staff-only' },
      { id: 'private', parentVisible: false, confidentialNotes: 'private' },
    ],
    risk: { riskLevel: 'MEDIUM', riskScore: 20, reasons: [{ code: 'LOW_ATTENDANCE', severity: 'MEDIUM', message: 'Review attendance.', evidence: { actual: 70 } }] },
  }, { role: 'PARENT' });
  assert.deepEqual(payload.teacherObservations, []);
  assert.deepEqual(payload.interventions.map((row) => row.id), ['public']);
  assert.equal(payload.interventions[0].confidentialNotes, undefined);
  assert.equal(payload.risk.reasons[0].evidence, undefined);
});

test('analytics router registers snapshots, configuration, interventions, and drill-down routes', () => {
  const paths = analyticsRoutes.stack.filter((layer) => layer.route).map((layer) => layer.route.path);
  for (const path of ['/students/:studentId/overview', '/configuration', '/snapshots', '/interventions', '/school/overview']) {
    assert.ok(paths.includes(path), `${path} should be registered`);
  }
});
