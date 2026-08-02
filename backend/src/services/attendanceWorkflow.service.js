import prisma from '../config/prisma.client.js';
import { getTeacherForUser } from '../utils/teacherAuthorization.util.js';
import {
  ADMIN_OVERRIDE_REASON_CODES, DEFAULT_RULES, STUDENT_STATUS_DEFAULTS,
  assertAttendanceTransition, dateInTimezone, statusWeight, utcDate,
} from './attendance.service.js';
import { publishAttendanceEvent } from './attendanceEvents.service.js';
import { findEligibleStudentsForSection } from './studentSectionEnrollment.service.js';

const clean = (value) => String(value ?? '').trim();
const dayKey = (value) => utcDate(value)?.toISOString().slice(0, 10);
const sessionNameFor = (date) => { const year = date.getUTCFullYear(); const start = date.getUTCMonth() >= 3 ? year : year - 1; return `${start}-${String(start + 1).slice(-2)}`; };
const fail = (message, statusCode = 400) => { throw Object.assign(new Error(message), { statusCode }); };
const requestIdFor = (request) => String(request?.res?.getHeader?.('X-Request-Id') || request?.get?.('x-request-id') || '').slice(0, 200) || null;
const isAttendanceAdmin = (user) => user?.role === 'ADMIN';
const isClassTeacher = (user) => user?.role === 'CLASS_TEACHER';

const rulesFor = async (schoolId) => ({ ...DEFAULT_RULES, ...(await prisma.attendanceRule.findUnique({ where: { schoolId } }) || {}) });

const statusesFor = async (schoolId) => {
  const configured = await prisma.attendanceStatusDefinition.findMany({ where: { schoolId, isActive: true, audience: { in: ['STUDENT', 'BOTH'] } } });
  return configured.length ? configured : STUDENT_STATUS_DEFAULTS;
};

const academicContext = async (schoolId, date, requestedName) => {
  const session = await prisma.academicSession.findFirst({
    where: requestedName ? { schoolId, name: requestedName } : { schoolId, startDate: { lte: date }, endDate: { gte: date } },
    orderBy: { startDate: 'desc' },
  });
  if (!session) fail('Attendance date is outside a configured academic session', 409);
  return session;
};

const sectionContext = async (schoolId, sectionId, date, requestedSession) => {
  const section = await prisma.section.findFirst({ where: { id: sectionId, schoolId, deletedAt: null }, include: { class: true } });
  if (!section) fail('Section not found in this school', 404);
  const academicSession = await academicContext(schoolId, date, requestedSession);
  let assignment = await prisma.sectionClassTeacherAssignment.findFirst({
    where: { schoolId, sectionId, academicSessionId: academicSession.id, isPrimary: true, status: 'ACTIVE', startDate: { lte: date }, OR: [{ endDate: null }, { endDate: { gte: date } }] },
    include: { teacher: true },
  });
  if (!assignment) assignment = await prisma.teacherAssignment.findFirst({
    where: { schoolId, sectionId, classId: section.classId, isActive: true, roleType: { in: ['CLASS_TEACHER', 'BOTH'] }, effectiveFrom: { lte: date }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] },
    include: { teacher: true },
  });
  return { section, academicSession, assignment };
};

const authorizeMarker = async (user, context) => {
  if (!user?.schoolId || user.schoolId !== context.section.schoolId || user.isActive === false) fail('Active school membership is required', 403);
  if (isAttendanceAdmin(user)) return { markerType: 'ADMIN', teacher: null };
  if (!isClassTeacher(user)) fail('Open the Class Teacher workspace to mark student attendance', 403);
  const teacher = await getTeacherForUser(user);
  if (!teacher || teacher.id !== context.assignment?.teacherId) fail('Only the assigned Class Teacher may mark attendance for this section', 403);
  return { markerType: 'CLASS_TEACHER', teacher };
};

