import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

if (process.env.DATABASE_URL?.includes('sslmode=require')) {
  process.env.DATABASE_URL = process.env.DATABASE_URL.replace('sslmode=require', 'sslmode=no-verify');
}

const client = new pg.Client({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 20000,
  query_timeout: 30000,
});

const id = (prefix) => `${prefix}_${randomUUID()}`;
const ago = (hours) => new Date(Date.now() - hours * 60 * 60 * 1000);
const ALL_ROLES = ['SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER', 'FEE_MANAGER', 'TEACHER', 'STAFF', 'STUDENT', 'PARENT'];

const notificationDefinitions = [
  { code: 'SESSION_WELCOME', category: 'GENERAL', priority: 'NORMAL', title: 'Welcome to the SchoolOS communication center', message: 'School announcements, academic updates and important alerts will now appear here and in the navbar notification menu.', actionUrl: '/communication', roles: ALL_ROLES, hoursAgo: 72, announcement: true },
  { code: 'CALENDAR_UPDATED', category: 'ACADEMIC', priority: 'NORMAL', title: 'Academic calendar updated', message: 'The 2026–27 academic calendar now includes examinations, holidays, activities and parent meetings.', actionUrl: '/dashboard/calendar', roles: ALL_ROLES, hoursAgo: 48 },
  { code: 'HOMEWORK_REMINDER', category: 'HOMEWORK', priority: 'NORMAL', title: 'Homework and learning resources available', message: 'Please review the latest assignments and learning resources shared for this week.', actionUrl: '/homework', roles: ['TEACHER', 'CURRICULUM_MANAGER', 'STUDENT', 'PARENT'], hoursAgo: 30 },
  { code: 'ATTENDANCE_REVIEW', category: 'ATTENDANCE', priority: 'HIGH', title: 'Monthly attendance review', message: 'Attendance records for the current month are available. Contact the school if any entry needs correction.', actionUrl: '/student/attendance', roles: ['SCHOOL_OWNER', 'ADMIN', 'TEACHER', 'STUDENT', 'PARENT'], hoursAgo: 24 },
  { code: 'FEE_INSTALLMENT', category: 'FEE', priority: 'HIGH', title: 'Fee installment reminder', message: 'Please review the current fee statement and upcoming installment due date in the fee portal.', actionUrl: '/parent/fees', roles: ['SCHOOL_OWNER', 'ADMIN', 'FEE_MANAGER', 'PARENT'], hoursAgo: 18 },
  { code: 'EXAM_TIMETABLE', category: 'EXAM', priority: 'HIGH', title: 'Examination timetable published', message: 'The examination schedule has been published. Students should review dates and prepare according to the timetable.', actionUrl: '/dashboard/calendar', roles: ['SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER', 'TEACHER', 'STUDENT', 'PARENT'], hoursAgo: 12, announcement: true },
  { code: 'SPORTS_EVENT', category: 'SPORTS', priority: 'NORMAL', title: 'Inter-house sports activities', message: 'Registrations are open for upcoming inter-house sports and fitness activities.', actionUrl: '/dashboard/calendar', roles: ALL_ROLES, hoursAgo: 8, announcement: true },
  { code: 'RESULT_UPDATE', category: 'RESULT', priority: 'HIGH', title: 'Assessment progress update', message: 'The latest assessment progress information is ready for review in the student portal.', actionUrl: '/student/performance', roles: ['CURRICULUM_MANAGER', 'TEACHER', 'STUDENT', 'PARENT'], hoursAgo: 6 },
  { code: 'SECURITY_REMINDER', category: 'SECURITY', priority: 'URGENT', title: 'Review account security settings', message: 'Keep recovery questions and account security information current to protect school data.', actionUrl: '/communication', roles: ['SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER', 'FEE_MANAGER', 'TEACHER', 'STAFF'], hoursAgo: 3 },
  { code: 'EMERGENCY_DRILL', category: 'EMERGENCY', priority: 'EMERGENCY', title: 'Safety drill acknowledgement required', message: 'A scheduled campus safety drill will take place this week. Please read and acknowledge this notice.', actionUrl: '/notifications', roles: ALL_ROLES, hoursAgo: 1, acknowledgement: true, announcement: true },
];

const templateDefinitions = [
  ['ACADEMIC_UPDATE', 'Academic update', 'ACADEMIC', 'Academic update for {{schoolName}}', '{{message}}', ['schoolName', 'message']],
  ['FEE_REMINDER', 'Fee reminder', 'FEE', 'Fee reminder from {{schoolName}}', '{{message}}', ['schoolName', 'message']],
  ['ATTENDANCE_ALERT', 'Attendance alert', 'ATTENDANCE', 'Attendance update for {{studentName}}', '{{message}}', ['studentName', 'message']],
  ['EMERGENCY_ALERT', 'Emergency alert', 'EMERGENCY', 'Important alert from {{schoolName}}', '{{message}}', ['schoolName', 'message']],
];

