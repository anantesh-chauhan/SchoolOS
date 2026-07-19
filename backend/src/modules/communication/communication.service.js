import prisma from '../../config/prisma.client.js';
import { getTeacherForUser } from '../../utils/teacherAuthorization.util.js';
import { CommunicationError, validateTemplateVariables } from './communication.validation.js';
import { emitToRecipient } from './realtime.service.js';
import { sendDelivery } from './delivery.providers.js';

const ADMIN_ROLES = new Set(['SCHOOL_OWNER', 'ADMIN']);
const MANDATORY_CATEGORIES = new Set(['EMERGENCY', 'SECURITY', 'LEGAL']);
const MASS_ROLES = new Set(['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','FEE_MANAGER','TEACHER']);
const STAFF_ROLES = ['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','FEE_MANAGER','TEACHER','STAFF'];

export const principalKey = (user) => user.role === 'STUDENT' ? `student:${user.studentId}` : user.role === 'PARENT' ? `parent:${user.email}` : `user:${user.id}`;
const auditContext = (req) => ({ ipAddress: req?.ip || null, userAgent: req?.get?.('user-agent')?.slice(0, 500) || null });
const now = () => new Date();

const userRecipient = (row, context = 'DIRECT') => ({ recipientKey: `user:${row.id}`, userId: row.id, studentId: null, parentId: null, recipientRole: row.role, deliveryContext: context, context: null });
const studentRecipients = (student, roles = ['STUDENT','PARENT'], context = 'SECTION') => [
  ...(roles.includes('STUDENT') && student.studentUserId ? [{ recipientKey: `student:${student.id}`, userId: null, studentId: student.id, parentId: null, recipientRole: 'STUDENT', deliveryContext: context, context: { studentId: student.id, studentName: `${student.studentFirstName} ${student.studentLastName || ''}`.trim() } }] : []),
  ...(roles.includes('PARENT') && student.parentUserId ? [{ recipientKey: `parent:${student.parentUserId}`, userId: null, studentId: student.id, parentId: student.parentUserId, recipientRole: 'PARENT', deliveryContext: context === 'DIRECT' ? 'DIRECT' : 'PARENT_OF_STUDENT', context: { studentId: student.id, studentName: `${student.studentFirstName} ${student.studentLastName || ''}`.trim() } }] : []),
];

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
  if (user.role === 'FEE_MANAGER' && category !== 'FEE') throw new CommunicationError('Fee Managers can only send fee communication.', 403);
  if (user.role !== 'TEACHER') return;
  if (!['ACADEMIC','HOMEWORK','RESOURCE','ATTENDANCE','GENERAL'].includes(category)) throw new CommunicationError('Teachers can only send communication within their academic scope.', 403);
  if (rules.some((rule) => ['SCHOOL_WIDE','STAFF','ROLE','CLASS','SAVED_GROUP','AUTOMATED_RULE'].includes(rule.kind))) throw new CommunicationError('Teachers cannot use school-wide or unrestricted audiences.', 403);
  const teacher = await getTeacherForUser(user);
  if (!teacher) throw new CommunicationError('Teacher profile not found.', 403);
  const assignments = await prisma.teacherAssignment.findMany({ where: { schoolId: user.schoolId, teacherId: teacher.id, isActive: true, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now() } }] }, select: { sectionId: true, subjectId: true } });
  const sectionIds = new Set(assignments.map((row) => row.sectionId)); const subjectIds = new Set(assignments.map((row) => row.subjectId));
  for (const rule of rules) {
    if (rule.kind === 'SECTION' && rule.entityIds.some((id) => !sectionIds.has(id))) throw new CommunicationError('Teacher audience contains an unassigned section.', 403);
    if (rule.kind === 'SUBJECT' && rule.entityIds.some((id) => !subjectIds.has(id))) throw new CommunicationError('Teacher audience contains an unassigned subject.', 403);
    if (['DIRECT','PARENT_OF_STUDENT'].includes(rule.kind)) {
      const identifiers = rule.entityIds.map((key) => key.replace(/^(student:|parent:)/, ''));
      const students = await prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true, OR: [{ id: { in: identifiers } }, { parentUserId: { in: identifiers } }] }, select: { id: true, parentUserId: true, className: true, section: true } });
      const sections = await prisma.section.findMany({ where: { schoolId: user.schoolId, id: { in: [...sectionIds] } }, include: { class: true } });
      const allowed = new Set(sections.flatMap((section) => students.filter((student) => student.className === section.class.className && student.section === section.sectionName).map((student) => student.id)));
      if (students.length !== new Set(identifiers).size || students.some((student) => !allowed.has(student.id))) throw new CommunicationError('Teacher audience contains an unrelated student.', 403);
    }
  }
};

