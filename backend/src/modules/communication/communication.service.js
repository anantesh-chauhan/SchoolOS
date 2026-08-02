import prisma from '../../config/prisma.client.js';
import { randomUUID } from 'node:crypto';
import { getTeacherForUser } from '../../utils/teacherAuthorization.util.js';
import { CommunicationError, validateTemplateVariables } from './communication.validation.js';
import { emitToRecipient } from './realtime.service.js';
import { sendDelivery } from './delivery.providers.js';

const ADMIN_ROLES = new Set(['SCHOOL_OWNER', 'ADMIN']);
const MANDATORY_CATEGORIES = new Set(['EMERGENCY', 'SECURITY', 'LEGAL']);
const MASS_ROLES = new Set(['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','FEE_MANAGER','TEACHER','CLASS_TEACHER']);
const STAFF_ROLES = ['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','FEE_MANAGER','TEACHER','STAFF'];
const TEACHER_DIRECT_ROLES = ['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER','STAFF'];
const LEGACY_SYNC_TTL_MS = 60_000;
const LEGACY_SYNC_CACHE_LIMIT = 500;
const legacySyncCache = new Map();

export const principalKey = (user) => user.role === 'STUDENT' ? `student:${user.studentId}` : user.role === 'PARENT' ? `parent:${user.email}` : `user:${user.id}`;
const auditContext = (req) => ({ ipAddress: req?.ip || null, userAgent: req?.get?.('user-agent')?.slice(0, 500) || null });
const now = () => new Date();

const userRecipient = (row, context = 'DIRECT') => ({ recipientKey: `user:${row.id}`, userId: row.id, studentId: null, parentId: null, recipientRole: row.role, deliveryContext: context, context: null });
const studentRecipients = (student, roles = ['STUDENT','PARENT'], context = 'SECTION') => [
  ...(roles.includes('STUDENT') && student.studentUserId ? [{ recipientKey: `student:${student.id}`, userId: null, studentId: student.id, parentId: null, recipientRole: 'STUDENT', deliveryContext: context, context: { studentId: student.id, studentName: `${student.studentFirstName} ${student.studentLastName || ''}`.trim() } }] : []),
  ...(roles.includes('PARENT') && student.parentUserId ? [{ recipientKey: `parent:${student.parentUserId}`, userId: null, studentId: student.id, parentId: student.parentUserId, recipientRole: 'PARENT', deliveryContext: context === 'DIRECT' ? 'DIRECT' : 'PARENT_OF_STUDENT', context: { studentId: student.id, studentName: `${student.studentFirstName} ${student.studentLastName || ''}`.trim() } }] : []),
];

const ensureLegacyRecipients = async (candidates) => {
  if (!candidates.length) return { synced: 0 };

  const schoolId = candidates[0].schoolId;
  const dedupeKeys = candidates.map((candidate) => candidate.dedupeKey);
  let notifications = await prisma.notification.findMany({
    where: { schoolId, dedupeKey: { in: dedupeKeys } },
    select: { id: true, dedupeKey: true },
  });
  const existingDedupeKeys = new Set(notifications.map((row) => row.dedupeKey));
  const missingNotifications = candidates.filter((candidate) => !existingDedupeKeys.has(candidate.dedupeKey));

  if (missingNotifications.length) {
    await prisma.notification.createMany({
      data: missingNotifications.map(({ dedupeKey, notification }) => ({
        schoolId,
        dedupeKey,
        status: 'PUBLISHED',
        publishedAt: notification.createdAt,
        resolvedRecipientCount: 1,
        ...notification,
      })),
      skipDuplicates: true,
    });
    notifications = await prisma.notification.findMany({
      where: { schoolId, dedupeKey: { in: dedupeKeys } },
      select: { id: true, dedupeKey: true },
    });
  }

  const notificationByDedupeKey = new Map(notifications.map((row) => [row.dedupeKey, row]));
  const recipientCandidates = candidates.flatMap((candidate) => {
    const notification = notificationByDedupeKey.get(candidate.dedupeKey);
    return notification ? [{ ...candidate, notificationId: notification.id }] : [];
  });
  const notificationIds = recipientCandidates.map((candidate) => candidate.notificationId);
  let recipients = await prisma.notificationRecipient.findMany({
    where: { notificationId: { in: notificationIds } },
    select: { id: true, notificationId: true, recipientKey: true, readAt: true },
  });
  const recipientScope = (notificationId, recipientKey) => `${notificationId}:${recipientKey}`;
  const existingRecipientByScope = new Map(
    recipients.map((row) => [recipientScope(row.notificationId, row.recipientKey), row]),
  );
  const missingRecipients = recipientCandidates.filter(
    (candidate) => !existingRecipientByScope.has(recipientScope(candidate.notificationId, candidate.recipient.recipientKey)),
  );

  if (missingRecipients.length) {
    await prisma.notificationRecipient.createMany({
      data: missingRecipients.map(({ notificationId, recipient }) => ({ notificationId, schoolId, ...recipient })),
      skipDuplicates: true,
    });
  }

  const readStateUpdates = recipientCandidates.flatMap((candidate) => {
    const existing = existingRecipientByScope.get(recipientScope(candidate.notificationId, candidate.recipient.recipientKey));
    return existing && !existing.readAt && candidate.recipient.readAt
      ? [prisma.notificationRecipient.update({ where: { id: existing.id }, data: { readAt: candidate.recipient.readAt } })]
      : [];
  });
  if (readStateUpdates.length) await prisma.$transaction(readStateUpdates);

  if (missingRecipients.length) {
    recipients = await prisma.notificationRecipient.findMany({
      where: { notificationId: { in: notificationIds } },
      select: { id: true, notificationId: true, recipientKey: true },
    });
  }
  const candidateByScope = new Map(
    recipientCandidates.map((candidate) => [recipientScope(candidate.notificationId, candidate.recipient.recipientKey), candidate]),
  );
  await prisma.notificationDelivery.createMany({
    data: recipients.flatMap((recipient) => {
      const candidate = candidateByScope.get(recipientScope(recipient.notificationId, recipient.recipientKey));
      return candidate ? [{
        notificationRecipientId: recipient.id,
        channel: 'IN_APP',
        status: 'DELIVERED',
        provider: 'database-legacy-bridge',
        attemptCount: 1,
        sentAt: candidate.notification.createdAt,
        deliveredAt: candidate.notification.createdAt,
      }] : [];
    }),
    skipDuplicates: true,
  });

  return { synced: recipientCandidates.length };
};