const insertPolicyAndTemplates = async (school, creator) => {
  await client.query('INSERT INTO "CommunicationPolicy" ("id", "schoolId", "updatedAt") VALUES ($1, $2, NOW()) ON CONFLICT ("schoolId") DO NOTHING', [id('comm_policy'), school.id]);
  for (const [code, name, category, title, body, variables] of templateDefinitions) {
    await client.query(`
      INSERT INTO "NotificationTemplate" ("id", "schoolId", "name", "code", "category", "channel", "titleTemplate", "bodyTemplate", "allowedVariables", "isSystemTemplate", "createdByUserId", "updatedAt")
      VALUES ($1, $2, $3, $4, CAST($5 AS "CommunicationCategory"), 'IN_APP', $6, $7, $8, true, $9, NOW())
      ON CONFLICT ("schoolId", "code", "channel") DO NOTHING
    `, [id('comm_template'), school.id, name, code, category, title, body, variables, creator.id]);
  }
};

const loadRecipients = async (schoolId) => {
  const users = await client.query(`SELECT "id", "role", "name" FROM "User" WHERE "schoolId"=$1 AND "isActive"=true AND "role" NOT IN ('PLATFORM_OWNER','STUDENT','PARENT')`, [schoolId]);
  const students = await client.query(`SELECT "id", "studentFirstName", "studentLastName", "studentUserId", "parentUserId", "fatherName" FROM "Student" WHERE "schoolId"=$1 AND "isActive"=true`, [schoolId]);
  return [
    ...users.rows.map((row) => ({ key: `user:${row.id}`, userId: row.id, studentId: null, parentId: null, role: row.role, context: null })),
    ...students.rows.flatMap((row) => {
      const studentName = `${row.studentFirstName} ${row.studentLastName || ''}`.trim();
      return [
        ...(row.studentUserId ? [{ key: `student:${row.id}`, userId: null, studentId: row.id, parentId: null, role: 'STUDENT', context: { studentId: row.id, studentName } }] : []),
        ...(row.parentUserId ? [{ key: `parent:${row.parentUserId}`, userId: null, studentId: row.id, parentId: row.parentUserId, role: 'PARENT', context: { studentId: row.id, studentName } }] : []),
      ];
    }),
  ];
};

