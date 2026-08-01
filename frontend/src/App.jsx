import React, { Suspense, lazy, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import NetworkStatus from './components/pwa/NetworkStatus';
import PWAInstallPrompt from './components/pwa/PWAInstallPrompt';
import PWAUpdatePrompt from './components/pwa/PWAUpdatePrompt';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const StudentLoginPage = lazy(() => import('./pages/StudentLoginPage'));
const PlatformOwnerDashboard = lazy(() => import('./pages/dashboards/PlatformOwnerDashboard'));
const SchoolOwnerDashboard = lazy(() => import('./pages/dashboards/SchoolOwnerDashboard'));
const AdminDashboard = lazy(() => import('./pages/dashboards/AdminDashboard'));
const TeacherDashboard = lazy(() => import('./pages/dashboards/TeacherDashboard'));
const TeacherAssignmentsPage = lazy(() => import('./pages/teacher/TeacherPortalPages').then(m=>({default:m.AssignmentsPage})));
const TeacherAssignmentDetailPage = lazy(() => import('./pages/teacher/TeacherPortalPages').then(m=>({default:m.AssignmentPage})));
const TeacherChapterPage = lazy(() => import('./pages/teacher/TeacherPortalPages').then(m=>({default:m.TeacherChapterPage})));
const TeacherAssignmentStudentsPage = lazy(() => import('./pages/teacher/TeacherPortalPages').then(m=>({default:m.AssignmentStudentsPage})));
const TeacherStudentPerformancePage = lazy(() => import('./pages/teacher/TeacherPortalPages').then(m=>({default:m.TeacherStudentPage})));
const TeacherPollsPage = lazy(() => import('./pages/teacher/TeacherPollListPage'));
const TeacherPollPage = lazy(() => import('./pages/teacher/TeacherWholeClassRatingPage'));
const TeacherPerformancePage = lazy(() => import('./pages/teacher/TeacherPortalPages').then(m=>({default:m.TeacherPerformancePage})));
const TeacherMyClassPage = lazy(() => import('./pages/teacher/TeacherPortalPages').then(m=>({default:m.MyClassPage})));
const ParentDashboard = lazy(() => import('./pages/dashboards/ParentDashboard'));
const StudentDashboard = lazy(() => import('./pages/dashboards/StudentDashboard'));
const StudentSubjectsPage = lazy(() => import('./pages/student/StudentPortalPages').then(m => ({ default: m.SubjectsPage })));
const StudentSubjectPage = lazy(() => import('./pages/student/StudentPortalPages').then(m => ({ default: m.SubjectPage })));
const StudentChapterPage = lazy(() => import('./pages/student/StudentPortalPages').then(m => ({ default: m.ChapterPage })));
const StudentAttendanceSummaryPage = lazy(() => import('./pages/student/StudentPortalPages').then(m => ({ default: m.AttendancePage })));
const StudentAttendanceMonthPage = lazy(() => import('./pages/student/StudentPortalPages').then(m => ({ default: m.AttendanceMonthPage })));
const StudentPendingPollsPage = lazy(() => import('./pages/student/StudentPortalPages').then(m => ({ default: () => <m.PollsPage /> })));
const StudentSubmittedPollsPage = lazy(() => import('./pages/student/StudentPortalPages').then(m => ({ default: () => <m.PollsPage submitted /> })));
const StudentPollPage = lazy(() => import('./pages/student/StudentChapterFeedbackPage'));
const StudentSubmittedPollPage = lazy(() => import('./pages/student/StudentChapterFeedbackPage'));
const StudentResourcesPage = lazy(() => import('./pages/student/StudentPortalPages').then(m => ({ default: m.ResourcesPage })));
const StudentPerformancePage = lazy(() => import('./pages/student/StudentPortalPages').then(m => ({ default: m.PerformancePage })));
const StaffDashboard = lazy(() => import('./pages/dashboards/StaffDashboard'));
const SchoolManagementPage = lazy(() => import('./pages/platform/SchoolManagementPage'));
const SchoolSettingsPage = lazy(() => import('./pages/platform/SchoolSettingsPage'));
const ClassManagementPage = lazy(() => import('./pages/admin/ClassManagementPage'));
const ClassDetailsDashboardPage = lazy(() => import('./pages/admin/ClassDetailsDashboardPage'));
const SubjectDetailsDashboardPage = lazy(() => import('./pages/admin/SubjectDetailsDashboardPage'));
const ChapterComingSoonPage = lazy(() => import('./pages/admin/ChapterComingSoonPage'));

const SectionManagementPage = lazy(() => import('./pages/admin/SectionManagementPage'));
const SubjectManagementPage = lazy(() => import('./pages/admin/SubjectManagementPage'));
const SubjectAssignmentPage = lazy(() => import('./pages/admin/SubjectAssignmentPage'));
const TeacherManagementPage = lazy(() => import('./pages/admin/TeacherManagementPage'));
const TeacherAssignmentPage = lazy(() => import('./pages/admin/TeacherAssignmentPage'));
const ClassTeacherAssignmentPage = lazy(() => import('./pages/admin/ClassTeacherAssignmentPage'));
const TeacherAssignmentSummaryPage = lazy(() => import('./pages/admin/TeacherAssignmentSummaryPage'));
const StudentAttendancePage = lazy(() => import('./pages/attendance/StudentAttendancePage'));
const TeacherAttendancePage = lazy(() => import('./pages/attendance/TeacherAttendancePage'));
const MyAttendancePage = lazy(() => import('./pages/attendance/MyAttendancePage'));
const AcademicCalendarPage = lazy(() => import('./pages/attendance/AcademicCalendarPage'));
const AttendanceDashboardPage = lazy(() => import('./pages/attendance/AttendanceDashboardPage'));
const MonthlyClassAttendancePage = lazy(() => import('./pages/attendance/MonthlyClassAttendancePage'));
const StudentAttendanceProfilePage = lazy(() => import('./pages/attendance/StudentAttendanceProfilePage'));
const EmployeeMonthlyAttendancePage = lazy(() => import('./pages/attendance/EmployeeMonthlyAttendancePage'));
const AttendanceCorrectionsPage = lazy(() => import('./pages/attendance/AttendanceCorrectionsPage'));
const AttendanceSettingsPage = lazy(() => import('./pages/attendance/AttendanceSettingsPage'));
const AttendanceAuditPage = lazy(() => import('./pages/attendance/AttendanceAuditPage'));
const AttendanceCorrectionRequestPage = lazy(() => import('./pages/attendance/AttendanceCorrectionRequestPage'));
const WeeklySlotManagementPage = lazy(() => import('./pages/admin/WeeklySlotManagementPage'));
const TimetableBuilderPage = lazy(() => import('./pages/admin/TimetableBuilderPage'));
const TimetableReconciliationPage = lazy(() => import('./pages/admin/TimetableReconciliationPage'));
const GalleryStudioPage = lazy(() => import('./pages/admin/GalleryStudioPage'));
const AddStudentPage = lazy(() => import('./pages/admin/AddStudentPage'));
const StudentAllocationPage = lazy(() => import('./pages/admin/StudentAllocationPage'));
const SchoolDirectoryPage = lazy(() => import('./pages/admin/SchoolDirectoryPage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const PlatformOwnerProfilePage = lazy(() => import('./pages/profile/PlatformOwnerProfilePage'));
const SchoolOwnerProfilePage = lazy(() => import('./pages/profile/SchoolOwnerProfilePage'));
const AdminProfilePage = lazy(() => import('./pages/profile/AdminProfilePage'));
const UserManagementPage = lazy(() => import('./pages/admin/UserManagementPage'));
const TeacherProfilePage = lazy(() => import('./pages/profile/TeacherProfilePage'));
const ParentProfilePage = lazy(() => import('./pages/profile/ParentProfilePage'));
const StudentProfilePage = lazy(() => import('./pages/profile/StudentProfilePage'));
const StaffProfilePage = lazy(() => import('./pages/profile/StaffProfilePage'));
const CurriculumManagerProfilePage = lazy(() => import('./pages/profile/CurriculumManagerProfilePage'));
const WidgetHubPage = lazy(() => import('./pages/widgets/WidgetHubPage'));
const MyReportsPage = lazy(() => import('./pages/support/MyReportsPage'));
const IssueManagementPage = lazy(() => import('./pages/platform/IssueManagementPage'));
const LoginCredentialsPage = lazy(() => import('./pages/admin/LoginCredentialsPage'));
const AccountRecoveryPage = lazy(() => import('./pages/AccountRecoveryPage'));
const CurriculumDashboardPage = lazy(() => import('./pages/curriculum/CurriculumDashboardPage'));
const CurriculumManagePage = lazy(() => import('./pages/curriculum/CurriculumManagePage'));
const FeePortalPage = lazy(() => import('./pages/fees/FeePortalPage'));
const FeeManagerProfilePage = lazy(() => import('./pages/profile/FeeManagerProfilePage'));
const FeeStructureWizardPage = lazy(() => import('./pages/fees/FeeStructureWizardPage'));
const FeeOperationsPage = lazy(() => import('./pages/fees/FeeOperationsPage'));
const FeeAdministrationPage = lazy(() => import('./pages/fees/FeeAdministrationPage'));
const FamilyFeePage = lazy(() => import('./pages/fees/FamilyFeePage'));
const PlatformFeeAnalyticsPage = lazy(() => import('./pages/fees/PlatformFeeAnalyticsPage'));
const ReceiptVerificationPage = lazy(() => import('./pages/fees/ReceiptVerificationPage'));
const TeacherFeePage = lazy(() => import('./pages/fees/TeacherFeePage'));
const HomeworkWorkspacePage = lazy(() => import('./pages/homework/HomeworkWorkspacePage'));
const NotificationCenterPage = lazy(() => import('./pages/communication/NotificationCenterPage'));
const CommunicationWorkspacePage = lazy(() => import('./pages/communication/CommunicationWorkspacePage'));
const HRWorkspacePage = lazy(() => import('./pages/hr/HRWorkspacePage'));
const EmployeeSelfServicePage = lazy(() => import('./pages/hr/EmployeeSelfServicePage'));
const StudentAnalyticsListPage = lazy(() => import('./features/analytics/pages/StudentAnalyticsListPage'));
const StudentAnalyticsPage = lazy(() => import('./features/analytics/pages/StudentAnalyticsPage'));
const SubjectAnalyticsPage = lazy(() => import('./features/analytics/pages/SubjectAnalyticsPage'));
const ChapterAnalyticsPage = lazy(() => import('./features/analytics/pages/ChapterAnalyticsPage'));
const AnalyticsConfigurationPage = lazy(() => import('./features/analytics/pages/AnalyticsConfigurationPage'));
const SchoolAnalyticsPage = lazy(() => import('./features/analytics/pages/SchoolAnalyticsPage'));
const ClassAnalyticsPage = lazy(() => import('./features/analytics/pages/ClassAnalyticsPage'));
const ExaminationWorkspacePage = lazy(() => import('./pages/examinations/ExaminationHubPage'));
const OfflinePage = lazy(() => import('./pages/OfflinePage'));
const PermissionDeniedPage = lazy(() => import('./pages/PermissionDeniedPage'));
const WorkspaceSelectionPage = lazy(() => import('./pages/WorkspaceSelectionPage'));
const ClassTeacherDashboard = lazy(() => import('./pages/dashboards/ClassTeacherDashboard'));
const RoleManagementPage = lazy(() => import('./pages/admin/RoleManagementPage'));
const SessionExpiredPage = lazy(() => import('./pages/SessionExpiredPage'));

const AppFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 transition-colors dark:bg-slate-950">
    <div className="w-72 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="h-4 w-32 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
      <div className="h-3 w-full rounded-full bg-slate-100 animate-pulse dark:bg-slate-800" />
      <div className="h-3 w-2/3 rounded-full bg-slate-100 animate-pulse dark:bg-slate-800" />
    </div>
  </div>
);

export default function App() {
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  useEffect(() => {
    const remountWorkspace = () => setWorkspaceVersion((version) => version + 1);
    window.addEventListener('schoolos:workspace-changed', remountWorkspace);
    return () => window.removeEventListener('schoolos:workspace-changed', remountWorkspace);
  }, []);
  return (
    <Router basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NetworkStatus />
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'dark:!bg-slate-900 dark:!text-slate-100 dark:!border dark:!border-slate-800',
          duration: 3200,
        }}
      />
      <Suspense fallback={<AppFallback />}>
        <Routes key={workspaceVersion}>
          <Route path="/permission-denied" element={<PermissionDeniedPage />} />
          <Route path="/session-expired" element={<SessionExpiredPage />} />
          <Route path="/choose-workspace" element={<ProtectedRoute><WorkspaceSelectionPage /></ProtectedRoute>} />
          {/* Login Route */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/student-login" element={<StudentLoginPage />} />
          <Route path="/parent-login" element={<StudentLoginPage />} />
          <Route path="/account-recovery" element={<AccountRecoveryPage />} />
          <Route path="/fees/verify/:code" element={<ReceiptVerificationPage />} />
          <Route path="/offline" element={<OfflinePage />} />
          <Route path="/homework" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER','PARENT','STUDENT']}><HomeworkWorkspacePage /></ProtectedRoute>} />
          <Route path="/notifications" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','FEE_MANAGER','HR','TEACHER','PARENT','STUDENT','STAFF']}><NotificationCenterPage /></ProtectedRoute>} />
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
          <Route path="/my/hr" element={<ProtectedRoute allowedRoles={['HR','TEACHER','STAFF']}><EmployeeSelfServicePage /></ProtectedRoute>} />
          <Route path="/attendance" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN']}><AttendanceDashboardPage /></ProtectedRoute>} />
          <Route path="/attendance/students/class/:classId/section/:sectionId/month/:month" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','TEACHER','CLASS_TEACHER']}><MonthlyClassAttendancePage /></ProtectedRoute>} />
          <Route path="/attendance/students/:studentId" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','TEACHER','STUDENT','PARENT']}><StudentAttendanceProfilePage /></ProtectedRoute>} />
          <Route path="/attendance/employees/month/:month" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','HR']}><EmployeeMonthlyAttendancePage /></ProtectedRoute>} />
          <Route path="/attendance/corrections" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','HR']}><AttendanceCorrectionsPage /></ProtectedRoute>} />
          <Route path="/attendance/settings" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN']}><AttendanceSettingsPage /></ProtectedRoute>} />
          <Route path="/attendance/audit" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','HR']}><AttendanceAuditPage /></ProtectedRoute>} />
          <Route path="/attendance/request-correction" element={<ProtectedRoute allowedRoles={['STUDENT','PARENT','TEACHER','STAFF','HR']}><AttendanceCorrectionRequestPage /></ProtectedRoute>} />
          <Route path="/support/my-reports" element={<ProtectedRoute allowedRoles={['PLATFORM_OWNER','SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER','PARENT','STUDENT','STAFF']}><MyReportsPage /></ProtectedRoute>} />
          <Route path="/platform/issues" element={<ProtectedRoute allowedRoles={['PLATFORM_OWNER']}><IssueManagementPage /></ProtectedRoute>} />

        {/* Dashboard Routes */}
        <Route path="/dashboard/admin/roles" element={<ProtectedRoute allowedRoles={['ADMIN','SCHOOL_OWNER','PRINCIPAL']} requiredPermissions={['staffing.manage']}><RoleManagementPage /></ProtectedRoute>} />

        <Route
          path="/dashboard/admin/students/add"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SCHOOL_OWNER"]}>
              <AddStudentPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/students/add"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SCHOOL_OWNER"]}>
              <AddStudentPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin/students/allocation"
          element={
            <ProtectedRoute allowedRoles={["ADMIN", "SCHOOL_OWNER"]}>
              <StudentAllocationPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/platform"
          element={
            <ProtectedRoute allowedRoles={['PLATFORM_OWNER']}>
              <PlatformOwnerDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/platform/schools"
          element={
            <ProtectedRoute allowedRoles={['PLATFORM_OWNER']}>
              <SchoolManagementPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/platform/school-settings"
          element={
            <ProtectedRoute allowedRoles={['PLATFORM_OWNER']}>
              <SchoolSettingsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/school/settings"
          element={
            <ProtectedRoute allowedRoles={['SCHOOL_OWNER']}>
              <SchoolSettingsPage />
            </ProtectedRoute>
          }
        />

          <Route
            path="/dashboard/school"
            element={
              <ProtectedRoute allowedRoles={['SCHOOL_OWNER']}>
                <SchoolOwnerDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/school/profile"
            element={
              <ProtectedRoute allowedRoles={['SCHOOL_OWNER']}>
                <SchoolOwnerProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/platform/profile"
            element={
              <ProtectedRoute allowedRoles={['PLATFORM_OWNER']}>
                <PlatformOwnerProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/admin/profile"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
                <AdminProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/admin/users"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/school/users"
            element={
              <ProtectedRoute allowedRoles={['SCHOOL_OWNER']}>
                <UserManagementPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/teacher/profile"
            element={
              <ProtectedRoute allowedRoles={['TEACHER']}>
                <TeacherProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/parent/profile"
            element={
              <ProtectedRoute allowedRoles={['PARENT']}>
                <ParentProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/student/profile"
            element={
              <ProtectedRoute allowedRoles={['STUDENT']}>
                <StudentProfilePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/staff/profile"
            element={
              <ProtectedRoute allowedRoles={['STAFF']}>
                <StaffProfilePage />
              </ProtectedRoute>
            }
          />

        <Route
          path="/dashboard/admin"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/classes"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
              <ClassManagementPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/dashboard/admin/directory"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
              <SchoolDirectoryPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/academic/classes/:classId/sections/:sectionId/subjects/:subjectId"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
              <SubjectDetailsDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/academic/classes/:classId/sections/:sectionId/subjects/:subjectId/chapters/:chapterId"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
              <ChapterComingSoonPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/academic/classes/:classId/sections/:sectionId"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
              <ClassDetailsDashboardPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/sections"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
              <SectionManagementPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="/dashboard/admin/subjects"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
              <SubjectManagementPage />
            </ProtectedRoute>
          }
        />

          <Route
            path="/dashboard/admin/subject-assignment"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
                <SubjectAssignmentPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/admin/teachers"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
                <TeacherManagementPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/admin/teacher-assignment"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
                <TeacherAssignmentPage />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard/admin/credentials" element={<ProtectedRoute allowedRoles={['ADMIN','SCHOOL_OWNER']}><LoginCredentialsPage /></ProtectedRoute>} />
          <Route path="/dashboard/curriculum" element={<ProtectedRoute allowedRoles={['CURRICULUM_MANAGER','ADMIN','SCHOOL_OWNER']}><CurriculumDashboardPage /></ProtectedRoute>} />
          <Route path="/dashboard/curriculum/manage" element={<ProtectedRoute allowedRoles={['CURRICULUM_MANAGER','ADMIN','SCHOOL_OWNER']}><CurriculumManagePage /></ProtectedRoute>} />
          <Route path="/dashboard/curriculum/profile" element={<ProtectedRoute allowedRoles={['CURRICULUM_MANAGER']}><CurriculumManagerProfilePage /></ProtectedRoute>} />
          <Route path="/dashboard/fees" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','FEE_MANAGER']}><FeePortalPage /></ProtectedRoute>} />
          <Route path="/dashboard/fees/sections/:sectionId" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','FEE_MANAGER']}><FeePortalPage /></ProtectedRoute>} />
          <Route path="/dashboard/fees/students/:studentId" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','FEE_MANAGER']}><FeePortalPage /></ProtectedRoute>} />
          <Route path="/dashboard/fees/structures/new" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','FEE_MANAGER']}><FeeStructureWizardPage /></ProtectedRoute>} />
          <Route path="/dashboard/fees/structures/:structureId/edit" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','FEE_MANAGER']}><FeeStructureWizardPage /></ProtectedRoute>} />
          <Route path="/dashboard/fees/operations" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','FEE_MANAGER']}><FeeOperationsPage /></ProtectedRoute>} />
          <Route path="/dashboard/fees/administration" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','FEE_MANAGER']}><FeeAdministrationPage /></ProtectedRoute>} />
          <Route path="/parent/fees/family" element={<ProtectedRoute allowedRoles={['PARENT']}><FamilyFeePage /></ProtectedRoute>} />
          <Route path="/dashboard/platform/fees" element={<ProtectedRoute allowedRoles={['PLATFORM_OWNER']}><PlatformFeeAnalyticsPage /></ProtectedRoute>} />
          <Route path="/dashboard/fee-manager/profile" element={<ProtectedRoute allowedRoles={['FEE_MANAGER']}><FeeManagerProfilePage /></ProtectedRoute>} />
          <Route path="/dashboard/fees/collect" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','FEE_MANAGER']}><FeePortalPage /></ProtectedRoute>} />
          <Route path="/student/fees" element={<ProtectedRoute allowedRoles={['STUDENT']}><FeePortalPage /></ProtectedRoute>} />
          <Route path="/parent/fees" element={<ProtectedRoute allowedRoles={['PARENT']}><FeePortalPage /></ProtectedRoute>} />
          <Route path="/teacher/fees" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherFeePage /></ProtectedRoute>} />
          <Route path="/dashboard/calendar" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER','PARENT','STUDENT','STAFF']}><AcademicCalendarPage /></ProtectedRoute>} />
          <Route
            path="/dashboard/admin/class-teachers"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
                <ClassTeacherAssignmentPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/admin/attendance/students"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
                <StudentAttendancePage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/admin/attendance/teachers"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
                <TeacherAttendancePage />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard/admin/attendance/calendar" element={<ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}><AcademicCalendarPage /></ProtectedRoute>} />

          <Route
            path="/dashboard/admin/teacher-assignment-summary"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
                <TeacherAssignmentSummaryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/admin/weekly-slots"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER']}>
                <WeeklySlotManagementPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/admin/timetable-builder"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
                <TimetableBuilderPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/admin/timetable-reconciliation"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
                <TimetableReconciliationPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/admin/gallery"
            element={
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
                <GalleryStudioPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/gallery"
            element={
              <ProtectedRoute allowedRoles={['PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT', 'STAFF']}>
                <GalleryPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/widgets"
            element={
              <ProtectedRoute allowedRoles={['PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'TEACHER', 'PARENT', 'STUDENT', 'STAFF']}>
                <WidgetHubPage />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/teacher"
            element={
              <ProtectedRoute allowedRoles={['TEACHER']}>
                <TeacherDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/teacher/dashboard" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/assignments" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherAssignmentsPage /></ProtectedRoute>} />
          <Route path="/teacher/assignments/:assignmentId" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherAssignmentDetailPage /></ProtectedRoute>} />
          <Route path="/teacher/assignments/:assignmentId/chapters/:chapterId" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherChapterPage /></ProtectedRoute>} />
          <Route path="/teacher/assignments/:assignmentId/students" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherAssignmentStudentsPage /></ProtectedRoute>} />
          <Route path="/teacher/assignments/:assignmentId/students/:studentId" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherStudentPerformancePage /></ProtectedRoute>} />
          <Route path="/teacher/polls" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherPollsPage /></ProtectedRoute>} />
          <Route path="/teacher/polls/:pollId" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherPollPage /></ProtectedRoute>} />
          <Route path="/teacher/performance" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherPerformancePage /></ProtectedRoute>} />
          <Route path="/teacher/my-class" element={<ProtectedRoute allowedRoles={['TEACHER','CLASS_TEACHER']}><TeacherMyClassPage /></ProtectedRoute>} />
          <Route path="/teacher/attendance" element={<ProtectedRoute allowedRoles={['TEACHER','CLASS_TEACHER']}><StudentAttendancePage /></ProtectedRoute>} />

          <Route
            path="/dashboard/teacher/attendance"
            element={
              <ProtectedRoute allowedRoles={['TEACHER']}>
                <StudentAttendancePage />
              </ProtectedRoute>
            }
          />
          <Route path="/dashboard/teacher/my-attendance" element={<ProtectedRoute allowedRoles={['TEACHER']}><MyAttendancePage /></ProtectedRoute>} />
          <Route path="/dashboard/student/attendance" element={<ProtectedRoute allowedRoles={['STUDENT']}><MyAttendancePage /></ProtectedRoute>} />
          <Route path="/dashboard/parent/attendance" element={<ProtectedRoute allowedRoles={['PARENT']}><MyAttendancePage /></ProtectedRoute>} />

          <Route
            path="/dashboard/parent"
            element={
              <ProtectedRoute allowedRoles={['PARENT']}>
                <ParentDashboard />
              </ProtectedRoute>
            }
          />

          <Route
            path="/dashboard/student"
            element={
              <ProtectedRoute allowedRoles={['STUDENT']}>
                <StudentDashboard />
              </ProtectedRoute>
            }
          />
          <Route path="/student/dashboard" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentDashboard /></ProtectedRoute>} />
          <Route path="/student/attendance" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentAttendanceSummaryPage /></ProtectedRoute>} />
          <Route path="/student/attendance/:year/:month" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentAttendanceMonthPage /></ProtectedRoute>} />
          <Route path="/student/subjects" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentSubjectsPage /></ProtectedRoute>} />
          <Route path="/student/subjects/:subjectId" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentSubjectPage /></ProtectedRoute>} />
          <Route path="/student/subjects/:subjectId/chapters/:chapterId" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentChapterPage /></ProtectedRoute>} />
          <Route path="/student/polls/pending" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentPendingPollsPage /></ProtectedRoute>} />
          <Route path="/student/polls/submitted" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentSubmittedPollsPage /></ProtectedRoute>} />
          <Route path="/student/polls/submitted/:submissionId" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentSubmittedPollPage /></ProtectedRoute>} />
          <Route path="/student/polls/:pollId" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentPollPage /></ProtectedRoute>} />
          <Route path="/student/performance" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentPerformancePage /></ProtectedRoute>} />
          <Route path="/student/resources" element={<ProtectedRoute allowedRoles={['STUDENT']}><StudentResourcesPage /></ProtectedRoute>} />

          <Route
            path="/dashboard/staff"
            element={
              <ProtectedRoute allowedRoles={['STAFF']}>
                <StaffDashboard />
              </ProtectedRoute>
            }
          />

          {/* Default Routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
      <div className="pwa-prompt-stack" aria-live="polite">
        <PWAUpdatePrompt />
        <PWAInstallPrompt />
      </div>
    </Router>
  );
}