const resolveDirect = async (schoolId, values, context) => {
  const results = [];
  for (const value of values) {
    if (value.startsWith('user:') || !value.includes(':')) {
      const id = value.replace(/^user:/, ''); const row = await prisma.user.findFirst({ where: { id, schoolId, isActive: true } });
      if (row) results.push(userRecipient(row, context));
    } else if (value.startsWith('student:')) {
      const row = await prisma.student.findFirst({ where: { id: value.slice(8), schoolId, isActive: true } }); if (row) results.push(...studentRecipients(row, ['STUDENT'], context));
    } else if (value.startsWith('parent:')) {
      const identifier = value.slice(7); const row = await prisma.student.findFirst({ where: { schoolId, isActive: true, OR: [{ id: identifier }, { parentUserId: identifier }] } }); if (row) results.push(...studentRecipients(row, ['PARENT'], context));
    }
  }
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
      const assignments = await prisma.teacherAssignment.findMany({ where: { schoolId: user.schoolId, subjectId: { in: rule.entityIds }, isActive: true }, include: { teacher: true, section: { include: { class: true } } } });
      const teacherEmails = assignments.map((row) => row.teacher.email); const users = await prisma.user.findMany({ where: { schoolId: user.schoolId, role: 'TEACHER', isActive: true, OR: [{ email: { in: teacherEmails } }, { contactEmail: { in: teacherEmails } }] } }); recipients.push(...users.map((row) => userRecipient(row, 'SUBJECT')));
      if (rule.metadata?.includeStudents) { const students = await prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true, OR: assignments.map((row) => ({ className: row.section.class.className, section: row.section.sectionName })) } }); students.forEach((row) => recipients.push(...studentRecipients(row, rule.metadata?.roles || ['STUDENT','PARENT'], 'SUBJECT'))); }
    }
  }
  const deduped = [...new Map(recipients.map((row) => [row.recipientKey, row])).values()];
  const policy = await prisma.communicationPolicy.upsert({ where: { schoolId: user.schoolId }, create: { schoolId: user.schoolId }, update: {} });
  if (deduped.length > policy.maximumRecipientsPerMessage) throw new CommunicationError(`Audience exceeds the ${policy.maximumRecipientsPerMessage} recipient limit.`, 413, 'RECIPIENT_LIMIT');
  return deduped;
};

const deliveryChannels = async (notification, recipient, policy) => {
  const mandatory = notification.isMandatory || MANDATORY_CATEGORIES.has(notification.category) || notification.priority === 'EMERGENCY';
  const preference = await prisma.notificationPreference.findUnique({ where: { schoolId_recipientKey_category: { schoolId: notification.schoolId, recipientKey: recipient.recipientKey, category: notification.category } } });
  const channels = mandatory || preference?.inAppEnabled !== false ? ['IN_APP'] : [];
  if (policy.emailDeliveryEnabled && (mandatory || preference?.emailEnabled !== false)) channels.push('EMAIL');
  if (policy.smsDeliveryEnabled && (mandatory || preference?.smsEnabled)) channels.push('SMS');
  if (policy.pushDeliveryEnabled && (mandatory || preference?.pushEnabled)) channels.push('PUSH');
  if (policy.whatsAppDeliveryEnabled && (mandatory || preference?.whatsAppEnabled)) channels.push('WHATSAPP');
  if (channels.includes('IN_APP')) channels.push('WEB_SOCKET'); return channels;
};

