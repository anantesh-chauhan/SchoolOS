import bcryptjs from 'bcryptjs';
import prisma from '../config/prisma.client.js';
import {
  SECURITY_QUESTIONS, accountKeyForUser, auditSecurity, normalizeAnswer, opaqueToken,
  resolveAccount, saveQuestions, securePassword, tokenHash, updateAccountPassword, validatePassword,
} from '../services/accountSecurity.service.js';

const publicQuestion = new Map(SECURITY_QUESTIONS);

export const listCredentialAccounts = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const query = String(req.query.search || '').trim().slice(0, 200);
    const [users, students] = await Promise.all([
      prisma.user.findMany({
        where: { schoolId, ...(query ? { OR: [{ name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }, { employeeId: { contains: query, mode: 'insensitive' } }] } : {}) },
        select: { id: true, name: true, email: true, role: true, employeeId: true, isActive: true, lastLoginAt: true, passwordChangedAt: true, lockedUntil: true, class: { select: { className: true } }, section: { select: { sectionName: true } } },
        orderBy: { name: 'asc' }, take: 101,
      }),
      prisma.student.findMany({
        where: { schoolId, ...(query ? { OR: [{ studentFirstName: { contains: query, mode: 'insensitive' } }, { studentLastName: { contains: query, mode: 'insensitive' } }, { admissionNo: { contains: query, mode: 'insensitive' } }, { studentUserId: { contains: query, mode: 'insensitive' } }, { parentUserId: { contains: query, mode: 'insensitive' } }] } : {}) },
        select: { id: true, studentFirstName: true, studentLastName: true, studentUserId: true, parentUserId: true, fatherName: true, className: true, section: true, admissionNo: true, isActive: true, passwordChangedAt: true, lockedUntil: true },
        orderBy: [{ className: 'asc' }, { studentFirstName: 'asc' }], take: 101,
      }),
    ]);
    const accountKeys = [
      ...users.map((row) => `user:${row.id}`),
      ...students.flatMap((row) => [`student:${row.id}`, `parent:${row.id}`]),
    ];
    const questionCounts = accountKeys.length ? await prisma.userSecurityQuestion.groupBy({ by: ['accountKey'], where: { schoolId, accountKey: { in: accountKeys } }, _count: { _all: true } }) : [];
    const configured = new Map(questionCounts.map((row) => [row.accountKey, row._count._all >= 2]));
    const rows = [
      ...users.map((row) => ({ accountKey: `user:${row.id}`, name: row.name, loginId: row.email, role: row.role, className: row.class?.className, sectionName: row.section?.sectionName, referenceId: row.employeeId, active: row.isActive, securityConfigured: configured.get(`user:${row.id}`) || false, lastLoginAt: row.lastLoginAt, passwordChangedAt: row.passwordChangedAt, locked: Boolean(row.lockedUntil && row.lockedUntil > new Date()) })),
      ...students.flatMap((row) => [
        { accountKey: `student:${row.id}`, name: [row.studentFirstName, row.studentLastName].filter(Boolean).join(' '), loginId: row.studentUserId, role: 'STUDENT', className: row.className, sectionName: row.section, referenceId: row.admissionNo, active: row.isActive, securityConfigured: configured.get(`student:${row.id}`) || false, passwordChangedAt: row.passwordChangedAt, locked: Boolean(row.lockedUntil && row.lockedUntil > new Date()) },
        { accountKey: `parent:${row.id}`, name: row.fatherName, loginId: row.parentUserId, role: 'PARENT', className: row.className, sectionName: row.section, referenceId: row.admissionNo, linkedStudent: [row.studentFirstName, row.studentLastName].filter(Boolean).join(' '), active: row.isActive, securityConfigured: configured.get(`parent:${row.id}`) || false, passwordChangedAt: row.passwordChangedAt, locked: Boolean(row.lockedUntil && row.lockedUntil > new Date()) },
      ]),
    ];
    const filtered = rows.filter((row) => (!req.query.role || row.role === req.query.role)
      && (!req.query.status || String(row.active) === req.query.status)
      && (!req.query.security || String(row.securityConfigured) === req.query.security)
      && (!req.query.locked || String(row.locked) === req.query.locked)
      && (!query || Object.values(row).filter(Boolean).some((value) => String(value).toLowerCase().includes(query.toLowerCase()))));
    const limit = Math.min(Number(req.query.limit) || 100, 100);
    return res.json({ success: true, data: filtered.slice(0, limit), pagination: { limit, returned: Math.min(filtered.length, limit), truncated: users.length > 100 || students.length > 100 || filtered.length > limit } });
  } catch (error) { return res.status(500).json({ success: false, message: 'Failed to load credential accounts' }); }
};

