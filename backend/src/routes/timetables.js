import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
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
router.use(requireRole('ADMIN', 'SCHOOL_OWNER'));

router.get('/', listTimetables);
router.post('/', createTimetable);

router.get('/weekly-requirements', listWeeklyRequirements);
router.put('/weekly-requirements', upsertWeeklyRequirements);
router.post('/weekly-requirements/propagate', propagateWeeklyRequirements);
router.get('/reconciliation/report', getReconciliationReport);

router.get('/:id', getTimetableBody);
router.get('/:id/validate', validateTimetable);

router.post('/slots/:slotId/assign', assignSlot);
router.post('/slots/:slotId/reset', resetSlot);

export default router;