const validateDatePolicy = (date, rules, markerType, reasonCode) => {
  const today = dateInTimezone(new Date(), rules.timezone);
  if (date > today) fail('Future-date attendance is prohibited');
  const age = Math.floor((today.getTime() - date.getTime()) / 86400000);
  if (age <= 0) {
    const parts = new Intl.DateTimeFormat('en-GB', { timeZone: rules.timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date());
    const currentMinute = Number(parts.find((part) => part.type === 'hour')?.value || 0) * 60 + Number(parts.find((part) => part.type === 'minute')?.value || 0);
    const configuredMinute = (value, fallback) => { const [hour, minute] = String(value || fallback).split(':').map(Number); return hour * 60 + minute; };
    if (currentMinute < configuredMinute(rules.attendanceOpenTime, '07:30')) fail(`Attendance opens at ${rules.attendanceOpenTime}`);
    if (markerType === 'CLASS_TEACHER' && currentMinute > configuredMinute(rules.classTeacherDeadline, '09:30')) fail('The Class Teacher submission deadline has passed. Contact the School Admin.', 423);
    if (markerType === 'ADMIN' && currentMinute > configuredMinute(rules.finalSubmissionTime, '12:00') && reasonCode !== 'EMERGENCY_ADMIN_ACTION') fail('The final administrative deadline has passed. Emergency authorization is required.', 423);
    return;
  }
  if (markerType !== 'ADMIN') fail('Backdated attendance may only be entered by School Admin', 403);
  if (!rules.allowBackdatedAttendance || age > Number(rules.maximumBackdatedDays || 0)) fail('Backdated attendance is outside the configured administrative window', 403);
  if (!reasonCode) fail('A reason is required for backdated attendance');
};

const validateAdminReason = (markerType, rules, reasonCode, reasonNote) => {
  if (markerType !== 'ADMIN' || !rules.requireAdminOverrideReason) return;
  if (!ADMIN_OVERRIDE_REASON_CODES.includes(reasonCode)) fail('A valid Admin override reason is required');
  if (reasonCode === 'OTHER' && !reasonNote) fail('An explanation is required when the Admin override reason is Other');
};

const eligibleStudents = (_schoolId, context, date) => findEligibleStudentsForSection({
  section: context.section,
  effectiveDate: date,
  select: { id: true, studentFirstName: true, studentLastName: true, admissionNo: true },
});

const normalizeRecords = (inputs, definitions) => {
  if (!Array.isArray(inputs) || !inputs.length) fail('Student attendance records are required');
  if (inputs.length > 500) fail('A maximum of 500 student records may be submitted at once', 413);
  const ids = inputs.map((row) => clean(row.studentId));
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) fail('Duplicate or empty student IDs are not allowed', 409);
  const allowed = new Map(definitions.map((item) => [item.code, item]));
  return inputs.map((input) => {
    const status = clean(input.status).toUpperCase(); const definition = allowed.get(status); const remarks = clean(input.remarks) || null;
    if (!definition) fail(`Unsupported attendance status: ${status}`);
    if (remarks?.length > 500) fail('Attendance remarks may not exceed 500 characters');
    if (definition.requiresRemark && !remarks) fail(`${definition.displayName} requires a remark`);
    return { studentId: clean(input.studentId), status, remarks, attendanceUnits: statusWeight(status, {}, definitions), leaveReference: clean(input.leaveReference) || null };
  });
};

const summaryOf = (records) => {
  const counts = records.reduce((all, row) => ({ ...all, [row.status]: (all[row.status] || 0) + 1 }), {});
  return { totalStudents: records.length, counts, present: counts.PRESENT || 0, absent: counts.ABSENT || 0, leave: (counts.LEAVE || 0) + (counts.APPROVED_LEAVE || 0) + (counts.MEDICAL_LEAVE || 0), late: counts.LATE || 0 };
};

const auditPayload = ({ request, user, context, register, action, reasonCode, reasonNote, previousRevisionNumber, newRevisionNumber, changes = [] }) => ({
  schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action, entityType: 'ATTENDANCE_SESSION', entityId: register.id,
  reason: reasonNote || null, reasonCode: reasonCode || null, academicSessionId: context.academicSession.id,
  attendanceSessionId: register.id, classId: context.section.classId, sectionId: context.section.id, attendanceDate: register.attendanceDate,
  assignedClassTeacherId: context.assignment?.teacherId || null, previousRevisionNumber, newRevisionNumber,
  changedStudentCount: changes.length, changedFields: changes.length ? changes : undefined,
  ipAddress: request?.ip || null, userAgent: request?.get?.('user-agent') || null, requestId: requestIdFor(request),
});

