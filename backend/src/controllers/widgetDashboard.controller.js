import prisma from '../config/prisma.client.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { getWidgetsForRole, WIDGET_CATALOG } from '../constants/widgetCatalog.js';
import { getUserContext, dayKey, dayDiff, toSafeNumber, buildSummaryWidgets, buildDashboardWidgets, handleCrud, createCrudHandlers } from './widgets.shared.js';

export const getWidgetCatalog = async (req, res) => {
  try {
    const { role } = req.user;
    const catalog = getWidgetsForRole(role).map((widget) => ({
      key: widget.key,
      title: widget.title,
      description: widget.description,
      kind: widget.kind,
      size: widget.size,
      icon: widget.icon,
    }));

    return res.json({
      success: true,
      data: catalog,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch widget catalog',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const getWidgetDashboard = async (req, res) => {
  try {
    const context = getUserContext(req);
    const data = await buildSummaryWidgets(context);
    const widgets = buildDashboardWidgets(context.role, data);

    return res.json({
      success: true,
      data: {
        schoolId: context.schoolId,
        role: context.role,
        widgets,
        metrics: data.metrics,
        preferences: data.preferences,
        todos: data.todos,
        notes: data.notes,
        bookmarks: data.bookmarks,
        notifications: data.notifications,
        activities: data.activities,
        streak: data.streak,
        schoolSettings: data.schoolSettings,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch widget dashboard',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const saveWidgetPreferences = async (req, res) => {
  try {
    const context = getUserContext(req);
    const { preferences } = req.body;

    if (!Array.isArray(preferences) || preferences.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'preferences must be a non-empty array',
      });
    }

    const rows = [];
    for (const preference of preferences) {
      if (!preference?.widgetKey) {
        continue;
      }

      const row = await prisma.userWidgetPreference.upsert({
        where: { userId_widgetKey: { userId: context.userId, widgetKey: preference.widgetKey } },
        create: {
          schoolId: context.schoolId,
          userId: context.userId,
          widgetKey: preference.widgetKey,
          isVisible: preference.isVisible ?? true,
          orderIndex: Number(preference.orderIndex ?? 0),
          size: String(preference.size || 'MD'),
          pinned: Boolean(preference.pinned),
          settings: preference.settings || undefined,
        },
        update: {
          isVisible: preference.isVisible ?? true,
          orderIndex: Number(preference.orderIndex ?? 0),
          size: String(preference.size || 'MD'),
          pinned: Boolean(preference.pinned),
          settings: preference.settings || undefined,
        },
      });
      rows.push(row);
    }

    return res.json({ success: true, data: rows });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to save widget preferences',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
