import prisma from '../config/prisma.client.js';
import {
  assertTeacherIsClassTeacherForSection,
  isSchoolAdmin,
  requireSchoolAdminOrClassTeacher,
  sendAuthorizationError,
} from '../utils/teacherAuthorization.util.js';

const VALID_ATTENDANCE_STATUSES = new Set(['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE']);

const normalizeDate = (value) => {
  const source = value ? new Date(value) : new Date();
  if (Number.isNaN(source.getTime())) return null;
  return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
};

const normalizeStatus = (value) => {
  const normalized = String(value || 'PRESENT').trim().toUpperCase().replace(/\s+/g, '_');
  return VALID_ATTENDANCE_STATUSES.has(normalized) ? normalized : null;
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
          status: record.status,
          remarks: record.remarks,
          markedById: req.user.id,
        },
      }))
    );

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

    if (normalizedRecords.some((record) => !teacherIds.has(record.teacherId) || !record.status)) {
      return res.status(409).json({ success: false, message: 'Attendance contains invalid teachers or statuses' });
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
          status: record.status,
          remarks: record.remarks,
          markedById: req.user.id,
        },
      }))
    );

    return res.json({ success: true, message: 'Teacher attendance saved' });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to save teacher attendance',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
