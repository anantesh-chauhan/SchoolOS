import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const sanitizeHexColor = (value, fallback) => {
  if (!value) {
    return fallback;
  }

  const normalized = String(value).trim();
  return /^#([A-Fa-f0-9]{6})$/.test(normalized) ? normalized : fallback;
};

const sanitizeString = (value) => {
  if (value === undefined) {
    return undefined;
  }

  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized : null;
};

const formatSettings = (settings) => ({
  id: settings.id,
  schoolId: settings.schoolId,
  schoolName: settings.schoolName,
  logoUrl: settings.logoUrl,
  email: settings.email,
  phone: settings.phone,
  addressLine1: settings.addressLine1,
  addressLine2: settings.addressLine2,
  city: settings.city,
  state: settings.state,
  country: settings.country,
  postalCode: settings.postalCode,
  website: settings.website,
  supportEmail: settings.supportEmail,
  primaryColor: settings.primaryColor,
  secondaryColor: settings.secondaryColor,
  createdAt: settings.createdAt,
  updatedAt: settings.updatedAt,
});

const upsertSchoolSettings = async (schoolId, payload = {}) => {
  const school = await prisma.school.findUnique({ where: { id: schoolId } });
  if (!school) {
    throw new Error('School not found');
  }

  const existing = await prisma.schoolSettings.findUnique({ where: { schoolId } });

  const mapped = {
    schoolName: payload.schoolName?.trim() || school.schoolName,
    logoUrl: sanitizeString(payload.logoUrl),
    email: sanitizeString(payload.email),
    phone: sanitizeString(payload.phone),
    addressLine1: sanitizeString(payload.addressLine1),
    addressLine2: sanitizeString(payload.addressLine2),
    city: sanitizeString(payload.city),
    state: sanitizeString(payload.state),
    country: sanitizeString(payload.country),
    postalCode: sanitizeString(payload.postalCode),
    website: sanitizeString(payload.website),
    supportEmail: sanitizeString(payload.supportEmail),
    primaryColor: sanitizeHexColor(payload.primaryColor, existing?.primaryColor || '#0f766e'),
    secondaryColor: sanitizeHexColor(payload.secondaryColor, existing?.secondaryColor || '#0f172a'),
  };

  if (!existing) {
    return prisma.schoolSettings.create({
      data: {
        schoolId,
        ...mapped,
      },
    });
  }

  return prisma.schoolSettings.update({
    where: { schoolId },
    data: Object.fromEntries(Object.entries(mapped).filter(([, value]) => value !== undefined)),
  });
};

export const listSchoolSettings = async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const search = String(req.query.search || '').trim();
    const skip = (page - 1) * limit;

    const where = search
      ? {
          OR: [
            { schoolName: { contains: search, mode: 'insensitive' } },
            { school: { schoolCode: { contains: search, mode: 'insensitive' } } },
          ],
        }
      : undefined;

    const [rows, total] = await Promise.all([
      prisma.schoolSettings.findMany({
        where,
        include: {
          school: {
            select: {
              id: true,
              schoolCode: true,
              status: true,
            },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.schoolSettings.count({ where }),
    ]);

    return res.json({
      success: true,
      data: rows.map((row) => ({
        ...formatSettings(row),
        school: row.school,
      })),
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
      message: 'Failed to fetch school settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getSchoolSettingsBySchoolId = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const existing = await prisma.schoolSettings.findUnique({ where: { schoolId } });
    if (existing) {
      return res.json({
        success: true,
        data: formatSettings(existing),
      });
    }

    const created = await upsertSchoolSettings(schoolId, {});

    return res.json({
      success: true,
      data: formatSettings(created),
    });
  } catch (error) {
    if (error.message === 'School not found') {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch school settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateSchoolSettingsBySchoolId = async (req, res) => {
  try {
    const { schoolId } = req.params;

    const payload = req.body || {};
    const updated = await upsertSchoolSettings(schoolId, payload);

    if (payload.schoolName?.trim()) {
      await prisma.school.update({
        where: { id: schoolId },
        data: { schoolName: payload.schoolName.trim() },
      });
    }

    return res.json({
      success: true,
      message: 'School settings updated successfully',
      data: formatSettings(updated),
    });
  } catch (error) {
    if (error.message === 'School not found') {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update school settings',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getCurrentSchoolBranding = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.json({
        success: true,
        data: null,
      });
    }

    const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
    if (!settings) {
      const school = await prisma.school.findUnique({
        where: { id: schoolId },
        select: { id: true, schoolName: true },
      });

      return res.json({
        success: true,
        data: {
          schoolId,
          schoolName: school?.schoolName || 'SchoolOS',
          logoUrl: null,
          primaryColor: '#0f766e',
          secondaryColor: '#0f172a',
        },
      });
    }

    return res.json({
      success: true,
      data: {
        schoolId,
        schoolName: settings.schoolName,
        logoUrl: settings.logoUrl,
        primaryColor: settings.primaryColor,
        secondaryColor: settings.secondaryColor,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch school branding',
    });
  }
};

export const getPublicSchoolBranding = async (req, res) => {
  try {
    const schoolId = req.query.schoolId;
    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'schoolId is required',
      });
    }

    const settings = await prisma.schoolSettings.findUnique({ where: { schoolId } });
    if (settings) {
      return res.json({
        success: true,
        data: {
          schoolId,
          schoolName: settings.schoolName,
          logoUrl: settings.logoUrl,
          primaryColor: settings.primaryColor,
          secondaryColor: settings.secondaryColor,
        },
      });
    }

    const school = await prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, schoolName: true },
    });

    if (!school) {
      return res.status(404).json({
        success: false,
        message: 'School not found',
      });
    }

    return res.json({
      success: true,
      data: {
        schoolId,
        schoolName: school.schoolName,
        logoUrl: null,
        primaryColor: '#0f766e',
        secondaryColor: '#0f172a',
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch school branding',
    });
  }
};
