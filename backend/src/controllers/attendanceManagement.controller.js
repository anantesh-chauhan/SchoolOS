import prisma from '../config/prisma.client.js';
import { isSchoolAdmin, requireSchoolAdminOrAssignedTeacherForSection, requireSchoolAdminOrClassTeacher, sendAuthorizationError } from '../utils/teacherAuthorization.util.js';
import {
  DEFAULT_RULES, EMPLOYEE_STATUS_DEFAULTS, STUDENT_STATUS_DEFAULTS, attendancePermission,
  buildWorkingDays, dateInTimezone, parseMonth, statusWeight, summarizeAttendance, utcDate,
} from '../services/attendance.service.js';
import { publishAttendanceEvent } from '../services/attendanceEvents.service.js';

const fail = (res, status, message) => res.status(status).json({ success: false, message });
const clean = (value) => String(value || '').trim();
const sessionNameFor = (date) => { const year = date.getUTCFullYear(); const start = date.getUTCMonth() >= 3 ? year : year - 1; return `${start}-${String(start + 1).slice(-2)}`; };
const publicRule = (row) => ({ ...DEFAULT_RULES, ...(row || {}), studentMinimumPercentage: Number(row?.studentMinimumPercentage ?? DEFAULT_RULES.studentMinimumPercentage), employeeMinimumPercentage: Number(row?.employeeMinimumPercentage ?? DEFAULT_RULES.employeeMinimumPercentage), halfDayWeight: Number(row?.halfDayWeight ?? .5), lateWeight: Number(row?.lateWeight ?? 1), approvedLeaveWeight: Number(row?.approvedLeaveWeight ?? 0), medicalLeaveWeight: Number(row?.medicalLeaveWeight ?? 0) });

const getRules = async (schoolId) => publicRule(await prisma.attendanceRule.findUnique({ where: { schoolId } }));
const getStatuses = async (schoolId, audience) => {
  let rows = await prisma.attendanceStatusDefinition.findMany({ where: { schoolId, isActive: true, audience: { in: [audience, 'BOTH'] } }, orderBy: [{ displayOrder: 'asc' }, { displayName: 'asc' }] });
  if (!rows.length) {
    const source = audience === 'EMPLOYEE' ? EMPLOYEE_STATUS_DEFAULTS : STUDENT_STATUS_DEFAULTS;
    rows = source.map((item, index) => ({ ...item, id: null, schoolId, audience, displayOrder: index, countsAsAbsent: false, affectsSalary: false, requiresApproval: false, requiresRemark: false, excludedFromWork: false, isActive: true }));
  }
  return rows.map((row) => ({ ...row, attendanceWeight: Number(row.attendanceWeight) }));
};
const auditData = (req, action, entityType, entityId, oldValue, newValue, reason, approvalReference) => ({ schoolId: req.user.schoolId, actorId: req.user.id, actorRole: req.user.role, action, entityType, entityId, oldValue: oldValue || undefined, newValue: newValue || undefined, reason: clean(reason) || null, approvalReference: clean(approvalReference) || null, ipAddress: req.ip, userAgent: req.get('user-agent') });

const sectionContext = async (schoolId, classId, sectionId) => {
  const section = await prisma.section.findFirst({ where: { schoolId, classId, id: sectionId, deletedAt: null }, include: { class: { select: { id: true, className: true } } } });
  if (!section) throw Object.assign(new Error('Section not found in this school'), { statusCode: 404 });
  return section;
};

const sessionContext = async (schoolId, requested, date) => {
  const where = requested ? { schoolId, name: requested } : { schoolId, startDate: { lte: date }, endDate: { gte: date } };
  return prisma.academicSession.findFirst({ where, orderBy: { startDate: 'desc' } });
};

const calendarFor = async (schoolId, start, end, calendarType = 'STUDENT', classId, sectionId) => {
  const [rules, calendarDays, overrides] = await Promise.all([
    getRules(schoolId),
    prisma.academicCalendarDay.findMany({ where: { schoolId, calendarDate: { gte: start, lt: end }, OR: [{ isSchoolWide: true }, { applicableClassIds: { has: classId || '__none__' } }, { applicableSectionIds: { has: sectionId || '__none__' } }] } }),
    prisma.schoolWorkingDay.findMany({ where: { schoolId, calendarDate: { gte: start, lt: end }, calendarType, OR: [{ classId: null }, { classId }, { sectionId }] } }),
  ]);
  return { rules, days: buildWorkingDays({ start, end, weeklyOffDays: rules.weeklyOffDays, calendarDays, overrides }) };
};

export const getAttendanceMetadata = async (req, res) => {
  try {
    if (!req.user.schoolId) return fail(res, 403, 'A school context is required');
    const [rules, studentStatuses, employeeStatuses, sessions] = await Promise.all([getRules(req.user.schoolId), getStatuses(req.user.schoolId, 'STUDENT'), getStatuses(req.user.schoolId, 'EMPLOYEE'), prisma.academicSession.findMany({ where: { schoolId: req.user.schoolId }, orderBy: { startDate: 'desc' }, select: { id: true, name: true, startDate: true, endDate: true, isActive: true } })]);
    return res.json({ success: true, data: { rules, studentStatuses, employeeStatuses, sessions, permissions: { configure: attendancePermission(req.user.role, 'configure'), markStudent: attendancePermission(req.user.role, 'markStudent'), markEmployee: attendancePermission(req.user.role, 'markEmployee'), approve: attendancePermission(req.user.role, 'approve'), lock: attendancePermission(req.user.role, 'lock'), export: attendancePermission(req.user.role, 'export') } } });
  } catch (error) { return fail(res, 500, error.message || 'Failed to load attendance configuration'); }
};