// Keep notifications created by older modules visible in the unified navbar and page.
const runLegacyNotificationSync = async (user) => {
  if (!user?.schoolId) return { synced: 0 };
  if (['STUDENT', 'PARENT'].includes(user.role) && user.studentId) {
    const student = await prisma.student.findFirst({ where: { id: user.studentId, schoolId: user.schoolId, isActive: true }, select: { id: true, parentUserId: true } });
    if (!student) return { synced: 0 };
    const rows = await prisma.academicNotification.findMany({ where: { schoolId: user.schoolId, recipientStudentId: student.id, recipientRole: user.role }, orderBy: { createdAt: 'desc' }, take: 200 });
    const recipientKey = user.role === 'PARENT' ? `parent:${student.parentUserId}` : `student:${student.id}`;
    if (recipientKey.endsWith(':null')) return { synced: 0 };
    return ensureLegacyRecipients(rows.map((row) => ({
        schoolId: user.schoolId,
        dedupeKey: `LEGACY_ACADEMIC:${row.id}`,
        notification: { type: row.type, category: row.entityType === 'RESOURCE' ? 'RESOURCE' : 'HOMEWORK', priority: 'NORMAL', title: row.title, message: row.body, actionUrl: '/homework', sourceModule: 'LEGACY_ACADEMIC', sourceEntityType: row.entityType, sourceEntityId: row.entityId, isSystemGenerated: true, createdAt: row.createdAt },
        recipient: { recipientKey, userId: null, studentId: student.id, parentId: user.role === 'PARENT' ? student.parentUserId : null, recipientRole: user.role, deliveryContext: 'AUTOMATED_RULE', readAt: row.readAt, context: { studentId: student.id } },
      })));
  } else if (user.id) {
    const rows = await prisma.userWidgetNotification.findMany({ where: { schoolId: user.schoolId, userId: user.id }, orderBy: { createdAt: 'desc' }, take: 200 });
    return ensureLegacyRecipients(rows.map((row) => ({
        schoolId: user.schoolId,
        dedupeKey: `LEGACY_WIDGET:${row.id}`,
        notification: { type: row.type, category: row.type?.includes('SECURITY') ? 'SECURITY' : 'SYSTEM', priority: 'NORMAL', title: row.title, message: row.body, actionUrl: row.link, sourceModule: 'LEGACY_WIDGET', sourceEntityType: 'UserWidgetNotification', sourceEntityId: row.id, isSystemGenerated: true, createdAt: row.createdAt },
        recipient: { recipientKey: `user:${user.id}`, userId: user.id, studentId: null, parentId: null, recipientRole: user.role, deliveryContext: 'DIRECT', readAt: row.isRead ? row.updatedAt : null },
      })));
  }
  return { synced: 0 };
};

export const syncLegacyNotifications = async (user) => {
  if (!user?.schoolId) return { synced: 0 };
  const cacheKey = `${user.schoolId}:${principalKey(user)}`;
  const cached = legacySyncCache.get(cacheKey);
  if (cached?.promise) return cached.promise;
  if (cached && Date.now() - cached.completedAt < LEGACY_SYNC_TTL_MS) return cached.result;

  const promise = runLegacyNotificationSync(user);
  legacySyncCache.set(cacheKey, { promise, completedAt: 0, result: null });
  try {
    const result = await promise;
    legacySyncCache.set(cacheKey, { promise: null, completedAt: Date.now(), result });
    if (legacySyncCache.size > LEGACY_SYNC_CACHE_LIMIT) {
      const oldestKey = legacySyncCache.keys().next().value;
      if (oldestKey !== cacheKey) legacySyncCache.delete(oldestKey);
    }
    return result;
  } catch (error) {
    legacySyncCache.delete(cacheKey);
    throw error;
  }
};

const assertSchoolUser = (user, schoolId) => {
  if (!user) throw new CommunicationError('Authentication required.', 401, 'UNAUTHORIZED');
  if (!schoolId || user.schoolId !== schoolId) throw new CommunicationError("You cannot access another school's communication.", 403, 'TENANT_FORBIDDEN');
};

const loadSectionScope = async (schoolId, ids) => {
  const sections = await prisma.section.findMany({ where: { schoolId, id: { in: ids }, deletedAt: null }, include: { class: { select: { className: true } } } });
  if (sections.length !== new Set(ids).size) throw new CommunicationError('One or more sections are invalid for this school.');
  return sections;
};

