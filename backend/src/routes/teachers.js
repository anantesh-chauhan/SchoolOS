import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
  bulkUpsertTeacherAssignments,
  createTeacher,
  deleteTeacher,
  getTeacherWorkload,
  listTeacherAssignmentSummary,
  listTeacherAssignmentsForSection,
  listTeachers,
  updateTeacher,
} from '../controllers/teacher.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.use(requireRole('ADMIN', 'SCHOOL_OWNER'));

router.get('/', listTeachers);
router.post('/', createTeacher);
router.put('/:id', updateTeacher);
router.delete('/:id', deleteTeacher);
router.get('/:id/workload', getTeacherWorkload);

router.get('/assignments/section', listTeacherAssignmentsForSection);
router.post('/assignments/bulk', bulkUpsertTeacherAssignments);
router.get('/assignments/summary', listTeacherAssignmentSummary);

export default router;