export const updateAttendanceSettings = async (req, res) => {
  try {
    if (!isSchoolAdmin(req.user)) return fail(res, 403, 'Only a school admin or owner can configure attendance');
    const allowed = ['timezone','academicSessionStart','academicSessionEnd','weeklyOffDays','markingDeadline','correctionWindowHours','studentMinimumPercentage','employeeMinimumPercentage','halfDayWeight','lateWeight','approvedLeaveWeight','medicalLeaveWeight','consecutiveAbsenceAlertDays','parentAbsenceNotifications','studentNotifications','requiresFinalSubmission','automaticMonthEndLock','correctionsRequireAdminApproval','payrollIntegrationEnabled'];
    const data = Object.fromEntries(allowed.filter((key) => req.body[key] !== undefined).map((key) => [key, req.body[key]]));
    if (data.timezone) { try { dateInTimezone(new Date(), data.timezone); } catch { return fail(res, 400, 'timezone must be a valid IANA timezone'); } }
    if (data.weeklyOffDays && (!Array.isArray(data.weeklyOffDays) || data.weeklyOffDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6))) return fail(res, 400, 'weeklyOffDays must contain weekday numbers from 0 to 6');
    if (['studentMinimumPercentage','employeeMinimumPercentage'].some((key) => data[key] !== undefined && (!Number.isFinite(Number(data[key])) || Number(data[key]) < 0 || Number(data[key]) > 100))) return fail(res, 400, 'Attendance thresholds must be between 0 and 100');
    if (['halfDayWeight','lateWeight','approvedLeaveWeight','medicalLeaveWeight'].some((key) => data[key] !== undefined && (!Number.isFinite(Number(data[key])) || Number(data[key]) < 0 || Number(data[key]) > 1))) return fail(res, 400, 'Attendance weights must be between 0 and 1');
    for (const key of ['academicSessionStart','academicSessionEnd']) if (data[key]) data[key] = utcDate(data[key]);
    const previous = await prisma.attendanceRule.findUnique({ where: { schoolId: req.user.schoolId } });
    const rule = await prisma.$transaction(async (tx) => {
      const saved = await tx.attendanceRule.upsert({ where: { schoolId: req.user.schoolId }, update: data, create: { schoolId: req.user.schoolId, ...data } });
      await tx.attendanceAuditLog.create({ data: auditData(req, 'SETTINGS_UPDATED', 'ATTENDANCE_RULE', saved.id, previous, saved, req.body.reason) });
      return saved;
    });
    return res.json({ success: true, message: 'Attendance rules updated', data: publicRule(rule) });
  } catch (error) { return fail(res, 400, error.message || 'Failed to update attendance rules'); }
};

export const saveAttendanceStatus = async (req, res) => {
  try {
    if (!isSchoolAdmin(req.user)) return fail(res, 403, 'Only a school admin or owner can configure statuses');
    const code = clean(req.body.code).toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (!code || !clean(req.body.displayName) || !['STUDENT','EMPLOYEE','BOTH'].includes(req.body.audience)) return fail(res, 400, 'Code, display name and a valid audience are required');
    if (code.length > 40 || clean(req.body.displayName).length > 80 || !Number.isFinite(Number(req.body.attendanceWeight)) || Number(req.body.attendanceWeight) < 0 || Number(req.body.attendanceWeight) > 1) return fail(res, 400, 'Status code/name is too long or attendance weight is outside 0 to 1');
    const data = { displayName: clean(req.body.displayName), shortLabel: clean(req.body.shortLabel) || code.slice(0, 3), countsAsPresent: Boolean(req.body.countsAsPresent), countsAsAbsent: Boolean(req.body.countsAsAbsent), attendanceWeight: Number(req.body.attendanceWeight || 0), affectsSalary: Boolean(req.body.affectsSalary), requiresApproval: Boolean(req.body.requiresApproval), requiresRemark: Boolean(req.body.requiresRemark), excludedFromWork: Boolean(req.body.excludedFromWork), audience: req.body.audience, badgeStyle: clean(req.body.badgeStyle) || 'slate', isActive: req.body.isActive !== false, displayOrder: Number(req.body.displayOrder || 0) };
    const status = await prisma.attendanceStatusDefinition.upsert({ where: { schoolId_code: { schoolId: req.user.schoolId, code } }, update: data, create: { schoolId: req.user.schoolId, code, ...data } });
    await prisma.attendanceAuditLog.create({ data: auditData(req, 'STATUS_CONFIGURED', 'ATTENDANCE_STATUS', status.id, null, status, req.body.reason) });
    return res.json({ success: true, message: 'Attendance status saved', data: status });
  } catch (error) { return fail(res, 400, error.message || 'Failed to save attendance status'); }
};

