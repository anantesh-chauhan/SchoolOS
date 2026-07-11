import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Save } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { attendanceService } from '../../services/managementService';

const STATUS_OPTIONS = ['PRESENT', 'ABSENT', 'LATE', 'HALF_DAY', 'LEAVE'];

const todayInputValue = () => {
  const now = new Date();
  const offsetDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 10);
};

export default function TeacherAttendancePage() {
  const queryClient = useQueryClient();
  const [date, setDate] = useState(todayInputValue());
  const [recordsByTeacher, setRecordsByTeacher] = useState({});
  const month = date.slice(0, 7);

  const rosterQuery = useQuery({
    queryKey: ['teacher-attendance-roster', date],
    queryFn: () => attendanceService.teacherRoster({ date }),
    enabled: Boolean(date),
  });
  const registerQuery = useQuery({
    queryKey: ['teacher-month-register', month],
    queryFn: () => attendanceService.teacherRegister({ month }),
    enabled: Boolean(month),
  });

  useEffect(() => {
    const teachers = rosterQuery.data?.data?.teachers || [];
    const next = {};
    teachers.forEach((teacher) => {
      next[teacher.id] = { status: teacher.status || 'PRESENT', remarks: teacher.remarks || '' };
    });
    setRecordsByTeacher(next);
  }, [rosterQuery.data]);

  const saveMutation = useMutation({
    mutationFn: attendanceService.saveTeacherAttendance,
    onSuccess: () => {
      toast.success('Teacher attendance saved');
      queryClient.invalidateQueries({ queryKey: ['teacher-attendance-roster', date] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to save teacher attendance'),
  });

  const teachers = rosterQuery.data?.data?.teachers || [];
  const summary = useMemo(() => {
    const counts = Object.fromEntries(STATUS_OPTIONS.map((status) => [status, 0]));
    teachers.forEach((teacher) => {
      const status = recordsByTeacher[teacher.id]?.status || teacher.status || 'PRESENT';
      counts[status] = (counts[status] || 0) + 1;
    });
    return counts;
  }, [recordsByTeacher, teachers]);

  const save = () => {
    saveMutation.mutate({
      date,
      records: teachers.map((teacher) => ({
        teacherId: teacher.id,
        status: recordsByTeacher[teacher.id]?.status || 'PRESENT',
        remarks: recordsByTeacher[teacher.id]?.remarks || '',
      })),
    });
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">Attendance</p>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Teacher Attendance</h1>
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

        <Card>
          <CardHeader>
            <CardTitle>Teachers</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[220px_180px]">
              <input
                type="date"
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
              <Button leftIcon={Save} onClick={save} loading={saveMutation.isPending} disabled={teachers.length === 0}>
                Save Attendance
              </Button>
            </div>

            {rosterQuery.isLoading ? (
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
                      <th className="px-3 py-2 text-left">Teacher</th>
                      <th className="px-3 py-2 text-left">Specialization</th>
                      <th className="px-3 py-2 text-left">Status</th>
                      <th className="px-3 py-2 text-left">Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {teachers.map((teacher) => (
                      <tr key={teacher.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-900 dark:text-slate-100">{teacher.teacherName}</p>
                          <p className="text-xs text-slate-500">{teacher.employeeId}</p>
                        </td>
                        <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{teacher.specialization || '-'}</td>
                        <td className="px-3 py-2">
                          <select
                            className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            value={recordsByTeacher[teacher.id]?.status || 'PRESENT'}
                            onChange={(event) => setRecordsByTeacher((prev) => ({
                              ...prev,
                              [teacher.id]: { ...(prev[teacher.id] || {}), status: event.target.value },
                            }))}
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status} value={status}>{status.replace(/_/g, ' ')}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            className="h-9 w-full min-w-48 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                            value={recordsByTeacher[teacher.id]?.remarks || ''}
                            onChange={(event) => setRecordsByTeacher((prev) => ({
                              ...prev,
                              [teacher.id]: { ...(prev[teacher.id] || {}), remarks: event.target.value },
                            }))}
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
        <Card><CardHeader><CardTitle>Monthly teacher summary</CardTitle></CardHeader><CardContent><div className="overflow-auto"><table className="min-w-full text-sm"><thead className="bg-slate-100 dark:bg-slate-800"><tr>{['Teacher','Present','Absent','Late','Half day','Leave','Marked','Attendance'].map((label) => <th key={label} className="px-3 py-2 text-left">{label}</th>)}</tr></thead><tbody>{(registerQuery.data?.data?.teachers || []).map((teacher) => <tr key={teacher.id} className="border-b dark:border-slate-800"><td className="px-3 py-2"><p className="font-semibold">{teacher.teacherName}</p><p className="text-xs text-slate-500">{teacher.employeeId}</p></td><td className="px-3 py-2 text-emerald-700">{teacher.PRESENT}</td><td className="px-3 py-2 text-rose-700">{teacher.ABSENT}</td><td className="px-3 py-2">{teacher.LATE}</td><td className="px-3 py-2">{teacher.HALF_DAY}</td><td className="px-3 py-2">{teacher.LEAVE}</td><td className="px-3 py-2">{teacher.markedDays}</td><td className="px-3 py-2 font-bold">{teacher.percentage}%</td></tr>)}</tbody></table></div></CardContent></Card>
      </div>
    </DashboardLayout>
  );
}