const assertCreatorScope = async (user, category, rules) => {
  if (!MASS_ROLES.has(user.role)) throw new CommunicationError('Your role cannot create broadcasts.', 403, 'FORBIDDEN');
  if (user.role === 'CURRICULUM_MANAGER' && !['ACADEMIC','HOMEWORK','RESOURCE','EXAM','RESULT','EVENT','HOLIDAY','GENERAL'].includes(category)) throw new CommunicationError('Curriculum Managers can only send academic communication.', 403);
  if (user.role === 'FEE_MANAGER') {
    if (category !== 'FEE') throw new CommunicationError('Fee Managers can only send fee communication.', 403);
    if (rules.some((rule) => !['DIRECT','ROLE','CLASS','SECTION','PARENT_OF_STUDENT'].includes(rule.kind))) throw new CommunicationError('Fee Managers can only message families or school administrators.', 403);
    if (rules.some((rule) => rule.kind === 'ROLE' && rule.role !== 'PARENT')) throw new CommunicationError('Fee Managers can only use the Parent bulk role.', 403);
    if (rules.some((rule) => ['CLASS','SECTION'].includes(rule.kind) && (!rule.metadata?.roles?.length || rule.metadata.roles.some((role) => role !== 'PARENT')))) throw new CommunicationError('Fee class and section messages must explicitly target parents.', 403);
    const directKeys = rules.filter((rule) => rule.kind === 'DIRECT').flatMap((rule) => rule.entityIds);
    const userIds = directKeys.filter((key) => key.startsWith('user:')).map((key) => key.slice(5));
    const parentIds = directKeys.filter((key) => key.startsWith('parent:')).map((key) => key.slice(7));
    if (directKeys.some((key) => !key.startsWith('user:') && !key.startsWith('parent:'))) throw new CommunicationError('Fee Managers can directly contact parents or administrators only.', 403);
    if (userIds.length) { const count = await prisma.user.count({ where: { schoolId: user.schoolId, id: { in: userIds }, isActive: true, role: { in: ['SCHOOL_OWNER','ADMIN'] } } }); if (count !== new Set(userIds).size) throw new CommunicationError('A direct recipient is outside the Fee Manager scope.', 403); }
    if (parentIds.length) { const count = await prisma.student.count({ where: { schoolId: user.schoolId, parentUserId: { in: parentIds }, isActive: true } }); if (count !== new Set(parentIds).size) throw new CommunicationError('A parent recipient is outside this school.', 403); }
    return;
  }
  if (!['TEACHER', 'CLASS_TEACHER'].includes(user.role)) return;
  if (!['ACADEMIC','HOMEWORK','RESOURCE','ATTENDANCE','GENERAL'].includes(category)) throw new CommunicationError('Teachers can only send communication within their academic scope.', 403);
  if (rules.some((rule) => ['SCHOOL_WIDE','STAFF','SAVED_GROUP','AUTOMATED_RULE'].includes(rule.kind))) throw new CommunicationError('Teachers cannot use school-wide or unrestricted audiences.', 403);
  const teacher = await getTeacherForUser(user);
  if (!teacher) throw new CommunicationError('Teacher profile not found.', 403);
  const [assignments, classAssignments] = await Promise.all([
    prisma.teacherAssignment.findMany({ where: { schoolId: user.schoolId, teacherId: teacher.id, isActive: true, ...(user.role === 'CLASS_TEACHER' ? { roleType: { in: ['CLASS_TEACHER', 'BOTH'] } } : {}), OR: [{ effectiveTo: null }, { effectiveTo: { gte: now() } }] }, select: { classId: true, sectionId: true, subjectId: true } }),
    user.role === 'CLASS_TEACHER' ? prisma.sectionClassTeacherAssignment.findMany({ where: { schoolId: user.schoolId, teacherId: teacher.id, status: 'ACTIVE', isPrimary: true, startDate: { lte: now() }, OR: [{ endDate: null }, { endDate: { gte: now() } }] }, select: { sectionId: true, section: { select: { classId: true } } } }) : [],
  ]);
  const classIds = new Set([...assignments.map((row) => row.classId), ...classAssignments.map((row) => row.section.classId)]); const sectionIds = new Set([...assignments.map((row) => row.sectionId), ...classAssignments.map((row) => row.sectionId)]); const subjectIds = new Set(user.role === 'TEACHER' ? assignments.map((row) => row.subjectId) : []);
  const assignedSections = await prisma.section.findMany({ where: { schoolId: user.schoolId, id: { in: [...sectionIds] } }, include: { class: true } });
  const assignedStudents = await prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true, OR: assignedSections.length ? assignedSections.map((section) => ({ className: section.class.className, section: section.sectionName })) : [{ id: '__none__' }] }, select: { id: true, parentUserId: true } });
  const allowedStudentIds = new Set(assignedStudents.map((student) => student.id));
  const allowedParentIds = new Set(assignedStudents.map((student) => student.parentUserId).filter(Boolean));
  for (const rule of rules) {
    if (rule.kind === 'CLASS' && rule.entityIds.some((id) => !classIds.has(id))) throw new CommunicationError('Teacher audience contains an unassigned class.', 403);
    if (rule.kind === 'SECTION' && rule.entityIds.some((id) => !sectionIds.has(id))) throw new CommunicationError('Teacher audience contains an unassigned section.', 403);
    if (rule.kind === 'SUBJECT' && rule.entityIds.some((id) => !subjectIds.has(id))) throw new CommunicationError('Teacher audience contains an unassigned subject.', 403);
    if (rule.kind === 'ROLE' && !TEACHER_DIRECT_ROLES.includes(rule.role)) throw new CommunicationError('Teachers can only bulk-message permitted academic or administrative staff roles.', 403);
    if (rule.kind === 'PARENT_OF_STUDENT' && rule.entityIds.some((id) => !allowedStudentIds.has(id))) throw new CommunicationError('Teacher audience contains an unrelated parent.', 403);
    if (rule.kind === 'DIRECT') {
      const userIds = rule.entityIds.filter((key) => key.startsWith('user:')).map((key) => key.slice(5));
      const studentIds = rule.entityIds.filter((key) => key.startsWith('student:')).map((key) => key.slice(8));
      const parentIds = rule.entityIds.filter((key) => key.startsWith('parent:')).map((key) => key.slice(7));
      if (userIds.length) { const count = await prisma.user.count({ where: { schoolId: user.schoolId, id: { in: userIds }, isActive: true, role: { in: TEACHER_DIRECT_ROLES } } }); if (count !== new Set(userIds).size) throw new CommunicationError('Teacher direct audience contains an unauthorized staff recipient.', 403); }
      if (studentIds.some((id) => !allowedStudentIds.has(id)) || parentIds.some((id) => !allowedParentIds.has(id)) || userIds.length + studentIds.length + parentIds.length !== rule.entityIds.length) throw new CommunicationError('Teacher direct audience contains an unrelated student or parent.', 403);
    }
  }
};

const resolveDirect = async (schoolId, values, context) => {
  const results = [];
  const userIds = values.filter((value) => value.startsWith('user:') || !value.includes(':')).map((value) => value.replace(/^user:/, ''));
  const studentIds = values.filter((value) => value.startsWith('student:')).map((value) => value.slice(8));
  const parentIds = values.filter((value) => value.startsWith('parent:')).map((value) => value.slice(7));
  const [users, students, parents] = await Promise.all([
    userIds.length ? prisma.user.findMany({ where: { id: { in: userIds }, schoolId, isActive: true } }) : [],
    studentIds.length ? prisma.student.findMany({ where: { id: { in: studentIds }, schoolId, isActive: true } }) : [],
    parentIds.length ? prisma.student.findMany({ where: { schoolId, isActive: true, OR: [{ id: { in: parentIds } }, { parentUserId: { in: parentIds } }] } }) : [],
  ]);
  results.push(...users.map((row) => userRecipient(row, context)));
  students.forEach((row) => results.push(...studentRecipients(row, ['STUDENT'], context)));
  parents.forEach((row) => results.push(...studentRecipients(row, ['PARENT'], context)));
  return results;
};