export const adminResetPassword = async (req, res) => {
  const schoolId = req.user.schoolId;
  const account = await resolveAccount({ accountKey: req.params.accountKey, schoolId });
  if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
  const temporaryPassword = req.body.method === 'MANUAL' ? req.body.password : securePassword();
  if (!validatePassword(temporaryPassword)) return res.status(400).json({ success: false, message: 'Password must be at least 10 characters with uppercase, lowercase, number, and symbol' });
  try {
    await updateAccountPassword({ account, passwordHash: await bcryptjs.hash(temporaryPassword, 12), mustChangePassword: true });
    await auditSecurity(req, { schoolId, targetUserId: account.accountKey || req.params.accountKey, action: 'ADMIN_PASSWORD_RESET', status: 'SUCCESS', metadata: { method: req.body.method || 'GENERATED', reason: req.body.reason || null } });
    return res.json({ success: true, message: 'Password reset and all sessions invalidated', data: { accountKey: req.params.accountKey, loginId: account.loginId, temporaryPassword, mustChangePassword: true } });
  } catch (error) {
    await auditSecurity(req, { schoolId, targetUserId: req.params.accountKey, action: 'ADMIN_PASSWORD_RESET', status: 'FAILURE', metadata: { reason: req.body.reason || error.message } });
    return res.status(500).json({ success: false, message: 'Password reset failed' });
  }
};