export const saveStudentAttendanceSession = async ({ user, sectionId, attendanceDate, payload, targetState, request }) => {
  const schoolId = user?.schoolId; const date = utcDate(attendanceDate);
  if (!schoolId || !date || !/^\d{4}-\d{2}-\d{2}$/.test(clean(attendanceDate)) || dayKey(date) !== clean(attendanceDate)) fail('A valid attendance date is required');
  const context = await sectionContext(schoolId, sectionId, date, payload.academicSession);
  const marker = await authorizeMarker(user, context); const rules = await rulesFor(schoolId);
  const reasonCode = clean(payload.overrideReasonCode || payload.reasonCode).toUpperCase(); const reasonNote = clean(payload.overrideReasonNote || payload.reasonNote || payload.reason);
  validateDatePolicy(date, rules, marker.markerType, reasonCode); validateAdminReason(marker.markerType, rules, reasonCode, reasonNote);
  if (targetState === 'DRAFT' && !rules.allowDraft) fail('Draft attendance is disabled for this school');
  const definitions = await statusesFor(schoolId); const records = normalizeRecords(payload.records, definitions);
  if (targetState !== 'DRAFT' && records.some((row) => row.status === 'NOT_MARKED')) fail('Every eligible student must be marked before submission');
  const students = await eligibleStudents(schoolId, context, date); const eligibleIds = new Set(students.map((row) => row.id));
  if (records.some((row) => !eligibleIds.has(row.studentId))) fail('One or more students are not enrolled in this section on the attendance date', 403);
  if (targetState !== 'DRAFT' && records.length !== students.length) fail('Submission must include every eligible student');
  const key = { schoolId_classId_sectionId_attendanceDate: { schoolId, classId: context.section.classId, sectionId, attendanceDate: date } };
  const existing = await prisma.attendanceDailyRegister.findUnique({ where: key });
  if (existing && ['LOCKED', 'CORRECTED', 'CANCELLED', 'NOT_APPLICABLE'].includes(existing.state)) {
    if (targetState !== 'DRAFT' && ['LOCKED', 'CORRECTED'].includes(existing.state)) {
      const current = await prisma.studentAttendance.findMany({ where: { schoolId, classId: context.section.classId, sectionId, attendanceDate: date } });
      const exact = current.length === records.length && records.every((row) => { const old = current.find((item) => item.studentId === row.studentId); return old && old.status === row.status && clean(old.remarks) === clean(row.remarks); });
      if (exact) return { idempotent: true, register: existing, message: 'Attendance was already submitted and locked' };
    }
    fail('Attendance is submitted and locked. Use the Admin correction workflow.', 423);
  }
  if (payload.expectedRevision !== undefined && existing && Number(payload.expectedRevision) !== existing.currentRevisionNumber) fail('This attendance record has changed since you opened it. Refresh to view the latest version.', 409);
  if (marker.markerType === 'ADMIN' && existing?.state === 'DRAFT' && existing.createdById && existing.createdById !== user.id && !reasonNote) fail('A takeover reason is required to continue the Class Teacher draft');
  assertAttendanceTransition(existing?.state || 'NOT_STARTED', targetState === 'DRAFT' ? 'DRAFT' : 'LOCKED');
  const now = new Date(); const nextRevision = targetState === 'DRAFT' ? Number(existing?.currentRevisionNumber || 0) : Number(existing?.currentRevisionNumber || 0) + 1;
  const result = await prisma.$transaction(async (tx) => {
    let register;
    const registerData = {
      academicSession: context.academicSession.name || sessionNameFor(date), assignedClassTeacherId: context.assignment?.teacherId || null,
      markedById: user.id, markedByRole: user.role, markedByType: marker.markerType, overrideReasonCode: reasonCode || null,
      overrideReasonNote: reasonNote || null, markedCount: records.filter((row) => row.status !== 'NOT_MARKED').length,
      state: targetState === 'DRAFT' ? 'DRAFT' : 'LOCKED', draftSavedAt: targetState === 'DRAFT' ? now : existing?.draftSavedAt,
      submittedById: targetState === 'DRAFT' ? null : user.id, submittedAt: targetState === 'DRAFT' ? null : now,
      isLocked: targetState !== 'DRAFT', lockedAt: targetState === 'DRAFT' ? null : now, currentRevisionNumber: nextRevision,
    };
    if (existing) {
      const updated = await tx.attendanceDailyRegister.updateMany({ where: { id: existing.id, schoolId, version: existing.version }, data: { ...registerData, version: { increment: 1 } } });
      if (updated.count !== 1) fail('This attendance record has changed since you opened it. Refresh to view the latest version.', 409);
      register = await tx.attendanceDailyRegister.findUnique({ where: { id: existing.id } });
    } else {
      register = await tx.attendanceDailyRegister.create({ data: { schoolId, classId: context.section.classId, sectionId, attendanceDate: date, createdById: user.id, ...registerData } });
    }
    const oldRows = await tx.studentAttendance.findMany({ where: { schoolId, classId: context.section.classId, sectionId, attendanceDate: date } });
    const oldByStudent = new Map(oldRows.map((row) => [row.studentId, row])); const changes = [];
    for (const row of records) {
      const old = oldByStudent.get(row.studentId);
      const saved = await tx.studentAttendance.upsert({
        where: { schoolId_classId_sectionId_studentId_attendanceDate: { schoolId, classId: context.section.classId, sectionId, studentId: row.studentId, attendanceDate: date } },
        update: { ...row, markedById: user.id, submittedById: targetState === 'DRAFT' ? null : user.id, submittedAt: targetState === 'DRAFT' ? null : now, lockedAt: targetState === 'DRAFT' ? null : now, revision: nextRevision || 1 },
        create: { schoolId, classId: context.section.classId, sectionId, attendanceDate: date, academicSession: context.academicSession.name, ...row, markedById: user.id, submittedById: targetState === 'DRAFT' ? null : user.id, submittedAt: targetState === 'DRAFT' ? null : now, lockedAt: targetState === 'DRAFT' ? null : now, revision: nextRevision || 1 },
      });
      if (!old || old.status !== row.status || clean(old.remarks) !== clean(row.remarks)) changes.push({ studentAttendanceId: saved.id, studentId: row.studentId, previousStatus: old?.status || null, newStatus: row.status, previousRemark: old?.remarks || null, newRemark: row.remarks });
    }
    if (targetState !== 'DRAFT') {
      const revision = await tx.attendanceRevision.create({ data: { schoolId, attendanceSessionId: register.id, revisionNumber: nextRevision, actionType: marker.markerType === 'ADMIN' ? 'ATTENDANCE_MARKED_BY_ADMIN' : 'ATTENDANCE_SUBMITTED', createdByUserId: user.id, createdByRole: user.role, reasonCode: reasonCode || null, reasonNote: reasonNote || null, summarySnapshot: summaryOf(records), recordSnapshot: records } });
      if (changes.length) await tx.attendanceRevisionChange.createMany({ data: changes.map((change) => ({ schoolId, attendanceRevisionId: revision.id, ...change })) });
    }
    const action = targetState === 'DRAFT' ? (existing ? (existing.createdById !== user.id ? 'ATTENDANCE_DRAFT_TAKEN_OVER' : 'ATTENDANCE_DRAFT_UPDATED') : 'ATTENDANCE_DRAFT_CREATED') : (marker.markerType === 'ADMIN' ? 'ATTENDANCE_MARKED_BY_ADMIN' : 'ATTENDANCE_SUBMITTED');
    await tx.attendanceAuditLog.create({ data: auditPayload({ request, user, context, register, action, reasonCode, reasonNote, previousRevisionNumber: existing?.currentRevisionNumber || 0, newRevisionNumber: nextRevision, changes }) });
    if (targetState !== 'DRAFT') await tx.attendanceAuditLog.create({ data: auditPayload({ request, user, context, register, action: 'ATTENDANCE_LOCKED', reasonCode, reasonNote, previousRevisionNumber: nextRevision, newRevisionNumber: nextRevision }) });
    return { register, changes };
  });
  if (targetState !== 'DRAFT') {
    const recipients = [...(rules.studentNotifications ? ['STUDENT'] : []), ...(rules.parentAbsenceNotifications ? ['PARENT'] : [])];
    await Promise.allSettled(records.filter((row) => row.status === 'ABSENT').map((row) => publishAttendanceEvent({ schoolId, eventType: 'STUDENT_ABSENT', subjectType: 'STUDENT_ATTENDANCE', subjectId: row.studentId, attendanceDate: date, students: [row.studentId], roles: recipients, priority: 'HIGH', title: 'Absence recorded', message: `Attendance for ${dayKey(date)} was marked absent.`, actionUrl: '/student/attendance' })));
    await publishAttendanceEvent({ schoolId, eventType: marker.markerType === 'ADMIN' ? 'ATTENDANCE_MARKED_BY_ADMIN' : 'ATTENDANCE_SUBMITTED', subjectType: 'ATTENDANCE_SESSION', subjectId: result.register.id, attendanceDate: date, roles: ['ADMIN', 'SCHOOL_OWNER'], title: 'Attendance submitted and locked', message: `${context.section.class.className} · ${context.section.sectionName} attendance was submitted${marker.markerType === 'ADMIN' ? ' by School Admin' : ''}.`, actionUrl: '/attendance' }).catch(() => null);
  }
  return { ...result, idempotent: false, message: targetState === 'DRAFT' ? 'Draft attendance saved' : 'Attendance submitted and locked' };
};

