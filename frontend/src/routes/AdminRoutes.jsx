import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { PlatformOwnerDashboard, SchoolOwnerDashboard, AdminDashboard, SchoolManagementPage, SchoolSettingsPage, ClassManagementPage, ClassDetailsDashboardPage, SubjectDetailsDashboardPage, ChapterComingSoonPage, SectionManagementPage, SubjectManagementPage, SubjectAssignmentPage, TeacherManagementPage, TeacherAssignmentPage, AddStudentPage, StudentAllocationPage, SchoolDirectoryPage, PlatformOwnerProfilePage, SchoolOwnerProfilePage, AdminProfilePage, UserManagementPage, TeacherProfilePage, ParentProfilePage, StudentProfilePage, StaffProfilePage, RoleManagementPage } from './lazyPages';

export const adminRoutes = (
    <>
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
    </>
);