const seedNotifications = async (school, creator, recipients) => {
  let notificationCount = 0;
  let recipientCount = 0;
  for (const definition of notificationDefinitions) {
    const applicable = recipients.filter((recipient) => definition.roles.includes(recipient.role));
    const dedupeKey = `COMM_DEMO_2026_27:${definition.code}`;
    const notificationId = id('comm_notification');
    const createdAt = ago(definition.hoursAgo);
    const inserted = await client.query(`
      INSERT INTO "Notification" ("id", "schoolId", "type", "category", "priority", "title", "message", "actionUrl", "actionLabel", "sourceModule", "sourceEntityType", "sourceEntityId", "createdByUserId", "createdByRole", "status", "publishedAt", "requiresAcknowledgement", "isMandatory", "isSystemGenerated", "resolvedRecipientCount", "dedupeKey", "createdAt", "updatedAt")
      VALUES ($1,$2,$3,CAST($4 AS "CommunicationCategory"),CAST($5 AS "NotificationPriority"),$6,$7,$8,$9,'DEMO_COMMUNICATION','DEMO',$3,$10,CAST($11 AS "Role"),'PUBLISHED',$12,$13,$13,false,$14,$15,$12,NOW())
      ON CONFLICT ("schoolId", "dedupeKey") DO NOTHING RETURNING "id"
    `, [notificationId, school.id, definition.code, definition.category, definition.priority, definition.title, definition.message, definition.actionUrl, definition.actionUrl ? 'Open related page' : null, creator.id, creator.role, createdAt, Boolean(definition.acknowledgement), applicable.length, dedupeKey]);
    const actualId = inserted.rows[0]?.id || (await client.query('SELECT "id" FROM "Notification" WHERE "schoolId"=$1 AND "dedupeKey"=$2', [school.id, dedupeKey])).rows[0].id;
    if (inserted.rowCount) notificationCount += 1;
    await client.query('INSERT INTO "NotificationAudienceRule" ("id", "notificationId", "kind") SELECT $1,$2,\'SCHOOL_WIDE\' WHERE NOT EXISTS (SELECT 1 FROM "NotificationAudienceRule" WHERE "notificationId"=$2)', [id('comm_audience'), actualId]);

    if (applicable.length) {
      const recipientInsert = await client.query(`
        INSERT INTO "NotificationRecipient" ("id", "notificationId", "schoolId", "recipientKey", "userId", "studentId", "parentId", "recipientRole", "deliveryContext", "context", "readAt", "createdAt")
        SELECT data.id, $1, $2, data.recipient_key, data.user_id, data.student_id, data.parent_id,
          CAST(data.role AS "Role"), 'SCHOOL_WIDE', data.context, data.read_at, $3
        FROM UNNEST($4::text[], $5::text[], $6::text[], $7::text[], $8::text[], $9::text[], $10::jsonb[], $11::timestamp[])
          AS data(id, recipient_key, user_id, student_id, parent_id, role, context, read_at)
        ON CONFLICT ("notificationId", "recipientKey") DO NOTHING
      `, [
        actualId,
        school.id,
        createdAt,
        applicable.map(() => id('comm_recipient')),
        applicable.map((recipient) => recipient.key),
        applicable.map((recipient) => recipient.userId),
        applicable.map((recipient) => recipient.studentId),
        applicable.map((recipient) => recipient.parentId),
        applicable.map((recipient) => recipient.role),
        applicable.map((recipient) => JSON.stringify(recipient.context)),
        applicable.map((_, index) => index === 0 && definition.hoursAgo > 24 ? createdAt : null),
      ]);
      recipientCount += recipientInsert.rowCount;
      const recipientIds = (await client.query('SELECT "id" FROM "NotificationRecipient" WHERE "notificationId"=$1', [actualId])).rows.map((row) => row.id);
      await client.query(`
        INSERT INTO "NotificationDelivery" ("id", "notificationRecipientId", "channel", "status", "attemptCount", "provider", "sentAt", "deliveredAt", "createdAt", "updatedAt")
        SELECT data.id, data.recipient_id, 'IN_APP', 'DELIVERED', 1, 'database-demo-seed', $1, $1, $1, NOW()
        FROM UNNEST($2::text[], $3::text[]) AS data(id, recipient_id)
        ON CONFLICT ("notificationRecipientId", "channel") DO NOTHING
      `, [createdAt, recipientIds.map(() => id('comm_delivery')), recipientIds]);
    }

    if (definition.announcement) {
      await client.query(`
        INSERT INTO "Announcement" ("id", "schoolId", "notificationId", "title", "content", "category", "priority", "status", "publishAt", "requiresAcknowledgement", "createdByUserId", "createdAt", "updatedAt")
        VALUES ($1,$2,$3,$4,$5,CAST($6 AS "CommunicationCategory"),CAST($7 AS "NotificationPriority"),'PUBLISHED',$8,$9,$10,$8,NOW())
        ON CONFLICT ("notificationId") DO NOTHING
      `, [id('comm_announcement'), school.id, actualId, definition.title, definition.message, definition.category, definition.priority, createdAt, Boolean(definition.acknowledgement), creator.id]);
    }
  }
  return { notificationCount, recipientCount };
};

const createConversation = async ({ school, type, subject, studentId, creatorKey, participants, messages }) => {
  const existing = await client.query('SELECT "id" FROM "Conversation" WHERE "schoolId"=$1 AND "subject"=$2 LIMIT 1', [school.id, subject]);
  if (existing.rowCount) return 0;
  const conversationId = id('comm_conversation');
  await client.query(`INSERT INTO "Conversation" ("id", "schoolId", "type", "subject", "studentId", "createdByKey", "status", "lastMessageAt", "createdAt", "updatedAt") VALUES ($1,$2,CAST($3 AS "ConversationType"),$4,$5,$6,'OPEN',NOW(),NOW(),NOW())`, [conversationId, school.id, type, subject, studentId, creatorKey]);
  for (const participant of participants) {
    await client.query(`INSERT INTO "ConversationParticipant" ("id", "conversationId", "participantKey", "userId", "studentId", "role", "canManage", "lastReadAt") VALUES ($1,$2,$3,$4,$5,CAST($6 AS "Role"),$7,$8)`, [id('comm_participant'), conversationId, participant.key, participant.userId, participant.studentId, participant.role, Boolean(participant.canManage), participant.read ? new Date() : null]);
  }
  for (const [index, message] of messages.entries()) {
    await client.query(`INSERT INTO "Message" ("id", "conversationId", "schoolId", "senderKey", "senderUserId", "senderRole", "content", "createdAt") VALUES ($1,$2,$3,$4,$5,CAST($6 AS "Role"),$7,$8)`, [id('comm_message'), conversationId, school.id, message.key, message.userId, message.role, message.content, ago(messages.length - index)]);
  }
  return 1;
};

