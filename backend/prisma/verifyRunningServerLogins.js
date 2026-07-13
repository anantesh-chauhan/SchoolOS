import 'dotenv/config';
import prisma from '../src/config/prisma.client.js';

const baseUrl = process.env.VERIFY_API_URL || 'http://localhost:5000/api';

const request = async (path, { method = 'GET', body, token } = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
};

const verifyRole = async ({ role, endpoint, email, password }) => {
  const login = await request(endpoint, { method: 'POST', body: { email, password } });
  const unifiedLogin = role === 'TEACHER'
    ? login
    : await request('/auth/login', { method: 'POST', body: { email, password } });
  const token = login.payload?.data?.accessToken;
  const me = token ? await request('/auth/me', { token }) : null;
  const dashboard = role === 'TEACHER' && token
    ? {
        dashboard: await request('/teacher/dashboard', { token }),
        assignments: await request('/teacher/assignments', { token }),
        polls: await request('/teacher/polls', { token }),
      }
    : null;
  return {
    login: login.status,
    loginMessage: login.payload?.message || null,
    unifiedLogin: unifiedLogin.status,
    me: me?.status || null,
    meMessage: me?.payload?.message || null,
    ...(dashboard ? {
      teacherDashboard: dashboard.dashboard.status,
      teacherDashboardMessage: dashboard.dashboard.payload?.message || null,
      teacherAssignments: dashboard.assignments.status,
      teacherAssignmentsMessage: dashboard.assignments.payload?.message || null,
      teacherPolls: dashboard.polls.status,
      teacherPollsMessage: dashboard.polls.payload?.message || null,
    } : {}),
  };
};

try {
  const student = await prisma.student.findFirst({ where: { passwordGenerated: true, isActive: true }, orderBy: { createdAt: 'desc' } });
  const teacherUsers = await prisma.user.findMany({ where: { role: 'TEACHER', isActive: true }, orderBy: { createdAt: 'desc' }, take: 20 });
  const teacher = teacherUsers.find((row) => row.email.endsWith('.schoolos')) || teacherUsers[0];
  if (!student || !teacher) throw new Error('A recent student and teacher are required');

  const tail = student.admissionNo.slice(-4);
  const teacherFirstName = teacher.name.split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const results = {
    student: await verifyRole({ role: 'STUDENT', endpoint: '/auth/login-student', email: student.studentUserId, password: `${student.studentFirstName}@${tail}` }),
    parent: await verifyRole({ role: 'PARENT', endpoint: '/auth/login-parent', email: student.parentUserId, password: `${student.fatherName}@${tail}` }),
    teacher: await verifyRole({ role: 'TEACHER', endpoint: '/auth/login', email: teacher.email, password: `${teacherFirstName}@123` }),
  };
  console.log(JSON.stringify(results, null, 2));
  const failed = Object.values(results).some((row) => row.login !== 200 || row.unifiedLogin !== 200 || row.me !== 200)
    || results.teacher.teacherDashboard !== 200
    || results.teacher.teacherAssignments !== 200
    || results.teacher.teacherPolls !== 200;
  if (failed) process.exitCode = 1;
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
