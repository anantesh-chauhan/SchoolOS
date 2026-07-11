import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Bell, BookOpenCheck, CalendarCheck, User } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { SummaryCard, WelcomeCard } from '../../components/DashboardCards';
import { authService } from '../../services/authService';
import { dashboardService } from '../../services/dashboardService';

export default function ParentDashboard() {
  const user = authService.getCurrentUser();
  const { data, isLoading, isError } = useQuery({ queryKey: ['dashboard-summary', 'parent'], queryFn: dashboardService.summary });
  const stats = data?.stats || {};
  return <DashboardLayout role="PARENT"><motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6"><WelcomeCard name={user?.name || 'Parent'} role="PARENT"/>
    {isError && <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">Unable to load the linked student dashboard.</div>}
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4"><SummaryCard icon={<User className="h-8 w-8"/>} label="Child" value={isLoading ? '…' : data?.student?.name || '—'} color="blue"/><SummaryCard icon={<CalendarCheck className="h-8 w-8"/>} label="Session Attendance" value={isLoading ? '…' : `${stats.attendanceRate || 0}%`} color="green"/><SummaryCard icon={<BookOpenCheck className="h-8 w-8"/>} label="Attendance Days" value={isLoading ? '…' : stats.markedDays || 0} color="purple"/><SummaryCard icon={<Bell className="h-8 w-8"/>} label="Pending Polls" value={isLoading ? '…' : stats.pendingPolls || 0} color="orange"/></div>
    <section className="rounded-xl bg-white p-6 shadow dark:bg-gray-800"><div className="flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-lg font-bold">Published chapter mastery</h2><p className="text-sm text-slate-500">{data?.student ? `${data.student.className} · Section ${data.student.section || '-'}` : 'Linked student performance'}</p></div></div><div className="mt-4 grid gap-3 md:grid-cols-2">{(data?.mastery || []).map((row) => <div key={row.id} className="rounded-xl border p-4 dark:border-slate-700"><div className="flex justify-between gap-3"><div><p className="font-semibold">{row.subject}</p><p className="text-xs text-slate-500">{row.chapter}</p></div><p className="font-bold text-indigo-600">{row.score == null ? 'Pending' : `${Math.round(row.score)}%`}</p></div><div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-indigo-600" style={{ width: `${Math.max(0, Math.min(100, row.score || 0))}%` }}/></div><p className="mt-2 text-[11px] font-semibold text-slate-500">{row.level?.replace(/_/g, ' ') || 'Insufficient data'}</p></div>)}{!isLoading && !(data?.mastery || []).length && <p className="rounded-xl border border-dashed p-6 text-sm text-slate-500">No published mastery evidence is available yet.</p>}</div></section>
  </motion.div></DashboardLayout>;
}
