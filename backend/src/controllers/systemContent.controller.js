import prisma from '../config/prisma.client.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { getWidgetsForRole, WIDGET_CATALOG } from '../constants/widgetCatalog.js';
import { getUserContext, dayKey, dayDiff, toSafeNumber, buildSummaryWidgets, buildDashboardWidgets, handleCrud, createCrudHandlers } from './widgets.shared.js';

export const listSystemContent = async (req, res) => {
  try {
    const context = getUserContext(req);
    const publishedOnly = !['PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN'].includes(context.role);

    const rows = await prisma.systemContent.findMany({
      where: {
        schoolId: context.schoolId,
        ...(publishedOnly ? { isPublished: true } : {}),
      },
      orderBy: [{ updatedAt: 'desc' }],
    });

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch system content',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const upsertSystemContent = async (req, res) => {
  try {
    const context = getUserContext(req);
    const { contentKey, title, body, metadata, isPublished = true, effectiveFrom = null, effectiveTo = null } = req.body || {};

    if (!contentKey?.trim() || !title?.trim() || !body?.trim()) {
      return res.status(400).json({
        success: false,
        message: 'contentKey, title, and body are required',
      });
    }

    const row = await prisma.systemContent.upsert({
      where: { schoolId_contentKey: { schoolId: context.schoolId, contentKey: contentKey.trim() } },
      create: {
        schoolId: context.schoolId,
        contentKey: contentKey.trim(),
        title: title.trim(),
        body: body.trim(),
        metadata: metadata || undefined,
        isPublished: Boolean(isPublished),
        effectiveFrom,
        effectiveTo,
        createdById: context.userId,
      },
      update: {
        title: title.trim(),
        body: body.trim(),
        metadata: metadata || undefined,
        isPublished: Boolean(isPublished),
        effectiveFrom,
        effectiveTo,
        createdById: context.userId,
      },
    });

    return res.json({ success: true, data: row });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to save system content',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const deleteSystemContent = async (req, res) => {
  try {
    const context = getUserContext(req);
    const { id } = req.params;
    const existing = await prisma.systemContent.findFirst({ where: { id, schoolId: context.schoolId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'System content not found' });
    }

    await prisma.systemContent.delete({ where: { id } });
    return res.json({ success: true, message: 'System content deleted successfully' });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to delete system content',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