export const resolveAudience = async (user, category, rules) => {
  assertSchoolUser(user, user.schoolId); await assertCreatorScope(user, category, rules);
  const recipients = [];
  for (const rule of rules) {
    if (rule.kind === 'DIRECT') recipients.push(...await resolveDirect(user.schoolId, rule.entityIds, 'DIRECT'));
    if (rule.kind === 'PARENT_OF_STUDENT') {
      const students = await prisma.student.findMany({ where: { schoolId: user.schoolId, id: { in: rule.entityIds }, isActive: true } }); students.forEach((row) => recipients.push(...studentRecipients(row, ['PARENT'], 'PARENT_OF_STUDENT')));
    }
    if (rule.kind === 'SCHOOL_WIDE' || rule.kind === 'STAFF') {
      const roles = rule.kind === 'STAFF' ? STAFF_ROLES : STAFF_ROLES;
      const users = await prisma.user.findMany({ where: { schoolId: user.schoolId, isActive: true, role: { in: roles } } }); recipients.push(...users.map((row) => userRecipient(row, rule.kind)));
      if (rule.kind === 'SCHOOL_WIDE') { const students = await prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true } }); students.forEach((row) => recipients.push(...studentRecipients(row, ['STUDENT','PARENT'], 'SCHOOL_WIDE'))); }
    }
    if (rule.kind === 'ROLE') {
      if (['STUDENT','PARENT'].includes(rule.role)) { const students = await prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true } }); students.forEach((row) => recipients.push(...studentRecipients(row, [rule.role], 'ROLE'))); }
      else { const users = await prisma.user.findMany({ where: { schoolId: user.schoolId, role: rule.role, isActive: true } }); recipients.push(...users.map((row) => userRecipient(row, 'ROLE'))); }
    }
    if (rule.kind === 'CLASS') {
      const classes = await prisma.class.findMany({ where: { schoolId: user.schoolId, id: { in: rule.entityIds }, deletedAt: null } });
      if (classes.length !== new Set(rule.entityIds).size) throw new CommunicationError('One or more classes are invalid for this school.');
      const students = await prisma.student.findMany({ where: { schoolId: user.schoolId, className: { in: classes.map((row) => row.className) }, isActive: true } }); students.forEach((row) => recipients.push(...studentRecipients(row, rule.metadata?.roles || ['STUDENT','PARENT'], 'CLASS')));
    }
    if (rule.kind === 'SECTION') {
      const sections = await loadSectionScope(user.schoolId, rule.entityIds); const pairs = sections.map((row) => ({ className: row.class.className, section: row.sectionName }));
      const students = await prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true, OR: pairs } }); students.forEach((row) => recipients.push(...studentRecipients(row, rule.metadata?.roles || ['STUDENT','PARENT'], 'SECTION')));
    }
    if (rule.kind === 'SUBJECT') {
      const subjects = await prisma.subject.count({ where: { schoolId: user.schoolId, id: { in: rule.entityIds }, deletedAt: null } }); if (subjects !== new Set(rule.entityIds).size) throw new CommunicationError('One or more subjects are invalid for this school.');
      const scopedTeacher = user.role === 'TEACHER' ? await getTeacherForUser(user) : null;
      const assignments = await prisma.teacherAssignment.findMany({ where: { schoolId: user.schoolId, subjectId: { in: rule.entityIds }, isActive: true, ...(user.role === 'TEACHER' ? { teacherId: scopedTeacher?.id || '__none__' } : {}) }, include: { teacher: true, section: { include: { class: true } } } });
      if (rule.metadata?.includeTeachers !== false) { const teacherEmails = assignments.map((row) => row.teacher.email); const users = await prisma.user.findMany({ where: { schoolId: user.schoolId, role: 'TEACHER', isActive: true, OR: [{ email: { in: teacherEmails } }, { contactEmail: { in: teacherEmails } }] } }); recipients.push(...users.map((row) => userRecipient(row, 'SUBJECT'))); }
      if (rule.metadata?.includeStudents) { const students = await prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true, OR: assignments.map((row) => ({ className: row.section.class.className, section: row.section.sectionName })) } }); students.forEach((row) => recipients.push(...studentRecipients(row, rule.metadata?.roles || ['STUDENT','PARENT'], 'SUBJECT'))); }
    }
  }
  const deduped = [...new Map(recipients.map((row) => [row.recipientKey, row])).values()];
  const policy = await prisma.communicationPolicy.upsert({ where: { schoolId: user.schoolId }, create: { schoolId: user.schoolId }, update: {} });
  if (deduped.length > policy.maximumRecipientsPerMessage) throw new CommunicationError(`Audience exceeds the ${policy.maximumRecipientsPerMessage} recipient limit.`, 413, 'RECIPIENT_LIMIT');
  return deduped;
};

const uniqueById = (rows) => [...new Map(rows.map((row) => [row.id, row])).values()];

