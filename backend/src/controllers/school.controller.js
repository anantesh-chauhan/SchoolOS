import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const toInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

export const createSchool = async (req, res) => {
  try {
    const {
      schoolName,
      schoolCode,
      address,
      city,
      state,
      phone,
      email,
      status,
    } = req.body;

    if (!schoolName || !schoolCode || !address || !city || !state || !phone || !email) {
      return res.status(400).json({
        success: false,
        message: 'All school fields are required',
      });
    }

    const school = await prisma.school.create({
      data: {
        schoolName: schoolName.trim(),
        schoolCode: schoolCode.trim().toUpperCase(),
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        status: status || 'ACTIVE',
      },
    });

    return res.status(201).json({
      success: true,
      data: school,
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'School code must be unique',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create school',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listSchools = async (req, res) => {
  try {
    const page = Math.max(1, toInt(req.query.page, 1));
    const limit = Math.min(50, Math.max(1, toInt(req.query.limit, 10)));
    const search = (req.query.search || '').trim();
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { schoolName: { contains: search, mode: 'insensitive' } },
            { schoolCode: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
            { state: { contains: search, mode: 'insensitive' } },
          ],
        }
      : undefined;

    const [rows, total] = await Promise.all([
      prisma.school.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.school.count({ where }),
    ]);

    return res.json({
      success: true,
      data: rows,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch schools',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteSchool = async (req, res) => {
  try {
    const { id } = req.params;

    const school = await prisma.school.findUnique({ where: { id } });
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    await prisma.school.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'School deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete school',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
