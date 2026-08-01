import prisma from '../config/prisma.client.js';


export class AuthorizationError extends Error {
  constructor(message = 'Forbidden', statusCode = 403) {
    super(message);
    this.name = 'AuthorizationError';
    this.statusCode = statusCode;
  }
}

export const assertSameSchool = (user, schoolId) => {
  if (!user) {
    throw new AuthorizationError('Unauthorized', 401);
  }

  if (user.role === 'PLATFORM_OWNER') {
    return true;
  }

  if (!user.schoolId || user.schoolId !== schoolId) {
    throw new AuthorizationError("You cannot access another school's data.", 403);
  }

  return true;
};

export const isSchoolAdmin = (user) => ['ADMIN', 'SCHOOL_OWNER'].includes(user?.role);

export const getTeacherForUser = async (user) => {
  if (!['TEACHER', 'CLASS_TEACHER'].includes(user?.role) || !user.schoolId) {
    return null;
  }

  const identity = user.employeeId
    ? user
    : await prisma.user.findFirst({
        where: { id: user.id, schoolId: user.schoolId, role: 'TEACHER', isActive: true },
        select: { employeeId: true, contactEmail: true },
      });

  return prisma.teacher.findFirst({
    where: {
      schoolId: user.schoolId,
      OR: [
        { email: user.email },
        ...(identity?.contactEmail ? [{ email: identity.contactEmail }] : []),
        ...(identity?.employeeId ? [{ employeeId: identity.employeeId }] : []),
      ],
      deletedAt: null,
    },
  });
};

export const assertTeacherAssignedToSectionSubject = async (user, { schoolId, classId, sectionId, subjectId }) => {
  assertSameSchool(user, schoolId);

  const teacher = await getTeacherForUser(user);
  if (!teacher) {
    throw new AuthorizationError('Teacher profile not found for this user.', 403);
  }

  const assignment = await prisma.teacherAssignment.findFirst({
    where: {
      schoolId,
      teacherId: teacher.id,
      classId,
      sectionId,
      subjectId,
      isActive: true,
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
  });

  if (!assignment) {
    throw new AuthorizationError('You are not assigned to this section or subject.', 403);
  }

  return { teacher, assignment };
};

export const assertTeacherIsClassTeacherForSection = async (user, { schoolId, classId, sectionId }) => {
  assertSameSchool(user, schoolId);

  const teacher = await getTeacherForUser(user);
  if (!teacher) {
    throw new AuthorizationError('Teacher profile not found for this user.', 403);
  }

  const assignment = await prisma.teacherAssignment.findFirst({
    where: {
      schoolId,
      teacherId: teacher.id,
      classId,
      sectionId,
      isActive: true,
      roleType: { in: ['CLASS_TEACHER', 'BOTH'] },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
  });

  if (!assignment) {
    throw new AuthorizationError('Only the class teacher can access attendance for this section.', 403);
  }

  return { teacher, assignment };
};

export const requireSchoolAdminOrClassTeacher = async (user, params) => {
  if (isSchoolAdmin(user)) {
    assertSameSchool(user, params.schoolId);
    return { allowed: true, teacher: null, assignment: null, isAdmin: true };
  }

  if (!['TEACHER', 'CLASS_TEACHER'].includes(user?.role)) {
    throw new AuthorizationError('Only school admins or class teachers can access attendance.', 403);
  }

  const result = await assertTeacherIsClassTeacherForSection(user, params);
  return { allowed: true, ...result, isAdmin: false };
};

export const requireSchoolAdminOrAssignedTeacherForSection = async (user, { schoolId, classId, sectionId }) => {
  if (isSchoolAdmin(user)) {
    assertSameSchool(user, schoolId);
    return { allowed: true, isAdmin: true, canMark: true };
  }
  if (!['TEACHER', 'CLASS_TEACHER'].includes(user?.role)) throw new AuthorizationError('Only school admins or assigned teachers can view this attendance.', 403);
  assertSameSchool(user, schoolId);
  const teacher = await getTeacherForUser(user);
  if (!teacher) throw new AuthorizationError('Teacher profile not found for this user.', 403);
  const assignment = await prisma.teacherAssignment.findFirst({ where: { schoolId, teacherId: teacher.id, classId, sectionId, isActive: true, OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }] } });
  if (!assignment) throw new AuthorizationError('You are not assigned to this section.', 403);
  return { allowed: true, teacher, assignment, isAdmin: false, canMark: ['CLASS_TEACHER', 'BOTH'].includes(assignment.roleType) };
};

export const canManageSectionSubject = async (user, params) => {
  if (isSchoolAdmin(user)) {
    assertSameSchool(user, params.schoolId);
    return { allowed: true, teacher: null, assignment: null, isAdmin: true };
  }

  const result = await assertTeacherAssignedToSectionSubject(user, params);
  return { allowed: true, ...result, isAdmin: false };
};

export const requireSchoolAdminOrAssignedTeacher = async (user, params) => {
  if (!isSchoolAdmin(user) && !['TEACHER', 'CLASS_TEACHER'].includes(user?.role)) {
    throw new AuthorizationError('Only school admins or assigned teachers can manage this data.', 403);
  }

  return canManageSectionSubject(user, params);
};

export const sendAuthorizationError = (res, error) => {
  if (error instanceof AuthorizationError) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }
  return null;
};
