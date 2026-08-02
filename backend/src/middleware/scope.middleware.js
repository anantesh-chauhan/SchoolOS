import prisma from '../config/prisma.client.js';
import { permissionScopes, SCOPES } from '../config/permissions.js';
import { getTeacherForUser } from '../utils/teacherAuthorization.util.js';

const forbidden = (res, message, code = 'SCOPE_FORBIDDEN') =>
  res.status(403).json({ success: false, message, code });

export const requestSchoolId = (req) =>
  req.params?.schoolId || req.body?.schoolId || req.query?.schoolId || null;

/**
 * Tenant boundary. Request-provided school IDs are treated only as targets and
 * never as proof of access.
 */
export const requireSchoolAccess = ({ optionalTarget = true } = {}) => async (req, res, next) => {
  const targetSchoolId = requestSchoolId(req);
  if (!req.user) return res.status(401).json({ success: false, message: 'Unauthorized', code: 'UNAUTHORIZED' });

  if (req.user.role === 'PLATFORM_OWNER') {
    if (!targetSchoolId && !optionalTarget) {
      return res.status(400).json({ success: false, message: 'schoolId is required', code: 'SCHOOL_ID_REQUIRED' });
    }
    req.authorizedSchoolId = targetSchoolId;
    return next();
  }

  if (!req.user.schoolId || (targetSchoolId && targetSchoolId !== req.user.schoolId)) {
    return forbidden(res, "You cannot access another school's data.", 'TENANT_FORBIDDEN');
  }
  req.authorizedSchoolId = req.user.schoolId;
  return next();
};

export const requireSelfAccess = ({ param = 'id', allowSchoolScope = true } = {}) => (req, res, next) => {
  const targetId = req.params?.[param] || req.body?.[param] || req.query?.[param];
  const ownIds = new Set([req.user?.id, req.user?.studentId].filter(Boolean));
  if (ownIds.has(targetId)) return next();
  if (allowSchoolScope && !['STUDENT', 'PARENT', 'TEACHER', 'CLASS_TEACHER', 'STAFF'].includes(req.user?.role)) return next();
  return forbidden(res, 'You can access only your own record.', 'SELF_SCOPE_FORBIDDEN');
};

export const requireChildAccess = ({ param = 'studentId' } = {}) => async (req, res, next) => {
  const studentId = req.params?.[param] || req.body?.[param] || req.query?.[param];
  if (req.user?.role !== 'PARENT') return next();
  if (!studentId) return res.status(400).json({ success: false, message: 'studentId is required', code: 'STUDENT_ID_REQUIRED' });

  const linked = studentId === req.user.studentId || await prisma.student.findFirst({
    where: {
      id: studentId,
      schoolId: req.user.schoolId,
      isActive: true,
      OR: [
        { parentUserId: req.user.email },
        { feeFamilyLinks: { some: { parentUserId: req.user.id, active: true } } },
      ],
    },
    select: { id: true },
  });
  if (!linked) return forbidden(res, 'You can access only your linked children.', 'CHILD_SCOPE_FORBIDDEN');
  return next();
};

/**
 * Record-aware student guard used after requirePermission(STUDENTS_VIEW).
 */
export const requireStudentAccess = (permission, { param = 'id' } = {}) => async (req, res, next) => {
  const studentId = req.params?.[param] || req.body?.studentId || req.query?.studentId;
  if (!studentId) return res.status(400).json({ success: false, message: 'studentId is required', code: 'STUDENT_ID_REQUIRED' });

  const student = await prisma.student.findFirst({
    where: { id: studentId, isActive: true },
    select: { id: true, schoolId: true, className: true, section: true, parentUserId: true },
  });
  if (!student) return res.status(404).json({ success: false, message: 'Student not found', code: 'NOT_FOUND' });
  if (req.user.role !== 'PLATFORM_OWNER' && student.schoolId !== req.user.schoolId) {
    return forbidden(res, "You cannot access another school's data.", 'TENANT_FORBIDDEN');
  }

  const scopes = permissionScopes(req.user.role, permission);
  if (scopes.includes(SCOPES.SCHOOL)) {
    req.authorizedStudent = student;
    return next();
  }
  if (scopes.includes(SCOPES.SELF) && student.id === req.user.studentId) {
    req.authorizedStudent = student;
    return next();
  }
  if (scopes.includes(SCOPES.CHILD) &&
      (student.id === req.user.studentId || student.parentUserId === req.user.email)) {
    req.authorizedStudent = student;
    return next();
  }
  if (scopes.includes(SCOPES.ASSIGNED) && ['TEACHER', 'CLASS_TEACHER'].includes(req.user.role)) {
    const teacher = await getTeacherForUser(req.user);
    const assignment = teacher && await prisma.teacherAssignment.findFirst({
      where: {
        schoolId: student.schoolId,
        teacherId: teacher.id,
        isActive: true,
        class: { className: student.className },
        section: { sectionName: student.section || '' },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      select: { id: true },
    });
    if (assignment) {
      req.authorizedStudent = student;
      return next();
    }
  }
  return forbidden(res, 'This student is outside your permitted scope.', 'STUDENT_SCOPE_FORBIDDEN');
};

export const requireAssignedClass = ({ classParam = 'classId', sectionParam = 'sectionId' } = {}) =>
  async (req, res, next) => {
    if (!['TEACHER', 'CLASS_TEACHER'].includes(req.user?.role)) return next();
    const teacher = await getTeacherForUser(req.user);
    const classId = req.params?.[classParam] || req.body?.[classParam] || req.query?.[classParam];
    const sectionId = req.params?.[sectionParam] || req.body?.[sectionParam] || req.query?.[sectionParam];
    const classTeacherAssignment = teacher && req.user.role === 'CLASS_TEACHER' && sectionId
      ? await prisma.sectionClassTeacherAssignment.findFirst({
          where: {
            schoolId: req.user.schoolId, teacherId: teacher.id, sectionId,
            status: 'ACTIVE', isPrimary: true, section: { classId },
            startDate: { lte: new Date() }, OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
          },
          select: { id: true },
        })
      : null;
    const assignment = classTeacherAssignment || teacher && await prisma.teacherAssignment.findFirst({
      where: {
        schoolId: req.user.schoolId, teacherId: teacher.id, classId,
        ...(sectionId ? { sectionId } : {}), isActive: true,
        ...(req.user.role === 'CLASS_TEACHER' ? { roleType: { in: ['CLASS_TEACHER', 'BOTH'] } } : {}),
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      select: { id: true },
    });
    if (!assignment) return forbidden(res, 'You are not assigned to this class or section.', 'ASSIGNMENT_FORBIDDEN');
    return next();
  };

export const requireAssignedSubject = ({ subjectParam = 'subjectId' } = {}) =>
  async (req, res, next) => {
    if (!['TEACHER', 'CLASS_TEACHER'].includes(req.user?.role)) return next();
    const teacher = await getTeacherForUser(req.user);
    const subjectId = req.params?.[subjectParam] || req.body?.[subjectParam] || req.query?.[subjectParam];
    const assignment = teacher && await prisma.teacherAssignment.findFirst({
      where: {
        schoolId: req.user.schoolId, teacherId: teacher.id, subjectId, isActive: true,
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
      },
      select: { id: true },
    });
    if (!assignment) return forbidden(res, 'You are not assigned to this subject.', 'SUBJECT_SCOPE_FORBIDDEN');
    return next();
  };
