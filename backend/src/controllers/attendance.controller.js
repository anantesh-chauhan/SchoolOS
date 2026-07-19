import prisma from '../config/prisma.client.js';
import { createSystemNotification } from '../modules/communication/communication.service.js';
import {
  assertTeacherIsClassTeacherForSection,
  isSchoolAdmin,
  requireSchoolAdminOrClassTeacher,
  sendAuthorizationError,
} from '../utils/teacherAuthorization.util.js';

const VALID_ATTENDANCE_STATUSES = new Set(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE']);
const VALID_DAY_TYPES = new Set(['WORKING_DAY', 'HOLIDAY', 'WEEKLY_OFF', 'EXAM', 'EVENT', 'VACATION']);

const normalizeDate = (value) => {
  const source = value ? new Date(value) : new Date();
  if (Number.isNaN(source.getTime())) return null;
  return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
};

const normalizeStatus = (value) => {
  const normalized = String(value || 'PRESENT').trim().toUpperCase().replace(/\s+/g, '_');
  return VALID_ATTENDANCE_STATUSES.has(normalized) ? normalized : null;
};

const sessionForDate = (date) => {
  const year = date.getUTCFullYear();
  const startYear = date.getUTCMonth() >= 3 ? year : year - 1;
  return `${startYear}-${String(startYear + 1).slice(-2)}`;
};

const monthRange = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (month < 0 || month > 11) return null;
  return { start: new Date(Date.UTC(year, month, 1)), end: new Date(Date.UTC(year, month + 1, 1)) };
};

const getSectionOr404 = async ({ schoolId, classId, sectionId }) => {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, classId, schoolId, deletedAt: null },
    include: { class: { select: { id: true, className: true, classOrder: true } } },
  });

  if (!section) {
    const error = new Error('Section not found for this school and class');
    error.statusCode = 404;
    throw error;
  }

  return section;
};

const getSectionStudents = async (section) => prisma.student.findMany({
  where: {
    schoolId: section.schoolId,
    className: section.class.className,
    section: section.sectionName,
    isActive: true,
  },
  orderBy: [{ serialNo: 'asc' }, { studentFirstName: 'asc' }],
});