export const audienceOptions = async (user) => {
  assertSchoolUser(user, user.schoolId);
  const isAdmin = ADMIN_ROLES.has(user.role);
  let classes = []; let sections = []; let subjects = []; let students = []; let staffRoles = []; let audiences = [];

  if (user.role === 'CLASS_TEACHER') {
    const teacher = await getTeacherForUser(user);
    if (!teacher) throw new CommunicationError('Teacher profile not found.', 403);
    const [canonical, legacy] = await Promise.all([
      prisma.sectionClassTeacherAssignment.findMany({ where: { schoolId: user.schoolId, teacherId: teacher.id, status: 'ACTIVE', isPrimary: true, startDate: { lte: now() }, OR: [{ endDate: null }, { endDate: { gte: now() } }] }, include: { section: { include: { class: true } } } }),
      prisma.teacherAssignment.findMany({ where: { schoolId: user.schoolId, teacherId: teacher.id, isActive: true, roleType: { in: ['CLASS_TEACHER', 'BOTH'] }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now() } }] }, include: { class: true, section: true } }),
    ]);
    classes = uniqueById([...canonical.map((row) => ({ id: row.section.class.id, name: row.section.class.className })), ...legacy.map((row) => ({ id: row.class.id, name: row.class.className }))]);
    sections = uniqueById([...canonical.map((row) => ({ id: row.section.id, classId: row.section.classId, name: `${row.section.class.className} · ${row.section.sectionName}` })), ...legacy.map((row) => ({ id: row.section.id, classId: row.section.classId, name: `${row.class.className} · ${row.section.sectionName}` }))]);
    const pairs = [...canonical.map((row) => ({ className: row.section.class.className, section: row.section.sectionName })), ...legacy.map((row) => ({ className: row.class.className, section: row.section.sectionName }))];
    students = await prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true, OR: pairs.length ? pairs : [{ id: '__none__' }] }, select: { id: true, studentFirstName: true, studentLastName: true, fatherName: true, studentUserId: true, parentUserId: true, className: true, section: true }, orderBy: [{ className: 'asc' }, { section: 'asc' }, { studentFirstName: 'asc' }] });
    staffRoles = TEACHER_DIRECT_ROLES;
    audiences = ['CLASS','SECTION','ROLE','DIRECT','PARENT_OF_STUDENT'];
  } else if (user.role === 'TEACHER') {
    const teacher = await getTeacherForUser(user);
    if (!teacher) throw new CommunicationError('Teacher profile not found.', 403);
    const assignments = await prisma.teacherAssignment.findMany({ where: { schoolId: user.schoolId, teacherId: teacher.id, isActive: true, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now() } }] }, include: { class: { select: { id: true, className: true } }, section: { select: { id: true, sectionName: true, classId: true } }, subject: { select: { id: true, subjectName: true } } } });
    classes = uniqueById(assignments.map((row) => ({ id: row.class.id, name: row.class.className })));
    sections = uniqueById(assignments.map((row) => ({ id: row.section.id, classId: row.section.classId, name: `${row.class.className} · ${row.section.sectionName}` })));
    subjects = uniqueById(assignments.map((row) => ({ id: row.subject.id, name: row.subject.subjectName })));
    students = await prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true, OR: sections.length ? sections.map((section) => { const assignment = assignments.find((row) => row.section.id === section.id); return { className: assignment.class.className, section: assignment.section.sectionName }; }) : [{ id: '__none__' }] }, select: { id: true, studentFirstName: true, studentLastName: true, fatherName: true, studentUserId: true, parentUserId: true, className: true, section: true }, orderBy: [{ className: 'asc' }, { section: 'asc' }, { studentFirstName: 'asc' }] });
    staffRoles = TEACHER_DIRECT_ROLES;
    audiences = ['CLASS','SECTION','SUBJECT','ROLE','DIRECT','PARENT_OF_STUDENT'];
  } else {
    const structureAllowed = isAdmin || ['CURRICULUM_MANAGER','FEE_MANAGER'].includes(user.role);
    if (structureAllowed) {
      const [classRows, sectionRows, subjectRows, studentRows] = await Promise.all([
        prisma.class.findMany({ where: { schoolId: user.schoolId, deletedAt: null }, select: { id: true, className: true }, orderBy: { className: 'asc' } }),
        prisma.section.findMany({ where: { schoolId: user.schoolId, deletedAt: null }, include: { class: { select: { className: true } } }, orderBy: { sectionName: 'asc' } }),
        prisma.subject.findMany({ where: { schoolId: user.schoolId, deletedAt: null }, select: { id: true, subjectName: true }, orderBy: { subjectName: 'asc' } }),
        prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true }, select: { id: true, studentFirstName: true, studentLastName: true, fatherName: true, studentUserId: true, parentUserId: true, className: true, section: true }, orderBy: [{ className: 'asc' }, { section: 'asc' }, { studentFirstName: 'asc' }] }),
      ]);
      classes = classRows.map((row) => ({ id: row.id, name: row.className }));
      sections = sectionRows.map((row) => ({ id: row.id, classId: row.classId, name: `${row.class.className} · ${row.sectionName}` }));
      subjects = subjectRows.map((row) => ({ id: row.id, name: row.subjectName }));
      students = studentRows;
    }
    if (isAdmin) { audiences = ['SCHOOL_WIDE','STAFF','ROLE','CLASS','SECTION','SUBJECT','DIRECT','PARENT_OF_STUDENT']; staffRoles = [...STAFF_ROLES, 'STUDENT', 'PARENT']; }
    else if (user.role === 'CURRICULUM_MANAGER') { audiences = ['SCHOOL_WIDE','STAFF','ROLE','CLASS','SECTION','SUBJECT','DIRECT','PARENT_OF_STUDENT']; staffRoles = ['SCHOOL_OWNER','ADMIN','TEACHER','STUDENT','PARENT']; }
    else if (user.role === 'FEE_MANAGER') { audiences = ['ROLE','CLASS','SECTION','DIRECT','PARENT_OF_STUDENT']; staffRoles = ['PARENT']; subjects = []; }
  }

  const userRoleFilter = user.role === 'FEE_MANAGER' ? ['SCHOOL_OWNER','ADMIN'] : ['TEACHER', 'CLASS_TEACHER'].includes(user.role) ? TEACHER_DIRECT_ROLES : STAFF_ROLES;
  const userRows = await prisma.user.findMany({ where: { schoolId: user.schoolId, isActive: true, id: { not: user.id }, role: { in: userRoleFilter } }, select: { id: true, name: true, role: true }, orderBy: { name: 'asc' } });
  const people = [
    ...userRows.map((row) => ({ key: `user:${row.id}`, name: row.name, role: row.role, kind: 'STAFF' })),
    ...(user.role === 'FEE_MANAGER' ? [] : students.filter((row) => row.studentUserId).map((row) => ({ key: `student:${row.id}`, name: `${row.studentFirstName} ${row.studentLastName || ''}`.trim(), role: 'STUDENT', kind: 'STUDENT', className: row.className, section: row.section }))),
    ...students.filter((row) => row.parentUserId).map((row) => ({ key: `parent:${row.parentUserId}`, name: `${row.fatherName || 'Parent'} · parent of ${row.studentFirstName}`, role: 'PARENT', kind: 'PARENT', className: row.className, section: row.section })),
  ];
  return {
    audiences,
    roles: staffRoles,
    recipientGroups: user.role === 'FEE_MANAGER' ? ['PARENT'] : ['STUDENT','PARENT','BOTH'],
    classes,
    sections,
    subjects,
    students: students.map((row) => ({ id: row.id, name: `${row.studentFirstName} ${row.studentLastName || ''}`.trim(), parentName: row.fatherName || null, hasParent: Boolean(row.parentUserId), className: row.className, section: row.section })),
    people,
  };
};

