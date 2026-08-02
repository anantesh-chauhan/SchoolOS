import React from 'react';
import { Route } from 'react-router-dom';
import ProtectedRoute from '../components/ProtectedRoute';
import { TeacherDashboard, TeacherAssignmentsPage, TeacherAssignmentDetailPage, TeacherChapterPage, TeacherAssignmentStudentsPage, TeacherStudentPerformancePage, TeacherPollsPage, TeacherPollPage, TeacherPerformancePage, TeacherMyClassPage, ParentDashboard, StudentDashboard, StudentSubjectsPage, StudentSubjectPage, StudentChapterPage, StudentAttendanceSummaryPage, StudentAttendanceMonthPage, StudentPendingPollsPage, StudentSubmittedPollsPage, StudentPollPage, StudentSubmittedPollPage, StudentResourcesPage, StudentPerformancePage, StaffDashboard, StudentAttendancePage, MyAttendancePage } from './lazyPages';

export const portalRoutes = (
    <>
<Route path="/teacher/dashboard" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherDashboard /></ProtectedRoute>} />
          <Route path="/teacher/assignments" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherAssignmentsPage /></ProtectedRoute>} />
          <Route path="/teacher/assignments/:assignmentId" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherAssignmentDetailPage /></ProtectedRoute>} />
          <Route path="/teacher/assignments/:assignmentId/chapters/:chapterId" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherChapterPage /></ProtectedRoute>} />
          <Route path="/teacher/assignments/:assignmentId/students" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherAssignmentStudentsPage /></ProtectedRoute>} />
          <Route path="/teacher/assignments/:assignmentId/students/:studentId" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherStudentPerformancePage /></ProtectedRoute>} />
          <Route path="/teacher/polls" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherPollsPage /></ProtectedRoute>} />
          <Route path="/teacher/polls/:pollId" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherPollPage /></ProtectedRoute>} />
          <Route path="/teacher/performance" element={<ProtectedRoute allowedRoles={['TEACHER']}><TeacherPerformancePage /></ProtectedRoute>} />
          <Route path="/teacher/my-class" element={<ProtectedRoute allowedRoles={['CLASS_TEACHER']}><TeacherMyClassPage /></ProtectedRoute>} />
          <Route path="/teacher/attendance" element={<ProtectedRoute allowedRoles={['CLASS_TEACHER']}><StudentAttendancePage /></ProtectedRoute>} />

          <Route
            path="/dashboard/teacher/attendance"
            element={
              <ProtectedRoute allowedRoles={['CLASS_TEACHER']}>
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
    </>
);
