import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import {
  bulkUpsertTeacherAssignments,
  createTeacher,
  deleteTeacher,
  getTeacherWorkload,
  listClassTeacherAssignments,
  listTeacherAssignmentSummary,
  listTeacherAssignmentsForSection,
  listTeachers,
  upsertClassTeacherAssignment,
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
router.get('/assignments/class-teachers', listClassTeacherAssignments);
router.post('/assignments/class-teachers', upsertClassTeacherAssignment);

export default router;
