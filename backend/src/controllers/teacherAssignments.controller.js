import prisma from '../config/prisma.client.js';
import bcryptjs from 'bcryptjs';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { formatTeacherUserId, generateInitialPassword, normalize } from '../services/identity.service.js';
import { DEFAULT_OVERLOAD_THRESHOLD, CLASS_TEACHER_ROLES, normalizeSubjectsHandled, getTeacherWithLoad } from './teacher.shared.js';

export const listTeacherAssignmentsForSection = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { classId, sectionId } = req.query;

    if (!classId || !sectionId) {
      return res.status(400).json({ success: false, message: 'classId and sectionId are required' });
    }

    const section = await prisma.section.findFirst({
      where: { id: sectionId, classId, schoolId },
      include: {
        class: true,
      },
    });

    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found in class for this school' });
    }

    let sectionSubjects = await prisma.sectionSubject.findMany({
      where: { sectionId },
      include: { subject: true },
      orderBy: { createdAt: 'asc' },
    });

    if (sectionSubjects.length === 0) {
      const classSubjects = await prisma.classSubject.findMany({
        where: { classId },
        select: { subjectId: true },
      });

      if (classSubjects.length > 0) {
        await prisma.sectionSubject.createMany({
          data: classSubjects.map((row) => ({
            sectionId,
            subjectId: row.subjectId,
          })),
          skipDuplicates: true,
        });

        sectionSubjects = await prisma.sectionSubject.findMany({
          where: { sectionId },
          include: { subject: true },
          orderBy: { createdAt: 'asc' },
        });
      }
    }

    const assignments = await prisma.teacherAssignment.findMany({
      where: { schoolId, classId, sectionId },
      include: {
        teacher: true,
        subject: true,
      },
    });

    const bySubjectId = new Map();
    assignments.forEach((item) => {
      const existing = bySubjectId.get(item.subjectId);
      if (!existing || (existing.roleType === 'CLASS_TEACHER' && item.roleType !== 'CLASS_TEACHER')) {
        bySubjectId.set(item.subjectId, item);
      }
    });

    const table = sectionSubjects.map((row) => {
      const assignment = bySubjectId.get(row.subjectId) || null;
      return {
        subjectId: row.subjectId,
        subjectName: row.subject.subjectName,
        subjectCode: row.subject.subjectCode,
        assignment,
        isAssigned: Boolean(assignment),
      };
    });

    const unassignedCount = table.filter((row) => !row.isAssigned).length;

    return res.json({
      success: true,
      data: {
        class: {
          id: section.class.id,
          className: section.class.className,
          classOrder: section.class.classOrder,
        },
        section: {
          id: section.id,
          sectionName: section.sectionName,
          sectionOrder: section.sectionOrder,
        },
        table,
        stats: {
          totalSubjects: table.length,
          assignedSubjects: table.length - unassignedCount,
          unassignedSubjects: unassignedCount,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch teacher assignments for section',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const bulkUpsertTeacherAssignments = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { classId, sectionId, assignments } = req.body;

    if (!classId || !sectionId || !Array.isArray(assignments)) {
      return res.status(400).json({
        success: false,
        message: 'classId, sectionId and assignments[] are required',
      });
    }

    const section = await prisma.section.findFirst({ where: { id: sectionId, classId, schoolId } });
    if (!section) {
      return res.status(404).json({ success: false, message: 'Section not found in class for this school' });
    }

    let sectionSubjects = await prisma.sectionSubject.findMany({
      where: { sectionId },
      select: { subjectId: true },
    });

    if (sectionSubjects.length === 0) {
      const classSubjects = await prisma.classSubject.findMany({
        where: { classId },
        select: { subjectId: true },
      });

      if (classSubjects.length > 0) {
        await prisma.sectionSubject.createMany({
          data: classSubjects.map((row) => ({ sectionId, subjectId: row.subjectId })),
          skipDuplicates: true,
        });

        sectionSubjects = await prisma.sectionSubject.findMany({
          where: { sectionId },
          select: { subjectId: true },
        });
      }
    }

    const sectionSubjectIds = new Set(sectionSubjects.map((item) => item.subjectId));
    if (sectionSubjectIds.size === 0) {
      return res.status(400).json({
        success: false,
        message: 'No subjects assigned to this section. Assign subjects first.',
      });
    }

    const normalizedAssignments = assignments
      .map((item) => ({
        subjectId: item.subjectId,
        teacherId: item.teacherId,
        roleType: ['SUBJECT_TEACHER', 'CLASS_TEACHER', 'BOTH'].includes(item.roleType) ? item.roleType : 'SUBJECT_TEACHER',
        isTemporary: Boolean(item.isTemporary),
      }))
      .filter((item) => item.subjectId && item.teacherId);

    const uniqueBySubject = new Map();
    for (const item of normalizedAssignments) {
      uniqueBySubject.set(item.subjectId, item);
    }

    const finalAssignments = [...uniqueBySubject.values()];

    const missingSubjects = [...sectionSubjectIds].filter(
      (subjectId) => !finalAssignments.some((item) => item.subjectId === subjectId)
    );

    if (missingSubjects.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'No subject should be left without teacher assignment for this section',
      });
    }

    const teacherIds = [...new Set(finalAssignments.map((item) => item.teacherId))];
    const subjectIds = [...new Set(finalAssignments.map((item) => item.subjectId))];

    const [teachers, subjects] = await Promise.all([
      prisma.teacher.findMany({ where: { schoolId, id: { in: teacherIds } } }),
      prisma.subject.findMany({ where: { schoolId, id: { in: subjectIds } } }),
    ]);

    if (teachers.length !== teacherIds.length || subjects.length !== subjectIds.length) {
      return res.status(404).json({
        success: false,
        message: 'Some teachers or subjects do not belong to this school',
      });
    }

    const teacherById = new Map(teachers.map((teacher) => [teacher.id, teacher]));

    for (const item of finalAssignments) {
      if (!sectionSubjectIds.has(item.subjectId)) {
        return res.status(409).json({
          success: false,
          message: 'Subject is not mapped to this section',
        });
      }

      const teacher = teacherById.get(item.teacherId);
      if (!teacher) {
        return res.status(404).json({ success: false, message: 'Teacher not found for assignment' });
      }
    }

    await prisma.$transaction(async (tx) => {
      const classTeacherAssignment = await tx.teacherAssignment.findFirst({
        where: {
          schoolId,
          classId,
          sectionId,
          isActive: true,
          roleType: { in: CLASS_TEACHER_ROLES },
        },
      });

      await tx.teacherAssignment.deleteMany({ where: { schoolId, classId, sectionId } });
      await tx.teacherAssignment.createMany({
        data: finalAssignments.map((item) => ({
          schoolId,
          classId,
          sectionId,
          subjectId: item.subjectId,
          teacherId: item.teacherId,
          roleType: item.roleType,
          isActive: true,
          isTemporary: item.isTemporary,
        })),
      });

      if (classTeacherAssignment) {
        const replacementSubjectId = sectionSubjectIds.has(classTeacherAssignment.subjectId)
          ? classTeacherAssignment.subjectId
          : finalAssignments[0]?.subjectId;

        if (!replacementSubjectId) return;

        const subjectAssignmentForClassTeacher = await tx.teacherAssignment.findFirst({
          where: {
            schoolId,
            classId,
            sectionId,
            teacherId: classTeacherAssignment.teacherId,
            subjectId: replacementSubjectId,
          },
        });

        if (subjectAssignmentForClassTeacher) {
          await tx.teacherAssignment.update({
            where: { id: subjectAssignmentForClassTeacher.id },
            data: { roleType: 'BOTH', isActive: true, effectiveTo: null },
          });
        } else {
          await tx.teacherAssignment.create({
            data: {
              schoolId,
              classId,
              sectionId,
              subjectId: replacementSubjectId,
              teacherId: classTeacherAssignment.teacherId,
              roleType: 'CLASS_TEACHER',
              isActive: true,
              isTemporary: classTeacherAssignment.isTemporary,
              effectiveFrom: classTeacherAssignment.effectiveFrom,
              effectiveTo: classTeacherAssignment.effectiveTo,
            },
          });
        }
      }
    });

    const saved = await prisma.teacherAssignment.findMany({
      where: { schoolId, classId, sectionId },
      include: {
        teacher: true,
        subject: true,
        class: true,
        section: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ success: true, data: saved });
   } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate teacher assignment detected for same subject in section',
      });
    }

     return res.status(500).json({
       success: false,
       message: 'Failed to save teacher assignments',
       error: process.env.NODE_ENV === 'development' ? error.message : undefined,
     });
   }
 };

