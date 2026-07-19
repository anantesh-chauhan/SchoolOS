import prisma from '../../config/prisma.client.js';
import { randomUUID } from 'node:crypto';
import { getTeacherForUser } from '../../utils/teacherAuthorization.util.js';
import { CommunicationError } from './communication.validation.js';
import { emitToRecipient } from './realtime.service.js';
import { principalKey } from './communication.service.js';

const ADMINS = new Set(['SCHOOL_OWNER','ADMIN']);
const now = () => new Date();

const messageCategory = (type) => type === 'FEE_SUPPORT' ? 'FEE' : type === 'ACADEMIC_SUPPORT' ? 'ACADEMIC' : 'GENERAL';
const notificationRecipient = (participant, conversationId, messageId) => ({
  id: `notification_recipient_${randomUUID()}`,
  recipientKey: participant.participantKey,
  userId: participant.userId || null,
  studentId: participant.studentId || null,
  parentId: participant.role === 'PARENT' ? participant.participantKey.slice('parent:'.length) : null,
  recipientRole: participant.role,
  deliveryContext: 'DIRECT',
  context: { conversationId, messageId },
});

const createMessageAlert = async (tx, user, conversation, message, participants) => {
  const alertRecipients = participants.filter((participant) => !participant.mutedUntil || participant.mutedUntil <= now());
  if (!alertRecipients.length) return [];
  const recipients = alertRecipients.map((participant) => notificationRecipient(participant, conversation.id, message.id));
  const notification = await tx.notification.create({
    data: {
      schoolId: user.schoolId,
      type: 'NEW_MESSAGE',
      category: messageCategory(conversation.type),
      priority: 'NORMAL',
      title: `New message from ${user.name || user.role.replaceAll('_', ' ')}`,
      message: message.content,
      shortMessage: message.content.slice(0, 240),
      actionUrl: `/communication?tab=inbox&conversation=${conversation.id}`,
      actionLabel: 'Open conversation',
      sourceModule: 'COMMUNICATION',
      sourceEntityType: 'Message',
      sourceEntityId: message.id,
      createdByUserId: ['PARENT','STUDENT'].includes(user.role) ? null : user.id,
      createdByRole: user.role,
      status: 'PUBLISHED',
      publishedAt: now(),
      isSystemGenerated: true,
      resolvedRecipientCount: recipients.length,
      dedupeKey: `MESSAGE:${message.id}`,
    },
  });
  await tx.notificationRecipient.createMany({ data: recipients.map((recipient) => ({ ...recipient, notificationId: notification.id, schoolId: user.schoolId })) });
  await tx.notificationDelivery.createMany({ data: recipients.map((recipient) => ({ notificationRecipientId: recipient.id, channel: 'IN_APP', provider: 'database-conversation', status: 'DELIVERED', attemptCount: 1, sentAt: now(), deliveredAt: now() })) });
  return recipients.map((recipient) => recipient.recipientKey);
};

const identityForKey = async (schoolId, key) => {
  if (key.startsWith('user:')) { const row = await prisma.user.findFirst({ where: { id: key.slice(5), schoolId, isActive: true } }); return row ? { participantKey: key, userId: row.id, studentId: null, role: row.role } : null; }
  if (key.startsWith('student:')) { const row = await prisma.student.findFirst({ where: { id: key.slice(8), schoolId, isActive: true } }); return row?.studentUserId ? { participantKey: key, userId: null, studentId: row.id, role: 'STUDENT' } : null; }
  if (key.startsWith('parent:')) { const value = key.slice(7); const row = await prisma.student.findFirst({ where: { schoolId, isActive: true, OR: [{ id: value }, { parentUserId: value }] } }); return row?.parentUserId ? { participantKey: `parent:${row.parentUserId}`, userId: null, studentId: row.id, role: 'PARENT' } : null; }
  return null;
};

const assignedSectionPairs = async (user) => {
  const teacher = await getTeacherForUser(user); if (!teacher) return [];
  const assignments = await prisma.teacherAssignment.findMany({ where: { schoolId: user.schoolId, teacherId: teacher.id, isActive: true, OR: [{ effectiveTo: null }, { effectiveTo: { gte: now() } }] }, include: { section: { include: { class: true } } } });
  return assignments.map((row) => ({ className: row.section.class.className, section: row.section.sectionName }));
};

