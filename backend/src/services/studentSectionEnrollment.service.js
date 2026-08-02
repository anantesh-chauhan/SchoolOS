import prisma from '../config/prisma.client.js';

const validDate = (value) => value instanceof Date && !Number.isNaN(value.getTime());

export const buildStudentSectionEligibilityWhere = ({ section, effectiveDate, allocatedStudentUserIds = [] }) => {
  if (!section?.schoolId || !section?.classId || !section?.id || !section?.class?.className || !validDate(effectiveDate)) {
    throw new TypeError('A tenant-scoped section and valid effective date are required');
  }

  const currentAllocation = {
    className: section.class.className,
    section: section.sectionName,
    OR: [{ admissionDate: null }, { admissionDate: { lte: effectiveDate } }],
  };
  const historicalEnrollment = {
    enrollmentHistory: {
      some: {
        schoolId: section.schoolId,
        classId: section.classId,
        sectionId: section.id,
        effectiveFrom: { lte: effectiveDate },
        OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveDate } }],
      },
    },
  };
  const canonicalUserAllocation = allocatedStudentUserIds.length ? {
    studentUserId: { in: [...new Set(allocatedStudentUserIds)] },
    OR: [{ admissionDate: null }, { admissionDate: { lte: effectiveDate } }],
  } : null;

  return {
    schoolId: section.schoolId,
    isActive: true,
    OR: [currentAllocation, historicalEnrollment, ...(canonicalUserAllocation ? [canonicalUserAllocation] : [])],
  };
};

export const findEligibleStudentsForSection = async ({ section, effectiveDate, select, orderBy }) => {
  const allocatedUsers = await prisma.user.findMany({
    where: {
      schoolId: section.schoolId,
      classId: section.classId,
      sectionId: section.id,
      role: 'STUDENT',
      isActive: true,
    },
    select: { email: true },
  });

  return prisma.student.findMany({
    where: buildStudentSectionEligibilityWhere({
      section,
      effectiveDate,
      allocatedStudentUserIds: allocatedUsers.map((user) => user.email).filter(Boolean),
    }),
    ...(select ? { select } : {}),
    ...(orderBy ? { orderBy } : {}),
  });
};
