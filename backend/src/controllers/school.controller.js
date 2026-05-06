import { PrismaClient } from '@prisma/client';
import { buildDefaultSchoolConfig, buildSchoolTheme, deriveSchoolSlug, normalizeSchoolPayload } from '../utils/publicSchool.util.js';

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
      slug,
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

    const resolvedSlug = deriveSchoolSlug({ slug, schoolCode, schoolName });

    const school = await prisma.school.create({
      data: {
        schoolName: schoolName.trim(),
        schoolCode: schoolCode.trim().toUpperCase(),
        slug: resolvedSlug,
        address: address.trim(),
        logoUrl: req.body.logoUrl?.trim() || null,
        city: city.trim(),
        state: state.trim(),
        phone: phone.trim(),
        email: email.trim().toLowerCase(),
        status: status || 'ACTIVE',
        theme: buildSchoolTheme({ slug: resolvedSlug, schoolCode, schoolName }),
        config: buildDefaultSchoolConfig({
          slug: resolvedSlug,
          schoolCode,
          schoolName,
          address,
          city,
          state,
          phone,
          email,
        }),
      },
    });

    return res.status(201).json({
      success: true,
      data: normalizeSchoolPayload(school),
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

export const getPublicSchoolBySlug = async (req, res) => {
  try {
    const slug = String(req.params.slug || '').trim().toLowerCase();

    if (!slug) {
      return res.status(400).json({
        success: false,
        message: 'School slug is required',
      });
    }

    const school = await prisma.school.findFirst({
      where: {
        OR: [
          { slug },
          { schoolCode: slug.toUpperCase() },
          { schoolCode: slug },
        ],
      },
      select: {
        id: true,
        schoolName: true,
        schoolCode: true,
        slug: true,
        theme: true,
        config: true,
      },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    return res.json({
      success: true,
      data: normalizeSchoolPayload(school),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch public school',
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

export const getMySchool = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'User is not mapped to a school',
      });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      include: {
        settings: true,
      },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    return res.json({
      success: true,
      data: school,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch school profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateMySchoolBasicDetails = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'User is not mapped to a school',
      });
    }

    const payload = {
      schoolName: req.body.schoolName,
      logoUrl: req.body.logoUrl,
      address: req.body.address,
      city: req.body.city,
      state: req.body.state,
      phone: req.body.phone,
      email: req.body.email,
    };

    const updates = Object.fromEntries(
      Object.entries(payload)
        .filter(([, value]) => value !== undefined)
        .map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])
    );

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided for update',
      });
    }

    const school = await prisma.school.findUnique({ where: { id: schoolId } });
    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    const [updatedSchool] = await prisma.$transaction([
      prisma.school.update({
        where: { id: schoolId },
        data: updates,
      }),
      prisma.schoolSettings.upsert({
        where: { schoolId },
        create: {
          schoolId,
          schoolName: updates.schoolName || school.schoolName,
          logoUrl: updates.logoUrl || school.logoUrl || null,
          email: updates.email || school.email,
          phone: updates.phone || school.phone,
          addressLine1: updates.address || school.address,
          city: updates.city || school.city,
          state: updates.state || school.state,
          country: 'India',
          primaryColor: '#0f766e',
          secondaryColor: '#0f172a',
        },
        update: {
          ...(updates.schoolName ? { schoolName: updates.schoolName } : {}),
          ...(updates.logoUrl !== undefined ? { logoUrl: updates.logoUrl } : {}),
          ...(updates.email ? { email: updates.email } : {}),
          ...(updates.phone ? { phone: updates.phone } : {}),
          ...(updates.address ? { addressLine1: updates.address } : {}),
          ...(updates.city ? { city: updates.city } : {}),
          ...(updates.state ? { state: updates.state } : {}),
        },
      }),
    ]);

    return res.json({
      success: true,
      message: 'School basic details updated successfully',
      data: updatedSchool,
    });
  } catch (error) {
        return res.status(500).json({
      success: false,
      message: 'Failed to update school profile',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getSchoolProfile = async (req, res) => {
  return getMySchool(req, res);
};

export const updateSchoolProfile = async (req, res) => {
  return updateMySchoolBasicDetails(req, res);
};
