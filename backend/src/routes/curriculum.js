import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  createBook, createChapter, createCurriculum, createUnit, curriculumAudit, listAcademicContext, listBooks, listChapters, listCurricula,
  listPublishers, overview, publishCurriculum, reorderChapters, savePublisher,
} from '../controllers/curriculum.controller.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/overview', requirePermission(PERMISSIONS.CURRICULUM_VIEW), overview);
router.get('/', requirePermission(PERMISSIONS.CURRICULUM_VIEW), listCurricula);
router.get('/academic-context', requirePermission(PERMISSIONS.CURRICULUM_VIEW), listAcademicContext);
router.post('/', requirePermission(PERMISSIONS.CURRICULUM_MANAGE), createCurriculum);
router.get('/publishers', requirePermission(PERMISSIONS.CURRICULUM_VIEW), listPublishers);
router.post('/publishers', requirePermission(PERMISSIONS.CURRICULUM_MANAGE), savePublisher);
router.get('/books', requirePermission(PERMISSIONS.CURRICULUM_VIEW), listBooks);
router.post('/books', requirePermission(PERMISSIONS.CURRICULUM_MANAGE), createBook);
router.get('/chapters', requirePermission(PERMISSIONS.CHAPTERS_VIEW), listChapters);
router.post('/chapters', requirePermission(PERMISSIONS.CHAPTERS_MANAGE), createChapter);
router.post('/units', requirePermission(PERMISSIONS.CHAPTERS_MANAGE), createUnit);
router.put('/chapters/reorder', requirePermission(PERMISSIONS.CHAPTERS_MANAGE), reorderChapters);
router.post('/publish', requirePermission(PERMISSIONS.CURRICULUM_MANAGE), publishCurriculum);
router.get('/audit', requirePermission(PERMISSIONS.CURRICULUM_VIEW), curriculumAudit);
export default router;
