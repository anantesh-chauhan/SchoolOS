import express from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';
import {
  attendanceHistory, attendanceOverview, correctAttendance, getSectionAttendance,
  pendingAttendance, setAttendanceNotApplicable, submitAttendance,
} from '../controllers/attendanceWorkflow.controller.js';
import { getAttendanceAudit } from '../controllers/attendanceManagement.controller.js';

const router = express.Router();
router.use(authMiddleware);
router.get('/overview', requireRole('ADMIN', 'SCHOOL_OWNER'), requirePermission(PERMISSIONS.ATTENDANCE_VIEW), attendanceOverview);
router.get('/pending', requireRole('ADMIN', 'SCHOOL_OWNER'), requirePermission(PERMISSIONS.ATTENDANCE_VIEW), pendingAttendance);
router.get('/sections/:sectionId/dates/:date', requireRole('ADMIN', 'SCHOOL_OWNER'), requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getSectionAttendance);
router.post('/sections/:sectionId/dates/:date/submit', requireRole('ADMIN'), requirePermission(PERMISSIONS.ATTENDANCE_MARK_STUDENT), submitAttendance);
router.post('/sections/:sectionId/dates/:date/not-applicable', requireRole('ADMIN'), requirePermission(PERMISSIONS.ATTENDANCE_LOCK), setAttendanceNotApplicable);
router.post('/sessions/:attendanceSessionId/corrections', requireRole('ADMIN'), requirePermission(PERMISSIONS.ATTENDANCE_CORRECT_APPROVE), correctAttendance);
router.get('/sessions/:attendanceSessionId/history', requirePermission(PERMISSIONS.ATTENDANCE_AUDIT), attendanceHistory);
router.get('/audit-logs', requirePermission(PERMISSIONS.ATTENDANCE_AUDIT), getAttendanceAudit);

export default router;
