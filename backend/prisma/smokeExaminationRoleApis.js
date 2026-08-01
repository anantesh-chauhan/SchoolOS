import 'dotenv/config';
import prisma from '../src/config/prisma.client.js';
import { auditLogs, metadata, resultRegister, roleDashboard } from '../src/modules/examinations/examination.controller.js';

const invoke = (handler, req) => new Promise((resolve, reject) => {
  const res = { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(payload) { resolve({ status: this.statusCode, payload }); } };
  handler({ query: {}, params: {}, body: {}, ip: '127.0.0.1', get: () => 'smoke-test', ...req }, res, reject);
});

const school = await prisma.school.findFirst({ where: { schoolName: { contains: 'Green Valley', mode: 'insensitive' } } });
const admin = school && await prisma.user.findFirst({ where: { schoolId: school.id, role: { in: ['ADMIN', 'SCHOOL_OWNER'] }, isActive: true } });
const exam = school && await prisma.examination.findFirst({ where: { schoolId: school.id, publishedAt: { not: null } } });
if (!school || !admin || !exam) throw new Error('Green Valley admin and published examination are required for the smoke check');
const user = { id: admin.id, schoolId: school.id, role: admin.role };
const [dashboard, meta, register, audits] = await Promise.all([
  invoke(roleDashboard, { user }), invoke(metadata, { user }),
  invoke(resultRegister, { user, params: { id: exam.id }, query: { page: '1', limit: '10' } }),
  invoke(auditLogs, { user, query: { examinationId: exam.id, limit: '10' } }),
]);
for (const [name, response] of Object.entries({ dashboard, metadata: meta, register, audits })) {
  if (response.status !== 200 || !response.payload.success) throw new Error(`${name} failed: ${response.payload.message || response.status}`);
}
console.log(JSON.stringify({ school: school.schoolName, dashboardExams: dashboard.payload.data.exams.length, sessions: meta.payload.data.sessions.length, registerRows: register.payload.data.rows.length, auditRows: audits.payload.data.rows.length }, null, 2));
await prisma.$disconnect();

