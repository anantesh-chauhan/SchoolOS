import { PrismaClient } from '@prisma/client';
import { getScopedSchoolId } from '../utils/tenant.util.js';

const prisma = new PrismaClient();

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

    const created = await prisma.class.create({
      data: {
        className: normalizedName,
        classOrder: numericOrder,
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