export const saveStudentDailyRegister = async (req, res) => {
  try {
    const schoolId = req.user.schoolId; const date = utcDate(req.body.date); const { classId, sectionId } = req.body;
    if (!schoolId || !date || !classId || !sectionId || !Array.isArray(req.body.records) || !req.body.records.length) return fail(res, 400, 'classId, sectionId, date and records are required');
    if (req.body.records.length > 500) return fail(res, 400, 'A maximum of 500 student records may be submitted at once');
    const rules = await getRules(schoolId);
    if (date > dateInTimezone(new Date(), rules.timezone)) return fail(res, 400, 'Attendance cannot be marked for a future date');
    const section = await sectionContext(schoolId, classId, sectionId);
    await requireSchoolAdminOrClassTeacher(req.user, { schoolId, classId, sectionId });
    const register = await prisma.attendanceDailyRegister.findUnique({ where: { schoolId_classId_sectionId_attendanceDate: { schoolId, classId, sectionId, attendanceDate: date } } });
    if (register?.state === 'LOCKED') return fail(res, 423, 'This attendance register is locked. Raise a correction request.');
    const activeLock = await prisma.attendanceLock.findFirst({ where: { schoolId, isActive: true, periodStart: { lte: date }, periodEnd: { gte: date }, scopeKey: { in: [sectionId, `${classId}:${sectionId}`] } } });
    if (activeLock) return fail(res, 423, 'This attendance period is locked. Raise a correction request.');
    if (!isSchoolAdmin(req.user) && register?.submittedAt && Date.now() - register.submittedAt.getTime() > rules.correctionWindowHours * 3600000) return fail(res, 423, 'The correction window has closed. Raise a correction request.');
    const state = req.body.state === 'SUBMITTED' ? 'SUBMITTED' : 'DRAFT';
    const statuses = await getStatuses(schoolId, 'STUDENT'); const validStatuses = new Map(statuses.map((item) => [item.code, item]));
    const ids = req.body.records.map((row) => row.studentId);
    if (new Set(ids).size !== ids.length) return fail(res, 409, 'Duplicate student records are not allowed');
    const students = await prisma.student.findMany({ where: { schoolId, id: { in: ids }, isActive: true, OR: [{ className: section.class.className, section: section.sectionName, OR: [{ admissionDate: null }, { admissionDate: { lte: date } }] }, { enrollmentHistory: { some: { classId, sectionId, effectiveFrom: { lte: date }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: date } }] } } }] }, select: { id: true, session: true, admissionDate: true } });
    if (students.length !== ids.length) return fail(res, 403, 'One or more students do not belong to this section');
    const normalized = req.body.records.map((row) => { const status = clean(row.status).toUpperCase(); const definition = validStatuses.get(status); const remarks = clean(row.remarks) || null; if (!definition) throw new Error(`Unsupported status: ${status}`); if (remarks?.length > 500) throw new Error('Attendance remarks may not exceed 500 characters'); if (definition.requiresRemark && !remarks) throw new Error(`${definition.displayName} requires a remark`); return { studentId: row.studentId, status, remarks, attendanceUnits: statusWeight(status, {}, statuses), leaveReference: clean(row.leaveReference) || null }; });
    if (state === 'SUBMITTED' && normalized.some((row) => row.status === 'NOT_MARKED')) return fail(res, 400, 'Every enrolled student must be marked before submission');
    const previous = await prisma.studentAttendance.findMany({ where: { schoolId, classId, sectionId, attendanceDate: date, studentId: { in: ids } } });
    const previousById = new Map(previous.map((row) => [row.studentId, row]));
    if (isSchoolAdmin(req.user) && previous.some((old) => normalized.find((row) => row.studentId === old.studentId)?.status !== old.status) && !clean(req.body.reason)) return fail(res, 400, 'An override reason is required when an admin changes attendance');
    const session = await sessionContext(schoolId, req.body.academicSession, date); if (!session) return fail(res, 409, 'Attendance date is outside a configured academic session'); const academicSession = session.name;
    await prisma.$transaction(async (tx) => {
      for (const row of normalized) {
        const old = previousById.get(row.studentId);
        const saved = await tx.studentAttendance.upsert({ where: { schoolId_classId_sectionId_studentId_attendanceDate: { schoolId, classId, sectionId, studentId: row.studentId, attendanceDate: date } }, update: { ...row, markedById: req.user.id, submittedById: state === 'SUBMITTED' ? req.user.id : null, submittedAt: state === 'SUBMITTED' ? new Date() : null, revision: { increment: 1 } }, create: { schoolId, classId, sectionId, attendanceDate: date, academicSession, ...row, markedById: req.user.id, submittedById: state === 'SUBMITTED' ? req.user.id : null, submittedAt: state === 'SUBMITTED' ? new Date() : null } });
        if (!old || old.status !== row.status || old.remarks !== row.remarks) await tx.attendanceAuditLog.create({ data: auditData(req, old ? 'ATTENDANCE_CHANGED' : 'ATTENDANCE_CREATED', 'STUDENT_ATTENDANCE', saved.id, old, saved, req.body.reason) });
      }
      await tx.attendanceDailyRegister.upsert({ where: { schoolId_classId_sectionId_attendanceDate: { schoolId, classId, sectionId, attendanceDate: date } }, update: { state, markedCount: normalized.length, submittedById: state === 'SUBMITTED' ? req.user.id : null, submittedAt: state === 'SUBMITTED' ? new Date() : null, version: { increment: 1 } }, create: { schoolId, academicSession, classId, sectionId, attendanceDate: date, state, markedCount: normalized.length, submittedById: state === 'SUBMITTED' ? req.user.id : null, submittedAt: state === 'SUBMITTED' ? new Date() : null } });
    });
    const absenceRecipients=[...(rules.studentNotifications?['STUDENT']:[]),...(rules.parentAbsenceNotifications?['PARENT']:[])];
    if(absenceRecipients.length)await Promise.allSettled(normalized.filter((row) => row.status === 'ABSENT').map((row) => publishAttendanceEvent({ schoolId, eventType: 'STUDENT_ABSENT', subjectType: 'STUDENT_ATTENDANCE', subjectId: row.studentId, attendanceDate: date, students: [row.studentId], roles:absenceRecipients, priority: 'HIGH', title: 'Absence recorded', message: `Attendance for ${date.toISOString().slice(0,10)} was marked absent.`, actionUrl: '/student/attendance' })));
    if (state === 'SUBMITTED') await publishAttendanceEvent({ schoolId, eventType: 'ATTENDANCE_SUBMITTED', subjectType: 'SECTION_ATTENDANCE', subjectId: `${classId}:${sectionId}`, attendanceDate: date, roles: ['ADMIN','SCHOOL_OWNER'], title: 'Attendance submitted', message: `${section.class.className} · ${section.sectionName} attendance was submitted.`, actionUrl: '/attendance' }).catch(() => null);
    return res.json({ success: true, message: state === 'SUBMITTED' ? 'Attendance submitted' : 'Draft attendance saved', data: { state, savedCount: normalized.length } });
  } catch (error) { if (sendAuthorizationError(res, error)) return; return fail(res, error.statusCode || 400, error.message || 'Failed to save attendance'); }
};

