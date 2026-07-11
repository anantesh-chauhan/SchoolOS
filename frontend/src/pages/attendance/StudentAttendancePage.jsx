import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, Save, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { attendanceService } from '../../services/managementService';
import { teacherDashboardService } from '../../services/teacherDashboardService';
import { authService } from '../../services/authService';
import { useAcademicStructure } from '../../hooks/useAcademicStructure';
import AttendanceCalendar from '../../components/attendance/AttendanceCalendar';

const STATUS_OPTIONS = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE'];

const todayInputValue = () => {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

export default function StudentAttendancePage() {
  const queryClient = useQueryClient();
  const user = authService.getCurrentUser();
  const isAdmin = ['ADMIN', 'SCHOOL_OWNER'].includes(user?.role);
  const academicStructure = useAcademicStructure();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [date, setDate] = useState(todayInputValue());
  const [recordsByStudent, setRecordsByStudent] = useState({});
  const month = date.slice(0, 7);

  const teacherAssignmentsQuery = useQuery({
    queryKey: ['teacher-class-attendance-sections'],
    queryFn: teacherDashboardService.getAssignments,
    enabled: user?.role === 'TEACHER',
  });

  const teacherSections = useMemo(() => {
    const groups = teacherAssignmentsQuery.data || [];
    const bySection = new Map();
    groups.forEach((classGroup) => {
      classGroup.sections.forEach((section) => {
        const classTeacherSubject = section.subjects.find((subject) => ['CLASS_TEACHER', 'BOTH'].includes(subject.roleType));
        if (classTeacherSubject) {
          bySection.set(section.sectionId, {
            classId: classGroup.classId,
            className: classGroup.className,
            sectionId: section.sectionId,
            sectionName: section.sectionName,
          });
        }
      });
    });
    return [...bySection.values()];
  }, [teacherAssignmentsQuery.data]);

  useEffect(() => {
    if (!isAdmin && teacherSections.length > 0 && !selectedSectionId) {
      setSelectedClassId(teacherSections[0].classId);
      setSelectedSectionId(teacherSections[0].sectionId);
    }
  }, [isAdmin, selectedSectionId, teacherSections]);

  const adminSections = academicStructure.getSections(selectedClassId);
  const attendanceQuery = useQuery({
    queryKey: ['student-attendance-roster', selectedClassId, selectedSectionId, date],
    queryFn: () => attendanceService.studentRoster({ classId: selectedClassId, sectionId: selectedSectionId, date }),
    enabled: Boolean(selectedClassId && selectedSectionId && date),
  });
  const monthQuery = useQuery({
    queryKey: ['student-attendance-month', selectedClassId, selectedSectionId, month],
    queryFn: () => attendanceService.classMonth({ classId: selectedClassId, sectionId: selectedSectionId, month }),
    enabled: Boolean(selectedClassId && selectedSectionId && month),
  });
  const registerQuery = useQuery({
    queryKey: ['student-month-register', selectedClassId, selectedSectionId, month],
    queryFn: () => attendanceService.classRegister({ classId: selectedClassId, sectionId: selectedSectionId, month }),
    enabled: Boolean(selectedClassId && selectedSectionId && month),
  });

  useEffect(() => {
    const students = attendanceQuery.data?.data?.students || [];
    const next = {};
    students.forEach((student) => {
      next[student.id] = { status: student.status || 'PRESENT', remarks: student.remarks || '' };
    });
    setRecordsByStudent(next);
  }, [attendanceQuery.data]);

  const saveMutation = useMutation({
    mutationFn: attendanceService.saveStudentAttendance,
    onSuccess: () => {
      toast.success('Attendance saved');
      queryClient.invalidateQueries({ queryKey: ['student-attendance-roster', selectedClassId, selectedSectionId, date] });
      queryClient.invalidateQueries({ queryKey: ['student-attendance-month', selectedClassId, selectedSectionId, month] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to save attendance'),
  });

  const roster = attendanceQuery.data?.data;
  const students = roster?.students || [];
  const canMark = roster?.canMark && user?.role === 'TEACHER';

  const summary = useMemo(() => {
    const counts = Object.fromEntries(STATUS_OPTIONS.map((status) => [status, 0]));
    students.forEach((student) => {
      const status = recordsByStudent[student.id]?.status || student.status || 'PRESENT';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [recordsByStudent, students]);

  const save = () => {
    saveMutation.mutate({
      classId: selectedClassId,
      sectionId: selectedSectionId,
      date,
      records: students.map((student) => ({
        studentId: student.id,
        status: recordsByStudent[student.id]?.status || 'PRESENT',
        remarks: recordsByStudent[student.id]?.remarks || '',
      })),
    });
  };
  const markAll = (status) => setRecordsByStudent(Object.fromEntries(students.map((student) => [student.id, { ...(recordsByStudent[student.id] || {}), status }])));

  return (
    <DashboardLayout role={user?.role || 'TEACHER'}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">Attendance</p>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Class attendance register</h1>
            <p className="text-sm text-slate-500">Monthly overview and fast daily marking in one place.</p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {STATUS_OPTIONS.map((status) => (
              <div key={status} className="rounded-md border border-slate-200 bg-white px-3 py-2 text-center dark:border-slate-800 dark:bg-slate-900">
                <p className="text-sm font-bold text-slate-950 dark:text-white">{summary[status] || 0}</p>
                <p className="text-[11px] text-slate-500">{status.replace(/_/g, ' ')}</p>
              </div>
            ))}
          </div>
        </div>

        {selectedSectionId && <Card><CardHeader><CardTitle>Monthly class calendar</CardTitle></CardHeader><CardContent className="space-y-4"><AttendanceCalendar month={month} days={monthQuery.data?.data?.days || []} onSelectDay={(day) => setDate(day.date)} />{isAdmin && <p className="text-xs text-slate-500">Manage holidays, exams and events from the Academic Calendar page.</p>}</CardContent></Card>}

        {selectedSectionId && <Card><CardHeader><CardTitle>Whole-class monthly summary</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="min-w-full text-sm"><thead className="bg-slate-100 dark:bg-slate-800"><tr>{['Roll','Student','Present','Absent','Late','Half day','Leave','Marked','Attendance'].map((label) => <th key={label} className="px-3 py-2 text-left">{label}</th>)}</tr></thead><tbody>{(registerQuery.data?.data?.students || []).map((student) => <tr key={student.id} className="border-b dark:border-slate-800"><td className="px-3 py-2">{student.rollNumber || '-'}</td><td className="px-3 py-2"><p className="font-semibold">{student.name}</p><p className="text-xs text-slate-500">{student.admissionNo}</p></td><td className="px-3 py-2 text-emerald-700">{student.PRESENT}</td><td className="px-3 py-2 text-rose-700">{student.ABSENT}</td><td className="px-3 py-2">{student.LATE}</td><td className="px-3 py-2">{student.HALF_DAY}</td><td className="px-3 py-2">{student.LEAVE}</td><td className="px-3 py-2">{student.markedDays}</td><td className="px-3 py-2 font-bold">{student.percentage}%</td></tr>)}</tbody></table></div></CardContent></Card>}

        <Card>
          <CardHeader>
            <CardTitle>Roster</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-4">
              {isAdmin ? (
                <>
                  <select
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                    value={selectedClassId}
                    onChange={(event) => {
                      setSelectedClassId(event.target.value);
                      setSelectedSectionId('');
                    }}
                  >
                    <option value="">Select class</option>
                    {academicStructure.classes.map((row) => (
                      <option key={row.id} value={row.id}>{row.className}</option>
                    ))}
                  </select>
                  <select
                    className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                    value={selectedSectionId}
                    onChange={(event) => setSelectedSectionId(event.target.value)}
                    disabled={!selectedClassId}
                  >
                    <option value="">Select section</option>
                    {adminSections.map((row) => (
                      <option key={row.id} value={row.id}>{row.sectionName}</option>
                    ))}
                  </select>
                </>
              ) : (
                <select
                  className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950 md:col-span-2"
                  value={selectedSectionId}
                  onChange={(event) => {
                    const selected = teacherSections.find((row) => row.sectionId === event.target.value);
                    setSelectedClassId(selected?.classId || '');
                    setSelectedSectionId(event.target.value);
                  }}
                >
                  <option value="">Select class teacher section</option>
                  {teacherSections.map((row) => (
                    <option key={row.sectionId} value={row.sectionId}>
                      {row.className} - Section {row.sectionName}
                    </option>
                  ))}
                </select>
              )}
              <input
                type="date"
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <Button leftIcon={Save} onClick={save} loading={saveMutation.isPending} disabled={!canMark || students.length === 0}>
                Save Attendance
              </Button>
            </div>

            {isAdmin && selectedSectionId && (
              <p className="text-xs font-medium text-slate-500">Admins can view student attendance. Student daily marking is reserved for the section class teacher.</p>
            )}

            {canMark && students.length > 0 && <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60"><span className="mr-1 flex items-center gap-1 text-sm font-semibold"><Users size={16}/> Quick marking</span><Button variant="outline" leftIcon={Check} onClick={() => markAll('PRESENT')}>All present</Button><Button variant="outline" onClick={() => markAll('ABSENT')}>All absent</Button><span className="text-xs text-slate-500">Tap a status below only for exceptions.</span></div>}

            {!selectedSectionId ? (
              <p className="text-sm text-slate-500">Select a section to load attendance.</p>
            ) : attendanceQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-12 rounded-md bg-slate-100 animate-pulse dark:bg-slate-800" />
                ))}
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left">Roll</th>
                      <th className="px-3 py-2 text-left">Student</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {students.map((student) => (
                      <tr key={student.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{student.rollNumber || '-'}</td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{student.name}</p>
                          <p className="text-xs text-slate-500">{student.admissionNo}</p>
                        </td>
                        <td className="px-3 py-2">
                          <select
                            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            value={recordsByStudent[student.id]?.status || 'PRESENT'}
                            onChange={(event) => setRecordsByStudent((prev) => ({
                              ...prev,
                              [student.id]: { ...(prev[student.id] || {}), status: event.target.value },
                            }))}
                            disabled={!canMark}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="h-9 w-full min-w-48 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            value={recordsByStudent[student.id]?.remarks || ''}
                            onChange={(event) => setRecordsByStudent((prev) => ({
                              ...prev,
                              [student.id]: { ...(prev[student.id] || {}), remarks: event.target.value },
                            }))}
                            disabled={!canMark}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
