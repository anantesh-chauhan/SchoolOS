import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
  createBookmark,
  createNote,
  createTodo,
  deleteBookmark,
  deleteNote,
  deleteSystemContent,
  deleteTodo,
  getWidgetCatalog,
  getWidgetDashboard,
  listActivities,
  listBookmarks,
  listNotes,
  listNotifications,
  listSystemContent,
  listTodos,
  markNotificationRead,
  pingLoginStreak,
  saveWidgetPreferences,
  updateBookmark,
  updateNote,
  updateTodo,
  upsertSystemContent,
} from '../controllers/widgets.controller.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/catalog', getWidgetCatalog);
router.get('/dashboard', getWidgetDashboard);
router.put('/preferences', saveWidgetPreferences);
router.post('/login-streak/ping', pingLoginStreak);

router.get('/todos', listTodos);
router.post('/todos', createTodo);
router.patch('/todos/:id', updateTodo);
router.delete('/todos/:id', deleteTodo);

router.get('/notes', listNotes);
router.post('/notes', createNote);
router.patch('/notes/:id', updateNote);
router.delete('/notes/:id', deleteNote);

router.get('/bookmarks', listBookmarks);
router.post('/bookmarks', createBookmark);
router.patch('/bookmarks/:id', updateBookmark);
router.delete('/bookmarks/:id', deleteBookmark);

router.get('/notifications', listNotifications);
router.patch('/notifications/:id/read', markNotificationRead);

router.get('/activity', listActivities);
router.get('/system-content', listSystemContent);
router.post('/system-content', requireRole('PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN'), upsertSystemContent);
router.patch('/system-content/:id', requireRole('PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN'), upsertSystemContent);
router.delete('/system-content/:id', requireRole('PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN'), deleteSystemContent);

export default router;