export const getStudentMonthlyReport = async (req, res) => {
  try {
    const schoolId = req.user.schoolId; const range = parseMonth(req.params.month || req.query.month); const { classId, sectionId } = req.params;
    if (!schoolId || !range || !classId || !sectionId) return fail(res, 400, 'A valid class, section and month are required');
    const section = await sectionContext(schoolId, classId, sectionId); await requireSchoolAdminOrAssignedTeacherForSection(req.user, { schoolId, classId, sectionId });
    const session = await sessionContext(schoolId, req.query.academicSession, range.start); if (!session) return fail(res, 409, 'The month is outside a configured academic session');
    if (range.start < utcDate(session.startDate) || range.start > utcDate(session.endDate)) return fail(res, 409, 'The selected month is outside the academic session');
    const cumulativeEnd = range.end < session.endDate ? range.end : new Date(utcDate(session.endDate).getTime() + 86400000);
    const [currentCalendar, cumulativeCalendar, statuses, students, enrollments, currentRows, cumulativeRows, registers, classTeacher, locks] = await Promise.all([
      calendarFor(schoolId, range.start, range.end, 'STUDENT', classId, sectionId), calendarFor(schoolId, utcDate(session.startDate), cumulativeEnd, 'STUDENT', classId, sectionId), getStatuses(schoolId, 'STUDENT'),
      prisma.student.findMany({ where: { schoolId, OR: [{ className: section.class.className, section: section.sectionName }, { enrollmentHistory: { some: { classId, sectionId, academicSession: session.name } } }] }, orderBy: [{ serialNo: 'asc' }, { studentFirstName: 'asc' }] }),
      prisma.studentEnrollmentHistory.findMany({ where: { schoolId, classId, sectionId, academicSession: session.name } }),
      prisma.studentAttendance.findMany({ where: { schoolId, classId, sectionId, attendanceDate: { gte: range.start, lt: range.end } }, orderBy: { attendanceDate: 'asc' } }),
      prisma.studentAttendance.findMany({ where: { schoolId, studentId: { not: '' }, academicSession: session.name, attendanceDate: { gte: session.startDate, lt: cumulativeEnd } }, orderBy: { attendanceDate: 'asc' } }),
      prisma.attendanceDailyRegister.findMany({ where: { schoolId, classId, sectionId, attendanceDate: { gte: range.start, lt: range.end } } }),
      prisma.teacherAssignment.findFirst({ where: { schoolId, classId, sectionId, isActive: true, roleType: { in: ['CLASS_TEACHER','BOTH'] } }, include: { teacher: { select: { id: true, teacherName: true } } } }),
      prisma.attendanceLock.findMany({ where: { schoolId, isActive: true, periodStart: { lt: range.end }, periodEnd: { gte: range.start }, OR: [{ scope: 'SCHOOL' }, { scopeKey: { in: [`${classId}:${sectionId}`, sectionId] } }] } }),
    ]);
    const enrollmentByStudent = new Map(enrollments.map((row) => [row.studentId, row])); const currentByStudent = new Map(); const cumulativeByStudent = new Map();
    currentRows.forEach((row) => currentByStudent.set(row.studentId, [...(currentByStudent.get(row.studentId) || []), row])); cumulativeRows.forEach((row) => cumulativeByStudent.set(row.studentId, [...(cumulativeByStudent.get(row.studentId) || []), row]));
    const rows = students.map((student) => {
      const enrollment = enrollmentByStudent.get(student.id) || { admissionDate: student.admissionDate, effectiveTo: student.isActive ? null : student.updatedAt };
      const sessionEnrollment = { admissionDate: student.admissionDate, effectiveTo: student.isActive ? null : student.updatedAt };
      const selected = summarizeAttendance({ rows: currentByStudent.get(student.id), workingDays: currentCalendar.days, enrollment, rules: currentCalendar.rules, definitions: statuses });
      const cumulative = summarizeAttendance({ rows: cumulativeByStudent.get(student.id), workingDays: cumulativeCalendar.days, enrollment: sessionEnrollment, rules: cumulativeCalendar.rules, definitions: statuses });
      const previousDays = cumulativeCalendar.days.filter((day) => day.date < range.start.toISOString().slice(0, 10)); const previousRows = (cumulativeByStudent.get(student.id) || []).filter((row) => row.attendanceDate < range.start); const previous = summarizeAttendance({ rows: previousRows, workingDays: previousDays, enrollment: sessionEnrollment, rules: cumulativeCalendar.rules, definitions: statuses });
      return { id: student.id, admissionNo: student.admissionNo, rollNumber: student.rollNumber, name: [student.studentFirstName, student.studentLastName].filter(Boolean).join(' '), active: student.isActive, selected, previous, cumulative, warning: cumulative.percentage !== null && cumulative.percentage < currentCalendar.rules.studentMinimumPercentage ? 'NEEDS_SUPPORT' : 'ON_TRACK' };
    });
    const percentages = rows.map((row) => row.selected.percentage).filter((value) => value !== null); const markedWorking = currentCalendar.days.filter((day) => day.isWorkingDay && registers.some((register) => register.attendanceDate.toISOString().slice(0,10) === day.date && ['SUBMITTED','LOCKED'].includes(register.state)));
    const totals = rows.reduce((acc, row) => { acc.present += row.selected.counts.PRESENT || 0; acc.absent += row.selected.counts.ABSENT || 0; acc.leave += (row.selected.counts.APPROVED_LEAVE || 0) + (row.selected.counts.LEAVE || 0); acc.halfDay += row.selected.counts.HALF_DAY || 0; acc.late += row.selected.counts.LATE || 0; return acc; }, { present: 0, absent: 0, leave: 0, halfDay: 0, late: 0 });
    const average = percentages.length ? Math.round(percentages.reduce((a,b) => a+b, 0) / percentages.length * 10) / 10 : null;
    return res.json({ success: true, data: { month: `${range.year}-${String(range.monthIndex+1).padStart(2,'0')}`, academicSession: session, class: section.class, section: { id: section.id, sectionName: section.sectionName }, classTeacher: classTeacher?.teacher || null, workingDays: currentCalendar.days.filter((day) => day.isWorkingDay).reduce((sum, day) => sum + day.weight, 0), markedDays: markedWorking.length, pendingDays: currentCalendar.days.filter((day) => day.isWorkingDay).length - markedWorking.length, holidays: currentCalendar.days.filter((day) => !day.isWorkingDay).length, locked: locks.length > 0, rows, calendar: currentCalendar.days, summary: { totalStudents: rows.length, averagePercentage: average, ...totals, aboveThreshold: rows.filter((row) => row.selected.percentage !== null && row.selected.percentage >= currentCalendar.rules.studentMinimumPercentage).length, belowThreshold: rows.filter((row) => row.selected.percentage !== null && row.selected.percentage < currentCalendar.rules.studentMinimumPercentage).length, highest: percentages.length ? Math.max(...percentages) : null, lowest: percentages.length ? Math.min(...percentages) : null, perfect: percentages.filter((value) => value === 100).length, notCalculated: rows.length - percentages.length, completionRate: currentCalendar.days.filter((day) => day.isWorkingDay).length ? Math.round(markedWorking.length / currentCalendar.days.filter((day) => day.isWorkingDay).length * 1000) / 10 : 100 } } });
  } catch (error) { if (sendAuthorizationError(res, error)) return; return fail(res, error.statusCode || 500, error.message || 'Failed to build monthly report'); }
};

const linkedStudentIds = async (user) => {
  if (!['STUDENT','PARENT'].includes(user.role)) return [];
  const direct = user.studentId ? [user.studentId] : [];
  if (user.role === 'PARENT') {
    const links = await prisma.feeFamilyLink.findMany({ where: { schoolId: user.schoolId, parentUserId: user.id, active: true }, select: { studentId: true } });
    return [...new Set([...direct, ...links.map((row) => row.studentId)])];
  }
  return direct;
};