export const publishNotification = async (user, notificationId, requestContext) => {
  const notification = await prisma.notification.findFirst({ where: { id: notificationId, schoolId: user.schoolId, deletedAt: null }, include: { audienceRules: true } });
  if (!notification) throw new CommunicationError('Notification not found.', 404);
  if (!['DRAFT','SCHEDULED'].includes(notification.status)) throw new CommunicationError('Only draft or scheduled communication can be published.', 409);
  if (notification.expiresAt && notification.expiresAt <= now()) throw new CommunicationError('Expired communication cannot be published.', 409);
  const rules = notification.audienceRules.map((rule) => ({ kind: rule.kind, role: rule.role, entityIds: rule.entityId ? [rule.entityId] : [], metadata: rule.metadata }));
  const recipients = await resolveAudience(user, notification.category, rules);
  if (!recipients.length) throw new CommunicationError('The selected audience has no active recipients.', 409);
  const policy = await prisma.communicationPolicy.upsert({ where: { schoolId: user.schoolId }, create: { schoolId: user.schoolId }, update: {} });
  const result = await prisma.$transaction(async (tx) => {
    const updated = await tx.notification.update({ where: { id: notification.id }, data: { status: 'PUBLISHED', publishedAt: now(), resolvedRecipientCount: recipients.length } });
    for (const recipient of recipients) {
      const channels = await deliveryChannels(notification, recipient, policy);
      const row = await tx.notificationRecipient.create({ data: { notificationId: notification.id, schoolId: notification.schoolId, ...recipient, isMuted: !channels.includes('IN_APP') } });
      await tx.notificationDelivery.createMany({ data: channels.map((channel) => ({ notificationRecipientId: row.id, channel, provider: channel === 'IN_APP' ? 'database' : channel === 'WEB_SOCKET' ? 'sse' : 'unconfigured', status: channel === 'IN_APP' ? 'DELIVERED' : 'QUEUED', attemptCount: channel === 'IN_APP' ? 1 : 0, sentAt: channel === 'IN_APP' ? now() : null, deliveredAt: channel === 'IN_APP' ? now() : null })) });
    }
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
  const key = principalKey(user); const page = Math.max(1, Number(query.page) || 1); const pageSize = Math.min(100, Math.max(1, Number(query.pageSize) || 20));
  const where = { recipientKey: key, schoolId: user.schoolId, archivedAt: null, isMuted: false, ...(query.read === 'false' ? { readAt: null } : query.read === 'true' ? { readAt: { not: null } } : {}), ...(query.acknowledged === 'false' ? { acknowledgedAt: null } : query.acknowledged === 'true' ? { acknowledgedAt: { not: null } } : {}), notification: { deletedAt: null, status: 'PUBLISHED', AND: [{ OR: [{ expiresAt: null }, { expiresAt: { gt: now() } }] }, ...(query.search ? [{ OR: [{ title: { contains: String(query.search), mode: 'insensitive' } }, { message: { contains: String(query.search), mode: 'insensitive' } }] }] : [])], ...(query.category ? { category: String(query.category).toUpperCase() } : {}), ...(query.priority ? { priority: String(query.priority).toUpperCase() } : {}) } };
  const [items, total] = await Promise.all([prisma.notificationRecipient.findMany({ where, include: { notification: true, deliveries: true }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }), prisma.notificationRecipient.count({ where })]);
  return { items: items.map(({ notification, ...recipient }) => ({ ...notification, recipient, isRead: Boolean(recipient.readAt), body: notification.message, link: notification.actionUrl })), page, pageSize, total, pages: Math.ceil(total / pageSize) };
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
  for (const row of rows) {
    if (row.recipient.notification.expiresAt && row.recipient.notification.expiresAt <= now()) { await prisma.notificationDelivery.update({ where: { id: row.id }, data: { status: 'CANCELLED', failureReason: 'Notification expired before delivery.' } }); continue; }
    const [policy, preference] = await Promise.all([prisma.communicationPolicy.findUnique({ where: { schoolId: row.recipient.schoolId } }), prisma.notificationPreference.findUnique({ where: { schoolId_recipientKey_category: { schoolId: row.recipient.schoolId, recipientKey: row.recipient.recipientKey, category: row.recipient.notification.category } } })]);
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
  let published = 0;
  for (const row of due) {
    const creator = await prisma.user.findFirst({ where: { id: row.createdByUserId, schoolId: row.schoolId, isActive: true } });
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