export const correctStudentAttendanceSession = async ({ user, attendanceSessionId, payload, request }) => {
  if (!isAttendanceAdmin(user)) fail('Only an authorized School Admin may correct submitted attendance', 403);
  const reasonCode = clean(payload.reasonCode).toUpperCase(); const reasonNote = clean(payload.reasonNote);
  if (!reasonCode || !reasonNote) fail('Correction reason and note are required');
  if (!Array.isArray(payload.changes) || !payload.changes.length) fail('At least one student correction is required');
  const ids = payload.changes.map((row) => clean(row.studentId)); if (new Set(ids).size !== ids.length) fail('Duplicate student corrections are not allowed', 409);
  const register = await prisma.attendanceDailyRegister.findFirst({ where: { id: attendanceSessionId, schoolId: user.schoolId } });
  if (!register) fail('Attendance session not found', 404);
  if (!['LOCKED', 'CORRECTED'].includes(register.state) || !register.isLocked) fail('Only locked attendance can be corrected', 409);
  if (payload.expectedRevision !== undefined && Number(payload.expectedRevision) !== register.currentRevisionNumber) fail('This attendance record has changed since you opened it. Refresh to view the latest version.', 409);
  const context = await sectionContext(user.schoolId, register.sectionId, register.attendanceDate, register.academicSession); const definitions = await statusesFor(user.schoolId); const allowed = new Map(definitions.map((row) => [row.code, row]));
  const current = await prisma.studentAttendance.findMany({ where: { schoolId: user.schoolId, classId: register.classId, sectionId: register.sectionId, attendanceDate: register.attendanceDate, studentId: { in: ids } } });
  if (current.length !== ids.length) fail('One or more student attendance records were not found in this session', 404);
  const currentById = new Map(current.map((row) => [row.studentId, row]));
  const changes = payload.changes.map((input) => { const old = currentById.get(input.studentId); const newStatus = clean(input.newStatus).toUpperCase(); const definition = allowed.get(newStatus); const newRemark = input.newRemark === undefined ? old.remarks : clean(input.newRemark) || null; if (!definition) fail(`Unsupported attendance status: ${newStatus}`); if (definition.requiresRemark && !newRemark) fail(`${definition.displayName} requires a remark`); return { studentAttendanceId: old.id, studentId: old.studentId, previousStatus: old.status, newStatus, previousRemark: old.remarks || null, newRemark, attendanceUnits: statusWeight(newStatus, {}, definitions) }; }).filter((row) => row.previousStatus !== row.newStatus || clean(row.previousRemark) !== clean(row.newRemark));
  if (!changes.length) fail('The correction does not change any attendance values');
  const nextRevision = register.currentRevisionNumber + 1; const now = new Date();
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.attendanceDailyRegister.updateMany({ where: { id: register.id, schoolId: user.schoolId, currentRevisionNumber: register.currentRevisionNumber, version: register.version }, data: { state: 'CORRECTED', correctedAt: now, isLocked: true, lockedAt: now, currentRevisionNumber: nextRevision, version: { increment: 1 } } });
    if (claimed.count !== 1) fail('This attendance record has changed since you opened it. Refresh to view the latest version.', 409);
    for (const change of changes) await tx.studentAttendance.update({ where: { id: change.studentAttendanceId }, data: { status: change.newStatus, remarks: change.newRemark, attendanceUnits: change.attendanceUnits, markedById: user.id, lockedAt: now, revision: nextRevision } });
    const effective = await tx.studentAttendance.findMany({ where: { schoolId: user.schoolId, classId: register.classId, sectionId: register.sectionId, attendanceDate: register.attendanceDate }, select: { studentId: true, status: true, remarks: true } });
    const revision = await tx.attendanceRevision.create({ data: { schoolId: user.schoolId, attendanceSessionId: register.id, revisionNumber: nextRevision, actionType: 'ATTENDANCE_CORRECTED', createdByUserId: user.id, createdByRole: user.role, reasonCode, reasonNote, summarySnapshot: summaryOf(effective), recordSnapshot: effective } });
    await tx.attendanceRevisionChange.createMany({ data: changes.map(({ attendanceUnits, ...change }) => ({ schoolId: user.schoolId, attendanceRevisionId: revision.id, ...change })) });
    await tx.attendanceAuditLog.create({ data: auditPayload({ request, user, context, register, action: 'ATTENDANCE_CORRECTED', reasonCode, reasonNote, previousRevisionNumber: register.currentRevisionNumber, newRevisionNumber: nextRevision, changes }) });
    return { register: { ...register, state: 'CORRECTED', currentRevisionNumber: nextRevision, correctedAt: now }, revision, changes };
  });
  const rules = await rulesFor(user.schoolId);
  if (rules.notifyClassTeacherOnCorrection && context.assignment?.teacher) {
    const assignedUser = await prisma.user.findFirst({ where: { schoolId: user.schoolId, isActive: true, OR: [{ employeeId: context.assignment.teacher.employeeId }, { email: context.assignment.teacher.email }, { contactEmail: context.assignment.teacher.email }] }, select: { id: true } });
    if (assignedUser) await publishAttendanceEvent({ schoolId: user.schoolId, eventType: 'ATTENDANCE_CORRECTED', subjectType: 'ATTENDANCE_SESSION', subjectId: `${register.id}:revision:${nextRevision}`, attendanceDate: register.attendanceDate, roles: [], userIds: [assignedUser.id], title: 'Attendance corrected by School Admin', message: `${context.section.class.className} · ${context.section.sectionName} attendance dated ${dayKey(register.attendanceDate)} was corrected. Reason: ${reasonNote}`, actionUrl: `/teacher/attendance?classId=${register.classId}&sectionId=${register.sectionId}&date=${dayKey(register.attendanceDate)}` }).catch(() => null);
  }
  return result;
};

