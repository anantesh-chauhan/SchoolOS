import { PrismaClient } from '@prisma/client';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { getWidgetsForRole, WIDGET_CATALOG } from '../constants/widgetCatalog.js';

const prisma = new PrismaClient();

const getUserContext = (req) => {
  if (!req.user?.id) {
    throw new Error('Unauthorized');
  }

  return {
    userId: req.user.id,
    role: req.user.role,
    schoolId: getScopedSchoolId(req.user, req.query.schoolId || req.body?.schoolId),
  };
};

const dayKey = (value) => new Date(value).toISOString().slice(0, 10);

const dayDiff = (left, right) => {
  const start = new Date(dayKey(left));
  const end = new Date(dayKey(right));
  return Math.round((end.getTime() - start.getTime()) / 86400000);
};

const toSafeNumber = (value) => Number(value || 0);

const buildSummaryWidgets = async ({ schoolId, userId }) => {
  const [studentCount, teacherCount, classCount, sectionCount, subjectCount, timetableCount, slotCount, weeklyRequirementCount, assignmentCount, academicLevelCount, streamCount, galleryGroupCount, activityCount, labRoomCount, labRuleCount, publishedContentCount] = await Promise.all([
    prisma.user.count({ where: { schoolId, role: 'STUDENT' } }),
    prisma.teacher.count({ where: { schoolId, deletedAt: null } }),
    prisma.class.count({ where: { schoolId, deletedAt: null } }),
    prisma.section.count({ where: { schoolId, deletedAt: null } }),
    prisma.subject.count({ where: { schoolId, deletedAt: null } }),
    prisma.timetable.count({ where: { schoolId } }),
    prisma.timetableSlot.count({ where: { schoolId } }),
    prisma.subjectWeeklyRequirement.count({ where: { schoolId } }),
    prisma.teacherAssignment.count({ where: { schoolId } }),
    prisma.academicLevel.count({ where: { schoolId, deletedAt: null } }),
    prisma.stream.count({ where: { schoolId, deletedAt: null } }),
    prisma.galleryGroup.count({ where: { schoolId } }),
    prisma.activity.count({ where: { schoolId, deletedAt: null } }),
    prisma.labRoom.count({ where: { schoolId, deletedAt: null } }),
    prisma.labSubjectRule.count({ where: { schoolId, deletedAt: null } }),
    prisma.systemContent.count({ where: { schoolId, isPublished: true } }),
  ]);

  const teacherLoad = await prisma.teacherAssignment.groupBy({
    by: ['teacherId'],
    where: { schoolId },
    _count: { teacherId: true },
    orderBy: { _count: { teacherId: 'desc' } },
    take: 1,
  });

  const busiestTeacher = teacherLoad.length > 0
    ? await prisma.teacher.findFirst({
        where: { id: teacherLoad[0].teacherId },
        select: { teacherName: true, employeeId: true },
      })
    : null;

  const [recentAcademicLevels, recentStreams, recentSections, recentGalleryGroups, recentActivities, recentSystemContent] = await Promise.all([
    prisma.academicLevel.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      take: 5,
      select: { id: true, code: true, name: true, minClassOrder: true, maxClassOrder: true },
    }),
    prisma.stream.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      take: 5,
      select: { id: true, code: true, name: true, classFrom: true, classTo: true, isActive: true },
    }),
    prisma.section.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: [{ createdAt: 'desc' }],
      take: 5,
      select: { id: true, sectionName: true, sectionOrder: true, class: { select: { className: true } } },
    }),
    prisma.galleryGroup.findMany({
      where: { schoolId },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      take: 4,
      include: { _count: { select: { photos: true } } },
    }),
    prisma.activity.findMany({
      where: { schoolId, deletedAt: null },
      orderBy: [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
      take: 5,
      select: { id: true, name: true, code: true, capacity: true, isActive: true },
    }),
    prisma.systemContent.findMany({
      where: { schoolId, isPublished: true },
      orderBy: [{ updatedAt: 'desc' }],
      take: 5,
      select: { id: true, contentKey: true, title: true, body: true, effectiveFrom: true, effectiveTo: true },
    }),
  ]);

  const [preferences, todos, notes, bookmarks, notifications, activities, streak, schoolSettings] = await Promise.all([
    prisma.userWidgetPreference.findMany({
      where: { schoolId, userId },
      orderBy: [{ orderIndex: 'asc' }, { createdAt: 'asc' }],
    }).catch(() => []),
    prisma.userWidgetTodo.findMany({
      where: { schoolId, userId },
      orderBy: [{ isCompleted: 'asc' }, { createdAt: 'desc' }],
    }).catch(() => []),
    prisma.userWidgetNote.findMany({
      where: { schoolId, userId },
      orderBy: [{ pinned: 'desc' }, { orderIndex: 'asc' }, { updatedAt: 'desc' }],
    }).catch(() => []),
    prisma.userWidgetBookmark.findMany({
      where: { schoolId, userId, isActive: true },
      orderBy: [{ createdAt: 'desc' }],
    }).catch(() => []),
    prisma.userWidgetNotification.findMany({
      where: { schoolId, userId },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 10,
    }).catch(() => []),
    prisma.userWidgetActivity.findMany({
      where: { schoolId, userId },
      orderBy: [{ createdAt: 'desc' }],
      take: 10,
    }).catch(() => []),
    prisma.userLoginStreak.findUnique({ where: { userId } }).catch(() => null),
    prisma.schoolSettings.findUnique({ where: { schoolId } }).catch(() => null),
  ]);

  return {
    metrics: {
      students: studentCount,
      teachers: teacherCount,
      classes: classCount,
      sections: sectionCount,
      subjects: subjectCount,
      timetables: timetableCount,
      slots: slotCount,
      weeklyRequirements: weeklyRequirementCount,
      assignments: assignmentCount,
      academicLevels: academicLevelCount,
      streams: streamCount,
      galleryGroups: galleryGroupCount,
      activities: activityCount,
      labRooms: labRoomCount,
      labRules: labRuleCount,
      publishedContent: publishedContentCount,
      busiestTeacher: busiestTeacher?.teacherName || null,
      busiestTeacherCode: busiestTeacher?.employeeId || null,
    },
    recentAcademicLevels,
    recentStreams,
    recentSections,
    recentGalleryGroups,
    recentActivities,
    recentSystemContent,
    preferences,
    todos,
    notes,
    bookmarks,
    notifications,
    activities,
    streak,
    schoolSettings,
  };
};

