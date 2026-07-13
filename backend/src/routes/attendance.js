import express from 'express';
import {
  getStudentAttendanceRoster,
  getTeacherAttendanceRoster,
  markStudentAttendance,
  markTeacherAttendance,
  getClassAttendanceMonth,
  getMyAttendance,
  saveCalendarDay,
  listCalendarDays,
  deleteCalendarDay,
  getClassMonthlyRegister,
  getTeacherMonthlyRegister,
  listPublicCalendarDays,
  calendarDashboardSummary,
} from '../controllers/attendance.controller.js';
import { authMiddleware, requireRole } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/public/calendar', listPublicCalendarDays);
router.use(authMiddleware);

router.get('/students', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER'), getStudentAttendanceRoster);
router.post('/students', requireRole('TEACHER'), markStudentAttendance);
router.get('/teachers', requireRole('ADMIN', 'SCHOOL_OWNER'), getTeacherAttendanceRoster);
router.post('/teachers', requireRole('ADMIN', 'SCHOOL_OWNER'), markTeacherAttendance);
router.get('/class-month', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER'), getClassAttendanceMonth);
router.get('/me', requireRole('STUDENT', 'PARENT', 'TEACHER'), getMyAttendance);
router.put('/calendar-day', requireRole('ADMIN', 'SCHOOL_OWNER'), saveCalendarDay);
router.get('/calendar', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF'), listCalendarDays);
router.get('/calendar/dashboard-summary', requireRole('ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF'), calendarDashboardSummary);
router.delete('/calendar-day/:id', requireRole('ADMIN', 'SCHOOL_OWNER'), deleteCalendarDay);
router.get('/class-register', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER'), getClassMonthlyRegister);
router.get('/teacher-register', requireRole('ADMIN', 'SCHOOL_OWNER'), getTeacherMonthlyRegister);

export default router;
