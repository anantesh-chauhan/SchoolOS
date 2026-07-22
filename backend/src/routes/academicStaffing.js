import express from 'express';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  applyTemplate, assignClassTeacher, autoAllocate, getAcademicConfig, listClassTeachers, listWeeklySlots,
  listWorkloads, replaceSubjectTeacher, resetDefaults, staffingAudit, updateAcademicConfig, updateWeeklySlot,
  unassignSubjectTeacher,
} from '../controllers/academicStaffing.controller.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/academic-config', requirePermission(PERMISSIONS.STAFFING_VIEW), getAcademicConfig);
router.patch('/academic-config', requirePermission(PERMISSIONS.STAFFING_MANAGE), updateAcademicConfig);
router.get('/curriculum/weekly-slots', requirePermission(PERMISSIONS.WEEKLY_SLOTS_VIEW), listWeeklySlots);
router.post('/curriculum/weekly-slots/apply-template', requirePermission(PERMISSIONS.WEEKLY_SLOTS_MANAGE), applyTemplate);
router.patch('/curriculum/weekly-slots/:id', requirePermission(PERMISSIONS.WEEKLY_SLOTS_MANAGE), updateWeeklySlot);
router.post('/curriculum/weekly-slots/reset-defaults', requirePermission(PERMISSIONS.WEEKLY_SLOTS_MANAGE), resetDefaults);
router.get('/teacher-assignments', requirePermission(PERMISSIONS.STAFFING_VIEW), listWeeklySlots);
router.post('/teacher-assignments/auto-allocate', requirePermission(PERMISSIONS.STAFFING_MANAGE), autoAllocate);
router.patch('/teacher-assignments/:id', requirePermission(PERMISSIONS.STAFFING_MANAGE), replaceSubjectTeacher);
router.delete('/teacher-assignments/:id', requirePermission(PERMISSIONS.STAFFING_MANAGE), unassignSubjectTeacher);
router.get('/class-teacher-assignments', requirePermission(PERMISSIONS.STAFFING_VIEW), listClassTeachers);
router.post('/class-teacher-assignments', requirePermission(PERMISSIONS.STAFFING_MANAGE), assignClassTeacher);
router.patch('/class-teacher-assignments/:id', requirePermission(PERMISSIONS.STAFFING_MANAGE), assignClassTeacher);
router.get('/teacher-workload', requirePermission(PERMISSIONS.STAFFING_VIEW), listWorkloads);
router.get('/teacher-workload/:teacherId', requirePermission(PERMISSIONS.STAFFING_VIEW), listWorkloads);
router.get('/academic-staffing/audit', requirePermission(PERMISSIONS.STAFFING_VIEW), staffingAudit);
export default router;