const deliveryChannels = async (notification, recipient, policy, loadedPreference) => {
  const mandatory = notification.isMandatory || MANDATORY_CATEGORIES.has(notification.category) || notification.priority === 'EMERGENCY';
  const preference = loadedPreference === undefined ? await prisma.notificationPreference.findUnique({ where: { schoolId_recipientKey_category: { schoolId: notification.schoolId, recipientKey: recipient.recipientKey, category: notification.category } } }) : loadedPreference;
  const channels = mandatory || preference?.inAppEnabled !== false ? ['IN_APP'] : [];
  if (policy.emailDeliveryEnabled && (mandatory || preference?.emailEnabled !== false)) channels.push('EMAIL');
  if (policy.smsDeliveryEnabled && (mandatory || preference?.smsEnabled)) channels.push('SMS');
  if (policy.pushDeliveryEnabled && (mandatory || preference?.pushEnabled)) channels.push('PUSH');
  if (policy.whatsAppDeliveryEnabled && (mandatory || preference?.whatsAppEnabled)) channels.push('WHATSAPP');
  return channels;
};

export const publishNotification = async (user, notificationId, requestContext) => {
  const notification = await prisma.notification.findFirst({ where: { id: notificationId, schoolId: user.schoolId, deletedAt: null }, include: { audienceRules: true } });
  if (!notification) throw new CommunicationError('Notification not found.', 404);
  if (!['DRAFT','SCHEDULED'].includes(notification.status)) throw new CommunicationError('Only draft or scheduled communication can be published.', 409);
  if (notification.expiresAt && notification.expiresAt <= now()) throw new CommunicationError('Expired communication cannot be published.', 409);
  const rules = notification.audienceRules.map((rule) => ({ kind: rule.kind, role: rule.role, entityIds: rule.entityId ? [rule.entityId] : [], metadata: rule.metadata }));
  const recipients = await resolveAudience(user, notification.category, rules);
  if (!recipients.length) throw new CommunicationError('The selected audience has no active recipients.', 409);
  const [policy, preferences] = await Promise.all([
    prisma.communicationPolicy.upsert({ where: { schoolId: user.schoolId }, create: { schoolId: user.schoolId }, update: {} }),
    prisma.notificationPreference.findMany({ where: { schoolId: user.schoolId, category: notification.category, recipientKey: { in: recipients.map((recipient) => recipient.recipientKey) } } }),
  ]);
  const preferencesByKey = new Map(preferences.map((preference) => [preference.recipientKey, preference]));
  const recipientsWithChannels = await Promise.all(recipients.map(async (recipient) => ({ recipient, channels: await deliveryChannels(notification, recipient, policy, preferencesByKey.get(recipient.recipientKey) || null) })));
  const recipientRows = recipientsWithChannels.map(({ recipient, channels }) => ({ id: `notification_recipient_${randomUUID()}`, notificationId: notification.id, schoolId: notification.schoolId, ...recipient, isMuted: !channels.includes('IN_APP') }));
  const deliveries = recipientsWithChannels.flatMap(({ channels }, index) => channels.map((channel) => ({ id: `notification_delivery_${randomUUID()}`, notificationRecipientId: recipientRows[index].id, channel, provider: channel === 'IN_APP' ? 'database' : 'unconfigured', status: channel === 'IN_APP' ? 'DELIVERED' : 'QUEUED', attemptCount: channel === 'IN_APP' ? 1 : 0, sentAt: channel === 'IN_APP' ? now() : null, deliveredAt: channel === 'IN_APP' ? now() : null })));
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.notification.update({ where: { id: notification.id }, data: { status: 'PUBLISHED', publishedAt: now(), resolvedRecipientCount: recipients.length } });
    await tx.notificationRecipient.createMany({ data: recipientRows });
    if (deliveries.length) await tx.notificationDelivery.createMany({ data: deliveries });
    await tx.communicationAudit.create({ data: { schoolId: user.schoolId, actorKey: principalKey(user), action: 'NOTIFICATION_PUBLISHED', entityType: 'Notification', entityId: notification.id, current: { recipientCount: recipients.length }, ...auditContext(requestContext) } });
    return updated;
  }, { timeout: 30000 });
  for (const recipient of recipients) emitToRecipient(recipient.recipientKey, 'notification', { id: result.id, title: result.title, category: result.category, priority: result.priority });
  await processQueuedDeliveries({ notificationId: result.id });
  return result;
};

export const createAnnouncement = async (user, input, req) => {
  assertSchoolUser(user, user.schoolId); await assertCreatorScope(user, input.category, input.audienceRules);
  const scheduled = input.publishAt && input.publishAt > now();
  return prisma.$transaction(async (tx) => {
    const notification = await tx.notification.create({ data: { schoolId: user.schoolId, type: input.category === 'EMERGENCY' ? 'EMERGENCY_ALERT' : 'ANNOUNCEMENT', category: input.category, priority: input.priority, title: input.title, message: input.content, shortMessage: input.summary, actionUrl: input.actionUrl, sourceModule: 'COMMUNICATION', createdByUserId: user.id, createdByRole: user.role, status: scheduled ? 'SCHEDULED' : 'DRAFT', scheduledAt: scheduled ? input.publishAt : null, expiresAt: input.expiresAt, acknowledgementDeadline: input.acknowledgementDeadline, requiresAcknowledgement: input.requiresAcknowledgement, allowReply: input.allowReplies, isMandatory: input.category === 'EMERGENCY', audienceRules: { create: input.audienceRules.flatMap((rule) => rule.entityIds.length ? rule.entityIds.map((entityId) => ({ kind: rule.kind, role: rule.role, entityId, metadata: rule.metadata })) : [{ kind: rule.kind, role: rule.role, metadata: rule.metadata }]) } } });
    const announcement = await tx.announcement.create({ data: { schoolId: user.schoolId, notificationId: notification.id, title: input.title, content: input.content, summary: input.summary, category: input.category, priority: input.priority, status: scheduled ? 'SCHEDULED' : 'DRAFT', publishAt: input.publishAt, expiresAt: input.expiresAt, acknowledgementDeadline: input.acknowledgementDeadline, requiresAcknowledgement: input.requiresAcknowledgement, allowComments: input.allowComments, allowReplies: input.allowReplies, createdByUserId: user.id } });
    await tx.communicationAudit.create({ data: { schoolId: user.schoolId, actorKey: principalKey(user), action: 'ANNOUNCEMENT_CREATED', entityType: 'Announcement', entityId: announcement.id, current: { title: input.title, category: input.category }, ...auditContext(req) } });
    return announcement;
  });
};

