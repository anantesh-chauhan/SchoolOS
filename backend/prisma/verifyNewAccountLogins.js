import 'dotenv/config';
import prisma from '../src/config/prisma.client.js';
import { getMe, login, loginParent, loginStudent, refreshSession } from '../src/controllers/auth.controller.js';
import { verifyToken } from '../src/utils/jwt.util.js';

const invoke = async (handler, req) => {
  let result = null;
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { result = { status: this.statusCode, body }; return result; },
  };
  await handler(req, res);
  return result;
};

const verifySession = async (loginHandler, email, password) => {
  const loggedIn = await invoke(loginHandler, { body: { email, password } });
  if (loggedIn?.status !== 200 || !loggedIn.body?.data?.accessToken) {
    return { login: loggedIn?.status || 500, me: null, role: null };
  }
  const decoded = verifyToken(loggedIn.body.data.accessToken);
  const directUserExists = ['STUDENT', 'PARENT'].includes(decoded.role)
    ? null
    : Boolean(await prisma.user.findUnique({ where: { id: decoded.id }, select: { id: true } }));
  const me = await invoke(getMe, { user: decoded });
  const refreshed = await invoke(refreshSession, { body: { refreshToken: loggedIn.body.data.refreshToken } });
  return { login: loggedIn.status, me: me?.status || 500, refresh: refreshed?.status || 500, role: me?.body?.data?.role || null, detail: me?.body?.message || null, tokenId: String(decoded.id).slice(0, 8), directUserExists };
};

try {
  const student = await prisma.student.findFirst({
    where: { passwordGenerated: true, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
  const teacherUsers = await prisma.user.findMany({
    where: { role: 'TEACHER', isActive: true },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });
  const teacher = teacherUsers.find((row) => row.email.endsWith('.schoolos')) || teacherUsers[0];

  if (!student || !teacher) throw new Error('A recent student and teacher account are required for verification');

  const admissionTail = student.admissionNo.slice(-4);
  const teacherFirstName = teacher.name.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const results = {
    student: await verifySession(loginStudent, ` ${student.studentUserId.toUpperCase()} `, `${student.studentFirstName}@${admissionTail}`),
    parent: await verifySession(loginParent, ` ${student.parentUserId.toUpperCase()} `, `${student.fatherName}@${admissionTail}`),
    studentMainLogin: await verifySession(login, ` ${student.studentUserId.toUpperCase()} `, `${student.studentFirstName}@${admissionTail}`),
    parentMainLogin: await verifySession(login, ` ${student.parentUserId.toUpperCase()} `, `${student.fatherName}@${admissionTail}`),
    teacher: await verifySession(login, ` ${teacher.email.toUpperCase()} `, `${teacherFirstName}@123`),
  };
  console.log(JSON.stringify(results, null, 2));
  if (Object.values(results).some((row) => row.login !== 200 || row.me !== 200 || row.refresh !== 200)) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