const seedConversations = async (school, creator, recipients) => {
  const teacher = recipients.find((row) => row.role === 'TEACHER');
  const student = recipients.find((row) => row.role === 'STUDENT');
  const parent = student && recipients.find((row) => row.role === 'PARENT' && row.studentId === student.studentId);
  const feeManager = recipients.find((row) => row.role === 'FEE_MANAGER');
  const curriculumManager = recipients.find((row) => row.role === 'CURRICULUM_MANAGER');
  let count = 0;
  if (teacher && parent) count += await createConversation({ school, type: 'PARENT_TEACHER', subject: 'Demo: academic progress discussion', studentId: student.studentId, creatorKey: parent.key, participants: [{ ...parent, canManage: true }, { ...teacher, canManage: true, read: true }], messages: [{ ...parent, content: 'Could we discuss the recent assessment progress and areas for improvement?' }, { ...teacher, content: 'Certainly. The student is progressing well; I will share focused practice suggestions.' }] });
  if (teacher) count += await createConversation({ school, type: 'ADMIN_STAFF', subject: 'Demo: upcoming school event coordination', studentId: null, creatorKey: `user:${creator.id}`, participants: [{ key: `user:${creator.id}`, userId: creator.id, studentId: null, role: creator.role, canManage: true, read: true }, { ...teacher, canManage: true }], messages: [{ key: `user:${creator.id}`, userId: creator.id, role: creator.role, content: 'Please review the responsibilities for the upcoming school event.' }, { ...teacher, content: 'Reviewed. I will coordinate with the assigned student teams.' }] });
  if (teacher && student) count += await createConversation({ school, type: 'STUDENT_TEACHER', subject: 'Demo: help with mathematics revision', studentId: student.studentId, creatorKey: student.key, participants: [{ ...student, canManage: true }, { ...teacher, canManage: true, read: true }], messages: [{ ...student, content: 'Could you suggest which topics I should revise first for the upcoming assessment?' }, { ...teacher, content: 'Begin with the latest two units, then use the revision worksheet shared in Homework.' }] });
  if (feeManager && parent) count += await createConversation({ school, type: 'FEE_SUPPORT', subject: 'Demo: fee statement clarification', studentId: student.studentId, creatorKey: parent.key, participants: [{ ...parent, canManage: true }, { ...feeManager, canManage: true, read: true }], messages: [{ ...parent, content: 'Please help me understand the current installment shown in the fee statement.' }, { ...feeManager, content: 'Certainly. I have shared the installment breakdown and applicable due date.' }] });
  if (curriculumManager && teacher) count += await createConversation({ school, type: 'ACADEMIC_SUPPORT', subject: 'Demo: curriculum planning discussion', studentId: null, creatorKey: curriculumManager.key, participants: [{ ...curriculumManager, canManage: true, read: true }, { ...teacher, canManage: true }], messages: [{ ...curriculumManager, content: 'Please review the chapter sequence for next month and share any pacing concerns.' }, { ...teacher, content: 'The sequence looks suitable. I have noted one chapter that may need an additional period.' }] });
  return count;
};

try {
  await client.connect();
  const schools = (await client.query('SELECT "id", "schoolCode", "schoolName" FROM "School" ORDER BY "schoolName"')).rows;
  let totalNotifications = 0; let totalRecipients = 0; let totalConversations = 0;
  for (const school of schools) {
    const creatorResult = await client.query(`SELECT "id", "role" FROM "User" WHERE "schoolId"=$1 AND "isActive"=true AND "role" IN ('SCHOOL_OWNER','ADMIN') ORDER BY CASE WHEN "role"='SCHOOL_OWNER' THEN 0 ELSE 1 END LIMIT 1`, [school.id]);
    const creator = creatorResult.rows[0];
    if (!creator) { console.log(`${school.schoolCode}: skipped because no active School Owner or Administrator exists`); continue; }
    await client.query('BEGIN');
    try {
      await insertPolicyAndTemplates(school, creator);
      const recipients = await loadRecipients(school.id);
      const seeded = await seedNotifications(school, creator, recipients);
      const conversations = await seedConversations(school, creator, recipients);
      await client.query('COMMIT');
      totalNotifications += seeded.notificationCount; totalRecipients += seeded.recipientCount; totalConversations += conversations;
      console.log(`${school.schoolCode}: ${seeded.notificationCount} notifications, ${seeded.recipientCount} recipient inbox rows, ${conversations} conversations inserted; existing demo rows preserved`);
    } catch (error) { await client.query('ROLLBACK'); throw error; }
  }
  console.log(`Communication demo seed complete: ${totalNotifications} notifications, ${totalRecipients} recipient inbox rows and ${totalConversations} conversations inserted. No existing data was deleted.`);
} finally {
  await client.end().catch(() => {});
}