export const listNotifications = async (user, query = {}) => {
  await syncLegacyNotifications(user);
  const key = principalKey(user); const page = Math.max(1, Number(query.page) || 1); const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const where = { recipientKey: key, schoolId: user.schoolId, archivedAt: null, isMuted: false, ...(query.read === 'false' ? { readAt: null } : query.read === 'true' ? { readAt: { not: null } } : {}), ...(query.acknowledged === 'false' ? { acknowledgedAt: null } : query.acknowledged === 'true' ? { acknowledgedAt: { not: null } } : {}), notification: { deletedAt: null, status: 'PUBLISHED', AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }] }, ...(query.search ? [{ OR: [{ title: { contains: String(query.search), mode: 'insensitive' } }, { message: { contains: String(query.search), mode: 'insensitive' } }] }] : [])], ...(query.category ? { category: String(query.category).toUpperCase() } : {}), ...(query.priority ? { priority: String(query.priority).toUpperCase() } : {}) } };
  const [items, total] = await Promise.all([prisma.notificationRecipient.findMany({ where, include: { notification: true, deliveries: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }), prisma.notificationRecipient.count({ where })]);
  return { items: items.map(({ notification, ...recipient }) => ({ ...notification, recipient, isRead: Boolean(recipient.readAt), body: notification.message, link: notification.actionUrl })), page, pageSize, total, pages: Math.ceil(total / pageSize) };
};

export const countUnreadNotifications = async (user) => {
  await syncLegacyNotifications(user);
  return prisma.notificationRecipient.count({ where: { schoolId: user.schoolId, recipientKey: principalKey(user), readAt: null, archivedAt: null, isMuted: false, notification: { status: 'PUBLISHED', deletedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }] } } });
};

export const getNotification = async (user, id, markSeen = true) => {
  const row = await prisma.notificationRecipient.findFirst({ where: { schoolId: user.schoolId, recipientKey: principalKey(user), OR: [{ id }, { notificationId: id }] }, include: { notification: { include: { attachments: true } }, deliveries: true } });
  if (!row) throw new CommunicationError('Notification not found.', 404);
  if (markSeen && !row.seenAt) await prisma.notificationRecipient.update({ where: { id: row.id }, data: { seenAt: now() } });
  return row;
};

export const updateRecipientState = async (user, id, action, note, req) => {
  const row = await getNotification(user, id, false); const data = {};
  if (action === 'read') data.readAt = now();
  if (action === 'archive') data.archivedAt = now();
  if (action === 'acknowledge') { if (!row.notification.requiresAcknowledgement) throw new CommunicationError('This notification does not require acknowledgement.', 409); data.acknowledgedAt = now(); data.acknowledgementNote = String(note || '').trim().slice(0, 1000) || null; }
  const updated = await prisma.notificationRecipient.update({ where: { id: row.id }, data });
  if (action === 'acknowledge') await prisma.communicationAudit.create({ data: { schoolId: user.schoolId, actorKey: principalKey(user), action: 'NOTIFICATION_ACKNOWLEDGED', entityType: 'Notification', entityId: row.notificationId, current: { note: data.acknowledgementNote }, ...auditContext(req) } });
  return updated;
};

export const markAllRead = async (user) => prisma.notificationRecipient.updateMany({ where: { schoolId: user.schoolId, recipientKey: principalKey(user), readAt: null, createdAt: { lte: now() } }, data: { readAt: now() } });

export const processQueuedDeliveries = async ({ notificationId, limit = 100 } = {}) => {
  const rows = await prisma.notificationDelivery.findMany({ where: { ...(notificationId ? { recipient: { notificationId } } : {}), status: { in: ['QUEUED','FAILED'] }, attemptCount: { lt: 5 }, OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now() } }] }, include: { recipient: { include: { notification: true } } }, take: limit, orderBy: { createdAt: 'asc' } });
  const schoolIds = [...new Set(rows.map((row) => row.recipient.schoolId))];
  const [policies, preferences] = await Promise.all([
    schoolIds.length ? prisma.communicationPolicy.findMany({ where: { schoolId: { in: schoolIds } } }) : [],
    rows.length ? prisma.notificationPreference.findMany({ where: { OR: rows.map((row) => ({ schoolId: row.recipient.schoolId, recipientKey: row.recipient.recipientKey, category: row.recipient.notification.category })) } }) : [],
  ]);
  const policyBySchool = new Map(policies.map((row) => [row.schoolId, row]));
  const preferenceByScope = new Map(preferences.map((row) => [`${row.schoolId}:${row.recipientKey}:${row.category}`, row]));
  for (const row of rows) {
    if (row.recipient.notification.expiresAt && row.recipient.notification.expiresAt <= now()) { await prisma.notificationDelivery.update({ where: { id: row.id }, data: { status: 'CANCELLED', failureReason: 'Notification expired before delivery.' } }); continue; }
    const policy = policyBySchool.get(row.recipient.schoolId);
    const preference = preferenceByScope.get(`${row.recipient.schoolId}:${row.recipient.recipientKey}:${row.recipient.notification.category}`);
    const mandatory = row.recipient.notification.isMandatory || MANDATORY_CATEGORIES.has(row.recipient.notification.category) || row.recipient.notification.priority === 'EMERGENCY';
    const quietStart = preference?.quietHoursStart || policy?.quietHoursStart; const quietEnd = preference?.quietHoursEnd || policy?.quietHoursEnd;
    if (!mandatory && row.channel !== 'IN_APP' && quietStart && quietEnd) { const parts = new Intl.DateTimeFormat('en-GB',{timeZone:preference?.timezone||'UTC',hour:'2-digit',minute:'2-digit',hour12:false}).format(now()).split(':').map(Number); const current=parts[0]*60+parts[1], start=Number(quietStart.slice(0,2))*60+Number(quietStart.slice(3,5)), end=Number(quietEnd.slice(0,2))*60+Number(quietEnd.slice(3,5)); const quiet=start<=end?current>=start&&current<end:current>=start||current<end; if(quiet){await prisma.notificationDelivery.update({where:{id:row.id},data:{nextRetryAt:new Date(Date.now()+15*60000)}});continue;} }
    const result = await sendDelivery(row.channel, { notification: row.recipient.notification, recipient: row.recipient, emit: () => emitToRecipient(row.recipient.recipientKey, 'notification', { id: row.recipient.notificationId, title: row.recipient.notification.title }) });
    const attemptCount = row.attemptCount + 1; await prisma.notificationDelivery.update({ where: { id: row.id }, data: { status: result.status, provider: result.provider, providerMessageId: result.providerMessageId, failureReason: result.failureReason, attemptCount, sentAt: ['SENT','DELIVERED'].includes(result.status) ? now() : row.sentAt, deliveredAt: result.status === 'DELIVERED' ? now() : row.deliveredAt, failedAt: result.status === 'FAILED' ? now() : null, nextRetryAt: result.status === 'FAILED' && attemptCount < 5 ? new Date(Date.now() + Math.min(60, 2 ** attemptCount) * 60000) : null } });
  }
  return { processed: rows.length };
};