export const markAttendanceNotApplicable = async ({ user, sectionId, attendanceDate, payload, request }) => {
  if (!isAttendanceAdmin(user)) fail('Only School Admin may mark attendance not applicable', 403);
  const reasonCode = clean(payload.reasonCode).toUpperCase(); const reasonNote = clean(payload.reasonNote);
  if (!reasonCode || !reasonNote) fail('A reason is required when attendance is not applicable');
  const date = utcDate(attendanceDate); if (!date) fail('A valid attendance date is required');
  const context = await sectionContext(user.schoolId, sectionId, date, payload.academicSession); const rules = await rulesFor(user.schoolId); validateDatePolicy(date, rules, 'ADMIN', reasonCode);
  const key = { schoolId_classId_sectionId_attendanceDate: { schoolId: user.schoolId, classId: context.section.classId, sectionId, attendanceDate: date } };
  const existing = await prisma.attendanceDailyRegister.findUnique({ where: key }); assertAttendanceTransition(existing?.state || 'NOT_STARTED', 'NOT_APPLICABLE');
  return prisma.$transaction(async (tx) => {
    const now = new Date(); const data = { academicSession: context.academicSession.name, assignedClassTeacherId: context.assignment?.teacherId || null, markedById: user.id, markedByRole: user.role, markedByType: 'ADMIN', overrideReasonCode: reasonCode, overrideReasonNote: reasonNote, state: 'NOT_APPLICABLE', isLocked: true, lockedAt: now, notApplicableAt: now };
    const register = existing ? await tx.attendanceDailyRegister.update({ where: { id: existing.id }, data: { ...data, version: { increment: 1 } } }) : await tx.attendanceDailyRegister.create({ data: { schoolId: user.schoolId, classId: context.section.classId, sectionId, attendanceDate: date, createdById: user.id, ...data } });
    await tx.attendanceAuditLog.create({ data: auditPayload({ request, user, context, register, action: 'ATTENDANCE_MARKED_NOT_APPLICABLE', reasonCode, reasonNote, previousRevisionNumber: existing?.currentRevisionNumber || 0, newRevisionNumber: existing?.currentRevisionNumber || 0 }) });
    return register;
  });
};

