import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
  createTeacherResource,
  deleteTeacherResource,
  getTeacherAssignments,
  getTeacherChapters,
  getTeacherDashboard,
  getTeacherResources,
  patchTeacherProgress,
  updateTeacherResource,
} from '../controllers/teacherDashboard.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('TEACHER', 'ADMIN', 'SCHOOL_OWNER'));

router.get('/dashboard', getTeacherDashboard);
router.get('/assignments', getTeacherAssignments);
router.get('/sections/:sectionId/subjects/:subjectId/chapters', getTeacherChapters);
router.patch('/progress', patchTeacherProgress);
router.get('/resources', getTeacherResources);
router.post('/resources', createTeacherResource);
router.patch('/resources/:resourceId', updateTeacherResource);
router.delete('/resources/:resourceId', deleteTeacherResource);

export default router;