export const processScheduled = async () => {
  const due = await prisma.notification.findMany({ where: { status: 'SCHEDULED', scheduledAt: { lte: now() }, OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }] }, take: 100 });
  const creatorIds = [...new Set(due.map((row) => row.createdByUserId).filter(Boolean))];
  const creators = creatorIds.length ? await prisma.user.findMany({ where: { id: { in: creatorIds }, isActive: true } }) : [];
  const creatorByScope = new Map(creators.map((row) => [`${row.schoolId}:${row.id}`, row]));
  let published = 0;
  for (const row of due) {
    const creator = creatorByScope.get(`${row.schoolId}:${row.createdByUserId}`);
    if (!creator) { await prisma.notification.update({ where: { id: row.id }, data: { status: 'CANCELLED' } }); continue; }
    try { await publishNotification(creator, row.id); await prisma.announcement.updateMany({ where: { notificationId: row.id }, data: { status: 'PUBLISHED' } }); published += 1; } catch (error) { await prisma.communicationAudit.create({ data: { schoolId: row.schoolId, action: 'SCHEDULED_PUBLISH_FAILED', entityType: 'Notification', entityId: row.id, current: { error: String(error.message).slice(0, 500) } } }); }
  }
  await prisma.notification.updateMany({ where: { status: 'PUBLISHED', expiresAt: { lte: now() } }, data: { status: 'EXPIRED' } });
  return { due: due.length, published };
};

export const renderTemplate = async (user, code, channel, variables) => {
  const template = await prisma.notificationTemplate.findFirst({ where: { code, channel, isActive: true, OR: [{ schoolId: user.schoolId }, { schoolId: null }] }, orderBy: { schoolId: 'desc' } });
  if (!template) throw new CommunicationError('Template not found.', 404); return validateTemplateVariables(template, variables);
};

export const createSystemNotification = async ({ schoolId, type, category, priority = 'NORMAL', title, message, actionUrl = null, sourceModule, sourceEntityType, sourceEntityId, dedupeKey, students = [], userIds = [], roles = ['STUDENT','PARENT'], mandatory = false }) => {
  if (!schoolId || !dedupeKey) throw new CommunicationError('System notification requires schoolId and dedupeKey.');
  const existing = await prisma.notification.findFirst({ where: { schoolId, dedupeKey } }); if (existing) return existing;
  const [studentRows,userRows] = await Promise.all([students.length ? prisma.student.findMany({ where: { schoolId, id: { in: students }, isActive: true } }) : [], userIds.length ? prisma.user.findMany({ where: { schoolId, id: { in: userIds }, isActive: true } }) : []]);
  const recipients = [...studentRows.flatMap((row) => studentRecipients(row, roles, 'AUTOMATED_RULE')), ...userRows.map((row) => userRecipient(row, 'AUTOMATED_RULE'))];
  if (!recipients.length) return null;
  const policy = await prisma.communicationPolicy.upsert({ where: { schoolId }, create: { schoolId }, update: {} });
  const notification = await prisma.$transaction(async (tx) => {
    const created = await tx.notification.create({ data: { schoolId, type, category, priority, title, message, actionUrl, sourceModule, sourceEntityType, sourceEntityId, dedupeKey, status: 'PUBLISHED', publishedAt: now(), isSystemGenerated: true, isMandatory: mandatory, resolvedRecipientCount: recipients.length, audienceRules: { create: { kind: 'AUTOMATED_RULE', entityId: sourceEntityId, metadata: { dedupeKey } } } } });
    for (const recipient of [...new Map(recipients.map((row) => [row.recipientKey,row])).values()]) {
      const channels = await deliveryChannels(created, recipient, policy); const record = await tx.notificationRecipient.create({ data: { notificationId: created.id, schoolId, ...recipient, isMuted: !channels.includes('IN_APP') } });
      await tx.notificationDelivery.createMany({ data: channels.map((channel) => ({ notificationRecipientId: record.id, channel, provider: channel === 'IN_APP' ? 'database' : channel === 'WEB_SOCKET' ? 'sse' : 'unconfigured', status: channel === 'IN_APP' ? 'DELIVERED' : 'QUEUED', attemptCount: channel === 'IN_APP' ? 1 : 0, sentAt: channel === 'IN_APP' ? now() : null, deliveredAt: channel === 'IN_APP' ? now() : null })) });
    }
    return created;
  });
  recipients.forEach((recipient) => emitToRecipient(recipient.recipientKey, 'notification', { id: notification.id, title: notification.title, category }));
  await processQueuedDeliveries({ notificationId: notification.id }); return notification;
};