const assertConversationTargets = async (user, input, identities) => {
  const policy = await prisma.communicationPolicy.upsert({ where: { schoolId: user.schoolId }, create: { schoolId: user.schoolId }, update: {} });
  if (!policy.directMessagingEnabled) throw new CommunicationError('Direct messaging is disabled by school policy.', 403);
  if (input.participantKeys.length > 20 || (input.type === 'GROUP' && !policy.groupCreationEnabled && !ADMINS.has(user.role))) throw new CommunicationError('You cannot create this group.', 403);
  if (ADMINS.has(user.role)) return;
  if (user.role === 'TEACHER') {
    const pairs = await assignedSectionPairs(user); const students = await prisma.student.findMany({ where: { schoolId: user.schoolId, isActive: true, OR: pairs.length ? pairs : [{ id: '__none__' }] }, select: { id: true, parentUserId: true } });
    const allowedKeys = new Set(students.flatMap((row) => [`student:${row.id}`, row.parentUserId ? `parent:${row.parentUserId}` : null]).filter(Boolean));
    for (const identity of identities) if (['STUDENT','PARENT'].includes(identity.role) && !allowedKeys.has(identity.participantKey)) throw new CommunicationError('Teacher cannot contact an unrelated student or parent.', 403);
    return;
  }
  if (['PARENT','STUDENT'].includes(user.role)) {
    const student = await prisma.student.findFirst({ where: { id: user.studentId, schoolId: user.schoolId, isActive: true } });
    if (!student) throw new CommunicationError('Linked student not found.', 403);
    const section = await prisma.section.findFirst({ where: { schoolId: user.schoolId, sectionName: student.section, class: { className: student.className } } });
    const teacherIds = section ? (await prisma.teacherAssignment.findMany({ where: { schoolId: user.schoolId, sectionId: section.id, isActive: true }, select: { teacherId: true } })).map((row) => row.teacherId) : [];
    const teachers = await prisma.teacher.findMany({ where: { id: { in: teacherIds } }, select: { email: true, employeeId: true } });
    const staff = await prisma.user.findMany({ where: { schoolId: user.schoolId, isActive: true, OR: [{ role: { in: input.type === 'FEE_SUPPORT' ? ['FEE_MANAGER','ADMIN','SCHOOL_OWNER'] : ['ADMIN','SCHOOL_OWNER'] } }, { role: 'TEACHER', OR: [{ email: { in: teachers.map((row) => row.email) } }, { contactEmail: { in: teachers.map((row) => row.email) } }, { employeeId: { in: teachers.map((row) => row.employeeId) } }] }] }, select: { id: true } });
    const allowed = new Set(staff.map((row) => `user:${row.id}`));
    if (identities.some((identity) => !allowed.has(identity.participantKey))) throw new CommunicationError('You may only contact staff assigned to your linked child or the selected support team.', 403);
    if (user.role === 'PARENT' && !policy.parentToTeacherEnabled && input.type === 'PARENT_TEACHER') throw new CommunicationError('Parent-to-teacher messaging is disabled.', 403);
    if (user.role === 'STUDENT' && !policy.studentToTeacherEnabled && input.type === 'STUDENT_TEACHER') throw new CommunicationError('Student-to-teacher messaging is disabled.', 403);
    return;
  }
  if (user.role === 'FEE_MANAGER') { if (input.type !== 'FEE_SUPPORT' || identities.some((identity) => !['PARENT','STUDENT','ADMIN','SCHOOL_OWNER'].includes(identity.role))) throw new CommunicationError('Fee Managers can only start fee-support conversations with authorized families or administrators.', 403); return; }
  if (user.role === 'CURRICULUM_MANAGER') { if (!['ACADEMIC_SUPPORT','DIRECT'].includes(input.type) || identities.some((identity) => !['TEACHER','ADMIN','SCHOOL_OWNER'].includes(identity.role))) throw new CommunicationError('Curriculum Managers can only contact academic staff.', 403); return; }
  if (user.role === 'STAFF') { if (identities.some((identity) => !['ADMIN','SCHOOL_OWNER'].includes(identity.role))) throw new CommunicationError('Staff may only contact school administration.', 403); return; }
  throw new CommunicationError('Your role cannot start conversations.', 403);
};

export const createConversation = async (user, input) => {
  const selfKey = principalKey(user); const uniqueKeys = [...new Set(input.participantKeys.filter((key) => key !== selfKey))];
  if (!uniqueKeys.length) throw new CommunicationError('At least one other participant is required.');
  const identities = await Promise.all(uniqueKeys.map((key) => identityForKey(user.schoolId, key)));
  if (identities.some((value) => !value)) throw new CommunicationError('A participant is invalid or belongs to another school.');
  await assertConversationTargets(user, input, identities);
  const self = { participantKey: selfKey, userId: ['PARENT','STUDENT'].includes(user.role) ? null : user.id, studentId: user.studentId || null, role: user.role, canManage: true };
  const result = await prisma.$transaction(async (tx) => {
    const conversation = await tx.conversation.create({ data: { schoolId: user.schoolId, type: input.type, subject: input.subject, classId: input.classId, sectionId: input.sectionId, studentId: input.studentId || user.studentId || null, createdByKey: selfKey, participants: { create: [self, ...identities] } } });
    const message = await tx.message.create({ data: { conversationId: conversation.id, schoolId: user.schoolId, senderKey: selfKey, senderUserId: self.userId, senderRole: user.role, content: input.message } });
    const notifiedKeys = await createMessageAlert(tx, user, conversation, message, identities);
    await tx.communicationAudit.create({ data: { schoolId: user.schoolId, actorKey: selfKey, action: 'CONVERSATION_CREATED', entityType: 'Conversation', entityId: conversation.id, current: { type: input.type } } });
    return { conversation, message, notifiedKeys };
  });
  result.notifiedKeys.forEach((recipientKey) => emitToRecipient(recipientKey, 'message', { conversationId: result.conversation.id, messageId: result.message.id, notification: true }));
  return result.conversation;
};