export const unlockAccount = async (req, res) => {
  const account = await resolveAccount({ accountKey: req.params.accountKey, schoolId: req.user.schoolId });
  if (!account) return res.status(404).json({ success: false, message: 'Account not found' });
  if (account.kind === 'user') await prisma.user.update({ where: { id: account.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  else await prisma.student.update({ where: { id: account.id }, data: { failedLoginAttempts: 0, lockedUntil: null } });
  await auditSecurity(req, { schoolId: req.user.schoolId, targetUserId: req.params.accountKey, action: 'ACCOUNT_UNLOCKED', status: 'SUCCESS' });
  return res.json({ success: true, message: 'Account unlocked' });
};

export const getSecuritySettings = async (req, res) => {
  const accountKey = accountKeyForUser(req.user);
  const questions = await prisma.userSecurityQuestion.findMany({ where: { schoolId: req.user.schoolId, accountKey }, select: { questionKey: true, createdAt: true } });
  if (!questions.length && req.user.role !== 'PLATFORM_OWNER' && !['STUDENT', 'PARENT'].includes(req.user.role)) {
    const existing = await prisma.userWidgetNotification.findFirst({ where: { schoolId: req.user.schoolId, userId: req.user.id, type: { in: ['SECURITY_SETUP_REQUIRED', 'SECURITY_SETUP_REMINDER'] }, isRead: false } });
    const profileLinks = { SCHOOL_OWNER: '/dashboard/school/profile#security-settings', ADMIN: '/dashboard/admin/profile#security-settings', CURRICULUM_MANAGER: '/dashboard/curriculum/profile#security-settings', TEACHER: '/dashboard/teacher/profile#security-settings', STAFF: '/dashboard/staff/profile#security-settings' };
    if (!existing) await prisma.userWidgetNotification.create({ data: { schoolId: req.user.schoolId, userId: req.user.id, title: 'Secure your account', body: 'Configure security questions to enable safe account recovery.', type: 'SECURITY_SETUP_REQUIRED', link: profileLinks[req.user.role] || null } });
  }
  return res.json({ success: true, data: { configured: questions.length >= 2, selectedQuestions: questions.map((row) => ({ questionKey: row.questionKey, question: publicQuestion.get(row.questionKey) })), availableQuestions: SECURITY_QUESTIONS.map(([questionKey, question]) => ({ questionKey, question })) } });
};

export const configureSecurityQuestions = async (req, res) => {
  const accountKey = accountKeyForUser(req.user);
  const account = await resolveAccount({ accountKey, schoolId: req.user.schoolId });
  if (!account || !await bcryptjs.compare(req.body.currentPassword || '', account.passwordHash || '')) return res.status(400).json({ success: false, message: 'Current password verification failed' });
  try {
    const count = await saveQuestions({ schoolId: req.user.schoolId, accountKey, questions: req.body.questions });
    await auditSecurity(req, { schoolId: req.user.schoolId, targetUserId: accountKey, action: 'SECURITY_QUESTIONS_CONFIGURED', status: 'SUCCESS', metadata: { count } });
    return res.json({ success: true, message: 'Security questions configured', data: { count } });
  } catch (error) { return res.status(error.statusCode || 400).json({ success: false, message: error.message }); }
};

const findRecoveryAccount = async (identifier) => {
  const value = String(identifier || '').trim().toLowerCase();
  const user = await prisma.user.findFirst({ where: { OR: [{ email: value }, { contactEmail: value }, { employeeId: { equals: value, mode: 'insensitive' } }] } });
  if (user) return { accountKey: `user:${user.id}`, schoolId: user.schoolId };
  const student = await prisma.student.findFirst({ where: { OR: [{ studentUserId: value }, { parentUserId: value }, { admissionNo: { equals: identifier, mode: 'insensitive' } }] } });
  if (!student) return null;
  return { accountKey: student.parentUserId === value ? `parent:${student.id}` : `student:${student.id}`, schoolId: student.schoolId };
};

export const startRecovery = async (req, res) => {
  const challenge = opaqueToken(); const found = await findRecoveryAccount(req.body.identifier);
  let questionKeys = SECURITY_QUESTIONS.slice(0, 2).map(([questionKey]) => questionKey);
  if (found) {
    await prisma.passwordResetToken.create({ data: { schoolId: found.schoolId, accountKey: found.accountKey, tokenHash: tokenHash(challenge), expiresAt: new Date(Date.now() + 15 * 60_000), requestedIp: req.ip, requestMethod: 'SECURITY_QUESTIONS', verificationState: { verified: false } } });
    const saved = await prisma.userSecurityQuestion.findMany({ where: { schoolId: found.schoolId, accountKey: found.accountKey }, select: { questionKey: true } });
    if (saved.length >= 2) questionKeys = saved.map((row) => row.questionKey);
  }
  return res.json({ success: true, message: 'If the account is eligible, recovery verification can continue.', data: { challenge, questions: questionKeys.map((questionKey) => ({ questionKey, question: publicQuestion.get(questionKey) })) } });
};

export const verifyRecovery = async (req, res) => {
  const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash: tokenHash(req.body.challenge || '') } });
  const generic = () => res.status(400).json({ success: false, message: 'Recovery verification failed' });
  if (!token || token.usedAt || token.expiresAt < new Date()) return generic();
  const account = await resolveAccount({ accountKey: token.accountKey, schoolId: token.schoolId });
  const detailMatches = account?.kind === 'user'
    ? String(account.row.employeeId || '').toLowerCase() === String(req.body.identityDetail || '').trim().toLowerCase()
    : String(account.row.admissionNo || '').toLowerCase() === String(req.body.identityDetail || '').trim().toLowerCase();
  const questions = await prisma.userSecurityQuestion.findMany({ where: { schoolId: token.schoolId, accountKey: token.accountKey } });
  const answers = new Map((req.body.answers || []).map((item) => [item.questionKey, normalizeAnswer(item.answer)]));
  const answerMatches = questions.length >= 2 && (await Promise.all(questions.map((row) => bcryptjs.compare(answers.get(row.questionKey) || '', row.answerHash)))).every(Boolean);
  if (!detailMatches || !answerMatches) { await auditSecurity(req, { schoolId: token.schoolId, targetUserId: token.accountKey, action: 'RECOVERY_VERIFICATION', status: 'FAILURE' }); return generic(); }
  const resetToken = opaqueToken();
  await prisma.passwordResetToken.update({ where: { id: token.id }, data: { tokenHash: tokenHash(resetToken), verificationState: { verified: true }, expiresAt: new Date(Date.now() + 10 * 60_000) } });
  return res.json({ success: true, message: 'Identity verified', data: { resetToken } });
};

export const completeRecovery = async (req, res) => {
  if (!validatePassword(req.body.password)) return res.status(400).json({ success: false, message: 'Password does not meet security requirements' });
  const token = await prisma.passwordResetToken.findUnique({ where: { tokenHash: tokenHash(req.body.resetToken || '') } });
  if (!token || token.usedAt || token.expiresAt < new Date() || token.verificationState?.verified !== true) return res.status(400).json({ success: false, message: 'Reset link is invalid or expired' });
  const account = await resolveAccount({ accountKey: token.accountKey, schoolId: token.schoolId });
  if (!account) return res.status(400).json({ success: false, message: 'Reset link is invalid or expired' });
  const passwordHash = await bcryptjs.hash(req.body.password, 12);
  await prisma.$transaction(async (tx) => {
    await updateAccountPassword({ account, passwordHash, mustChangePassword: false, client: tx });
    await tx.passwordResetToken.update({ where: { id: token.id }, data: { usedAt: new Date() } });
  });
  await auditSecurity(req, { schoolId: token.schoolId, targetUserId: token.accountKey, action: 'SELF_SERVICE_PASSWORD_RESET', status: 'SUCCESS' });
  return res.json({ success: true, message: 'Password changed successfully. Sign in with the new password.' });
};