export const getStudentProfile = async (req, res) => {
  try {
    const schoolId = req.user.schoolId; const studentId = req.params.studentId || req.user.studentId;
    if (!studentId) return fail(res, 400, 'A student is required');
    if (['STUDENT','PARENT'].includes(req.user.role) && !(await linkedStudentIds(req.user)).includes(studentId)) return fail(res, 403, 'You may only view attendance for a linked student');
    const student = await prisma.student.findFirst({ where: { id: studentId, schoolId } }); if (!student) return fail(res, 404, 'Student not found');
    if (req.user.role === 'TEACHER') {
      const section = await prisma.section.findFirst({ where: { schoolId, sectionName: student.section, class: { className: student.className } } }); if (!section) return fail(res, 404, 'Student section not found');
      await requireSchoolAdminOrClassTeacher(req.user, { schoolId, classId: section.classId, sectionId: section.id });
    } else if (!isSchoolAdmin(req.user) && !['STUDENT','PARENT'].includes(req.user.role)) return fail(res, 403, 'You cannot view this student attendance');
    const session = await sessionContext(schoolId, req.query.academicSession, new Date()); if (!session) return fail(res, 404, 'Academic session not found');
    const currentSection = await prisma.section.findFirst({ where: { schoolId, sectionName: student.section, class: { className: student.className } } });
    const configuredSessionEnd = new Date(utcDate(session.endDate).getTime() + 86400000), tomorrow = new Date(utcDate(new Date()).getTime() + 86400000), sessionEnd = configuredSessionEnd < tomorrow ? configuredSessionEnd : tomorrow;
    const [rows, calendar, statuses] = await Promise.all([prisma.studentAttendance.findMany({ where: { schoolId, studentId, academicSession: session.name, attendanceDate: { lt: sessionEnd } }, orderBy: { attendanceDate: 'asc' } }), calendarFor(schoolId, utcDate(session.startDate), sessionEnd, 'STUDENT', currentSection?.classId, currentSection?.id), getStatuses(schoolId, 'STUDENT')]);
    const enrollment = { admissionDate: student.admissionDate, effectiveTo: student.isActive ? null : student.updatedAt };
    const overview = summarizeAttendance({ rows, workingDays: calendar.days, enrollment, rules: calendar.rules, definitions: statuses });
    const monthHistory = []; for (let cursor = new Date(Date.UTC(session.startDate.getUTCFullYear(), session.startDate.getUTCMonth(), 1)); cursor < sessionEnd; cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth()+1, 1))) { const month = cursor.toISOString().slice(0,7), next = new Date(Date.UTC(cursor.getUTCFullYear(),cursor.getUTCMonth()+1,1)); const records=rows.filter((row)=>row.attendanceDate>=cursor&&row.attendanceDate<next), monthDays=calendar.days.filter((day)=>day.date>=month&&day.date<next.toISOString().slice(0,7)); const summary=summarizeAttendance({rows:records,workingDays:monthDays,enrollment,rules:calendar.rules,definitions:statuses});monthHistory.push({month,workingDays:summary.eligibleWorkingDays,present:summary.attendanceUnits,absent:summary.counts.ABSENT||0,leave:(summary.counts.APPROVED_LEAVE||0)+(summary.counts.MEDICAL_LEAVE||0)+(summary.counts.LEAVE||0),percentage:summary.percentage}); }
    return res.json({ success: true, data: { student: { id: student.id, name: [student.studentFirstName,student.studentLastName].filter(Boolean).join(' '), admissionNo: student.admissionNo, className: student.className, section: student.section }, academicSession: session.name, overview: { workingDays: overview.eligibleWorkingDays, attendanceUnits: overview.attendanceUnits, percentage: overview.percentage, counts: overview.counts }, monthlyHistory: monthHistory, records: rows.map((row) => ({ id: row.id, date: row.attendanceDate.toISOString().slice(0,10), status: row.status, remarks: row.remarks, ...(isSchoolAdmin(req.user) || req.user.role === 'TEACHER' ? { markedById: row.markedById, updatedAt: row.updatedAt } : {}) })), alerts: { belowThreshold: overview.percentage !== null && overview.percentage < calendar.rules.studentMinimumPercentage } } });
  } catch (error) { if (sendAuthorizationError(res,error)) return; return fail(res,error.statusCode||500,error.message||'Failed to load student attendance'); }
};

export const getEmployeeMonthlyReport = async (req, res) => {
  try {
    if (!attendancePermission(req.user.role, 'markEmployee')) return fail(res, 403, 'HR or school administration access is required');
    const range = parseMonth(req.params.month || req.query.month); if (!range) return fail(res,400,'Month must use YYYY-MM'); const schoolId=req.user.schoolId;
    const { rules, days } = await calendarFor(schoolId, range.start, range.end, 'EMPLOYEE'); const statuses=await getStatuses(schoolId,'EMPLOYEE');
    const where={schoolId,deletedAt:null,...(req.query.department?{department:req.query.department}:{}),...(req.query.category?{category:req.query.category}:{})};
    const [employees,records]=await Promise.all([prisma.employee.findMany({where,orderBy:[{department:'asc'},{firstName:'asc'}],include:{leaveBalances:{where:{leaveYear:range.year}}}}),prisma.employeeAttendance.findMany({where:{schoolId,attendanceDate:{gte:range.start,lt:range.end}}})]); const byEmployee=new Map(); records.forEach((row)=>byEmployee.set(row.employeeId,[...(byEmployee.get(row.employeeId)||[]),row]));
    const rows=employees.map((employee)=>{const summary=summarizeAttendance({rows:byEmployee.get(employee.id),workingDays:days,enrollment:{effectiveFrom:employee.joiningDate,effectiveTo:employee.exitDate},rules,definitions:statuses});const recs=byEmployee.get(employee.id)||[];return{id:employee.id,employeeId:employee.employeeId,name:[employee.firstName,employee.lastName].filter(Boolean).join(' '),role:employee.designation,department:employee.department,employmentType:employee.employmentType,summary,paidLeave:recs.filter(r=>['PAID_LEAVE','CASUAL_LEAVE','MEDICAL_LEAVE','EARNED_LEAVE','MATERNITY_LEAVE','PATERNITY_LEAVE'].includes(r.status)).length,unpaidLeave:recs.filter(r=>r.status==='UNPAID_LEAVE').length,late:recs.filter(r=>r.status==='LATE').length,earlyExit:recs.filter(r=>r.status==='EARLY_EXIT').length,officialDuty:recs.filter(r=>['OFFICIAL_DUTY','ON_DUTY'].includes(r.status)).length,salaryImpactDays:recs.reduce((sum,r)=>sum+Number(r.salaryImpactDays||0),0),leaveBalance:employee.leaveBalances[0]?Number(employee.leaveBalances[0].opening)+Number(employee.leaveBalances[0].accrued)+Number(employee.leaveBalances[0].adjusted)-Number(employee.leaveBalances[0].used):null,warning:summary.percentage!==null&&summary.percentage<rules.employeeMinimumPercentage};});
    const percentages=rows.map(r=>r.summary.percentage).filter(v=>v!==null); return res.json({success:true,data:{month:req.params.month||req.query.month,workingDays:days.filter(d=>d.isWorkingDay).reduce((s,d)=>s+d.weight,0),rows,summary:{totalEmployees:rows.length,averagePercentage:percentages.length?Math.round(percentages.reduce((a,b)=>a+b,0)/percentages.length*10)/10:null,totalPresent:records.filter(r=>r.status==='PRESENT').length,totalAbsent:records.filter(r=>r.status==='ABSENT').length,totalPaidLeave:rows.reduce((s,r)=>s+r.paidLeave,0),totalUnpaidLeave:rows.reduce((s,r)=>s+r.unpaidLeave,0),totalHalfDays:records.filter(r=>r.status==='HALF_DAY').length,totalLate:rows.reduce((s,r)=>s+r.late,0),payrollDeductionDays:rows.reduce((s,r)=>s+r.salaryImpactDays,0),belowThreshold:rows.filter(r=>r.warning).length}}});
  } catch(error){return fail(res,500,error.message||'Failed to build employee attendance report');}
};

