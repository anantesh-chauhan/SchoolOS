import { PrismaClient } from '@prisma/client';
import { getScopedSchoolId } from '../utils/tenant.util.js';

const prisma = new PrismaClient();

const getDefaultIndianSubjectsForClass = (className) => {
  const normalized = String(className || '').trim();
  const classMatch = normalized.match(/class\s*(\d+)/i);
  const classNo = classMatch ? Number(classMatch[1]) : null;

  if (['Nursery', 'LKG', 'UKG'].includes(normalized)) {
    return ['English', 'Hindi', 'Mathematics', 'Environmental Studies', 'Art & Craft', 'Rhymes', 'Physical Education'];
  }

  if (classNo >= 1 && classNo <= 5) {
    return ['English', 'Hindi', 'Mathematics', 'Environmental Studies', 'General Knowledge', 'Art & Craft', 'Computer', 'Physical Education'];
  }

  if (classNo >= 6 && classNo <= 8) {
    return ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Sanskrit', 'Computer', 'Physical Education', 'Moral Science'];
  }

  if (classNo === 9 || classNo === 10) {
    return ['English', 'Hindi', 'Mathematics', 'Science', 'Social Science', 'Computer', 'Physical Education', 'Sanskrit'];
  }

  if (classNo === 11 || classNo === 12) {
    return ['English', 'Physical Education'];
  }

  return [];
};

export const createClass = async (req, res) => {
  try {
    const { className, classOrder } = req.body;
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const normalizedName = className?.trim();
    const numericOrder = Number(classOrder);

    if (!normalizedName || Number.isNaN(numericOrder)) {
      return res.status(400).json({
        success: false,
        message: 'className and classOrder are required',
      });
    }

    const created = await prisma.$transaction(async (tx) => {
      const classRow = await tx.class.create({
        data: {
          className: normalizedName,
          classOrder: numericOrder,
          schoolId,
        },
      });

      const defaultSubjects = getDefaultIndianSubjectsForClass(normalizedName);
      if (defaultSubjects.length > 0) {
        const subjectRows = await tx.subject.findMany({
          where: {
            schoolId,
            subjectName: { in: defaultSubjects },
          },
          select: { id: true },
        });

        if (subjectRows.length > 0) {
          await tx.classSubject.createMany({
            data: subjectRows.map((row) => ({
              classId: classRow.id,
              subjectId: row.id,
            })),
            skipDuplicates: true,
          });
        }
      }

      return classRow;
    });

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Duplicate class name or class order for this school',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create class',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listClasses = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);

    const rows = await prisma.class.findMany({
      where: { schoolId },
      orderBy: [{ classOrder: 'asc' }, { className: 'asc' }],
      include: {
        _count: {
          select: { sections: true, classSubjects: true },
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
      message: 'Failed to fetch classes',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteClass = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);

    const row = await prisma.class.findFirst({
      where: { id, schoolId },
      include: {
        _count: {
          select: {
            sections: true,
          },
        },
      },
    });

    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Class not found',
      });
    }

    if (row._count.sections > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete class with active sections. Remove sections first.',
      });
    }

    const activeStudents = await prisma.user.count({
      where: {
        classId: id,
        role: 'STUDENT',
      },
    });

    if (activeStudents > 0) {
      return res.status(409).json({
        success: false,
        message: 'Cannot delete class with active students mapped',
      });
    }

    await prisma.class.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'Class deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete class',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
