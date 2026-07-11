import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import AttendanceCalendar from '../../components/attendance/AttendanceCalendar';
import { attendanceService } from '../../services/managementService';
import { authService } from '../../services/authService';

const currentSession = () => { const now = new Date(); const start = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; return `${start}-${String(start + 1).slice(-2)}`; };
const currentMonth = () => new Date().toISOString().slice(0, 7);

export default function MyAttendancePage() {
  const user = authService.getCurrentUser();
  const [session, setSession] = useState(currentSession());
  const [month, setMonth] = useState(currentMonth());
  const query = useQuery({ queryKey: ['my-attendance', session], queryFn: () => attendanceService.myAttendance({ academicSession: session }) });
  const data = query.data?.data;
  const days = useMemo(() => { const [year, m] = month.split('-').map(Number); return Array.from({ length: new Date(Date.UTC(year, m, 0)).getUTCDate() }, (_, i) => { const date = `${month}-${String(i + 1).padStart(2, '0')}`; const dow = new Date(`${date}T00:00:00Z`).getUTCDay(); return { date, dayType: dow === 0 ? 'WEEKLY_OFF' : 'WORKING_DAY' }; }); }, [month]);
  return <DashboardLayout role={user?.role}><div className="space-y-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-sm font-semibold uppercase text-slate-500">Attendance</p><h1 className="text-2xl font-bold">My attendance history</h1><p className="text-sm text-slate-500">View the complete academic session, month by month.</p></div><div className="flex gap-2"><input className="h-10 rounded-md border px-3 dark:bg-slate-950" value={session} onChange={(e) => setSession(e.target.value)} aria-label="Academic session"/><input type="month" className="h-10 rounded-md border px-3 dark:bg-slate-950" value={month} onChange={(e) => setMonth(e.target.value)}/></div></div>
  <div className="grid grid-cols-2 gap-3 md:grid-cols-6">{[['Attendance', `${data?.percentage || 0}%`], ['Working days', data?.workingDays || 0], ...Object.entries(data?.counts || {})].map(([label, value]) => <div key={label} className="rounded-xl border bg-white p-3 dark:border-slate-800 dark:bg-slate-900"><p className="text-xl font-bold">{value}</p><p className="text-xs text-slate-500">{label.replace(/_/g, ' ')}</p></div>)}</div>
  <Card><CardHeader><CardTitle>{new Date(`${month}-01T00:00:00`).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</CardTitle></CardHeader><CardContent>{query.isLoading ? <p className="text-sm text-slate-500">Loading attendance…</p> : <AttendanceCalendar month={month} days={days} personalRecords={(data?.records || []).filter((row) => row.date.startsWith(month))}/>}</CardContent></Card></div></DashboardLayout>;
}
