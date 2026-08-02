import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { TeacherDashboard, ClassTeacherAssignmentPage, TeacherAssignmentSummaryPage, StudentAttendancePage, TeacherAttendancePage, AcademicCalendarPage, WeeklySlotManagementPage, TimetableBuilderPage, TimetableReconciliationPage, GalleryStudioPage, GalleryPage, CurriculumManagerProfilePage, WidgetHubPage, LoginCredentialsPage, CurriculumDashboardPage, CurriculumManagePage, FeePortalPage, FeeManagerProfilePage, FeeStructureWizardPage, FeeOperationsPage, FeeAdministrationPage, FamilyFeePage, PlatformFeeAnalyticsPage, TeacherFeePage } from './lazyPages';

export const operationsRoutes = (
    <>
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
          <Route path="/teacher/fees" element={<ProtectedRoute allowedRoles={['CLASS_TEACHER']}><TeacherFeePage /></ProtectedRoute>} />
          <Route path="/dashboard/calendar" element={<ProtectedRoute allowedRoles={['SCHOOL_OWNER','ADMIN','CURRICULUM_MANAGER','TEACHER','CLASS_TEACHER','PARENT','STUDENT','STAFF']}><AcademicCalendarPage /></ProtectedRoute>} />
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
    </>
);