export const getStudentAttendanceRoster = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { classId, sectionId } = req.query;
    const attendanceDate = normalizeDate(req.query.date);

    if (!schoolId || !classId || !sectionId || !attendanceDate) {
      return res.status(400).json({ success: false, message: 'classId, sectionId and valid date are required' });
    }

    const section = await getSectionOr404({ schoolId, classId, sectionId });
    await requireSchoolAdminOrClassTeacher(req.user, { schoolId, classId, sectionId });

    const [students, attendanceRows, classTeacher] = await Promise.all([
      getSectionStudents(section),
      prisma.studentAttendance.findMany({ where: { schoolId, classId, sectionId, attendanceDate } }),
      prisma.teacherAssignment.findFirst({
        where: { schoolId, classId, sectionId, isActive: true, roleType: { in: ['CLASS_TEACHER', 'BOTH'] } },
        include: { teacher: { select: { id: true, teacherName: true, employeeId: true } } },
      }),
    ]);

    const attendanceByStudentId = new Map(attendanceRows.map((row) => [row.studentId, row]));

    return res.json({
      success: true,
      data: {
        date: attendanceDate,
        canMark: req.user.role === 'TEACHER',
        class: section.class,
        section: { id: section.id, sectionName: section.sectionName, sectionOrder: section.sectionOrder },
        classTeacher: classTeacher?.teacher || null,
        students: students.map((student) => {
          const attendance = attendanceByStudentId.get(student.id);
          return {
            id: student.id,
            admissionNo: student.admissionNo,
            name: [student.studentFirstName, student.studentLastName].filter(Boolean).join(' '),
            rollNumber: student.rollNumber,
            status: attendance?.status || 'PRESENT',
            remarks: attendance?.remarks || '',
            attendanceId: attendance?.id || null,
          };
        }),
      },
    });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to load attendance roster',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const markStudentAttendance = async (req, res) => {
  try {
    if (req.user.role !== 'TEACHER') {
      return res.status(403).json({ success: false, message: 'Only the class teacher can mark student attendance' });
    }

    const schoolId = req.user.schoolId;
    const { classId, sectionId, records = [] } = req.body;
    const attendanceDate = normalizeDate(req.body.date);

    if (!schoolId || !classId || !sectionId || !attendanceDate || !Array.isArray(records)) {
      return res.status(400).json({ success: false, message: 'classId, sectionId, date and records[] are required' });
    }

    const section = await getSectionOr404({ schoolId, classId, sectionId });
    await assertTeacherIsClassTeacherForSection(req.user, { schoolId, classId, sectionId });
    const students = await getSectionStudents(section);
    const studentIds = new Set(students.map((student) => student.id));

    const normalizedRecords = records.map((record) => ({
      studentId: record.studentId,
      status: normalizeStatus(record.status),
      remarks: String(record.remarks || '').trim() || null,
    }));

    if (normalizedRecords.some((record) => !studentIds.has(record.studentId) || !record.status)) {
      return res.status(409).json({ success: false, message: 'Attendance contains invalid students or statuses' });
    }

    const previousRows = await prisma.studentAttendance.findMany({ where: { schoolId, classId, sectionId, studentId: { in: normalizedRecords.map((record) => record.studentId) }, attendanceDate }, select: { studentId: true, status: true } });
    const previous = new Map(previousRows.map((row) => [row.studentId, row.status]));
    await prisma.$transaction(
      normalizedRecords.map((record) => prisma.studentAttendance.upsert({
        where: {
          schoolId_classId_sectionId_studentId_attendanceDate: {
            schoolId,
            classId,
            sectionId,
            studentId: record.studentId,
            attendanceDate,
          },
        },
        update: {
          status: record.status,
          remarks: record.remarks,
          markedById: req.user.id,
        },
        create: {
          schoolId,
          classId,
          sectionId,
          studentId: record.studentId,
          attendanceDate,
          academicSession: students.find((student) => student.id === record.studentId)?.session || sessionForDate(attendanceDate),
          status: record.status,
          remarks: record.remarks,
          markedById: req.user.id,
        },
      }))
    );

    const day = attendanceDate.toISOString().slice(0, 10);
    await Promise.all(normalizedRecords.filter((record) => ['ABSENT','LATE'].includes(record.status) || (previous.has(record.studentId) && previous.get(record.studentId) !== record.status)).map((record) => {
      const corrected = previous.has(record.studentId) && previous.get(record.studentId) !== record.status;
      return createSystemNotification({ schoolId, type: corrected ? 'ATTENDANCE_CORRECTED' : `ATTENDANCE_${record.status}`, category: 'ATTENDANCE', priority: record.status === 'ABSENT' ? 'HIGH' : 'NORMAL', title: corrected ? 'Attendance corrected' : record.status === 'ABSENT' ? 'Absence recorded' : 'Late arrival recorded', message: corrected ? `Attendance for ${day} was changed from ${previous.get(record.studentId)} to ${record.status}.` : `Attendance status for ${day}: ${record.status}.`, actionUrl: '/student/attendance', sourceModule: 'ATTENDANCE', sourceEntityType: 'STUDENT_ATTENDANCE', sourceEntityId: `${record.studentId}:${day}`, dedupeKey: `${corrected ? 'CORRECTED' : record.status}:${record.studentId}:${day}:${record.status}`, students: [record.studentId], mandatory: record.status === 'ABSENT' });
    }));

    return res.json({ success: true, message: 'Student attendance saved' });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to save student attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getTeacherAttendanceRoster = async (req, res) => {
  try {
    if (!isSchoolAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins can view teacher attendance' });
    }

    const schoolId = req.user.schoolId;
    const attendanceDate = normalizeDate(req.query.date);
    if (!schoolId || !attendanceDate) {
      return res.status(400).json({ success: false, message: 'A valid date is required' });
    }

    const [teachers, attendanceRows] = await Promise.all([
      prisma.teacher.findMany({
        where: { schoolId, deletedAt: null },
        orderBy: { teacherName: 'asc' },
      }),
      prisma.teacherAttendance.findMany({ where: { schoolId, attendanceDate } }),
    ]);

    const attendanceByTeacherId = new Map(attendanceRows.map((row) => [row.teacherId, row]));

    return res.json({
      success: true,
      data: {
        date: attendanceDate,
        teachers: teachers.map((teacher) => {
          const attendance = attendanceByTeacherId.get(teacher.id);
          return {
            id: teacher.id,
            teacherName: teacher.teacherName,
            employeeId: teacher.employeeId,
            specialization: teacher.specialization,
            status: attendance?.status || 'PRESENT',
            remarks: attendance?.remarks || '',
            attendanceId: attendance?.id || null,
          };
        }),
      },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to load teacher attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const markTeacherAttendance = async (req, res) => {
  try {
    if (!isSchoolAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Only admins can mark teacher attendance' });
    }

    const schoolId = req.user.schoolId;
    const attendanceDate = normalizeDate(req.body.date);
    const records = Array.isArray(req.body.records) ? req.body.records : [];

    if (!schoolId || !attendanceDate) {
      return res.status(400).json({ success: false, message: 'A valid date is required' });
    }
    if (records.length === 0) {
      return res.status(400).json({ success: false, message: 'At least one teacher attendance record is required' });
    }

    const teachers = await prisma.teacher.findMany({
      where: { schoolId, deletedAt: null },
      select: { id: true },
    });
    const teacherIds = new Set(teachers.map((teacher) => teacher.id));
    const normalizedRecords = records.map((record) => ({
      teacherId: record.teacherId,
      status: normalizeStatus(record.status),
      remarks: String(record.remarks || '').trim() || null,
    }));
    const submittedTeacherIds = normalizedRecords.map((record) => record.teacherId);

    if (normalizedRecords.some((record) => !teacherIds.has(record.teacherId) || !record.status)) {
      return res.status(409).json({ success: false, message: 'Attendance contains invalid teachers or statuses' });
    }
    if (new Set(submittedTeacherIds).size !== submittedTeacherIds.length) {
      return res.status(409).json({ success: false, message: 'Attendance contains duplicate teacher records' });
    }

    await prisma.$transaction(
      normalizedRecords.map((record) => prisma.teacherAttendance.upsert({
        where: {
          schoolId_teacherId_attendanceDate: {
            schoolId,
            teacherId: record.teacherId,
            attendanceDate,
          },
        },
        update: {
          status: record.status,
          remarks: record.remarks,
          markedById: req.user.id,
        },
        create: {
          schoolId,
          teacherId: record.teacherId,
          attendanceDate,
          academicSession: String(req.body.academicSession || sessionForDate(attendanceDate)),
          status: record.status,
          remarks: record.remarks,
          markedById: req.user.id,
        },
      }))
    );

    return res.json({
      success: true,
      message: `Attendance saved for ${normalizedRecords.length} teacher${normalizedRecords.length === 1 ? '' : 's'}`,
      data: { date: attendanceDate.toISOString().slice(0, 10), savedCount: normalizedRecords.length },
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to save teacher attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getClassAttendanceMonth = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { classId, sectionId } = req.query;
    const range = monthRange(req.query.month);
    if (!schoolId || !classId || !sectionId || !range) {
      return res.status(400).json({ success: false, message: 'classId, sectionId and month (YYYY-MM) are required' });
    }
    const section = await getSectionOr404({ schoolId, classId, sectionId });
    await requireSchoolAdminOrClassTeacher(req.user, { schoolId, classId, sectionId });
    const [students, rows, calendar] = await Promise.all([
      getSectionStudents(section),
      prisma.studentAttendance.findMany({
        where: { schoolId, classId, sectionId, attendanceDate: { gte: range.start, lt: range.end } },
        select: { studentId: true, attendanceDate: true, status: true },
      }),
      prisma.academicCalendarDay.findMany({
        where: { schoolId, calendarDate: { gte: range.start, lt: range.end } }, orderBy: { calendarDate: 'asc' },
      }),
    ]);
    const daysInMonth = Math.round((range.end - range.start) / 86400000);
    const byDay = new Map();
    rows.forEach((row) => {
      const key = row.attendanceDate.toISOString().slice(0, 10);
      const counts = byDay.get(key) || { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, LEAVE: 0, marked: 0 };
      counts[row.status] += 1; counts.marked += 1; byDay.set(key, counts);
    });
    const calendarByDay = new Map(calendar.map((day) => [day.calendarDate.toISOString().slice(0, 10), day]));
    const days = Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(range.start.getTime() + index * 86400000);
      const key = date.toISOString().slice(0, 10);
      const marker = calendarByDay.get(key);
      const weekend = date.getUTCDay() === 0;
      return { date: key, dayType: marker?.dayType || (weekend ? 'WEEKLY_OFF' : 'WORKING_DAY'), title: marker?.title || (weekend ? 'Sunday' : null), counts: { ...(byDay.get(key) || { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, LEAVE: 0, marked: 0 }), total: students.length } };
    });
    return res.json({ success: true, data: { month: req.query.month, academicSession: String(req.query.academicSession || sessionForDate(range.start)), class: section.class, section: { id: section.id, sectionName: section.sectionName }, totalStudents: students.length, days } });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to load monthly attendance' });
  }
};

const summarizeRows = (rows, idKey) => {
  const summary = new Map();
  rows.forEach((row) => {
    const id = row[idKey];
    const counts = summary.get(id) || { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, LEAVE: 0, markedDays: 0 };
    counts[row.status] += 1;
    counts.markedDays += 1;
    summary.set(id, counts);
  });
  return summary;
};

const withPercentage = (counts = {}) => {
  const markedDays = counts.markedDays || 0;
  const attended = (counts.PRESENT || 0) + (counts.LATE || 0) + (counts.HALF_DAY || 0) * 0.5;
  return { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, LEAVE: 0, markedDays: 0, ...counts, percentage: markedDays ? Math.round((attended / markedDays) * 1000) / 10 : 0 };
};

export const getClassMonthlyRegister = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const { classId, sectionId } = req.query;
    const range = monthRange(req.query.month);
    if (!schoolId || !classId || !sectionId || !range) return res.status(400).json({ success: false, message: 'classId, sectionId and month are required' });
    const section = await getSectionOr404({ schoolId, classId, sectionId });
    await requireSchoolAdminOrClassTeacher(req.user, { schoolId, classId, sectionId });
    const [students, rows] = await Promise.all([
      getSectionStudents(section),
      prisma.studentAttendance.findMany({ where: { schoolId, classId, sectionId, attendanceDate: { gte: range.start, lt: range.end } }, select: { studentId: true, status: true } }),
    ]);
    const summary = summarizeRows(rows, 'studentId');
    return res.json({ success: true, data: { month: req.query.month, class: section.class, section: { id: section.id, sectionName: section.sectionName }, students: students.map((student) => ({ id: student.id, admissionNo: student.admissionNo, rollNumber: student.rollNumber, name: [student.studentFirstName, student.studentLastName].filter(Boolean).join(' '), ...withPercentage(summary.get(student.id)) })) } });
  } catch (error) {
    if (sendAuthorizationError(res, error)) return;
    return res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Failed to load class register' });
  }
};

export const getTeacherMonthlyRegister = async (req, res) => {
  try {
    if (!isSchoolAdmin(req.user)) return res.status(403).json({ success: false, message: 'Only admins can view the teacher register' });
    const range = monthRange(req.query.month);
    if (!range) return res.status(400).json({ success: false, message: 'month (YYYY-MM) is required' });
    const [teachers, rows] = await Promise.all([
      prisma.teacher.findMany({ where: { schoolId: req.user.schoolId, deletedAt: null }, orderBy: { teacherName: 'asc' } }),
      prisma.teacherAttendance.findMany({ where: { schoolId: req.user.schoolId, attendanceDate: { gte: range.start, lt: range.end } }, select: { teacherId: true, status: true } }),
    ]);
    const summary = summarizeRows(rows, 'teacherId');
    return res.json({ success: true, data: { month: req.query.month, teachers: teachers.map((teacher) => ({ id: teacher.id, teacherName: teacher.teacherName, employeeId: teacher.employeeId, specialization: teacher.specialization, ...withPercentage(summary.get(teacher.id)) })) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to load teacher register' });
  }
};

export const getMyAttendance = async (req, res) => {
  try {
    const schoolId = req.user.schoolId;
    const academicSession = String(req.query.academicSession || sessionForDate(new Date()));
    if (['STUDENT', 'PARENT'].includes(req.user.role)) {
      const student = await prisma.student.findFirst({ where: { schoolId, isActive: true, ...(req.user.role === 'STUDENT' ? { studentUserId: req.user.email } : { parentUserId: req.user.email }) } });
      if (!student) return res.status(404).json({ success: false, message: 'Linked student profile not found' });
      const records = await prisma.studentAttendance.findMany({ where: { schoolId, studentId: student.id, academicSession }, orderBy: { attendanceDate: 'asc' } });
      return res.json({ success: true, data: buildPersonalHistory('STUDENT', student, academicSession, records) });
    }
    const teacher = await prisma.teacher.findFirst({ where: { schoolId, deletedAt: null, OR: [{ email: req.user.email }, ...(req.user.employeeId ? [{ employeeId: req.user.employeeId }] : [])] } });
    if (!teacher) return res.status(404).json({ success: false, message: 'Teacher profile not found' });
    const records = await prisma.teacherAttendance.findMany({ where: { schoolId, teacherId: teacher.id, academicSession }, orderBy: { attendanceDate: 'asc' } });
    return res.json({ success: true, data: buildPersonalHistory('TEACHER', teacher, academicSession, records) });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to load attendance history' });
  }
};

const buildPersonalHistory = (personType, person, academicSession, records) => {
  const counts = { PRESENT: 0, ABSENT: 0, LATE: 0, HALF_DAY: 0, LEAVE: 0 };
  records.forEach((row) => { counts[row.status] += 1; });
  const attended = counts.PRESENT + counts.LATE + counts.HALF_DAY * 0.5;
  const workingDays = records.length;
  return { personType, person: { id: person.id, name: person.teacherName || [person.studentFirstName, person.studentLastName].filter(Boolean).join(' ') }, academicSession, counts, workingDays, percentage: workingDays ? Math.round((attended / workingDays) * 1000) / 10 : 0, records: records.map((row) => ({ date: row.attendanceDate.toISOString().slice(0, 10), status: row.status, remarks: row.remarks })) };
};

export const saveCalendarDay = async (req, res) => {
  try {
    if (!isSchoolAdmin(req.user) && req.user.role !== 'CURRICULUM_MANAGER') return res.status(403).json({ success: false, message: 'You cannot manage the academic calendar' });
    const calendarDate = normalizeDate(req.body.date);
    const dayType = String(req.body.dayType || '').toUpperCase();
    if (!calendarDate || !VALID_DAY_TYPES.has(dayType)) return res.status(400).json({ success: false, message: 'Valid date and dayType are required' });
    const data = { academicSession: String(req.body.academicSession || sessionForDate(calendarDate)), dayType, title: String(req.body.title || '').trim() || null, description: String(req.body.description || '').trim() || null, endDate: normalizeDate(req.body.endDate) || calendarDate, eventType: String(req.body.eventType || dayType), holidayType: req.body.holidayType || null, applicableClassIds: req.body.applicableClassIds || [], applicableSectionIds: req.body.applicableSectionIds || [], applicableRoles: req.body.applicableRoles || [], isFullDay: req.body.isFullDay !== false, isSchoolWide: req.body.isSchoolWide !== false, region: req.body.region || null, isVisible: req.body.isVisible !== false, colorCategory: req.body.colorCategory || null, isRecurring: Boolean(req.body.isRecurring), sourceNote: req.body.sourceNote || null, createdById: req.user.id };
    const day = await prisma.academicCalendarDay.upsert({ where: { schoolId_calendarDate: { schoolId: req.user.schoolId, calendarDate } }, update: data, create: { schoolId: req.user.schoolId, calendarDate, ...data } });
    if (day.isVisible) {
      let studentWhere = { schoolId: req.user.schoolId, isActive: true };
      if (!day.isSchoolWide && (day.applicableClassIds.length || day.applicableSectionIds.length)) {
        const [classes, sections] = await Promise.all([prisma.class.findMany({ where: { schoolId: req.user.schoolId, id: { in: day.applicableClassIds } }, select: { className: true } }), prisma.section.findMany({ where: { schoolId: req.user.schoolId, id: { in: day.applicableSectionIds } }, include: { class: true } })]);
        studentWhere = { ...studentWhere, OR: [...classes.map((row) => ({ className: row.className })), ...sections.map((row) => ({ className: row.class.className, section: row.sectionName }))] };
      }
      const recipients = await prisma.student.findMany({ where: studentWhere, select: { id: true } });
      await createSystemNotification({ schoolId: req.user.schoolId, type: `CALENDAR_${day.dayType}`, category: day.dayType === 'HOLIDAY' ? 'HOLIDAY' : day.dayType === 'EXAM' ? 'EXAM' : 'EVENT', priority: day.eventType === 'EMERGENCY' ? 'EMERGENCY' : 'NORMAL', title: day.title || day.dayType.replaceAll('_', ' '), message: day.description || `Calendar update for ${calendarDate.toISOString().slice(0,10)}.`, actionUrl: '/dashboard/calendar', sourceModule: 'ACADEMIC_CALENDAR', sourceEntityType: 'ACADEMIC_CALENDAR_DAY', sourceEntityId: day.id, dedupeKey: `CALENDAR:${day.id}:${day.updatedAt.getTime()}`, students: recipients.map((row) => row.id), mandatory: day.eventType === 'EMERGENCY' });
    }
    return res.json({ success: true, data: day, message: 'Calendar day saved' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to save calendar day' });
  }
};

export const listCalendarDays = async (req, res) => {
  try {
    const range = monthRange(req.query.month);
    const where = { schoolId: req.user.schoolId, isVisible: true, ...(range ? { calendarDate: { gte: range.start, lt: range.end } } : {}), ...(req.query.academicSession ? { academicSession: String(req.query.academicSession) } : {}) };
    if (!range && !req.query.academicSession) return res.status(400).json({ success: false, message: 'month or academicSession is required' });
    let scope = { classId: req.user.classId, sectionId: req.user.sectionId };
    if (['STUDENT', 'PARENT'].includes(req.user.role)) { const student = await prisma.student.findFirst({ where: { id: req.user.studentId, schoolId: req.user.schoolId, isActive: true } }); const cls = student ? await prisma.class.findFirst({ where: { schoolId: req.user.schoolId, className: student.className } }) : null; const section = cls && student?.section ? await prisma.section.findFirst({ where: { schoolId: req.user.schoolId, classId: cls.id, sectionName: student.section } }) : null; scope = { classId: cls?.id, sectionId: section?.id }; }
    const allDays = await prisma.academicCalendarDay.findMany({ where, orderBy: { calendarDate: 'asc' } });
    const days = allDays.filter((day) => isSchoolAdmin(req.user) || ((!day.applicableRoles.length || day.applicableRoles.includes(req.user.role)) && (day.isSchoolWide || ((!day.applicableClassIds.length || day.applicableClassIds.includes(scope.classId)) && (!day.applicableSectionIds.length || day.applicableSectionIds.includes(scope.sectionId))))));
    return res.json({ success: true, data: { month: req.query.month || null, academicSession: req.query.academicSession || null, days: days.map((day) => ({ ...day, date: day.calendarDate.toISOString().slice(0, 10), endDate: day.endDate?.toISOString().slice(0, 10) || null })) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to load academic calendar' });
  }
};

export const listPublicCalendarDays = async (req, res) => {
  try {
    const schoolId = String(req.query.schoolId || '');
    const range = monthRange(req.query.month);
    if (!schoolId || (!range && !req.query.academicSession)) return res.status(400).json({ success: false, message: 'schoolId and month or academicSession are required' });
    const school = await prisma.school.findFirst({ where: { id: schoolId, status: 'ACTIVE' }, select: { id: true, schoolName: true, schoolCode: true } });
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });
    const days = await prisma.academicCalendarDay.findMany({ where: { schoolId, isVisible: true, isSchoolWide: true, applicableRoles: { isEmpty: true }, ...(range ? { calendarDate: { gte: range.start, lt: range.end } } : {}), ...(req.query.academicSession ? { academicSession: String(req.query.academicSession) } : {}) }, orderBy: { calendarDate: 'asc' } });
    res.set('Cache-Control', 'public, max-age=300');
    return res.json({ success: true, data: { school, month: req.query.month || null, academicSession: req.query.academicSession || null, days: days.map((day) => ({ id: day.id, date: day.calendarDate.toISOString().slice(0, 10), dayType: day.dayType, title: day.title, description: day.description, academicSession: day.academicSession, updatedAt: day.updatedAt })) } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to load public academic calendar' });
  }
};

export const deleteCalendarDay = async (req, res) => {
  try {
    if (!isSchoolAdmin(req.user)) return res.status(403).json({ success: false, message: 'Only admins can manage the academic calendar' });
    const day = await prisma.academicCalendarDay.findFirst({ where: { id: req.params.id, schoolId: req.user.schoolId } });
    if (!day) return res.status(404).json({ success: false, message: 'Calendar day not found' });
    await prisma.academicCalendarDay.delete({ where: { id: day.id } });
    return res.json({ success: true, message: 'Calendar marker removed' });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message || 'Failed to remove calendar day' });
  }
};

export const calendarDashboardSummary = async (req, res) => {
  const now = new Date(); const week = new Date(now.getTime() + 7 * 86400000);
  const rows = await prisma.academicCalendarDay.findMany({ where: { schoolId: req.user.schoolId, isVisible: true, calendarDate: { gte: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())) } }, orderBy: { calendarDate: 'asc' }, take: 50 });
  const visible = rows.filter((row) => row.isSchoolWide || !row.applicableRoles.length || row.applicableRoles.includes(req.user.role));
  return res.json({ success: true, data: { today: now.toISOString().slice(0, 10), nextEvent: visible[0] || null, eventsThisWeek: visible.filter((row) => row.calendarDate < week).length, nearestHoliday: visible.find((row) => row.dayType === 'HOLIDAY') || null, nearestExam: visible.find((row) => row.dayType === 'EXAM' || row.eventType === 'EXAM') || null } });
};