export const saveEmployeeAttendance = async (req,res)=>{
  try{if(!attendancePermission(req.user.role,'markEmployee'))return fail(res,403,'HR or school administration access is required');const schoolId=req.user.schoolId,date=utcDate(req.body.date),records=Array.isArray(req.body.records)?req.body.records:[];if(!date||!records.length)return fail(res,400,'Date and employee records are required');if(date>utcDate(new Date()))return fail(res,400,'Attendance cannot be marked for a future date');const activeLock=await prisma.attendanceLock.findFirst({where:{schoolId,isActive:true,scope:'EMPLOYEE_MONTH',periodStart:{lte:date},periodEnd:{gte:date}}});if(activeLock)return fail(res,423,'This employee attendance period is locked');const ids=records.map(r=>r.employeeId);if(new Set(ids).size!==ids.length)return fail(res,409,'Duplicate employee records are not allowed');const employees=await prisma.employee.findMany({where:{schoolId,id:{in:ids},deletedAt:null}});if(employees.length!==ids.length)return fail(res,403,'One or more employees do not belong to this school');const statuses=await getStatuses(schoolId,'EMPLOYEE'),valid=new Map(statuses.map(s=>[s.code,s]));await prisma.$transaction(async tx=>{for(const input of records){const status=clean(input.status).toUpperCase(),definition=valid.get(status);if(!definition)throw new Error(`Unsupported status: ${status}`);if(definition.requiresRemark&&!clean(input.remarks))throw new Error(`${definition.displayName} requires a remark`);const previous=await tx.employeeAttendance.findUnique({where:{schoolId_employeeId_attendanceDate:{schoolId,employeeId:input.employeeId,attendanceDate:date}}});if(previous?.lockedAt)return Promise.reject(new Error('A locked employee attendance record cannot be changed'));const data={status,remarks:clean(input.remarks)||null,attendanceUnits:statusWeight(status,{},statuses),salaryImpactDays:definition.affectsSalary?Number(input.salaryImpactDays??1):0,minutesLate:Number(input.minutesLate||0),minutesEarlyExit:Number(input.minutesEarlyExit||0),checkIn:input.checkIn?new Date(input.checkIn):null,checkOut:input.checkOut?new Date(input.checkOut):null,leaveReference:clean(input.leaveReference)||null,markedById:req.user.id,source:'MANUAL'};const saved=await tx.employeeAttendance.upsert({where:{schoolId_employeeId_attendanceDate:{schoolId,employeeId:input.employeeId,attendanceDate:date}},update:data,create:{schoolId,employeeId:input.employeeId,attendanceDate:date,...data}});await tx.attendanceAuditLog.create({data:auditData(req,previous?'EMPLOYEE_ATTENDANCE_CHANGED':'EMPLOYEE_ATTENDANCE_CREATED','EMPLOYEE_ATTENDANCE',saved.id,previous,saved,req.body.reason)});}});return res.json({success:true,message:`Attendance saved for ${records.length} employees`});}catch(error){return fail(res,400,error.message||'Failed to save employee attendance');}
};

export const createCorrectionRequest = async (req,res)=>{
  if (!['STUDENT','PARENT','TEACHER','STAFF','HR','ADMIN','SCHOOL_OWNER'].includes(req.user.role)) return fail(res,403,'You cannot request attendance corrections');
  if (req.user.role === 'HR' && clean(req.body.personType).toUpperCase() !== 'EMPLOYEE') return fail(res,403,'HR correction access is limited to employee attendance');
  if (clean(req.body.reason).length > 1000) return fail(res,400,'Correction reason may not exceed 1000 characters');
  if (req.body.evidenceUrl) { try { if (new URL(req.body.evidenceUrl).protocol !== 'https:') return fail(res,400,'Evidence URL must use HTTPS'); } catch { return fail(res,400,'Evidence URL is invalid'); } }
  try{const schoolId=req.user.schoolId,date=utcDate(req.body.date),personType=clean(req.body.personType).toUpperCase(),personId=clean(req.body.personId),reason=clean(req.body.reason),requestedStatus=clean(req.body.requestedStatus).toUpperCase();if(!date||!['STUDENT','EMPLOYEE'].includes(personType)||!personId||!reason||!requestedStatus)return fail(res,400,'Person, date, requested status and reason are required');if(personType==='STUDENT'&&['STUDENT','PARENT'].includes(req.user.role)&&!(await linkedStudentIds(req.user)).includes(personId))return fail(res,403,'You may only request corrections for a linked student');let record;if(personType==='STUDENT'){record=await prisma.studentAttendance.findFirst({where:{schoolId,studentId:personId,attendanceDate:date}});if(record&&req.user.role==='TEACHER')await requireSchoolAdminOrClassTeacher(req.user,{schoolId,classId:record.classId,sectionId:record.sectionId});}else{const employee=await prisma.employee.findFirst({where:{schoolId,id:personId,...(!attendancePermission(req.user.role,'markEmployee')?{OR:[{userId:req.user.id},...(req.user.employeeId?[{employeeId:req.user.employeeId}]:[]),...(req.user.email?[{email:req.user.email}]:[])]}:{})}});if(!employee)return fail(res,403,'You may only request a correction for your own attendance');record=await prisma.employeeAttendance.findFirst({where:{schoolId,employeeId:personId,attendanceDate:date}});}if(!record)return fail(res,404,'Attendance record not found');const validStatuses=await getStatuses(schoolId,personType);if(!validStatuses.some(item=>item.code===requestedStatus))return fail(res,400,'Requested attendance status is not available');const duplicate=await prisma.attendanceCorrectionRequest.findFirst({where:{schoolId,personType,personId,attendanceDate:date,status:'PENDING'}});if(duplicate)return fail(res,409,'A correction request is already pending for this date');const request=await prisma.attendanceCorrectionRequest.create({data:{schoolId,personType,personId,attendanceDate:date,studentAttendanceId:personType==='STUDENT'?record.id:null,employeeAttendanceId:personType==='EMPLOYEE'?record.id:null,existingStatus:record.status,requestedStatus,reason,evidenceUrl:clean(req.body.evidenceUrl)||null,requestedById:req.user.id}});return res.status(201).json({success:true,message:'Correction request submitted',data:request});}catch(error){if(sendAuthorizationError(res,error))return;return fail(res,400,error.message||'Failed to create correction request');}
};