const buildDashboardWidgets = (role, data) => {
  const catalog = getWidgetsForRole(role);

  return catalog.map((widget) => {
    switch (widget.key) {
      case 'school-kpis':
        return {
          ...widget,
          data: [
            { label: 'Students', value: data.metrics.students },
            { label: 'Teachers', value: data.metrics.teachers },
            { label: 'Classes', value: data.metrics.classes },
            { label: 'Sections', value: data.metrics.sections },
          ],
        };
      case 'curriculum-health':
        return {
          ...widget,
          data: [
            { label: 'Subjects', value: data.metrics.subjects },
            { label: 'Assignments', value: data.metrics.assignments },
            { label: 'Weekly Rules', value: data.metrics.weeklyRequirements },
            { label: 'Academic Levels', value: data.metrics.academicLevels },
          ],
        };
      case 'timetable-health':
        return {
          ...widget,
          data: [
            { label: 'Timetables', value: data.metrics.timetables },
            { label: 'Slots', value: data.metrics.slots },
            { label: 'Activity Periods', value: data.recentActivities.length },
            { label: 'Streams', value: data.metrics.streams },
          ],
        };
      case 'teacher-load':
        return {
          ...widget,
          data: [
            { label: 'Teachers', value: data.metrics.teachers },
            { label: 'Assignments', value: data.metrics.assignments },
            { label: 'Busiest Teacher', value: data.metrics.busiestTeacher || 'N/A' },
            { label: 'Teacher Code', value: data.metrics.busiestTeacherCode || 'N/A' },
          ],
        };
      case 'academic-levels':
        return { ...widget, data: data.recentAcademicLevels };
      case 'streams':
        return { ...widget, data: data.recentStreams };
      case 'section-map':
        return { ...widget, data: data.recentSections };
      case 'subject-map':
        return {
          ...widget,
          data: [
            { label: 'Subjects', value: data.metrics.subjects },
            { label: 'Weekly Requirements', value: data.metrics.weeklyRequirements },
            { label: 'Assignments', value: data.metrics.assignments },
          ],
        };
      case 'gallery-highlights':
        return {
          ...widget,
          data: data.recentGalleryGroups.map((group) => ({
            id: group.id,
            title: group.title,
            description: group.description,
            count: group._count?.photos || 0,
            isVisible: group.isVisible,
          })),
        };
      case 'school-branding':
        return {
          ...widget,
          data: data.schoolSettings
            ? {
                schoolName: data.schoolSettings.schoolName,
                logoUrl: data.schoolSettings.logoUrl,
                primaryColor: data.schoolSettings.primaryColor,
                secondaryColor: data.schoolSettings.secondaryColor,
                website: data.schoolSettings.website,
                supportEmail: data.schoolSettings.supportEmail,
              }
            : null,
        };
      case 'quick-actions':
        return {
          ...widget,
          data: [
            { label: 'Open Timetable Builder', href: '/dashboard/admin/timetable-builder' },
            { label: 'Review Teacher Assignments', href: '/dashboard/admin/teacher-assignment-summary' },
            { label: 'Open Gallery Studio', href: '/dashboard/admin/gallery' },
          ],
        };
      case 'pending-todos':
        return { ...widget, data: data.todos };
      case 'notes':
        return { ...widget, data: data.notes };
      case 'bookmarks':
        return { ...widget, data: data.bookmarks };
      case 'notifications':
        return { ...widget, data: data.notifications };
      case 'activity-feed':
        return { ...widget, data: data.activities };
      case 'login-streak':
        return {
          ...widget,
          data: data.streak
            ? {
                currentStreak: data.streak.currentStreak,
                bestStreak: data.streak.bestStreak,
                lastLoginAt: data.streak.lastLoginAt,
              }
            : { currentStreak: 0, bestStreak: 0, lastLoginAt: null },
        };
      case 'lab-ready':
        return {
          ...widget,
          data: [
            { label: 'Lab Rooms', value: data.metrics.labRooms },
            { label: 'Lab Rules', value: data.metrics.labRules },
          ],
        };
      case 'activity-planner':
        return { ...widget, data: data.recentActivities };
      case 'system-content':
        return { ...widget, data: data.recentSystemContent };
      default:
        return { ...widget, data: [] };
    }
  });
};

