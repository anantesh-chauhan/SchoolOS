import prisma from '../config/prisma.client.js';
import { createSystemNotification } from '../modules/communication/communication.service.js';

// Attendance writes publish domain events here. Delivery channels remain owned by
// the communication module, and the log provides tenant-scoped idempotency.
export async function publishAttendanceEvent({ schoolId, eventType, subjectType, subjectId, attendanceDate, title, message, actionUrl, students = [], roles = ['STUDENT','PARENT'], priority = 'NORMAL' }) {
  const dateKey = attendanceDate ? new Date(attendanceDate).toISOString().slice(0, 10) : 'none';
  const dedupeKey = `${eventType}:${subjectType}:${subjectId}:${dateKey}`;
  try {
    await prisma.attendanceNotificationLog.create({ data: { schoolId, eventType, subjectType, subjectId, attendanceDate, dedupeKey, recipientCount: students.length } });
  } catch (error) {
    if (error?.code === 'P2002') return { duplicate: true };
    throw error;
  }
  try {
    const userIds = roles.length ? (await prisma.user.findMany({ where: { schoolId, role: { in: roles }, isActive: true }, select: { id: true } })).map((row) => row.id) : [];
    await createSystemNotification({ schoolId, type: eventType, category: 'ATTENDANCE', priority, title, message, actionUrl, sourceModule: 'ATTENDANCE', sourceEntityType: subjectType, sourceEntityId: subjectId, dedupeKey, students, userIds, roles, mandatory: priority === 'HIGH' });
  } catch (error) {
    await prisma.attendanceNotificationLog.deleteMany({ where: { schoolId, dedupeKey } });
    throw error;
  }
  return { duplicate: false };
}
