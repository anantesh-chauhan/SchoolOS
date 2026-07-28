import React, { useEffect, useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Save,
  Search,
  UserCheck,
  UserMinus,
  Users,
} from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { attendanceService } from '../../services/managementService';
import { authService } from '../../services/authService';

const STATUS_OPTIONS = [
  { code: 'PRESENT', label: 'Present', short: 'P', tone: 'emerald' },
  { code: 'ABSENT', label: 'Absent', short: 'A', tone: 'rose' },
  { code: 'LATE', label: 'Late', short: 'LT', tone: 'amber' },
  { code: 'HALF_DAY', label: 'Half day', short: 'HD', tone: 'orange' },
  { code: 'LEAVE', label: 'Leave', short: 'L', tone: 'sky' },
];

const toneClasses = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  rose: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900 dark:bg-rose-950/50 dark:text-rose-300',
  amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  orange: 'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300',
  sky: 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900 dark:bg-sky-950/50 dark:text-sky-300',
  slate: 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300',
};

const todayInputValue = (source = new Date()) => {
  const local = new Date(source.getTime() - source.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
};

const shiftDate = (value, amount) => {
  const next = new Date(`${value}T12:00:00`);
  next.setDate(next.getDate() + amount);
  return todayInputValue(next);
};

const percentageTone = (value) => {
  if (value >= 90) return 'text-emerald-600';
  if (value >= 75) return 'text-amber-600';
  return 'text-rose-600';
};

function SummaryCard({ icon: Icon, label, value, helper, tone = 'slate' }) {
  return (
    <div className={`rounded-2xl border p-4 ${toneClasses[tone]}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wide">{label}</p>
        <Icon size={18} aria-hidden="true" />
      </div>
      <p className="mt-3 text-2xl font-black">{value}</p>
      <p className="mt-1 text-xs opacity-80">{helper}</p>
    </div>
  );
}
SummaryCard.propTypes = { icon: PropTypes.elementType.isRequired, label: PropTypes.string.isRequired, value: PropTypes.node.isRequired, helper: PropTypes.node.isRequired, tone: PropTypes.oneOf(Object.keys(toneClasses)) };

export default function TeacherAttendancePage() {
  const queryClient = useQueryClient();
  const currentUser = authService.getCurrentUser();
  const [date, setDate] = useState(todayInputValue());
  const [records, setRecords] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [changedIds, setChangedIds] = useState(new Set());
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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
    const next = {};
    (rosterQuery.data?.data?.teachers || []).forEach((teacher) => {
      next[teacher.id] = {
        status: teacher.attendanceId ? teacher.status : 'NOT_MARKED',
        remarks: teacher.remarks || '',
      };
    });
    setRecords(next);
    setSelected(new Set());
    setChangedIds(new Set());
  }, [rosterQuery.data]);

  useEffect(() => {
    const warn = (event) => {
      if (changedIds.size) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [changedIds.size]);

  const saveMutation = useMutation({
    mutationFn: attendanceService.saveTeacherAttendance,
    onSuccess: async (response) => {
      toast.success(response?.message || 'Teacher attendance saved');
      setChangedIds(new Set());
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['teacher-attendance-roster', date] }),
        queryClient.invalidateQueries({ queryKey: ['teacher-month-register', month] }),
        queryClient.invalidateQueries({ queryKey: ['attendance-dashboard'] }),
      ]);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to save teacher attendance'),
  });

  const teachers = rosterQuery.data?.data?.teachers || [];
  const summary = useMemo(() => {
    const counts = { NOT_MARKED: 0 };
    STATUS_OPTIONS.forEach(({ code }) => { counts[code] = 0; });
    teachers.forEach((teacher) => {
      const status = records[teacher.id]?.status || 'NOT_MARKED';
      counts[status] = (counts[status] || 0) + 1;
    });
    const marked = teachers.length - counts.NOT_MARKED;
    const attendedUnits = counts.PRESENT + counts.LATE + counts.HALF_DAY * 0.5;
    return {
      ...counts,
      marked,
      completion: teachers.length ? Math.round((marked / teachers.length) * 100) : 0,
      attendanceRate: marked ? Math.round((attendedUnits / marked) * 1000) / 10 : 0,
    };
  }, [records, teachers]);

  const monthly = useMemo(() => {
    const rows = registerQuery.data?.data?.teachers || [];
    const totalMarked = rows.reduce((sum, row) => sum + row.markedDays, 0);
    const average = rows.length ? Math.round((rows.reduce((sum, row) => sum + row.percentage, 0) / rows.length) * 10) / 10 : 0;
    return {
      average,
      totalMarked,
      reviewCount: rows.filter((row) => row.markedDays > 0 && row.percentage < 75).length,
    };
  }, [registerQuery.data]);

  const visibleTeachers = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return teachers.filter((teacher) => {
      const matchesSearch = !needle || `${teacher.teacherName} ${teacher.employeeId || ''} ${teacher.specialization || ''}`.toLowerCase().includes(needle);
      const matchesStatus = !statusFilter || records[teacher.id]?.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [teachers, records, search, statusFilter]);

  const updateRows = (ids, status) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    setRecords((previous) => Object.fromEntries(
      Object.entries(previous).map(([id, row]) => [id, idSet.has(id) ? { ...row, status } : row])
    ));
    setChangedIds((previous) => new Set([...previous, ...ids]));
  };

  const updateRow = (teacherId, patch) => {
    setRecords((previous) => ({
      ...previous,
      [teacherId]: { ...previous[teacherId], ...patch },
    }));
    setChangedIds((previous) => new Set(previous).add(teacherId));
  };

  const save = () => {
    if (rosterQuery.isError) {
      toast.error(rosterQuery.error?.response?.data?.message || 'Reload the teacher list before saving');
      return;
    }
    if (!teachers.length) {
      toast.error('No active teachers are available for attendance');
      return;
    }
    if (summary.NOT_MARKED) {
      toast.error(`Mark attendance for the remaining ${summary.NOT_MARKED} teacher${summary.NOT_MARKED === 1 ? '' : 's'}`);
      setStatusFilter('NOT_MARKED');
      return;
    }
    saveMutation.mutate({
      date,
      records: teachers.map((teacher) => ({
        teacherId: teacher.id,
        status: records[teacher.id]?.status,
        remarks: records[teacher.id]?.remarks || '',
      })),
    });
  };

  const allVisibleSelected = visibleTeachers.length > 0 && visibleTeachers.every((teacher) => selected.has(teacher.id));
  const dateLabel = new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <DashboardLayout role={currentUser?.role || 'ADMIN'}>
      <div className="space-y-5 print:p-0">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Attendance / Teachers</p>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Teacher attendance</h1>
            <p className="mt-1 text-sm text-slate-500">Mark today’s exceptions, check completion, and save one clear daily register.</p>
          </div>
          <div className="flex items-center gap-1 rounded-xl border bg-white p-1 dark:border-slate-800 dark:bg-slate-900">
            <button className="rounded-lg p-2 hover:bg-slate-100 dark:hover:bg-slate-800" onClick={() => setDate(shiftDate(date, -1))} aria-label="Previous day"><ChevronLeft size={18} /></button>
            <label className="relative">
              <CalendarDays className="pointer-events-none absolute left-3 top-2.5 text-slate-400" size={17} />
              <input type="date" aria-label="Attendance date" className="h-10 rounded-lg border-0 bg-transparent pl-9 pr-2 text-sm font-semibold" value={date} max={todayInputValue()} onChange={(event) => setDate(event.target.value)} />
            </label>
            <button className="rounded-lg p-2 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800" disabled={date >= todayInputValue()} onClick={() => setDate(shiftDate(date, 1))} aria-label="Next day"><ChevronRight size={18} /></button>
            {date !== todayInputValue() && <Button variant="ghost" size="sm" onClick={() => setDate(todayInputValue())}>Today</Button>}
          </div>
        </header>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <SummaryCard icon={Users} label="Teachers" value={teachers.length} helper={dateLabel} />
          <SummaryCard icon={Check} label="Register complete" value={`${summary.completion}%`} helper={`${summary.marked} of ${teachers.length} marked`} tone={summary.completion === 100 ? 'emerald' : 'amber'} />
          <SummaryCard icon={UserCheck} label="Attendance rate" value={summary.marked ? `${summary.attendanceRate}%` : '—'} helper="Based on marked teachers" tone="emerald" />
          <SummaryCard icon={AlertCircle} label="Needs attention" value={summary.ABSENT + summary.LATE + summary.HALF_DAY} helper={`${summary.ABSENT} absent · ${summary.LATE} late`} tone={summary.ABSENT ? 'rose' : 'slate'} />
        </div>

        {teachers.length > 0 && (
          <div className="rounded-2xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between gap-3 text-sm">
              <div>
                <p className="font-bold text-slate-900 dark:text-white">{summary.NOT_MARKED ? `${summary.NOT_MARKED} still to mark` : 'Register ready to save'}</p>
                <p className="text-xs text-slate-500">Present {summary.PRESENT} · Absent {summary.ABSENT} · Late {summary.LATE} · Half day {summary.HALF_DAY} · Leave {summary.LEAVE}</p>
              </div>
              <span className="font-black text-indigo-600">{summary.completion}%</span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
              <div className={`h-full rounded-full transition-all ${summary.completion === 100 ? 'bg-emerald-500' : 'bg-indigo-600'}`} style={{ width: `${summary.completion}%` }} />
            </div>
          </div>
        )}

        <Card>
          <CardHeader className="flex-col items-start gap-1 sm:flex-row sm:items-center">
            <div>
              <CardTitle>Daily teacher register</CardTitle>
              <p className="text-sm text-slate-500">Start with “Mark remaining present,” then record only the exceptions.</p>
            </div>
            {changedIds.size > 0 && <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">{changedIds.size} unsaved change{changedIds.size === 1 ? '' : 's'}</span>}
          </CardHeader>
          <CardContent className="space-y-4">
            {teachers.length > 0 && (
              <>
                <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-50 p-3 sm:flex sm:flex-wrap dark:bg-slate-800/60">
                  <Button variant="success" leftIcon={Check} onClick={() => updateRows(teachers.filter((teacher) => records[teacher.id]?.status === 'NOT_MARKED').map((teacher) => teacher.id), 'PRESENT')} disabled={!summary.NOT_MARKED}>
                    Mark remaining
                  </Button>
                  <Button variant="outline" leftIcon={UserMinus} onClick={() => updateRows([...selected], 'ABSENT')} disabled={!selected.size}>Selected absent</Button>
                  <Button variant="outline" leftIcon={Clock3} onClick={() => updateRows([...selected], 'LATE')} disabled={!selected.size}>Selected late</Button>
                  <Button variant="outline" onClick={() => updateRows([...selected], 'LEAVE')} disabled={!selected.size}>Selected leave</Button>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <label className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 text-slate-400" size={17} />
                    <input className="h-11 w-full rounded-lg border bg-white pl-9 pr-3 text-base sm:h-10 sm:text-sm dark:bg-slate-950" placeholder="Search teacher, ID or specialization" value={search} onChange={(event) => setSearch(event.target.value)} />
                  </label>
                  <select className="h-11 rounded-lg border bg-white px-3 text-base sm:h-10 sm:text-sm dark:bg-slate-950" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="">All statuses</option>
                    <option value="NOT_MARKED">Not marked ({summary.NOT_MARKED})</option>
                    {STATUS_OPTIONS.map((status) => <option key={status.code} value={status.code}>{status.label} ({summary[status.code]})</option>)}
                  </select>
                </div>
              </>
            )}

            {rosterQuery.isError && <div className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{rosterQuery.error?.response?.data?.message || 'Failed to load the teacher attendance roster.'}</div>}
            {rosterQuery.isLoading ? (
              <div className="space-y-2">{Array.from({ length: 8 }).map((_, index) => <div key={index} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}</div>
            ) : teachers.length === 0 ? (
              <div className="py-12 text-center">
                <Users className="mx-auto text-slate-300" size={36} />
                <p className="mt-3 font-semibold">No active teachers found</p>
                <p className="text-sm text-slate-500">Add an active teacher before creating this register.</p>
              </div>
            ) : visibleTeachers.length === 0 ? (
              <p className="py-10 text-center text-sm text-slate-500">No teachers match the current search or status filter.</p>
            ) : (
              <>
              <div className="grid gap-3 md:hidden">
                {visibleTeachers.map((teacher) => {
                  const activeStatus = records[teacher.id]?.status || 'NOT_MARKED';
                  return <article key={teacher.id} className="rounded-xl border bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start gap-3">
                      <input className="mt-1 h-5 w-5 shrink-0" aria-label={`Select ${teacher.teacherName}`} type="checkbox" checked={selected.has(teacher.id)} onChange={() => setSelected((previous) => { const next = new Set(previous); next.has(teacher.id) ? next.delete(teacher.id) : next.add(teacher.id); return next; })} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0"><p className="truncate font-bold">{teacher.teacherName}</p><p className="text-xs text-slate-500">{teacher.employeeId || 'No employee ID'}{teacher.specialization ? ` · ${teacher.specialization}` : ''}</p></div>
                          <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${activeStatus === 'NOT_MARKED' ? toneClasses.slate : changedIds.has(teacher.id) ? toneClasses.amber : toneClasses.emerald}`}>{activeStatus === 'NOT_MARKED' ? 'Not marked' : changedIds.has(teacher.id) ? 'Unsaved' : 'Saved'}</span>
                        </div>
                        <div className="mt-3 grid grid-cols-5 gap-1.5">{STATUS_OPTIONS.map((status) => <button key={status.code} type="button" aria-label={`Mark ${teacher.teacherName} ${status.label}`} onClick={() => updateRow(teacher.id, { status: status.code })} className={`min-h-10 rounded-lg border px-1 text-xs font-bold ${activeStatus === status.code ? toneClasses[status.tone] : 'border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-950'}`}>{status.short}</button>)}</div>
                        <input aria-label={`Remark for ${teacher.teacherName}`} className="mt-3 h-11 w-full rounded-lg border bg-white px-3 text-base dark:bg-slate-950" placeholder={['ABSENT', 'LATE', 'HALF_DAY'].includes(activeStatus) ? 'Add a helpful note' : 'Add a remark (optional)'} value={records[teacher.id]?.remarks || ''} onChange={(event) => updateRow(teacher.id, { remarks: event.target.value })} />
                      </div>
                    </div>
                  </article>;
                })}
              </div>
              <div className="hidden max-h-[58vh] overflow-auto rounded-xl border md:block dark:border-slate-800">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="sticky top-0 z-20 bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <tr>
                      <th className="w-10 p-3"><input aria-label="Select visible teachers" type="checkbox" checked={allVisibleSelected} onChange={(event) => setSelected((previous) => {
                        const next = new Set(previous);
                        visibleTeachers.forEach((teacher) => event.target.checked ? next.add(teacher.id) : next.delete(teacher.id));
                        return next;
                      })} /></th>
                      <th className="px-3 py-3 text-left">Teacher</th>
                      <th className="px-3 py-3 text-left">Today’s status</th>
                      <th className="px-3 py-3 text-left">Remark</th>
                      <th className="px-3 py-3 text-left">State</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleTeachers.map((teacher) => {
                      const activeStatus = records[teacher.id]?.status || 'NOT_MARKED';
                      return (
                        <tr key={teacher.id} className="border-t dark:border-slate-800">
                          <td className="p-3"><input aria-label={`Select ${teacher.teacherName}`} type="checkbox" checked={selected.has(teacher.id)} onChange={() => setSelected((previous) => {
                            const next = new Set(previous);
                            next.has(teacher.id) ? next.delete(teacher.id) : next.add(teacher.id);
                            return next;
                          })} /></td>
                          <td className="px-3 py-3">
                            <p className="font-semibold text-slate-900 dark:text-slate-100">{teacher.teacherName}</p>
                            <p className="text-xs text-slate-500">{teacher.employeeId || 'No employee ID'}{teacher.specialization ? ` · ${teacher.specialization}` : ''}</p>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-wrap gap-1.5">
                              {STATUS_OPTIONS.map((status) => (
                                <button
                                  key={status.code}
                                  type="button"
                                  aria-label={`Mark ${teacher.teacherName} ${status.label}`}
                                  title={status.label}
                                  onClick={() => updateRow(teacher.id, { status: status.code })}
                                  className={`min-w-9 rounded-full border px-2.5 py-1 text-xs font-bold transition ${activeStatus === status.code ? toneClasses[status.tone] : 'border-slate-200 bg-white text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-950'}`}
                                >
                                  {status.short}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3"><input aria-label={`Remark for ${teacher.teacherName}`} className="h-9 w-full min-w-52 rounded-lg border bg-white px-3 dark:bg-slate-950" placeholder={['ABSENT', 'LATE', 'HALF_DAY'].includes(activeStatus) ? 'Add a helpful note' : 'Optional'} value={records[teacher.id]?.remarks || ''} onChange={(event) => updateRow(teacher.id, { remarks: event.target.value })} /></td>
                          <td className="px-3 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${activeStatus === 'NOT_MARKED' ? toneClasses.slate : changedIds.has(teacher.id) ? toneClasses.amber : toneClasses.emerald}`}>{activeStatus === 'NOT_MARKED' ? 'Not marked' : changedIds.has(teacher.id) ? 'Unsaved' : 'Saved'}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </>
            )}

            {teachers.length > 0 && (
              <div className="sticky bottom-2 z-30 flex flex-col gap-3 rounded-xl border bg-white/95 p-3 shadow-lg backdrop-blur sm:bottom-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700 dark:bg-slate-900/95">
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  {summary.NOT_MARKED ? <><strong className="text-amber-700">{summary.NOT_MARKED} not marked.</strong> Complete the register before saving.</> : <><strong className="text-emerald-700">All {teachers.length} teachers marked.</strong> Ready to save.</>}
                </p>
                <Button className="w-full sm:w-auto" variant="primary" leftIcon={Save} onClick={save} loading={saveMutation.isPending} disabled={rosterQuery.isError || summary.NOT_MARKED > 0}>Save attendance</Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-col items-start gap-1 sm:flex-row sm:items-center">
            <div>
              <CardTitle className="flex items-center gap-2"><BarChart3 size={18} /> Monthly summary</CardTitle>
              <p className="text-sm text-slate-500">A quick view of attendance recorded in {new Date(`${month}-01T12:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}.</p>
            </div>
            {!registerQuery.isLoading && <div className="flex gap-4 text-right text-xs text-slate-500"><span><b className={`block text-lg ${percentageTone(monthly.average)}`}>{monthly.average}%</b>average</span><span><b className="block text-lg text-slate-900 dark:text-white">{monthly.reviewCount}</b>to review</span></div>}
          </CardHeader>
          <CardContent>
            {registerQuery.isLoading ? <div className="h-40 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" /> : registerQuery.isError ? <p className="rounded-xl bg-rose-50 p-4 text-sm text-rose-700">Monthly summary could not be loaded.</p> : (
              <>
              <div className="grid gap-3 md:hidden">{(registerQuery.data?.data?.teachers || []).map((teacher) => <article key={teacher.id} className="rounded-xl border p-3 dark:border-slate-800"><div className="flex items-start justify-between gap-2"><div><p className="font-bold">{teacher.teacherName}</p><p className="text-xs text-slate-500">{teacher.employeeId} · {teacher.markedDays} days marked</p></div><span className={`text-lg font-black ${percentageTone(teacher.percentage)}`}>{teacher.markedDays ? `${teacher.percentage}%` : '—'}</span></div><div className="mt-3 grid grid-cols-5 gap-1 text-center"><span className="rounded-lg bg-emerald-50 p-2 text-xs text-emerald-700"><b className="block text-sm">{teacher.PRESENT}</b>P</span><span className="rounded-lg bg-rose-50 p-2 text-xs text-rose-700"><b className="block text-sm">{teacher.ABSENT}</b>A</span><span className="rounded-lg bg-amber-50 p-2 text-xs text-amber-700"><b className="block text-sm">{teacher.LATE}</b>LT</span><span className="rounded-lg bg-orange-50 p-2 text-xs text-orange-700"><b className="block text-sm">{teacher.HALF_DAY}</b>HD</span><span className="rounded-lg bg-sky-50 p-2 text-xs text-sky-700"><b className="block text-sm">{teacher.LEAVE}</b>L</span></div></article>)}</div>
              <div className="hidden overflow-auto rounded-xl border md:block dark:border-slate-800">
                <table className="min-w-[820px] w-full text-sm">
                  <thead className="bg-slate-100 dark:bg-slate-800"><tr>{['Teacher', 'Present', 'Absent', 'Late', 'Half day', 'Leave', 'Days marked', 'Attendance'].map((item) => <th key={item} className="px-3 py-2 text-left">{item}</th>)}</tr></thead>
                  <tbody>{(registerQuery.data?.data?.teachers || []).map((teacher) => <tr key={teacher.id} className="border-t dark:border-slate-800"><td className="px-3 py-3"><p className="font-semibold">{teacher.teacherName}</p><p className="text-xs text-slate-500">{teacher.employeeId}</p></td><td className="px-3 py-3 text-emerald-700">{teacher.PRESENT}</td><td className="px-3 py-3 text-rose-700">{teacher.ABSENT}</td><td className="px-3 py-3">{teacher.LATE}</td><td className="px-3 py-3">{teacher.HALF_DAY}</td><td className="px-3 py-3">{teacher.LEAVE}</td><td className="px-3 py-3">{teacher.markedDays}</td><td className={`px-3 py-3 font-black ${percentageTone(teacher.percentage)}`}>{teacher.markedDays ? `${teacher.percentage}%` : '—'}</td></tr>)}</tbody>
                </table>
              </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
