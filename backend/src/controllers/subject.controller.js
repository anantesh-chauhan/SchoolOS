import { PrismaClient } from '@prisma/client';
import { getScopedSchoolId } from '../utils/tenant.util.js';

const prisma = new PrismaClient();

export const createSubject = async (req, res) => {
  try {
    const { subjectName, subjectCode } = req.body;
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);

    if (!subjectName || !subjectCode) {
      return res.status(400).json({
        success: false,
        message: 'subjectName and subjectCode are required',
      });
    }

    const created = await prisma.subject.create({
      data: {
        subjectName: subjectName.trim(),
        subjectCode: subjectCode.trim().toUpperCase(),
        schoolId,
      },
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Subject name/code already exists for this school',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create subject',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listSubjects = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);

    const rows = await prisma.subject.findMany({
      where: { schoolId },
      orderBy: { subjectName: 'asc' },
      include: {
        _count: {
          select: { classSubjects: true, sectionSubjects: true },
        },
      },
    });

    return res.json({
      success: true,
      data: rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subjects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);

    const row = await prisma.subject.findFirst({ where: { id, schoolId } });
    if (!row) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const assignmentCount = await prisma.classSubject.count({ where: { subjectId: id } })
      + await prisma.sectionSubject.count({ where: { subjectId: id } })
      + await prisma.teacherAssignment.count({ where: { subjectId: id } });

    if (assignmentCount > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete subject while assignments exist',
      });
    }

    await prisma.subject.delete({ where: { id } });

    return res.json({ success: true, message: 'Subject deleted successfully' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete subject',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const assignSubjectToClass = async (req, res) => {
  try {
    const { classId, subjectId } = req.body;
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);

    if (!classId || !subjectId) {
      return res.status(400).json({ success: false, message: 'classId and subjectId are required' });
    }

    const [classRow, subjectRow] = await Promise.all([
      prisma.class.findFirst({ where: { id: classId, schoolId } }),
      prisma.subject.findFirst({ where: { id: subjectId, schoolId } }),
    ]);

    if (!classRow || !subjectRow) {
      return res.status(404).json({ success: false, message: 'Class or subject not found in this school' });
    }

    const assignment = await prisma.classSubject.create({
      data: { classId, subjectId },
    });

    return res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Subject already assigned to this class' });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to assign subject to class',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const bulkAssignSubjectsToClass = async (req, res) => {
  try {
    const { classId, subjectIds } = req.body;
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);

    if (!classId || !Array.isArray(subjectIds)) {
      return res.status(400).json({ success: false, message: 'classId and subjectIds[] are required' });
    }

    const classRow = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!classRow) {
      return res.status(404).json({ success: false, message: 'Class not found in this school' });
    }

    const validSubjects = await prisma.subject.findMany({
      where: {
        schoolId,
        id: { in: subjectIds },
      },
      select: { id: true },
    });

    const validSubjectIds = new Set(validSubjects.map((item) => item.id));
    const filtered = [...new Set(subjectIds)].filter((id) => validSubjectIds.has(id));

    await prisma.classSubject.deleteMany({ where: { classId } });

    if (filtered.length > 0) {
      await prisma.classSubject.createMany({
        data: filtered.map((subjectId) => ({ classId, subjectId })),
      });
    }

    const rows = await prisma.classSubject.findMany({
      where: { classId },
      include: { subject: true },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to bulk assign subjects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const assignSubjectToSection = async (req, res) => {
  try {
    const { sectionId, subjectId } = req.body;
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);

    if (!sectionId || !subjectId) {
      return res.status(400).json({ success: false, message: 'sectionId and subjectId are required' });
    }

    const [sectionRow, subjectRow] = await Promise.all([
      prisma.section.findFirst({ where: { id: sectionId, schoolId } }),
      prisma.subject.findFirst({ where: { id: subjectId, schoolId } }),
    ]);

    if (!sectionRow || !subjectRow) {
      return res.status(404).json({ success: false, message: 'Section or subject not found in this school' });
    }

    const assignment = await prisma.sectionSubject.create({
      data: { sectionId, subjectId },
    });

    return res.status(201).json({ success: true, data: assignment });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ success: false, message: 'Subject already assigned to this section' });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to assign subject to section',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listClassSubjects = async (req, res) => {
  try {
    const { classId } = req.params;
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);

    const classRow = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!classRow) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    const rows = await prisma.classSubject.findMany({
      where: { classId },
      include: {
        subject: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch class subjects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listSectionSubjects = async (req, res) => {
  try {
    const { sectionId } = req.params;
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);

    const sectionRow = await prisma.section.findFirst({ where: { id: sectionId, schoolId } });
    if (!sectionRow) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    const rows = await prisma.sectionSubject.findMany({
      where: { sectionId },
      include: {
        subject: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch section subjects',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listSubjectMappings = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const rows = await prisma.subject.findMany({
      where: { schoolId },
      orderBy: { subjectName: 'asc' },
      include: {
        classSubjects: {
          include: {
            class: {
              select: { id: true, className: true, classOrder: true },
            },
          },
        },
        sectionSubjects: {
          include: {
            section: {
              select: {
                id: true,
                sectionName: true,
                class: {
                  select: { id: true, className: true, classOrder: true },
                },
              },
            },
          },
        },
      },
    });

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch subject mappings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateSubject = async (req, res) => {
  try {
    const { id } = req.params;
    const { subjectName, subjectCode } = req.body;
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);

    if (!subjectName || !subjectCode) {
      return res.status(400).json({
        success: false,
        message: 'subjectName and subjectCode are required',
      });
    }

    const existing = await prisma.subject.findFirst({ where: { id, schoolId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Subject not found' });
    }

    const updated = await prisma.subject.update({
      where: { id },
      data: {
        subjectName: subjectName.trim(),
        subjectCode: subjectCode.trim().toUpperCase(),
      },
    });

    return res.json({ success: true, data: updated });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Subject name/code already exists for this school',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update subject',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const removeSubjectFromClass = async (req, res) => {
  try {
    const { classId, subjectId } = req.body;
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);

    if (!classId || !subjectId) {
      return res.status(400).json({ success: false, message: 'classId and subjectId are required' });
    }

    const classRow = await prisma.class.findFirst({ where: { id: classId, schoolId } });
    if (!classRow) {
      return res.status(404).json({ success: false, message: 'Class not found' });
    }

    await prisma.classSubject.deleteMany({ where: { classId, subjectId } });
    return res.json({ success: true, message: 'Subject removed from class' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to remove class subject assignment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const removeSubjectFromSection = async (req, res) => {
  try {
    const { sectionId, subjectId } = req.body;
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);

    if (!sectionId || !subjectId) {
      return res.status(400).json({ success: false, message: 'sectionId and subjectId are required' });
    }

    const sectionRow = await prisma.section.findFirst({ where: { id: sectionId, schoolId } });
    if (!sectionRow) {
      return res.status(404).json({ success: false, message: 'Section not found' });
    }

    await prisma.sectionSubject.deleteMany({ where: { sectionId, subjectId } });
    return res.json({ success: true, message: 'Subject removed from section' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to remove section subject assignment',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
