import express from 'express';
import {
  getStudentAttendanceRoster,
  getTeacherAttendanceRoster,
  markStudentAttendance,
  markTeacherAttendance,
} from '../controllers/attendance.controller.js';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.use(authMiddleware);

router.get('/students', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER'), getStudentAttendanceRoster);
router.post('/students', requireRole('TEACHER'), markStudentAttendance);
router.get('/teachers', requireRole('ADMIN', 'SCHOOL_OWNER'), getTeacherAttendanceRoster);
router.post('/teachers', requireRole('ADMIN', 'SCHOOL_OWNER'), markTeacherAttendance);

export default router;