export const listTeacherAssignmentSummary = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { classId, sectionId, teacherId, subjectId, exportFormat } = req.query;

    const where = {
      schoolId,
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(teacherId ? { teacherId } : {}),
      ...(subjectId ? { subjectId } : {}),
    };

    const rows = await prisma.teacherAssignment.findMany({
      where,
      include: {
        class: { select: { id: true, className: true, classOrder: true } },
        section: { select: { id: true, sectionName: true, sectionOrder: true } },
        subject: { select: { id: true, subjectName: true, subjectCode: true } },
        teacher: { select: { id: true, teacherName: true, employeeId: true, specialization: true } },
      },
      orderBy: [{ class: { classOrder: 'asc' } }, { section: { sectionOrder: 'asc' } }, { subject: { subjectName: 'asc' } }],
    });

    if (exportFormat === 'csv') {
      const header = 'Class,Section,Subject,SubjectCode,Teacher,EmployeeId,Specialization,RoleType,Active';
      const lines = rows.map((row) => [
        row.class.className,
        row.section.sectionName,
        row.subject.subjectName,
        row.subject.subjectCode,
        row.teacher.teacherName,
        row.teacher.employeeId,
        row.teacher.specialization,
        row.roleType,
        row.isActive ? 'Yes' : 'No',
      ].map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="teacher-assignment-summary.csv"');
      return res.send([header, ...lines].join('\n'));
    }

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch assignment summary',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
