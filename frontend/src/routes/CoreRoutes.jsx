import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import WorkspaceHomePage from '../pages/WorkspaceHomePage';
import WorkspaceOverviewPage from '../pages/WorkspaceOverviewPage';
import { LoginPage, StudentLoginPage, AttendanceDashboardPage, MonthlyClassAttendancePage, StudentAttendanceProfilePage, EmployeeMonthlyAttendancePage, AttendanceCorrectionsPage, AttendanceSettingsPage, AttendanceAuditPage, AttendanceCorrectionRequestPage, MyReportsPage, IssueManagementPage, AccountRecoveryPage, ReceiptVerificationPage, HomeworkWorkspacePage, NotificationCenterPage, CommunicationWorkspacePage, HRWorkspacePage, EmployeeSelfServicePage, StudentAnalyticsListPage, StudentAnalyticsPage, SubjectAnalyticsPage, ChapterAnalyticsPage, AnalyticsConfigurationPage, SchoolAnalyticsPage, ClassAnalyticsPage, ExaminationWorkspacePage, OfflinePage, PermissionDeniedPage, WorkspaceSelectionPage, ClassTeacherDashboard, SessionExpiredPage } from './lazyPages';

export const coreRoutes = (
    <>
<Route path="/permission-denied" element={<PermissionDeniedPage />} />
          <Route path="/session-expired" element={<SessionExpiredPage />} />
          <Route path="/choose-workspace" element={<ProtectedRoute><WorkspaceSelectionPage /></ProtectedRoute>} />
          <Route path="/workspace/home" element={<ProtectedRoute><WorkspaceHomePage /></ProtectedRoute>} />
          <Route path="/workspace/:workspaceId" element={<ProtectedRoute><WorkspaceOverviewPage /></ProtectedRoute>} />
          {/* Login Route */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/student-login" element={<StudentLoginPage />} />
          <Route path="/parent-login" element={<StudentLoginPage />} />
          <Route path="/account-recovery" element={<AccountRecoveryPage />} />
          <Route path="/fees/verify/:code" element={<ReceiptVerificationPage />} />
          <Route path="/offline" element={<OfflinePage />} />
          <Route path="/homework" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER','PARENT','STUDENT']}><HomeworkWorkspacePage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','FEE_MANAGER','HR','TEACHER','CLASS_TEACHER','PARENT','STUDENT','STAFF']}><NotificationCenterPage /></ProtectedRoute>} />
          <Route path="/communication" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','FEE_MANAGER','TEACHER','CLASS_TEACHER','PARENT','STUDENT','STAFF']}><CommunicationWorkspacePage /></ProtectedRoute>} />
          <Route path="/analytics/students" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER','PARENT','STUDENT']}><StudentAnalyticsListPage /></ProtectedRoute>} />
          <Route path="/analytics/students/:studentId" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER','PARENT','STUDENT']}><StudentAnalyticsPage /></ProtectedRoute>} />
          <Route path="/analytics/students/:studentId/subjects/:subjectId" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER','PARENT','STUDENT']}><SubjectAnalyticsPage /></ProtectedRoute>} />
          <Route path="/analytics/students/:studentId/subjects/:subjectId/chapters/:chapterId" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER','PARENT','STUDENT']}><ChapterAnalyticsPage /></ProtectedRoute>} />
          <Route path="/analytics/configuration" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN']}><AnalyticsConfigurationPage /></ProtectedRoute>} />
          <Route path="/analytics/school" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER']}><SchoolAnalyticsPage /></ProtectedRoute>} />
          <Route path="/analytics/classes/:classId" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER']}><ClassAnalyticsPage /></ProtectedRoute>} />
          <Route path="/analytics/sections/:sectionId" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER']}><ClassAnalyticsPage sectionMode /></ProtectedRoute>} />
          <Route path="/examinations" element={<ProtectedRoute allowedRoles={['PLATFORM_OWNER','SCHOOL_OWNER','PRINCIPAL','EXAM_COORDINATOR','EXAM_CONTROLLER','ADMIN','CURRICULUM_MANAGER','TEACHER','CLASS_TEACHER','PARENT','STUDENT']}><ExaminationWorkspacePage /></ProtectedRoute>} />
          <Route path="/dashboard/hr" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','HR','HR_MANAGER']}><HRWorkspacePage /></ProtectedRoute>} />
          <Route path="/dashboard/class-teacher" element={<ProtectedRoute allowedRoles={['CLASS_TEACHER']}><ClassTeacherDashboard /></ProtectedRoute>} />
          <Route path="/my/hr" element={<ProtectedRoute allowedRoles={['HR','TEACHER','CLASS_TEACHER','STAFF']}><EmployeeSelfServicePage /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN']}><AttendanceDashboardPage /></ProtectedRoute>} />
          <Route path="/attendance/students/class/:classId/section/:sectionId/month/:month" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','TEACHER','CLASS_TEACHER']}><MonthlyClassAttendancePage /></ProtectedRoute>} />
          <Route path="/attendance/students/:studentId" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','TEACHER','CLASS_TEACHER','STUDENT','PARENT']}><StudentAttendanceProfilePage /></ProtectedRoute>} />
          <Route path="/attendance/employees/month/:month" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','HR']}><EmployeeMonthlyAttendancePage /></ProtectedRoute>} />
          <Route path="/attendance/corrections" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','HR']}><AttendanceCorrectionsPage /></ProtectedRoute>} />
          <Route path="/attendance/settings" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN']}><AttendanceSettingsPage /></ProtectedRoute>} />
          <Route path="/attendance/audit" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','HR']}><AttendanceAuditPage /></ProtectedRoute>} />
          <Route path="/attendance/request-correction" element={<ProtectedRoute allowedRoles={['STUDENT','PARENT','TEACHER','STAFF','HR']}><AttendanceCorrectionRequestPage /></ProtectedRoute>} />
          <Route path="/support/my-reports" element={<ProtectedRoute allowedRoles={['PLATFORM_OWNER','SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER','CLASS_TEACHER','PARENT','STUDENT','STAFF']}><MyReportsPage /></ProtectedRoute>} />
          <Route path="/platform/issues" element={<ProtectedRoute allowedRoles={['PLATFORM_OWNER']}><IssueManagementPage /></ProtectedRoute>} />
    </>
);
