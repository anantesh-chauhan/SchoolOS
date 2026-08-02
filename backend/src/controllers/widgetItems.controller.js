import prisma from '../config/prisma.client.js';
import { getScopedSchoolId } from '../utils/tenant.util.js';
import { getWidgetsForRole, WIDGET_CATALOG } from '../constants/widgetCatalog.js';
import { getUserContext, dayKey, dayDiff, toSafeNumber, buildSummaryWidgets, buildDashboardWidgets, handleCrud, createCrudHandlers } from './widgets.shared.js';

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

export const listNotifications = async (req, res) => {
  if (['STUDENT', 'PARENT'].includes(req.user?.role) && req.user?.studentId) {
    try {
      const rows = await prisma.academicNotification.findMany({
        where: { schoolId: req.user.schoolId, recipientStudentId: req.user.studentId, recipientRole: req.user.role },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return res.json({ success: true, data: rows.map((row) => ({ ...row, isRead: Boolean(row.readAt), link: '/homework' })) });
    } catch (error) {
      return res.status(500).json({ success: false, message: 'Failed to fetch notifications', error: process.env.NODE_ENV === 'development' ? error.message : undefined });
    }
  }
  return notificationHandlers.list(req, res);
};
export const markNotificationRead = async (req, res) => {
  try {
    if (['STUDENT', 'PARENT'].includes(req.user?.role) && req.user?.studentId) {
      const existingPortalNotification = await prisma.academicNotification.findFirst({ where: { id: req.params.id, schoolId: req.user.schoolId, recipientStudentId: req.user.studentId, recipientRole: req.user.role } });
      if (!existingPortalNotification) return res.status(404).json({ success: false, message: 'Notification not found' });
      const row = await prisma.academicNotification.update({ where: { id: req.params.id }, data: { readAt: new Date() } });
      return res.json({ success: true, data: { ...row, isRead: true, link: '/homework' } });
    }
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
