import prisma from '../../config/prisma.client.js';

const schoolStaff = new Set(['SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER']);

export const requireTenant = (user) => {
  if (!user?.schoolId) {
    const error = new Error('A school-scoped account is required.');
    error.status = 403;
    throw error;
  }
  return user.schoolId;
};

export const getLinkedStudentIds = async (user) => {
  const direct = user.studentId ? [user.studentId] : [];
  if (user.role !== 'PARENT') return direct;
  const links = user.id ? await prisma.feeFamilyLink.findMany({
    where: { schoolId: user.schoolId, parentUserId: user.id, active: true },
    select: { studentId: true },
  }) : [];
  return [...new Set([...direct, ...links.map((row) => row.studentId)])];
};

export const assertStudentAccess = async (user, student, { subjectId = null } = {}) => {
  if (!student || student.schoolId !== user.schoolId) {
    const error = new Error('Student not found.');
    error.status = 404;
    throw error;
  }
  if (schoolStaff.has(user.role)) return { scope: 'SCHOOL' };
  if (['STUDENT', 'PARENT'].includes(user.role)) {
    if (!(await getLinkedStudentIds(user)).includes(student.id)) {
      const error = new Error('You may only view analytics for a linked student.');
      error.status = 403;
      throw error;
    }
    return { scope: 'SELF', redactInternal: true };
  }
  if (user.role === 'TEACHER') {
    const teacher = await prisma.teacher.findFirst({
      where: { schoolId: user.schoolId, isActive: true, deletedAt: null, OR: [
        ...(user.email ? [{ email: user.email }] : []),
        ...(user.employeeId ? [{ employeeId: user.employeeId }] : []),
      ] },
      select: { id: true },
    });
    const classRow = await prisma.class.findFirst({
      where: { schoolId: user.schoolId, className: student.className, deletedAt: null },
      select: { id: true },
    });
    const section = classRow && student.section ? await prisma.section.findFirst({
      where: { schoolId: user.schoolId, classId: classRow.id, sectionName: student.section, deletedAt: null },
      select: { id: true },
    }) : null;
    const assignments = teacher && classRow && section ? await prisma.teacherAssignment.findMany({
      where: {
        schoolId: user.schoolId,
        teacherId: teacher.id,
        classId: classRow.id,
        sectionId: section.id,
        isActive: true,
        ...(subjectId ? { subjectId } : {}),
      },
      select: { id: true, subjectId: true, roleType: true },
    }) : [];
    if (!assignments.length) {
      const error = new Error('This student is outside your assigned class, section, or subject.');
      error.status = 403;
      throw error;
    }
    const classTeacher = assignments.some((assignment) => assignment.roleType === 'CLASS_TEACHER' || assignment.roleType === 'BOTH');
    return {
      scope: classTeacher ? 'CLASS' : 'SUBJECT',
      teacherId: teacher.id,
      allowedSubjectIds: classTeacher ? null : [...new Set(assignments.map((assignment) => assignment.subjectId))],
    };
  }
  const error = new Error('Your role cannot access student analytics.');
  error.status = 403;
  throw error;
};

export const filterForRole = (payload, user) => {
  if (!['STUDENT', 'PARENT'].includes(user.role)) return payload;
  const copy = structuredClone(payload);
  if (copy.teacherObservations) copy.teacherObservations = [];
  for (const key of ['chapters', 'weakChapters', 'strongChapters']) {
    if (copy[key]) copy[key] = copy[key].map(({ teacherRemarks, ...chapter }) => chapter);
  }
  if (copy.interventions) {
    copy.interventions = copy.interventions
      .filter((item) => item.parentVisible)
      .map(({ confidentialNotes, notes, ...item }) => item);
  }
  if (copy.risk) {
    copy.risk = {
      riskLevel: copy.risk.riskLevel,
      riskScore: copy.risk.riskScore,
      reasons: copy.risk.reasons.map(({ evidence, ...item }) => item),
      wording: copy.risk.riskLevel === 'LOW' ? 'Progress is currently on track.' : 'Some areas may need attention. Review the suggested next steps.',
    };
  }
  return copy;
};
