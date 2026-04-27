import { PrismaClient } from '@prisma/client';
import { getScopedSchoolId } from '../utils/tenant.util.js';

const prisma = new PrismaClient();
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const indexToSectionName = (index) => {
  let n = index + 1;
  let name = '';

  while (n > 0) {
    const remainder = (n - 1) % 26;
    name = ALPHABET[remainder] + name;
    n = Math.floor((n - 1) / 26);
  }

  return name;
};

export const createNextSection = async (req, res) => {
  try {
    const { classId } = req.body;
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);

    if (!classId) {
      return res.status(400).json({
        success: false,
        message: 'classId is required',
      });
    }

    const classRow = await prisma.class.findFirst({
      where: { id: classId, schoolId },
      include: {
        sections: {
          orderBy: { sectionOrder: 'desc' },
          take: 1,
        },
      },
    });

    if (!classRow) {
      return res.status(404).json({
        success: false,
        message: 'Class not found for this school',
      });
    }

    const lastOrder = classRow.sections[0]?.sectionOrder ?? 0;
    const nextOrder = lastOrder + 1;
    const nextName = indexToSectionName(nextOrder - 1);

    const created = await prisma.$transaction(async (tx) => {
      const section = await tx.section.create({
        data: {
          sectionName: nextName,
          sectionOrder: nextOrder,
          classId,
          schoolId,
        },
      });

      const classSubjects = await tx.classSubject.findMany({
        where: { classId },
        select: { subjectId: true },
      });

      if (classSubjects.length > 0) {
        await tx.sectionSubject.createMany({
          data: classSubjects.map((row) => ({
            sectionId: section.id,
            subjectId: row.subjectId,
          })),
          skipDuplicates: true,
        });
      }

      return section;
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Section already exists for this class',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create section',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listSections = async (req, res) => {
  try {
    const { classId } = req.query;
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);

    const where = {
      schoolId,
      ...(classId ? { classId } : {}),
    };

    const rows = await prisma.section.findMany({
      where,
      orderBy: [{ classId: 'asc' }, { sectionOrder: 'asc' }],
      include: {
        class: {
          select: { id: true, className: true, classOrder: true },
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
      message: 'Failed to fetch sections',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteSection = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);

    const existing = await prisma.section.findFirst({ where: { id, schoolId } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Section not found',
      });
    }

    await prisma.section.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'Section deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete section',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