const membership = async (user, conversationId) => {
  const participant = await prisma.conversationParticipant.findFirst({ where: { conversationId, participantKey: principalKey(user), leftAt: null }, include: { conversation: true } });
  if (!participant || participant.conversation.schoolId !== user.schoolId) throw new CommunicationError('Conversation not found.', 404); return participant;
};

export const listConversations = async (user, query = {}) => {
  const page = Math.max(1, Number(query.page) || 1); const pageSize = Math.min(50, Math.max(1, Number(query.pageSize) || 20));
  const where = { schoolId: user.schoolId, participants: { some: { participantKey: principalKey(user), leftAt: null } }, ...(query.status ? { status: String(query.status).toUpperCase() } : {}) };
  const [items, total] = await Promise.all([prisma.conversation.findMany({ where, include: { participants: true, messages: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' }, take: 1 } }, orderBy: { lastMessageAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize }), prisma.conversation.count({ where })]);
  return { items, total, page, pageSize, pages: Math.ceil(total / pageSize) };
};

export const getConversation = async (user, id, query = {}) => {
  await membership(user, id); const take = Math.min(100, Math.max(1, Number(query.pageSize) || 50));
  return prisma.conversation.findUnique({ where: { id }, include: { participants: true, messages: { orderBy: { createdAt: 'desc' }, take, include: { attachments: true, replyTo: { select: { id: true, content: true, deletedAt: true } } } } } });
};

export const sendMessage = async (user, conversationId, input) => {
  const member = await membership(user, conversationId); if (!member.canReply) throw new CommunicationError('You cannot reply to this conversation.', 403); if (member.conversation.status !== 'OPEN') throw new CommunicationError('This conversation is closed.', 409);
  if (input.replyToMessageId) { const reply = await prisma.message.findFirst({ where: { id: input.replyToMessageId, conversationId } }); if (!reply) throw new CommunicationError('Reply target is invalid.'); }
  const participants = await prisma.conversationParticipant.findMany({ where: { conversationId, leftAt: null, participantKey: { not: principalKey(user) } } });
  const result = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({ data: { conversationId, schoolId: user.schoolId, senderKey: principalKey(user), senderUserId: ['PARENT','STUDENT'].includes(user.role) ? null : user.id, senderRole: user.role, messageType: input.messageType, content: input.content, replyToMessageId: input.replyToMessageId } });
    const conversation = await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now() } });
    const notifiedKeys = await createMessageAlert(tx, user, conversation, message, participants);
    return { message, notifiedKeys };
  });
  result.notifiedKeys.forEach((recipientKey) => emitToRecipient(recipientKey, 'message', { conversationId, messageId: result.message.id, notification: true }));
  return result.message;
};

export const markConversationRead = async (user, id) => {
  const member = await membership(user, id);
  return prisma.$transaction(async (tx) => {
    const participant = await tx.conversationParticipant.update({ where: { id: member.id }, data: { lastReadAt: now() } });
    await tx.notificationRecipient.updateMany({
      where: {
        schoolId: user.schoolId,
        recipientKey: principalKey(user),
        readAt: null,
        notification: { sourceModule: 'COMMUNICATION', sourceEntityType: 'Message', actionUrl: `/communication?tab=inbox&conversation=${id}` },
      },
      data: { readAt: now(), seenAt: now() },
    });
    return participant;
  });
};
export const setConversationStatus = async (user, id, status) => { const member = await membership(user, id); if (!member.canManage) throw new CommunicationError('Only a conversation manager can change its status.', 403); return prisma.conversation.update({ where: { id }, data: { status, closedAt: status === 'CLOSED' ? now() : null } }); };

export const editMessage = async (user, id, content) => {
  const message = await prisma.message.findFirst({ where: { id, schoolId: user.schoolId, senderKey: principalKey(user), deletedAt: null } }); if (!message) throw new CommunicationError('Message not found.', 404);
  const policy = await prisma.communicationPolicy.upsert({ where: { schoolId: user.schoolId }, create: { schoolId: user.schoolId }, update: {} }); if (Date.now() - message.createdAt.getTime() > policy.messageEditingWindowMinutes * 60000) throw new CommunicationError('The message editing window has closed.', 409);
  return prisma.message.update({ where: { id }, data: { content: String(content || '').trim().slice(0, 5000), editedAt: now() } });
};

export const deleteMessage = async (user, id) => {
  const message = await prisma.message.findFirst({ where: { id, schoolId: user.schoolId, senderKey: principalKey(user), deletedAt: null } }); if (!message) throw new CommunicationError('Message not found.', 404);
  const policy = await prisma.communicationPolicy.upsert({ where: { schoolId: user.schoolId }, create: { schoolId: user.schoolId }, update: {} }); if (Date.now() - message.createdAt.getTime() > policy.messageDeletionWindowMinutes * 60000) throw new CommunicationError('The message deletion window has closed.', 409);
  return prisma.message.update({ where: { id }, data: { deletedAt: now(), content: '[Message deleted]' } });
};
