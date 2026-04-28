import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';

const LoginPage = lazy(() => import('./pages/LoginPage'));
const PlatformOwnerDashboard = lazy(() => import('./pages/dashboards/PlatformOwnerDashboard'));
const SchoolOwnerDashboard = lazy(() => import('./pages/dashboards/SchoolOwnerDashboard'));
const AdminDashboard = lazy(() => import('./pages/dashboards/AdminDashboard'));
const TeacherDashboard = lazy(() => import('./pages/dashboards/TeacherDashboard'));
const ParentDashboard = lazy(() => import('./pages/dashboards/ParentDashboard'));
const StudentDashboard = lazy(() => import('./pages/dashboards/StudentDashboard'));
const StaffDashboard = lazy(() => import('./pages/dashboards/StaffDashboard'));
const SchoolManagementPage = lazy(() => import('./pages/platform/SchoolManagementPage'));
const SchoolSettingsPage = lazy(() => import('./pages/platform/SchoolSettingsPage'));
const ClassManagementPage = lazy(() => import('./pages/admin/ClassManagementPage'));
const SectionManagementPage = lazy(() => import('./pages/admin/SectionManagementPage'));
const SubjectManagementPage = lazy(() => import('./pages/admin/SubjectManagementPage'));
const SubjectAssignmentPage = lazy(() => import('./pages/admin/SubjectAssignmentPage'));
const TeacherManagementPage = lazy(() => import('./pages/admin/TeacherManagementPage'));
const TeacherAssignmentPage = lazy(() => import('./pages/admin/TeacherAssignmentPage'));
const TeacherAssignmentSummaryPage = lazy(() => import('./pages/admin/TeacherAssignmentSummaryPage'));
const WeeklySlotManagementPage = lazy(() => import('./pages/admin/WeeklySlotManagementPage'));
const TimetableBuilderPage = lazy(() => import('./pages/admin/TimetableBuilderPage'));
const TimetableReconciliationPage = lazy(() => import('./pages/admin/TimetableReconciliationPage'));
const GalleryStudioPage = lazy(() => import('./pages/admin/GalleryStudioPage'));
const GalleryPage = lazy(() => import('./pages/GalleryPage'));
const SchoolProfilePage = lazy(() => import('./pages/school/SchoolProfilePage'));
const WidgetHubPage = lazy(() => import('./pages/widgets/WidgetHubPage'));

const AppFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50">
    <div className="h-10 w-10 rounded-full border-4 border-slate-200 border-t-blue-600 animate-spin" />
  </div>
);

export default function App() {
  return (
    <Router>
      <Toaster position="top-right" />
      <Suspense fallback={<AppFallback />}>
        <Routes>
          {/* Login Route */}
          <Route path="/login" element={<LoginPage />} />

        {/* Dashboard Routes */}
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
                <SchoolProfilePage />
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
              <ProtectedRoute allowedRoles={['ADMIN', 'SCHOOL_OWNER']}>
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
    </Router>
  );
}

