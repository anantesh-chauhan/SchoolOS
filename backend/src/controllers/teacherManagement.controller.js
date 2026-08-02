import prisma from '../config/prisma.client.js';
import bcryptjs from 'bcryptjs';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { formatTeacherUserId, generateInitialPassword, normalize } from '../services/identity.service.js';
import { DEFAULT_OVERLOAD_THRESHOLD, CLASS_TEACHER_ROLES, normalizeSubjectsHandled, getTeacherWithLoad } from './teacher.shared.js';

export const createTeacher = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const {
      teacherName,
      email,
      phone,
      employeeId,
      qualification,
      specialization,
      subjectsHandled,
      joiningYear,
    } = req.body;

    if (!teacherName || !email || !phone || !employeeId || !qualification || !specialization) {
      return res.status(400).json({
        success: false,
        message: 'teacherName, email, phone, employeeId, qualification, specialization are required',
      });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId }, select: { schoolCode: true } });
    if (!school) return res.status(404).json({ success: false, message: 'School not found' });

    const nameParts = teacherName.trim().split(/\s+/);
    const firstName = nameParts.shift();
    const lastName = nameParts.join(' ') || 'teacher';
    const normalizedEmployeeId = normalize(employeeId).toUpperCase();
    const normalizedJoiningYear = Number.parseInt(joiningYear, 10) || new Date().getFullYear();
    const loginId = formatTeacherUserId({
      firstName,
      lastName,
      employeeId: normalizedEmployeeId,
      joiningYear: normalizedJoiningYear,
      schoolCode: school.schoolCode,
    });
    const plainPassword = generateInitialPassword(firstName);
    const password = await bcryptjs.hash(plainPassword, 10);

    const created = await prisma.$transaction(async (tx) => {
      const teacher = await tx.teacher.create({
        data: {
          schoolId,
          teacherName: teacherName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          employeeId: normalizedEmployeeId,
          joiningYear: normalizedJoiningYear,
          qualification: qualification.trim(),
          specialization: specialization.trim(),
          subjectsHandled: normalizeSubjectsHandled(subjectsHandled),
        },
      });
      const user = await tx.user.create({
        data: {
          email: loginId,
          password,
          name: teacherName.trim(),
          contactEmail: email.trim().toLowerCase(),
          alternateMobile: phone.trim(),
          role: 'TEACHER',
          schoolId,
          employeeId: normalizedEmployeeId,
          joiningYear: normalizedJoiningYear,
          mustChangePassword: true,
        },
      });
      return { teacher, user };
    });

    return res.status(201).json({
      success: true,
      message: 'Teacher profile and login credentials created successfully',
      data: {
        teacher: created.teacher,
        loginId: created.user.email,
        password: plainPassword,
        mustChangePassword: true,
      },
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Teacher email, employee ID, or generated login ID already exists',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create teacher',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateTeacher = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { id } = req.params;
    const {
      teacherName,
      email,
      phone,
      employeeId,
      qualification,
      specialization,
      subjectsHandled,
    } = req.body;

    const existing = await prisma.teacher.findFirst({ where: { id, schoolId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      const teacher = await tx.teacher.update({
        where: { id },
        data: {
          ...(teacherName !== undefined ? { teacherName: teacherName.trim() } : {}),
          ...(email !== undefined ? { email: email.trim().toLowerCase() } : {}),
          ...(phone !== undefined ? { phone: phone.trim() } : {}),
          ...(employeeId !== undefined ? { employeeId: employeeId.trim().toUpperCase() } : {}),
          ...(qualification !== undefined ? { qualification: qualification.trim() } : {}),
          ...(specialization !== undefined ? { specialization: specialization.trim() } : {}),
          ...(subjectsHandled !== undefined ? { subjectsHandled: normalizeSubjectsHandled(subjectsHandled) } : {}),
        },
      });
      await tx.user.updateMany({
        where: { schoolId, role: 'TEACHER', employeeId: existing.employeeId },
        data: {
          name: teacher.teacherName,
          contactEmail: teacher.email,
          alternateMobile: teacher.phone,
          employeeId: teacher.employeeId,
        },
      });
      return teacher;
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Teacher email or employeeId already exists for this school',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update teacher',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listTeachers = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
    const search = String(req.query.search || '').trim();
    const subject = String(req.query.subject || '').trim();

    const where = {
      schoolId,
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { teacherName: { contains: search, mode: 'insensitive' } },
              { email: { contains: search, mode: 'insensitive' } },
              { employeeId: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(subject
        ? {
            OR: [
              { specialization: { contains: subject, mode: 'insensitive' } },
              { subjectsHandled: { has: subject } },
            ],
          }
        : {}),
    };

    const [total, rows] = await Promise.all([
      prisma.teacher.count({ where }),
      prisma.teacher.findMany({
        where,
        orderBy: { teacherName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          teacherAssignments: {
            where: { isActive: true },
            include: {
              class: { select: { id: true, className: true } },
              section: { select: { id: true, sectionName: true } },
              subject: { select: { id: true, subjectName: true, subjectCode: true } },
            },
          },
        },
      }),
    ]);

    const data = rows.map((row) => {
      const sectionIds = [...new Set(row.teacherAssignments.map((item) => item.sectionId))];
      const classIds = [...new Set(row.teacherAssignments.map((item) => item.classId))];
      const subjectIds = [...new Set(row.teacherAssignments.map((item) => item.subjectId))];

      return {
        ...row,
        workload: {
          assignedSectionCount: sectionIds.length,
          assignedClassCount: classIds.length,
          assignedSubjectCount: subjectIds.length,
          totalAssignments: row.teacherAssignments.length,
          isOverloaded: sectionIds.length > DEFAULT_OVERLOAD_THRESHOLD,
          threshold: DEFAULT_OVERLOAD_THRESHOLD,
        },
      };
    });

    return res.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch teachers',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteTeacher = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { id } = req.params;

    const existing = await prisma.teacher.findFirst({ where: { id, schoolId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const assignmentCount = await prisma.teacherAssignment.count({ where: { teacherId: id } });
    if (assignmentCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete teacher with active subject assignments',
      });
    }

    await prisma.$transaction(async (tx) => {
      await tx.teacher.delete({ where: { id } });
      await tx.user.deleteMany({ where: { schoolId, role: 'TEACHER', employeeId: existing.employeeId } });
    });

    return res.json({ success: true, message: 'Teacher deleted successfully' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete teacher',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getTeacherWorkload = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { id } = req.params;

    const teacher = await prisma.teacher.findFirst({ where: { id, schoolId } });
    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found' });
    }

    const load = await getTeacherWithLoad(id);
    return res.json({ success: true, data: load });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch teacher workload',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
