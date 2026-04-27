import { PrismaClient } from '@prisma/client';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { getOptimizedCloudinaryImageUrl } from '../utils/cloudinary.util.js';

const prisma = new PrismaClient();

const toInt = (value, fallback = 0) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
};

const mapGroup = (group) => ({
  ...group,
  coverImageUrlOptimized: getOptimizedCloudinaryImageUrl(group.coverImageUrl),
});

const mapPhoto = (photo) => ({
  ...photo,
  imageUrlOptimized: getOptimizedCloudinaryImageUrl(photo.imageUrl),
});

export const listGalleryGroups = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);

    const groups = await prisma.galleryGroup.findMany({
      where: { schoolId },
      include: {
        _count: { select: { photos: true } },
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return res.json({
      success: true,
      data: groups.map(mapGroup),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch gallery groups',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const createGalleryGroup = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { title, description, coverImageUrl, isVisible = true, displayOrder } = req.body;

    if (!title?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'title is required',
      });
    }

    const maxOrder = await prisma.galleryGroup.aggregate({
      where: { schoolId },
      _max: { displayOrder: true },
    });

    const row = await prisma.galleryGroup.create({
      data: {
        schoolId,
        title: title.trim(),
        description: description?.trim() || null,
        coverImageUrl: coverImageUrl?.trim() || null,
        isVisible: Boolean(isVisible),
        displayOrder:
          displayOrder === undefined || displayOrder === null
            ? (maxOrder._max.displayOrder || 0) + 1
            : toInt(displayOrder, 0),
      },
      include: {
        _count: { select: { photos: true } },
      },
    });

    return res.status(201).json({
      success: true,
      data: mapGroup(row),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Gallery group title must be unique per school',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to create gallery group',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateGalleryGroup = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId || req.query.schoolId);
    const { id } = req.params;
    const { title, description, coverImageUrl, isVisible, displayOrder } = req.body;

    const existing = await prisma.galleryGroup.findFirst({ where: { id, schoolId } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Gallery group not found',
      });
    }

    const row = await prisma.galleryGroup.update({
      where: { id },
      data: {
        ...(title !== undefined ? { title: title.trim() } : {}),
        ...(description !== undefined ? { description: description?.trim() || null } : {}),
        ...(coverImageUrl !== undefined ? { coverImageUrl: coverImageUrl?.trim() || null } : {}),
        ...(isVisible !== undefined ? { isVisible: Boolean(isVisible) } : {}),
        ...(displayOrder !== undefined ? { displayOrder: toInt(displayOrder, existing.displayOrder) } : {}),
      },
      include: {
        _count: { select: { photos: true } },
      },
    });

    return res.json({
      success: true,
      data: mapGroup(row),
    });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({
        success: false,
        message: 'Gallery group title must be unique per school',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Failed to update gallery group',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteGalleryGroup = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { id } = req.params;

    const existing = await prisma.galleryGroup.findFirst({ where: { id, schoolId } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Gallery group not found',
      });
    }

    await prisma.galleryGroup.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'Gallery group deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete gallery group',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const reorderGalleryGroups = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { order } = req.body;

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'order must be a non-empty array',
      });
    }

    await prisma.$transaction(
      order.map((item, index) =>
        prisma.galleryGroup.updateMany({
          where: {
            id: item.id,
            schoolId,
          },
          data: {
            displayOrder: item.displayOrder ?? index + 1,
          },
        })
      )
    );

    return res.json({
      success: true,
      message: 'Gallery groups reordered',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reorder gallery groups',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listGalleryPhotosByGroup = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { groupId } = req.params;

    const group = await prisma.galleryGroup.findFirst({
      where: { id: groupId, schoolId },
      select: { id: true, title: true },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Gallery group not found',
      });
    }

    const rows = await prisma.galleryPhoto.findMany({
      where: { schoolId, groupId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return res.json({
      success: true,
      group,
      data: rows.map(mapPhoto),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch gallery photos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const createGalleryPhotos = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { groupId } = req.params;
    const { photos } = req.body;

    if (!Array.isArray(photos) || photos.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'photos must be a non-empty array',
      });
    }

    const group = await prisma.galleryGroup.findFirst({ where: { id: groupId, schoolId } });
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Gallery group not found',
      });
    }

    const maxOrder = await prisma.galleryPhoto.aggregate({
      where: { schoolId, groupId },
      _max: { displayOrder: true },
    });

    let currentOrder = (maxOrder._max.displayOrder || 0) + 1;

    const preparedRows = photos
      .filter((photo) => photo?.imageUrl)
      .map((photo) => ({
        schoolId,
        groupId,
        imageUrl: String(photo.imageUrl).trim(),
        caption: photo.caption?.trim() || null,
        isVisible: photo.isVisible === undefined ? true : Boolean(photo.isVisible),
        displayOrder: photo.displayOrder ?? currentOrder++,
      }));

    if (preparedRows.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No valid photos provided',
      });
    }

    await prisma.galleryPhoto.createMany({
      data: preparedRows,
    });

    const rows = await prisma.galleryPhoto.findMany({
      where: { schoolId, groupId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return res.status(201).json({
      success: true,
      data: rows.map(mapPhoto),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to create gallery photos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const updateGalleryPhoto = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId || req.query.schoolId);
    const { id } = req.params;
    const { imageUrl, caption, isVisible, displayOrder } = req.body;

    const existing = await prisma.galleryPhoto.findFirst({ where: { id, schoolId } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found',
      });
    }

    const row = await prisma.galleryPhoto.update({
      where: { id },
      data: {
        ...(imageUrl !== undefined ? { imageUrl: imageUrl?.trim() || existing.imageUrl } : {}),
        ...(caption !== undefined ? { caption: caption?.trim() || null } : {}),
        ...(isVisible !== undefined ? { isVisible: Boolean(isVisible) } : {}),
        ...(displayOrder !== undefined ? { displayOrder: toInt(displayOrder, existing.displayOrder) } : {}),
      },
    });

    return res.json({
      success: true,
      data: mapPhoto(row),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update photo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteGalleryPhoto = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.query.schoolId);
    const { id } = req.params;

    const existing = await prisma.galleryPhoto.findFirst({ where: { id, schoolId } });
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Photo not found',
      });
    }

    await prisma.galleryPhoto.delete({ where: { id } });

    return res.json({
      success: true,
      message: 'Photo deleted successfully',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete photo',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const reorderGalleryPhotos = async (req, res) => {
  try {
    const schoolId = getScopedSchoolId(req.user, req.body.schoolId);
    const { groupId } = req.params;
    const { order } = req.body;

    if (!Array.isArray(order) || order.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'order must be a non-empty array',
      });
    }

    const group = await prisma.galleryGroup.findFirst({ where: { id: groupId, schoolId } });
    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Gallery group not found',
      });
    }

    await prisma.$transaction(
      order.map((item, index) =>
        prisma.galleryPhoto.updateMany({
          where: {
            id: item.id,
            schoolId,
            groupId,
          },
          data: {
            displayOrder: item.displayOrder ?? index + 1,
          },
        })
      )
    );

    return res.json({
      success: true,
      message: 'Gallery photos reordered',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to reorder gallery photos',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listPublicGalleryGroups = async (req, res) => {
  try {
    const schoolId = req.query.schoolId || req.user?.schoolId;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'schoolId is required',
      });
    }

    const rows = await prisma.galleryGroup.findMany({
      where: {
        schoolId,
        isVisible: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    const visibleCounts = await prisma.galleryPhoto.groupBy({
      by: ['groupId'],
      where: {
        schoolId,
        isVisible: true,
      },
      _count: {
        _all: true,
      },
    });

    const visibleCountByGroup = new Map(visibleCounts.map((row) => [row.groupId, row._count._all]));

    return res.json({
      success: true,
      data: rows.map((row) => ({
        ...mapGroup(row),
        _count: {
          photos: visibleCountByGroup.get(row.id) || 0,
        },
      })),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch public gallery groups',
    });
  }
};

export const listPublicGalleryPhotos = async (req, res) => {
  try {
    const schoolId = req.query.schoolId || req.user?.schoolId;
    const { groupId } = req.params;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'schoolId is required',
      });
    }

    const group = await prisma.galleryGroup.findFirst({
      where: {
        id: groupId,
        schoolId,
        isVisible: true,
      },
      select: {
        id: true,
        title: true,
        description: true,
        coverImageUrl: true,
      },
    });

    if (!group) {
      return res.status(404).json({
        success: false,
        message: 'Gallery group not found',
      });
    }

    const photos = await prisma.galleryPhoto.findMany({
      where: {
        schoolId,
        groupId,
        isVisible: true,
      },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    });

    return res.json({
      success: true,
      group: mapGroup(group),
      data: photos.map(mapPhoto),
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch gallery photos',
    });
  }
};