export const listCorrectionRequests=async(req,res)=>{try{const own=!attendancePermission(req.user.role,'approve');const requests=await prisma.attendanceCorrectionRequest.findMany({where:{schoolId:req.user.schoolId,...(req.query.status?{status:req.query.status}:{}),...(req.user.role==='HR'?{personType:'EMPLOYEE'}:{}),...(own?{requestedById:req.user.id}:{})},orderBy:{createdAt:'desc'},take:200});return res.json({success:true,data:requests});}catch(error){return fail(res,500,error.message||'Failed to load correction requests');}};

export const reviewCorrectionRequest=async(req,res)=>{
  try{
    if(!attendancePermission(req.user.role,'approve'))return fail(res,403,'You cannot review correction requests');
    const decision=clean(req.body.decision).toUpperCase();if(!['APPROVED','REJECTED'].includes(decision))return fail(res,400,'Decision must be APPROVED or REJECTED');
    const request=await prisma.attendanceCorrectionRequest.findFirst({where:{id:req.params.id,schoolId:req.user.schoolId,status:'PENDING'}});if(!request)return fail(res,404,'Pending correction request not found');
    if(req.user.role==='HR'&&request.personType!=='EMPLOYEE')return fail(res,403,'HR may review employee attendance corrections only');
    const definitions=await getStatuses(req.user.schoolId,request.personType);
    await prisma.$transaction(async tx=>{if(decision==='APPROVED'){if(request.personType==='STUDENT')await tx.studentAttendance.update({where:{id:request.studentAttendanceId},data:{status:request.requestedStatus,attendanceUnits:statusWeight(request.requestedStatus,{},definitions),revision:{increment:1}}});else await tx.employeeAttendance.update({where:{id:request.employeeAttendanceId},data:{status:request.requestedStatus,attendanceUnits:statusWeight(request.requestedStatus,{},definitions)}});}const saved=await tx.attendanceCorrectionRequest.update({where:{id:request.id},data:{status:decision,reviewedById:req.user.id,reviewedAt:new Date(),reviewRemark:clean(req.body.reviewRemark)||null}});await tx.attendanceAuditLog.create({data:auditData(req,`CORRECTION_${decision}`,'ATTENDANCE_CORRECTION',request.id,request,saved,req.body.reviewRemark)});});
    if(request.personType==='STUDENT')await publishAttendanceEvent({schoolId:req.user.schoolId,eventType:`CORRECTION_${decision}`,subjectType:'STUDENT_ATTENDANCE',subjectId:request.personId,attendanceDate:request.attendanceDate,students:[request.personId],title:`Attendance correction ${decision.toLowerCase()}`,message:`Your attendance correction for ${request.attendanceDate.toISOString().slice(0,10)} was ${decision.toLowerCase()}.`,actionUrl:'/student/attendance'}).catch(()=>null);
    return res.json({success:true,message:`Correction request ${decision.toLowerCase()}`});
  }catch(error){return fail(res,400,error.message||'Failed to review correction request');}
};

export const lockAttendance=async(req,res)=>{
  try{
    if(!attendancePermission(req.user.role,'lock'))return fail(res,403,'You cannot lock attendance');
    const start=utcDate(req.body.periodStart),end=utcDate(req.body.periodEnd),scope=clean(req.body.scope).toUpperCase(),scopeKey=clean(req.body.scopeKey),reason=clean(req.body.reason);
    if(req.user.role==='HR'&&scope!=='EMPLOYEE_MONTH')return fail(res,403,'HR may lock employee attendance months only');
    if(!start||!end||end<start||!['DAY','MONTH','SECTION','EMPLOYEE_MONTH','SESSION'].includes(scope)||!scopeKey||!reason)return fail(res,400,'Valid scope, scope key, period and reason are required');
    const pending=await prisma.attendanceCorrectionRequest.count({where:{schoolId:req.user.schoolId,status:'PENDING',attendanceDate:{gte:start,lte:end}}});
    if(pending&&!req.body.confirmPending)return fail(res,409,`${pending} correction request(s) are pending`);
    if(['MONTH','SECTION'].includes(scope)&&scopeKey.includes(':')){const [classId,sectionId]=scopeKey.split(':');const calendar=await calendarFor(req.user.schoolId,start,new Date(end.getTime()+86400000),'STUDENT',classId,sectionId);const expected=calendar.days.filter(day=>day.isWorkingDay).length;const completed=await prisma.attendanceDailyRegister.count({where:{schoolId:req.user.schoolId,classId,sectionId,attendanceDate:{gte:start,lte:end},state:{in:['SUBMITTED','LOCKED']}}});if(completed<expected&&!req.body.confirmIncomplete)return fail(res,409,`${expected-completed} working date(s) are incomplete`);}
    const lock=await prisma.attendanceLock.create({data:{schoolId:req.user.schoolId,academicSession:clean(req.body.academicSession)||sessionNameFor(start),scope,scopeKey,periodStart:start,periodEnd:end,lockedById:req.user.id}});
    await prisma.attendanceAuditLog.create({data:auditData(req,'ATTENDANCE_LOCKED','ATTENDANCE_LOCK',lock.id,null,lock,reason)});
    return res.status(201).json({success:true,message:'Attendance period locked',data:lock});
  }catch(error){return fail(res,400,error.message||'Failed to lock attendance');}
};

