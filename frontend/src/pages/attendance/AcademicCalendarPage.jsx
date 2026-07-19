import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, List, RotateCcw, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import AttendanceCalendar from '../../components/attendance/AttendanceCalendar';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { attendanceService } from '../../services/managementService';
import { authService } from '../../services/authService';
import { CALENDAR_EVENT_STYLES, CALENDAR_EVENT_TYPES, getCalendarEventStyle } from '../../lib/calendarEventStyles';

const localDate = () => {
  const value = new Date();
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
};

const moveMonth = (month, offset) => {
  const [year, monthNumber] = month.split('-').map(Number);
  const value = new Date(Date.UTC(year, monthNumber - 1 + offset, 1));
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}`;
};

const monthTitle = (month) => {
  const [year, monthNumber] = month.split('-').map(Number);
  return new Date(Date.UTC(year, monthNumber - 1, 1)).toLocaleDateString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};

const defaultForm = () => ({ date: localDate(), dayType: 'HOLIDAY', title: '', description: '' });

export default function AcademicCalendarPage() {
  const user = authService.getCurrentUser();
  const queryClient = useQueryClient();
  const currentMonth = localDate().slice(0, 7);
  const [month, setMonth] = useState(currentMonth);
  const [view, setView] = useState('MONTH');
  const [typeFilter, setTypeFilter] = useState('');
  const [form, setForm] = useState(defaultForm);
  const query = useQuery({ queryKey: ['academic-calendar', month], queryFn: () => attendanceService.calendar({ month }) });
  const records = query.data?.data?.days || [];
  const filteredRecords = useMemo(() => records.filter((row) => !typeFilter || row.dayType === typeFilter || row.eventType === typeFilter), [records, typeFilter]);
  const allRecordsByDate = useMemo(() => new Map(records.map((row) => [row.date, row])), [records]);
  const filteredRecordsByDate = useMemo(() => new Map(filteredRecords.map((row) => [row.date, row])), [filteredRecords]);
  const canManage = ['ADMIN', 'SCHOOL_OWNER'].includes(user?.role);

  const visibleAgenda = useMemo(() => {
    if (view !== 'WEEK') return filteredRecords;
    const now = new Date();
    const start = new Date(now);
    start.setDate(now.getDate() - now.getDay());
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 7);
    return filteredRecords.filter((row) => {
      const event = new Date(`${row.date}T00:00:00`);
      return event >= start && event < end;
    });
  }, [filteredRecords, view]);

  const days = useMemo(() => {
    const [year, monthNumber] = month.split('-').map(Number);
    return Array.from({ length: new Date(Date.UTC(year, monthNumber, 0)).getUTCDate() }, (_, index) => {
      const date = `${month}-${String(index + 1).padStart(2, '0')}`;
      const saved = filteredRecordsByDate.get(date);
      return saved || { date, dayType: new Date(`${date}T00:00:00Z`).getUTCDay() === 0 ? 'WEEKLY_OFF' : 'WORKING_DAY', title: null };
    });
  }, [month, filteredRecordsByDate]);

  const eventCounts = useMemo(() => CALENDAR_EVENT_TYPES.reduce((result, type) => ({
    ...result,
    [type]: records.filter((row) => row.dayType === type).length,
  }), {}), [records]);

  const save = useMutation({
    mutationFn: attendanceService.saveCalendarDay,
    onSuccess: () => {
      toast.success('Calendar updated');
      queryClient.invalidateQueries({ queryKey: ['academic-calendar', month] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not save event'),
  });

  const remove = useMutation({
    mutationFn: attendanceService.deleteCalendarDay,
    onSuccess: () => {
      toast.success('Marker removed');
      queryClient.invalidateQueries({ queryKey: ['academic-calendar', month] });
      setForm(defaultForm());
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Could not remove event'),
  });

  const choose = (day) => {
    const saved = allRecordsByDate.get(day.date);
    setForm({ date: day.date, dayType: saved?.dayType || day.dayType, title: saved?.title || '', description: saved?.description || '' });
  };

  const navigateMonth = (offset) => setMonth((value) => moveMonth(value, offset));

  return (
    <DashboardLayout role={user?.role}>
      <div className="space-y-5">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-blue-700 to-cyan-600 p-5 text-white shadow-lg sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-100">School calendar</p>
              <h1 className="mt-2 text-2xl font-black sm:text-3xl">Academic calendar</h1>
              <p className="mt-2 max-w-2xl text-sm text-blue-100">Plan examinations, holidays, vacations and school events in one clear monthly view.</p>
            </div>
            <div className="rounded-2xl bg-white/15 px-5 py-3 text-right backdrop-blur-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-blue-100">Viewing</p>
              <p className="mt-0.5 text-lg font-black">{monthTitle(month)}</p>
            </div>
          </div>
        </section>

        <div className="flex flex-col justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" aria-label="Previous month" title="Previous month" onClick={() => navigateMonth(-1)}><ChevronLeft className="h-5 w-5" /></Button>
            <div className="min-w-44 text-center">
              <p className="text-base font-black text-slate-900 dark:text-white">{monthTitle(month)}</p>
              <p className="text-[11px] text-slate-500">{records.length} scheduled item{records.length === 1 ? '' : 's'}</p>
            </div>
            <Button variant="outline" size="icon" aria-label="Next month" title="Next month" onClick={() => navigateMonth(1)}><ChevronRight className="h-5 w-5" /></Button>
            <Button variant="ghost" size="sm" leftIcon={RotateCcw} onClick={() => setMonth(currentMonth)} disabled={month === currentMonth}>Today</Button>
          </div>
          <div className="flex flex-wrap gap-2">
            <select aria-label="Filter events by type" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              <option value="">All event types</option>
              {CALENDAR_EVENT_TYPES.map((type) => <option key={type} value={type}>{CALENDAR_EVENT_STYLES[type].label}</option>)}
            </select>
            <input aria-label="Choose month" type="month" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950" value={month} onChange={(event) => setMonth(event.target.value)} />
            <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
              {[['MONTH', CalendarDays], ['WEEK', CalendarDays], ['AGENDA', List]].map(([name, Icon]) => <button key={name} type="button" onClick={() => setView(name)} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-bold transition ${view === name ? 'bg-white text-indigo-700 shadow-sm dark:bg-slate-800 dark:text-indigo-300' : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'}`}><Icon size={14} />{name}</button>)}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
          {CALENDAR_EVENT_TYPES.map((type) => <button type="button" key={type} onClick={() => setTypeFilter((value) => value === type ? '' : type)} className={`inline-flex items-center gap-2 rounded-lg px-2 py-1 text-xs font-semibold transition hover:bg-slate-50 dark:hover:bg-slate-800 ${typeFilter === type ? 'ring-2 ring-indigo-400' : ''}`}><span className={`h-2.5 w-2.5 rounded-full ${CALENDAR_EVENT_STYLES[type].dot}`} />{CALENDAR_EVENT_STYLES[type].label}<span className="text-slate-400">{eventCounts[type]}</span></button>)}
        </div>

        {query.isError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Calendar could not be loaded. <button className="font-bold underline" onClick={() => query.refetch()}>Retry</button></div>}

        <div className={`grid gap-5 ${canManage ? 'xl:grid-cols-[minmax(0,1fr)_360px]' : ''}`}>
          <Card className="overflow-hidden">
            <CardHeader><div><CardTitle>{view === 'MONTH' ? monthTitle(month) : view === 'WEEK' ? 'This week' : `${monthTitle(month)} agenda`}</CardTitle><p className="mt-1 text-xs text-slate-500">{canManage ? 'Select a date to add or edit its calendar marker.' : 'School dates and event details for the selected month.'}</p></div></CardHeader>
            <CardContent className="p-3 sm:px-5 sm:py-4">
              {query.isLoading ? <div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /> : view === 'MONTH' ? <AttendanceCalendar month={month} days={days} onSelectDay={canManage ? choose : undefined} /> : !visibleAgenda.length ? <div className="py-20 text-center"><CalendarDays className="mx-auto h-10 w-10 text-slate-300" /><p className="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">No events match this view</p><p className="mt-1 text-xs text-slate-400">Try another month or remove the event filter.</p></div> : <div className="space-y-3">{visibleAgenda.map((row) => {
                const style = getCalendarEventStyle(row.dayType);
                const date = new Date(`${row.date}T00:00:00`);
                return <article key={row.id} className={`flex gap-4 rounded-2xl border border-l-4 border-slate-200 bg-white p-4 transition hover:shadow-md dark:border-slate-700 dark:bg-slate-900 ${style.accent}`}><div className="min-w-14 rounded-xl bg-slate-50 p-2 text-center dark:bg-slate-800"><p className="text-[10px] font-bold uppercase text-slate-500">{date.toLocaleDateString('en-IN', { month: 'short' })}</p><p className="text-2xl font-black">{date.getDate()}</p><p className="text-[10px] text-slate-400">{date.toLocaleDateString('en-IN', { weekday: 'short' })}</p></div><div className="min-w-0"><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${style.badge}`}>{style.label}</span><h3 className="mt-2 font-black text-slate-900 dark:text-white">{row.title || style.label}</h3><p className="mt-1 text-sm leading-6 text-slate-500">{row.description || 'No additional details.'}</p></div></article>;
              })}</div>}
            </CardContent>
          </Card>

          {canManage && <Card className="h-fit xl:sticky xl:top-5"><CardHeader><div><CardTitle>Add or edit a day</CardTitle><p className="mt-1 text-xs text-slate-500">Changes are visible only within your school.</p></div></CardHeader><CardContent className="space-y-4">
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Date</span><input type="date" className="h-10 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" value={form.date} onChange={(event) => setForm((old) => ({ ...old, date: event.target.value }))} /></label>
            <div><span className="mb-2 block text-xs font-bold text-slate-600 dark:text-slate-300">Day type</span><div className="grid grid-cols-2 gap-2">{CALENDAR_EVENT_TYPES.map((type) => <button key={type} type="button" onClick={() => setForm((old) => ({ ...old, dayType: type }))} className={`rounded-xl border p-2.5 text-left text-[11px] font-bold transition ${form.dayType === type ? `${CALENDAR_EVENT_STYLES[type].cell} ring-2 ring-indigo-500` : 'border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800'}`}><span className={`mr-2 inline-block h-2 w-2 rounded-full ${CALENDAR_EVENT_STYLES[type].dot}`} />{CALENDAR_EVENT_STYLES[type].label}</button>)}</div></div>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Event title</span><input className="h-10 w-full rounded-xl border border-slate-200 px-3 dark:border-slate-700 dark:bg-slate-950" placeholder="e.g. Mid-term examinations" value={form.title} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} /></label>
            <label className="block"><span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Details</span><textarea className="min-h-24 w-full rounded-xl border border-slate-200 p-3 dark:border-slate-700 dark:bg-slate-950" placeholder="Add timing, classes or instructions" value={form.description} onChange={(event) => setForm((old) => ({ ...old, description: event.target.value }))} /></label>
            <Button leftIcon={CalendarPlus} variant="primary" fullWidth onClick={() => save.mutate(form)} loading={save.isPending}>Publish calendar day</Button>
            {allRecordsByDate.get(form.date) && <Button variant="outline" leftIcon={Trash2} fullWidth className="text-rose-600 hover:bg-rose-50 dark:text-rose-300" onClick={() => remove.mutate(allRecordsByDate.get(form.date).id)} loading={remove.isPending}>Remove custom marker</Button>}
            <p className="text-xs leading-5 text-slate-500">Only School Owners and Administrators can publish calendar changes.</p>
          </CardContent></Card>}
        </div>
      </div>
    </DashboardLayout>
  );
}
