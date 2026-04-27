import { PrismaClient } from '@prisma/client';
import { getScopedSchoolId } from '../utils/tenant.util.js';

const prisma = new PrismaClient();
const DEFAULT_OVERLOAD_THRESHOLD = Number(process.env.TEACHER_OVERLOAD_THRESHOLD || 8);

const normalizeSubjectsHandled = (value) => {
  if (!Array.isArray(value)) {
    return [];
  }

  return [...new Set(value.map((item) => String(item || '').trim()).filter(Boolean))];
};

const getTeacherWithLoad = async (teacherId) => {
  const assignments = await prisma.teacherAssignment.findMany({
    where: { teacherId },
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
    } = req.body;

    if (!teacherName || !email || !phone || !employeeId || !qualification || !specialization) {
      return res.status(400).json({
        success: false,
        message: 'teacherName, email, phone, employeeId, qualification, specialization are required',
      });
    }

    const created = await prisma.teacher.create({
      data: {
        schoolId,
        teacherName: teacherName.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
        employeeId: employeeId.trim().toUpperCase(),
        qualification: qualification.trim(),
        specialization: specialization.trim(),
        subjectsHandled: normalizeSubjectsHandled(subjectsHandled),
      },
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Teacher email or employeeId already exists for this school',
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

    const updated = await prisma.teacher.update({
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

    await prisma.teacher.delete({ where: { id } });

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

    const bySubjectId = new Map(assignments.map((item) => [item.subjectId, item]));

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
      await tx.teacherAssignment.deleteMany({ where: { schoolId, classId, sectionId } });
      await tx.teacherAssignment.createMany({
        data: finalAssignments.map((item) => ({
          schoolId,
          classId,
          sectionId,
          subjectId: item.subjectId,
          teacherId: item.teacherId,
          isTemporary: item.isTemporary,
        })),
      });
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
    const { classId, sectionId, teacherId, exportFormat } = req.query;

    const where = {
      schoolId,
      ...(classId ? { classId } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(teacherId ? { teacherId } : {}),
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
      const header = 'Class,Section,Subject,SubjectCode,Teacher,EmployeeId,Specialization';
      const lines = rows.map((row) => [
        row.class.className,
        row.section.sectionName,
        row.subject.subjectName,
        row.subject.subjectCode,
        row.teacher.teacherName,
        row.teacher.employeeId,
        row.teacher.specialization,
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
