import prisma from '../config/prisma.client.js';
import bcryptjs from 'bcryptjs';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { formatTeacherUserId, generateInitialPassword, normalize } from '../services/identity.service.js';
import { DEFAULT_OVERLOAD_THRESHOLD, CLASS_TEACHER_ROLES, normalizeSubjectsHandled, getTeacherWithLoad } from './teacher.shared.js';

const getFirstSectionSubjectId = async (tx, { classId, sectionId }) => {
  const sectionSubject = await tx.sectionSubject.findFirst({
    where: { sectionId },
    include: { subject: true },
    orderBy: [{ subject: { displayOrder: 'asc' } }, { createdAt: 'asc' }],
  });
  if (sectionSubject) return sectionSubject.subjectId;

  const classSubject = await tx.classSubject.findFirst({
    where: { classId },
    include: { subject: true },
    orderBy: [{ subject: { displayOrder: 'asc' } }, { createdAt: 'asc' }],
  });

  return classSubject?.subjectId || null;
};

export const listClassTeacherAssignments = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { classId } = req.query;

    const sections = await prisma.section.findMany({
      where: {
        schoolId,
        deletedAt: null,
        ...(classId ? { classId } : {}),
      },
      include: {
        class: { select: { id: true, className: true, classOrder: true } },
        teacherAssignments: {
          where: { isActive: true, roleType: { in: CLASS_TEACHER_ROLES } },
          include: {
            teacher: { select: { id: true, teacherName: true, employeeId: true, specialization: true } },
            subject: { select: { id: true, subjectName: true, subjectCode: true } },
          },
          orderBy: { updatedAt: 'desc' },
          take: 1,
        },
      },
      orderBy: [{ class: { classOrder: 'asc' } }, { sectionOrder: 'asc' }],
    });

    const rows = sections.map((section) => {
      const assignment = section.teacherAssignments[0] || null;
      return {
        classId: section.classId,
        className: section.class.className,
        classOrder: section.class.classOrder,
        sectionId: section.id,
        sectionName: section.sectionName,
        sectionOrder: section.sectionOrder,
        assignmentId: assignment?.id || null,
        teacher: assignment?.teacher || null,
        subject: assignment?.subject || null,
        roleType: assignment?.roleType || null,
      };
    });

    return res.json({
      success: true,
      data: rows,
      stats: {
        totalSections: rows.length,
        assignedSections: rows.filter((row) => row.teacher).length,
        unassignedSections: rows.filter((row) => !row.teacher).length,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch class teacher assignments',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const upsertClassTeacherAssignment = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { classId, sectionId, teacherId, subjectId } = req.body;

    if (!classId || !sectionId || !teacherId) {
      return res.status(400).json({
        success: false,
        message: 'classId, sectionId and teacherId are required',
      });
    }

    const [section, teacher] = await Promise.all([
      prisma.section.findFirst({ where: { id: sectionId, classId, schoolId, deletedAt: null } }),
      prisma.teacher.findFirst({ where: { id: teacherId, schoolId, deletedAt: null } }),
    ]);

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found for this school and class' });
    }

    if (!teacher) {
      return res.status(404).json({ success: false, message: 'Teacher not found for this school' });
    }

    const saved = await prisma.$transaction(async (tx) => {
      const resolvedSubjectId = subjectId || await getFirstSectionSubjectId(tx, { classId, sectionId });
      if (!resolvedSubjectId) {
        throw Object.assign(new Error('Assign at least one subject to this section before assigning a class teacher'), { statusCode: 409 });
      }

      const validSubject = await tx.subject.findFirst({ where: { id: resolvedSubjectId, schoolId, deletedAt: null } });
      if (!validSubject) {
        throw Object.assign(new Error('Subject not found for this school'), { statusCode: 404 });
      }

      const existingClassTeacherRows = await tx.teacherAssignment.findMany({
        where: {
          schoolId,
          classId,
          sectionId,
          isActive: true,
          roleType: { in: CLASS_TEACHER_ROLES },
        },
      });

      for (const row of existingClassTeacherRows) {
        if (row.teacherId === teacherId && row.subjectId === resolvedSubjectId) {
          continue;
        }

        if (row.roleType === 'BOTH') {
          await tx.teacherAssignment.update({ where: { id: row.id }, data: { roleType: 'SUBJECT_TEACHER' } });
        } else {
          await tx.teacherAssignment.delete({ where: { id: row.id } });
        }
      }

      const existingTarget = await tx.teacherAssignment.findFirst({
        where: {
          schoolId,
          classId,
          sectionId,
          teacherId,
          OR: [{ subjectId: resolvedSubjectId }, { roleType: 'SUBJECT_TEACHER' }],
        },
        orderBy: [{ subjectId: 'asc' }, { createdAt: 'asc' }],
      });

      if (existingTarget) {
        return tx.teacherAssignment.update({
          where: { id: existingTarget.id },
          data: {
            roleType: existingTarget.roleType === 'SUBJECT_TEACHER' ? 'BOTH' : existingTarget.roleType,
            isActive: true,
            effectiveTo: null,
          },
          include: {
            teacher: { select: { id: true, teacherName: true, employeeId: true, specialization: true } },
            subject: { select: { id: true, subjectName: true, subjectCode: true } },
            class: { select: { id: true, className: true } },
            section: { select: { id: true, sectionName: true } },
          },
        });
      }

      return tx.teacherAssignment.create({
        data: {
          schoolId,
          classId,
          sectionId,
          teacherId,
          subjectId: resolvedSubjectId,
          roleType: 'CLASS_TEACHER',
          isActive: true,
        },
        include: {
          teacher: { select: { id: true, teacherName: true, employeeId: true, specialization: true } },
          subject: { select: { id: true, subjectName: true, subjectCode: true } },
          class: { select: { id: true, className: true } },
          section: { select: { id: true, sectionName: true } },
        },
      });
    });

    return res.json({ success: true, data: saved });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to save class teacher assignment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