const handleCrud = (model, schoolId, userId, req, res, mapCreate, mapUpdate) => {
  return Promise.resolve({ model, schoolId, userId, req, res, mapCreate, mapUpdate });
};

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

const createCrudHandlers = (modelName) => ({
  list: async (req, res) => {
    try {
      const context = getUserContext(req);
      const rows = await prisma[modelName].findMany({
        where: { schoolId: context.schoolId, userId: context.userId },
        orderBy: [{ createdAt: 'desc' }],
      });
      return res.json({ success: true, data: rows });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Failed to fetch ${modelName}`,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },
  create: async (req, res) => {
    try {
      const context = getUserContext(req);
      const payload = req.body || {};
      const row = await prisma[modelName].create({
        data: {
          schoolId: context.schoolId,
          userId: context.userId,
          ...payload,
        },
      });
      return res.status(201).json({ success: true, data: row });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Failed to create ${modelName}`,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },
  update: async (req, res) => {
    try {
      const context = getUserContext(req);
      const { id } = req.params;
      const existing = await prisma[modelName].findFirst({ where: { id, schoolId: context.schoolId, userId: context.userId } });
      if (!existing) {
        return res.status(404).json({ success: false, message: `${modelName} not found` });
      }

      const row = await prisma[modelName].update({ where: { id }, data: req.body || {} });
      return res.json({ success: true, data: row });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Failed to update ${modelName}`,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },
  remove: async (req, res) => {
    try {
      const context = getUserContext(req);
      const { id } = req.params;
      const existing = await prisma[modelName].findFirst({ where: { id, schoolId: context.schoolId, userId: context.userId } });
      if (!existing) {
        return res.status(404).json({ success: false, message: `${modelName} not found` });
      }

      await prisma[modelName].delete({ where: { id } });
      return res.json({ success: true, message: `${modelName} deleted successfully` });
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: `Failed to delete ${modelName}`,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      });
    }
  },
});

const todoHandlers = createCrudHandlers('userWidgetTodo');
const noteHandlers = createCrudHandlers('userWidgetNote');
const bookmarkHandlers = createCrudHandlers('userWidgetBookmark');
const notificationHandlers = createCrudHandlers('userWidgetNotification');
const activityHandlers = createCrudHandlers('userWidgetActivity');

export const listTodos = todoHandlers.list;
export const createTodo = todoHandlers.create;
export const updateTodo = todoHandlers.update;
export const deleteTodo = todoHandlers.remove;

export const listNotes = noteHandlers.list;
export const createNote = noteHandlers.create;
export const updateNote = noteHandlers.update;
export const deleteNote = noteHandlers.remove;

export const listBookmarks = bookmarkHandlers.list;
export const createBookmark = bookmarkHandlers.create;
export const updateBookmark = bookmarkHandlers.update;
export const deleteBookmark = bookmarkHandlers.remove;

export const listNotifications = notificationHandlers.list;
export const markNotificationRead = async (req, res) => {
  try {
    const context = getUserContext(req);
    const { id } = req.params;
    const existing = await prisma.userWidgetNotification.findFirst({ where: { id, schoolId: context.schoolId, userId: context.userId } });
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    const row = await prisma.userWidgetNotification.update({
      where: { id },
      data: { isRead: true },
    });

    return res.json({ success: true, data: row });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update notification',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const listActivities = activityHandlers.list;

export const pingLoginStreak = async (req, res) => {
  try {
    const context = getUserContext(req);
    const now = new Date();
    const existing = await prisma.userLoginStreak.findUnique({ where: { userId: context.userId } });

    let currentStreak = 1;
    let bestStreak = 1;
    let streakStartedAt = now;

    if (existing) {
      const lastLogin = existing.lastLoginAt ? new Date(existing.lastLoginAt) : null;
      const sameDay = lastLogin ? dayKey(lastLogin) === dayKey(now) : false;
      const yesterday = lastLogin ? dayDiff(lastLogin, now) === 1 : false;

      if (sameDay) {
        currentStreak = existing.currentStreak;
        bestStreak = existing.bestStreak;
        streakStartedAt = existing.streakStartedAt || existing.createdAt;
      } else if (yesterday) {
        currentStreak = existing.currentStreak + 1;
        bestStreak = Math.max(existing.bestStreak, currentStreak);
        streakStartedAt = existing.streakStartedAt || now;
      } else {
        currentStreak = 1;
        bestStreak = Math.max(existing.bestStreak, 1);
        streakStartedAt = now;
      }
    }

    const row = existing
      ? await prisma.userLoginStreak.update({
          where: { userId: context.userId },
          data: {
            schoolId: context.schoolId,
            currentStreak,
            bestStreak,
            lastLoginAt: now,
            streakStartedAt,
          },
        })
      : await prisma.userLoginStreak.create({
          data: {
            schoolId: context.schoolId,
            userId: context.userId,
            currentStreak,
            bestStreak,
            lastLoginAt: now,
            streakStartedAt,
          },
        });

    return res.json({ success: true, data: row });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to update login streak',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

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