export const unlockAttendance=async(req,res)=>{try{if(!attendancePermission(req.user.role,'lock'))return fail(res,403,'You cannot unlock attendance');const reason=clean(req.body.reason),approvalReference=clean(req.body.approvalReference);if(!reason||!approvalReference)return fail(res,400,'Unlock reason and approval reference are required');const existing=await prisma.attendanceLock.findFirst({where:{id:req.params.id,schoolId:req.user.schoolId,isActive:true}});if(!existing)return fail(res,404,'Active lock not found');if(req.user.role==='HR'&&existing.scope!=='EMPLOYEE_MONTH')return fail(res,403,'HR may unlock employee attendance months only');const lock=await prisma.attendanceLock.update({where:{id:existing.id},data:{isActive:false,unlockedAt:new Date(),unlockedById:req.user.id,unlockReason:reason,approvalReference}});await prisma.attendanceAuditLog.create({data:auditData(req,'ATTENDANCE_UNLOCKED','ATTENDANCE_LOCK',lock.id,existing,lock,reason,approvalReference)});return res.json({success:true,message:'Attendance period unlocked'});}catch(error){return fail(res,400,error.message||'Failed to unlock attendance');}};

export const getAttendanceDashboard=async(req,res)=>{try{const schoolId=req.user.schoolId,today=utcDate(new Date()),tomorrow=new Date(today.getTime()+86400000),monthStart=new Date(Date.UTC(today.getUTCFullYear(),today.getUTCMonth(),1));const [studentRows,employeeRows,sections,registers,corrections,rules]=await Promise.all([prisma.studentAttendance.findMany({where:{schoolId,attendanceDate:today}}),prisma.employeeAttendance.findMany({where:{schoolId,attendanceDate:today},include:{employee:{select:{firstName:true,lastName:true,department:true}}}}),prisma.section.count({where:{schoolId,deletedAt:null}}),prisma.attendanceDailyRegister.findMany({where:{schoolId,attendanceDate:today}}),prisma.attendanceCorrectionRequest.count({where:{schoolId,status:'PENDING'}}),getRules(schoolId)]);const units=studentRows.reduce((s,r)=>s+Number(r.attendanceUnits??statusWeight(r.status)),0),employeeUnits=employeeRows.reduce((s,r)=>s+Number(r.attendanceUnits??statusWeight(r.status)),0);return res.json({success:true,data:{date:today.toISOString().slice(0,10),students:{marked:studentRows.length,attendanceRate:studentRows.length?Math.round(units/studentRows.length*1000)/10:null,absent:studentRows.filter(r=>r.status==='ABSENT').length},employees:{marked:employeeRows.length,attendanceRate:employeeRows.length?Math.round(employeeUnits/employeeRows.length*1000)/10:null,absent:employeeRows.filter(r=>r.status==='ABSENT').map(r=>({id:r.employeeId,name:[r.employee.firstName,r.employee.lastName].filter(Boolean).join(' '),department:r.employee.department}))},completion:{sections,totalSubmitted:registers.filter(r=>['SUBMITTED','LOCKED'].includes(r.state)).length,pending:Math.max(0,sections-registers.filter(r=>['SUBMITTED','LOCKED'].includes(r.state)).length)},pendingCorrections:corrections,thresholds:{student:rules.studentMinimumPercentage,employee:rules.employeeMinimumPercentage},monthStart,tomorrow}});}catch(error){return fail(res,500,error.message||'Failed to load attendance dashboard');}};

export const getAttendanceAudit=async(req,res)=>{try{if(!attendancePermission(req.user.role,'audit'))return fail(res,403,'You cannot view attendance audit history');const entityFilter=req.user.role==='HR'?{entityType:{in:['EMPLOYEE_ATTENDANCE','ATTENDANCE_CORRECTION','ATTENDANCE_LOCK']}}:(req.query.entityType?{entityType:req.query.entityType}:{});const rows=await prisma.attendanceAuditLog.findMany({where:{schoolId:req.user.schoolId,...entityFilter,...(req.query.entityId?{entityId:req.query.entityId}:{})},orderBy:{createdAt:'desc'},take:Math.min(500,Number(req.query.limit)||100)});return res.json({success:true,data:rows});}catch(error){return fail(res,500,error.message||'Failed to load attendance audit history');}};

export const exportAttendanceCsv=async(req,res)=>{
  try{
    if(!attendancePermission(req.user.role,'export'))return fail(res,403,'You cannot export attendance reports');
    const range=parseMonth(req.query.month);if(!range)return fail(res,400,'Month must use YYYY-MM');
    const schoolId=req.user.schoolId,kind=req.query.kind==='employees'?'employees':'students';
    if(req.user.role==='HR'&&kind!=='employees')return fail(res,403,'HR export access is limited to employee attendance');
    const [school,rules]=await Promise.all([prisma.school.findUnique({where:{id:schoolId},select:{schoolName:true}}),getRules(schoolId)]);
    let lines;
    if(kind==='employees'){
      const records=await prisma.employeeAttendance.findMany({where:{schoolId,attendanceDate:{gte:range.start,lt:range.end}},include:{employee:true},orderBy:[{attendanceDate:'asc'}]});
      lines=[['Date','Employee ID','Employee','Department','Status','Units','Salary impact','Remarks'],...records.map(r=>[r.attendanceDate.toISOString().slice(0,10),r.employee.employeeId,[r.employee.firstName,r.employee.lastName].filter(Boolean).join(' '),r.employee.department,r.status,r.attendanceUnits,r.salaryImpactDays,r.remarks||''])];
    }else{
      const records=await prisma.studentAttendance.findMany({where:{schoolId,attendanceDate:{gte:range.start,lt:range.end}},include:{student:true,class:true,section:true},orderBy:[{attendanceDate:'asc'}]});
      lines=[['Date','Admission no','Student','Class','Section','Status','Units','Remarks'],...records.map(r=>[r.attendanceDate.toISOString().slice(0,10),r.student.admissionNo||'',[r.student.studentFirstName,r.student.studentLastName].filter(Boolean).join(' '),r.class.className,r.section.sectionName,r.status,r.attendanceUnits,r.remarks||''])];
    }
    const preamble=[['School',school?.schoolName||'SchoolOS'],['Report',kind==='employees'?'Employee attendance':'Student attendance'],['Month',req.query.month],['Generated at',new Date().toISOString()],['Generated by',req.user.name||req.user.email||req.user.id],['Timezone',rules.timezone],['Calculation','Attendance units / eligible working days × 100'],[]];
    const csv=[...preamble,...lines].map(row=>row.map(value=>`"${String(value??'').replace(/"/g,'""')}"`).join(',')).join('\r\n');
    res.setHeader('Content-Type','text/csv; charset=utf-8');res.setHeader('Content-Disposition',`attachment; filename="attendance-${kind}-${req.query.month}.csv"`);return res.send(`\uFEFF${csv}`);
  }catch(error){return fail(res,500,error.message||'Failed to export attendance');}
};
