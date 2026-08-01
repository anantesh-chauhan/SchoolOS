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
import { requirePermission } from '../middleware/permission.middleware.js';
import { requireAssignedClass, requireStudentAccess } from '../middleware/scope.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';
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

router.get('/students', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'CLASS_TEACHER'), requirePermission(PERMISSIONS.ATTENDANCE_VIEW), requireAssignedClass(), getStudentAttendanceRoster);
router.post('/students', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'CLASS_TEACHER'), requirePermission(PERMISSIONS.ATTENDANCE_MARK_STUDENT), requireAssignedClass(), markStudentAttendance);
router.get('/teachers', requireRole('ADMIN', 'SCHOOL_OWNER'), requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getTeacherAttendanceRoster);
router.post('/teachers', requireRole('ADMIN', 'SCHOOL_OWNER'), requirePermission(PERMISSIONS.ATTENDANCE_MARK_EMPLOYEE), markTeacherAttendance);
router.get('/class-month', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'CLASS_TEACHER'), requirePermission(PERMISSIONS.ATTENDANCE_VIEW), requireAssignedClass(), getClassAttendanceMonth);
router.get('/me', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getMyAttendance);
router.put('/calendar-day', requirePermission(PERMISSIONS.CALENDAR_MANAGE), saveCalendarDay);
router.get('/calendar', requirePermission(PERMISSIONS.CALENDAR_VIEW), listCalendarDays);
router.get('/calendar/dashboard-summary', requirePermission(PERMISSIONS.CALENDAR_VIEW), calendarDashboardSummary);
router.delete('/calendar-day/:id', requirePermission(PERMISSIONS.CALENDAR_MANAGE), deleteCalendarDay);
router.get('/class-register', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'CLASS_TEACHER'), requirePermission(PERMISSIONS.ATTENDANCE_VIEW), requireAssignedClass(), getClassMonthlyRegister);
router.get('/teacher-register', requireRole('ADMIN', 'SCHOOL_OWNER'), requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getTeacherMonthlyRegister);
router.get('/metadata', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getAttendanceMetadata);
router.put('/settings', requirePermission(PERMISSIONS.ATTENDANCE_CONFIGURE), updateAttendanceSettings);
router.put('/statuses', requirePermission(PERMISSIONS.ATTENDANCE_CONFIGURE), saveAttendanceStatus);
router.post('/student-register', requirePermission(PERMISSIONS.ATTENDANCE_MARK_STUDENT), requireAssignedClass(), saveStudentDailyRegister);
router.get('/students/class/:classId/section/:sectionId/month/:month', requireRole('ADMIN', 'SCHOOL_OWNER', 'TEACHER', 'CLASS_TEACHER'), requirePermission(PERMISSIONS.ATTENDANCE_VIEW), requireAssignedClass(), getStudentMonthlyReport);
router.get('/students/:studentId/profile', requirePermission(PERMISSIONS.ATTENDANCE_VIEW), requireStudentAccess(PERMISSIONS.STUDENTS_VIEW, { param: 'studentId' }), getStudentProfile);
router.get('/employees/month/:month', requireRole('ADMIN', 'SCHOOL_OWNER', 'HR'), requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getEmployeeMonthlyReport);
router.post('/employees', requireRole('ADMIN', 'SCHOOL_OWNER', 'HR'), requirePermission(PERMISSIONS.ATTENDANCE_MARK_EMPLOYEE), saveEmployeeAttendance);
router.get('/corrections', requirePermission(PERMISSIONS.ATTENDANCE_CORRECT_REQUEST), listCorrectionRequests);
router.post('/corrections', requirePermission(PERMISSIONS.ATTENDANCE_CORRECT_REQUEST), createCorrectionRequest);
router.patch('/corrections/:id', requirePermission(PERMISSIONS.ATTENDANCE_CORRECT_APPROVE), reviewCorrectionRequest);
router.post('/locks', requirePermission(PERMISSIONS.ATTENDANCE_LOCK), lockAttendance);
router.post('/locks/:id/unlock', requirePermission(PERMISSIONS.ATTENDANCE_LOCK), unlockAttendance);
router.get('/dashboard', requireRole('ADMIN', 'SCHOOL_OWNER'), requirePermission(PERMISSIONS.ATTENDANCE_VIEW), getAttendanceDashboard);
router.get('/audit', requirePermission(PERMISSIONS.ATTENDANCE_AUDIT), getAttendanceAudit);
router.get('/export.csv', requirePermission(PERMISSIONS.ATTENDANCE_EXPORT), exportAttendanceCsv);

export default router;
