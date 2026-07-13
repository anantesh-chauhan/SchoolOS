import crypto from 'crypto';
import bcryptjs from 'bcryptjs';
import prisma from '../config/prisma.client.js';

export const SECURITY_QUESTIONS = Object.freeze([
  ['FIRST_SCHOOL', 'What was the name of your first school?'],
  ['MEMORABLE_TEACHER', 'What is the name of a memorable teacher?'],
  ['CHILDHOOD_FRIEND', 'What was the name of your childhood best friend?'],
  ['FAMILY_PLACE', 'What is the name of a place meaningful to your family?'],
  ['FIRST_BOOK', 'What was the title of the first book you remember reading?'],
]);
const questionKeys = new Set(SECURITY_QUESTIONS.map(([key]) => key));
export const normalizeAnswer = (value) => String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
export const validatePassword = (value) => typeof value === 'string' && value.length >= 10 && /[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value) && /[^A-Za-z0-9]/.test(value);
export const securePassword = () => `${crypto.randomBytes(6).toString('base64url')}!aA7`;
export const opaqueToken = () => crypto.randomBytes(32).toString('base64url');
export const tokenHash = (token) => crypto.createHash('sha256').update(token).digest('hex');

export const accountKeyForUser = (user) => ['STUDENT', 'PARENT'].includes(user.role)
  ? `${user.role.toLowerCase()}:${user.studentId || user.id}`
  : `user:${user.id}`;

export const resolveAccount = async ({ accountKey, schoolId }) => {
  const [kind, id] = String(accountKey || '').split(':');
  if (kind === 'user') {
    const row = await prisma.user.findFirst({ where: { id, schoolId }, include: { class: true, section: true } });
    return row ? { kind, id: row.id, schoolId: row.schoolId, role: row.role, name: row.name, loginId: row.email, passwordHash: row.password, row } : null;
  }
  if (kind === 'student' || kind === 'parent') {
    const row = await prisma.student.findFirst({ where: { id, schoolId } });
    if (!row) return null;
    return {
      kind, id: row.id, schoolId: row.schoolId, role: kind.toUpperCase(),
      name: kind === 'student' ? [row.studentFirstName, row.studentLastName].filter(Boolean).join(' ') : row.fatherName,
      loginId: kind === 'student' ? row.studentUserId : row.parentUserId,
      passwordHash: kind === 'student' ? row.studentPasswordHash : row.parentPasswordHash,
      row,
    };
  }
  return null;
};

export const updateAccountPassword = async ({ account, passwordHash, mustChangePassword, client = prisma }) => {
  if (account.kind === 'user') {
    return client.user.update({ where: { id: account.id }, data: { password: passwordHash, mustChangePassword, passwordChangedAt: new Date(), sessionVersion: { increment: 1 }, failedLoginAttempts: 0, lockedUntil: null } });
  }
  return client.student.update({
    where: { id: account.id },
    data: {
      ...(account.kind === 'student' ? { studentPasswordHash: passwordHash } : { parentPasswordHash: passwordHash }),
      ...(account.kind === 'student' ? { studentMustChangePassword: mustChangePassword } : { parentMustChangePassword: mustChangePassword }),
      passwordChangedAt: new Date(), sessionVersion: { increment: 1 }, failedLoginAttempts: 0, lockedUntil: null,
    },
  });
};

export const saveQuestions = async ({ schoolId, accountKey, questions }) => {
  if (!Array.isArray(questions) || questions.length < 2 || questions.length > 3) throw Object.assign(new Error('Select two or three security questions'), { statusCode: 400 });
  const keys = questions.map((item) => item.questionKey);
  if (new Set(keys).size !== keys.length || keys.some((key) => !questionKeys.has(key))) throw Object.assign(new Error('Choose unique questions from the approved list'), { statusCode: 400 });
  const rows = await Promise.all(questions.map(async (item) => {
    const answer = normalizeAnswer(item.answer);
    if (answer.length < 3) throw Object.assign(new Error('Security answers must contain at least three characters'), { statusCode: 400 });
    return { schoolId, accountKey, questionKey: item.questionKey, answerHash: await bcryptjs.hash(answer, 10) };
  }));
  await prisma.$transaction(async (tx) => {
    await tx.userSecurityQuestion.deleteMany({ where: { schoolId, accountKey } });
    await tx.userSecurityQuestion.createMany({ data: rows });
    const [kind, id] = accountKey.split(':');
    if (kind === 'user') await tx.user.update({ where: { id }, data: { securityQuestionsConfigured: true, securitySetupCompletedAt: new Date(), recoveryEnabled: true } });
    else await tx.student.update({ where: { id }, data: { securityQuestionsConfigured: true, securitySetupCompletedAt: new Date(), recoveryEnabled: true } });
    if (kind === 'user') await tx.userWidgetNotification.updateMany({ where: { schoolId, userId: id, type: { in: ['SECURITY_SETUP_REQUIRED', 'SECURITY_SETUP_REMINDER'] } }, data: { isRead: true } });
  });
  return rows.length;
};

export const auditSecurity = (req, data) => prisma.securityAuditLog.create({ data: {
  schoolId: data.schoolId || null, actorUserId: data.actorUserId || req.user?.id || null,
  targetUserId: data.targetUserId || null, action: data.action, status: data.status,
  metadata: data.metadata || undefined, ipAddress: req.ip || null, userAgent: req.get?.('user-agent') || null,
} });
