import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  assignSlot,
  createTimetable,
  getReconciliationReport,
  getTimetableBody,
  listTimetables,
  listWeeklyRequirements,
  propagateWeeklyRequirements,
  resetSlot,
  upsertWeeklyRequirements,
  validateTimetable,
} from '../controllers/timetable.controller.js';

const router = express.Router();

router.use(authMiddleware);
router.get('/', requireRole('ADMIN', 'SCHOOL_OWNER'), listTimetables);
router.post('/', requireRole('ADMIN', 'SCHOOL_OWNER'), createTimetable);

router.get('/weekly-requirements', requirePermission(PERMISSIONS.WEEKLY_SLOTS_VIEW), listWeeklyRequirements);
router.put('/weekly-requirements', requirePermission(PERMISSIONS.WEEKLY_SLOTS_MANAGE), upsertWeeklyRequirements);
router.post('/weekly-requirements/propagate', requirePermission(PERMISSIONS.WEEKLY_SLOTS_MANAGE), propagateWeeklyRequirements);
router.get('/reconciliation/report', requireRole('ADMIN', 'SCHOOL_OWNER'), getReconciliationReport);

router.get('/:id', requireRole('ADMIN', 'SCHOOL_OWNER'), getTimetableBody);
router.get('/:id/validate', requireRole('ADMIN', 'SCHOOL_OWNER'), validateTimetable);

router.post('/slots/:slotId/assign', requireRole('ADMIN', 'SCHOOL_OWNER'), assignSlot);
router.post('/slots/:slotId/reset', requireRole('ADMIN', 'SCHOOL_OWNER'), resetSlot);

export default router;