export const getAttendanceSessionHistory = async ({ user, attendanceSessionId }) => {
  const register = await prisma.attendanceDailyRegister.findFirst({ where: { id: attendanceSessionId, schoolId: user.schoolId } });
  if (!register) fail('Attendance session not found', 404);
  if (!['ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'CLASS_TEACHER'].includes(user.role)) fail('You cannot view attendance history', 403);
  const context = await sectionContext(user.schoolId, register.sectionId, register.attendanceDate, register.academicSession);
  if (['TEACHER', 'CLASS_TEACHER'].includes(user?.role)) await authorizeMarker(user, context);
  const [revisions, audit, students, users] = await Promise.all([
    prisma.attendanceRevision.findMany({ where: { schoolId: user.schoolId, attendanceSessionId }, include: { changes: true }, orderBy: { revisionNumber: 'asc' } }),
    prisma.attendanceAuditLog.findMany({ where: { schoolId: user.schoolId, attendanceSessionId }, orderBy: { createdAt: 'asc' } }),
    prisma.student.findMany({ where: { schoolId: user.schoolId }, select: { id: true, studentFirstName: true, studentLastName: true } }),
    prisma.user.findMany({ where: { schoolId: user.schoolId }, select: { id: true, name: true, role: true } }),
  ]);
  const studentNames = new Map(students.map((row) => [row.id, [row.studentFirstName, row.studentLastName].filter(Boolean).join(' ')])); const userNames = new Map(users.map((row) => [row.id, row.name]));
  return { register, assignedClassTeacher: context.assignment?.teacher ? { id: context.assignment.teacher.id, name: context.assignment.teacher.teacherName } : null, revisions: revisions.map((revision) => ({ ...revision, createdByName: userNames.get(revision.createdByUserId) || 'Unknown user', changes: revision.changes.map((change) => ({ ...change, studentName: studentNames.get(change.studentId) || 'Unknown student' })) })), audit: audit.map((event) => ({ ...event, performedByName: userNames.get(event.actorId) || 'Unknown user' })) };
};

export const getAttendanceOverview = async ({ user, attendanceDate }) => {
  if (!['ADMIN', 'SCHOOL_OWNER'].includes(user?.role)) fail('School administration access is required', 403);
  const date = utcDate(attendanceDate || new Date()); if (!date) fail('A valid date is required'); const schoolId = user.schoolId;
  const session = await academicContext(schoolId, date); const [sections, registers, assignments, teacherAttendance] = await Promise.all([
    prisma.section.findMany({ where: { schoolId, deletedAt: null }, include: { class: { select: { className: true } } }, orderBy: [{ class: { classOrder: 'asc' } }, { sectionOrder: 'asc' }] }),
    prisma.attendanceDailyRegister.findMany({ where: { schoolId, attendanceDate: date } }),
    prisma.sectionClassTeacherAssignment.findMany({ where: { schoolId, academicSessionId: session.id, isPrimary: true, status: 'ACTIVE', startDate: { lte: date }, OR: [{ endDate: null }, { endDate: { gte: date } }] }, include: { teacher: true } }),
    prisma.teacherAttendance.findMany({ where: { schoolId, attendanceDate: date } }),
  ]);
  const bySection = new Map(registers.map((row) => [row.sectionId, row])); const assignmentBySection = new Map(assignments.map((row) => [row.sectionId, row])); const teacherStatus = new Map(teacherAttendance.map((row) => [row.teacherId, row.status]));
  const rows = sections.map((section) => { const register = bySection.get(section.id); const assignment = assignmentBySection.get(section.id); return { classId: section.classId, className: section.class.className, sectionId: section.id, sectionName: section.sectionName, attendanceSessionId: register?.id || null, assignedClassTeacher: assignment?.teacher ? { id: assignment.teacher.id, name: assignment.teacher.teacherName } : null, teacherStatus: assignment ? (teacherStatus.get(assignment.teacherId) || 'UNAVAILABLE') : 'ASSIGNMENT_VACANT', attendanceStatus: register?.state || 'NOT_STARTED', markedByType: register?.markedByType || null, markedById: register?.markedById || null, submittedAt: register?.submittedAt || null, currentRevisionNumber: register?.currentRevisionNumber || 0, overrideReasonCode: register?.overrideReasonCode || null } });
  const summary = { totalSections: rows.length, submitted: rows.filter((row) => ['LOCKED', 'CORRECTED'].includes(row.attendanceStatus)).length, pending: rows.filter((row) => ['NOT_STARTED', 'DRAFT'].includes(row.attendanceStatus)).length, markedByAdmin: rows.filter((row) => row.markedByType === 'ADMIN').length, corrected: rows.filter((row) => row.attendanceStatus === 'CORRECTED').length, notApplicable: rows.filter((row) => row.attendanceStatus === 'NOT_APPLICABLE').length };
  const marked = rows.filter((row) => row.markedByType); const submissionMinutes = rows.filter((row) => row.submittedAt).map((row) => row.submittedAt.getUTCHours() * 60 + row.submittedAt.getUTCMinutes());
  const analytics = {
    classTeacherMarkedPercentage: marked.length ? Math.round(marked.filter((row) => row.markedByType === 'CLASS_TEACHER').length / marked.length * 1000) / 10 : null,
    adminMarkedPercentage: marked.length ? Math.round(marked.filter((row) => row.markedByType === 'ADMIN').length / marked.length * 1000) / 10 : null,
    correctionRate: summary.submitted ? Math.round(summary.corrected / summary.submitted * 1000) / 10 : null,
    averageSubmissionMinuteUtc: submissionMinutes.length ? Math.round(submissionMinutes.reduce((total, value) => total + value, 0) / submissionMinutes.length) : null,
    teacherAbsenceAdminInterventions: rows.filter((row) => row.markedByType === 'ADMIN' && ['ABSENT', 'LEAVE', 'MEDICAL_LEAVE'].includes(row.teacherStatus)).length,
    adminOverrideReasons: Object.entries(rows.filter((row) => row.overrideReasonCode).reduce((all, row) => ({ ...all, [row.overrideReasonCode]: (all[row.overrideReasonCode] || 0) + 1 }), {})).map(([reasonCode, count]) => ({ reasonCode, count })),
  };
  return { date: dayKey(date), academicSession: session.name, summary, analytics, sections: rows };
};
