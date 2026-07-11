import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarPlus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import AttendanceCalendar from '../../components/attendance/AttendanceCalendar';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { attendanceService } from '../../services/managementService';
import { authService } from '../../services/authService';

const today = () => new Date().toISOString().slice(0, 10);
const TYPES = ['HOLIDAY', 'WORKING_DAY', 'WEEKLY_OFF', 'EXAM', 'EVENT', 'VACATION'];

export default function AcademicCalendarPage() {
  const user = authService.getCurrentUser();
  const qc = useQueryClient();
  const [month, setMonth] = useState(today().slice(0, 7));
  const [form, setForm] = useState({ date: today(), dayType: 'HOLIDAY', title: '', description: '' });
  const query = useQuery({ queryKey: ['academic-calendar', month], queryFn: () => attendanceService.calendar({ month }) });
  const records = query.data?.data?.days || [];
  const recordByDate = useMemo(() => new Map(records.map((row) => [row.date, row])), [records]);
  const days = useMemo(() => { const [y, m] = month.split('-').map(Number); return Array.from({ length: new Date(Date.UTC(y, m, 0)).getUTCDate() }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, '0')}`; const saved = recordByDate.get(date); return saved || { date, dayType: new Date(`${date}T00:00:00Z`).getUTCDay() === 0 ? 'WEEKLY_OFF' : 'WORKING_DAY', title: null }; }); }, [month, recordByDate]);
  const save = useMutation({ mutationFn: attendanceService.saveCalendarDay, onSuccess: () => { toast.success('Calendar updated'); qc.invalidateQueries({ queryKey: ['academic-calendar', month] }); }, onError: (e) => toast.error(e.response?.data?.message || 'Could not save event') });
  const remove = useMutation({ mutationFn: attendanceService.deleteCalendarDay, onSuccess: () => { toast.success('Marker removed'); qc.invalidateQueries({ queryKey: ['academic-calendar', month] }); } });
  const choose = (day) => { const saved = recordByDate.get(day.date); setForm({ date: day.date, dayType: saved?.dayType || day.dayType, title: saved?.title || '', description: saved?.description || '' }); };
  return <DashboardLayout role={user?.role}><div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase text-slate-500">School operations</p><h1 className="text-2xl font-bold">Academic calendar</h1><p className="text-sm text-slate-500">Publish holidays, working days, exams, events and vacations once for every module.</p></div><input type="month" className="h-10 rounded-md border px-3 dark:bg-slate-950" value={month} onChange={(e) => setMonth(e.target.value)}/></div>
  <div className="grid gap-5 xl:grid-cols-[1fr_340px]"><Card><CardHeader><CardTitle>Calendar</CardTitle></CardHeader><CardContent><AttendanceCalendar month={month} days={days} onSelectDay={choose}/></CardContent></Card><Card><CardHeader><CardTitle>Add or edit a day</CardTitle></CardHeader><CardContent className="space-y-3"><input type="date" className="h-10 w-full rounded-md border px-3 dark:bg-slate-950" value={form.date} onChange={(e) => setForm((old) => ({ ...old, date: e.target.value }))}/><div className="grid grid-cols-2 gap-2">{TYPES.map((type) => <button key={type} type="button" onClick={() => setForm((old) => ({ ...old, dayType: type }))} className={`rounded-lg border p-2 text-xs font-bold ${form.dayType === type ? 'border-blue-500 bg-blue-50 text-blue-700' : 'dark:border-slate-700'}`}>{type.replace(/_/g, ' ')}</button>)}</div><input className="h-10 w-full rounded-md border px-3 dark:bg-slate-950" placeholder="Name, e.g. Diwali" value={form.title} onChange={(e) => setForm((old) => ({ ...old, title: e.target.value }))}/><textarea className="min-h-24 w-full rounded-md border p-3 dark:bg-slate-950" placeholder="Optional details" value={form.description} onChange={(e) => setForm((old) => ({ ...old, description: e.target.value }))}/><Button leftIcon={CalendarPlus} className="w-full" onClick={() => save.mutate(form)} loading={save.isPending}>Publish calendar day</Button>{recordByDate.get(form.date) && <Button variant="outline" leftIcon={Trash2} className="w-full" onClick={() => remove.mutate(recordByDate.get(form.date).id)} loading={remove.isPending}>Remove custom marker</Button>}<p className="text-xs text-slate-500">Click any calendar cell to edit it. Unmarked Sundays are displayed automatically as weekly offs.</p></CardContent></Card></div></div></DashboardLayout>;
}
