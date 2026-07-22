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
import {
  createCorrectionRequest,
  exportAttendanceCsv,
  getAttendanceAudit,
  getAttendanceDashboard,
  getAttendanceMetadata,
  getEmployeeMonthlyReport,
  getStudentMonthlyReport,
  getStudentProfile,
  listCorrectionRequests,
  lockAttendance,
  reviewCorrectionRequest,
  saveAttendanceStatus,
  saveEmployeeAttendance,
  saveStudentDailyRegister,
  unlockAttendance,
  updateAttendanceSettings,
} from '../controllers/attendanceManagement.controller.js';

const router = express.Router();

router.get('/public/calendar', listPublicCalendarDays);
router.use(authMiddleware);

router.get('/students', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER'), getStudentAttendanceRoster);
router.post('/students', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER'), markStudentAttendance);
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
router.get('/metadata', getAttendanceMetadata);
router.put('/settings', requireRole('ADMIN', 'SCHOOL_OWNER'), updateAttendanceSettings);
router.put('/statuses', requireRole('ADMIN', 'SCHOOL_OWNER'), saveAttendanceStatus);
router.post('/student-register', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER'), saveStudentDailyRegister);
router.get('/students/class/:classId/section/:sectionId/month/:month', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER'), getStudentMonthlyReport);
router.get('/students/:studentId/profile', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'STUDENT', 'PARENT'), getStudentProfile);
router.get('/employees/month/:month', requireRole('ADMIN', 'SCHOOL_OWNER', 'HR'), getEmployeeMonthlyReport);
router.post('/employees', requireRole('ADMIN', 'SCHOOL_OWNER', 'HR'), saveEmployeeAttendance);
router.get('/corrections', listCorrectionRequests);
router.post('/corrections', createCorrectionRequest);
router.patch('/corrections/:id', requireRole('ADMIN', 'SCHOOL_OWNER', 'HR'), reviewCorrectionRequest);
router.post('/locks', requireRole('ADMIN', 'SCHOOL_OWNER', 'HR'), lockAttendance);
router.post('/locks/:id/unlock', requireRole('ADMIN', 'SCHOOL_OWNER', 'HR'), unlockAttendance);
router.get('/dashboard', requireRole('ADMIN', 'SCHOOL_OWNER'), getAttendanceDashboard);
router.get('/audit', requireRole('ADMIN', 'SCHOOL_OWNER', 'HR'), getAttendanceAudit);
router.get('/export.csv', requireRole('ADMIN', 'SCHOOL_OWNER', 'HR'), exportAttendanceCsv);

export default router;
