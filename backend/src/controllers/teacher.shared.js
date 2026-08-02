import prisma from '../config/prisma.client.js';
import bcryptjs from 'bcryptjs';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { formatTeacherUserId, generateInitialPassword, normalize } from '../services/identity.service.js';

export const DEFAULT_OVERLOAD_THRESHOLD = Number(process.env.TEACHER_OVERLOAD_THRESHOLD || 8);
export const CLASS_TEACHER_ROLES = ['CLASS_TEACHER', 'BOTH'];

export const normalizeSubjectsHandled = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
};

export const getTeacherWithLoad = async (teacherId) => {
  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId, isActive: true },
    select: {
      id: true,
      subjectId: true,
      sectionId: true,
    },
  });

  const uniqueSections = new Set(assignments.map((item) => item.sectionId));
  const uniqueSubjects = new Set(assignments.map((item) => item.subjectId));

  return {
    assignedSectionCount: uniqueSections.size,
    assignedSubjectCount: uniqueSubjects.size,
    totalAssignments: assignments.length,
    isOverloaded: uniqueSections.size > DEFAULT_OVERLOAD_THRESHOLD,
  };
};
