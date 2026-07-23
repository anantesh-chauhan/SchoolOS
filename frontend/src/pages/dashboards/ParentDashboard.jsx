import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, BarChart3, Bell, BookOpenCheck, CalendarCheck, GraduationCap, Image, ShieldCheck, UserRound } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { authService } from '../../services/authService';
import { dashboardService } from '../../services/dashboardService';
import { useBranding } from '../../contexts/BrandingContext';

const Panel = ({ children, className = '' }) => <section className={`rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>{children}</section>;

export default function ParentDashboard() {
  const user = authService.getCurrentUser();
  const branding = useBranding();
  const { data, isLoading, isError } = useQuery({ queryKey: ['dashboard-summary', 'parent'], queryFn: dashboardService.summary });
  const student = data?.student;
  const stats = data?.stats || {};
  const mastery = data?.mastery || [];

  return (
    <DashboardLayout role="PARENT">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
        <section className="overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-950 text-white shadow-xl">
          <div className="grid gap-7 p-7 lg:grid-cols-[1.2fr,.8fr] lg:p-9">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-blue-300">{branding.schoolName || 'Parent portal'}</p>
              <h1 className="mt-3 text-3xl font-black sm:text-4xl">Welcome, {user?.name || 'Parent'}</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">A clear view of your child’s attendance, learning progress, and school activity in one place.</p>
              {student && <div className="mt-6 inline-flex items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 backdrop-blur"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10"><GraduationCap/></div><div><p className="font-bold">{student.name}</p><p className="text-xs text-slate-300">{student.className} · Section {student.section || 'Not allocated'}</p></div></div>}
            </div>
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <div className="flex items-center justify-between"><span className="text-sm font-semibold text-slate-300">Session attendance</span><ShieldCheck className="text-emerald-300"/></div>
              <p className="mt-4 text-5xl font-black">{isLoading ? '—' : `${stats.attendanceRate || 0}%`}</p>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-emerald-400" style={{ width: `${Math.min(100, stats.attendanceRate || 0)}%` }}/></div>
              <p className="mt-3 text-xs text-slate-300">Based on {stats.markedDays || 0} marked school days</p>
            </div>
          </div>
        </section>

        {isError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-700">Unable to load the linked student dashboard. Please ask the school administrator to verify the parent ID.</div>}

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [UserRound, 'Linked child', isLoading ? 'Loading…' : student?.name || 'Not linked', 'Student profile'],
            [CalendarCheck, 'Attendance', `${stats.attendanceRate || 0}%`, `${stats.markedDays || 0} marked days`],
            [BookOpenCheck, 'Learning records', mastery.length, 'Published chapter results'],
            [Bell, 'Pending feedback', stats.pendingPolls || 0, 'Open student polls'],
          ].map(([Icon, label, value, helper]) => <Panel key={label}><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300"><Icon size={21}/></div><p className="mt-4 text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 truncate text-2xl font-black text-slate-950 dark:text-white">{value}</p><p className="mt-1 text-xs text-slate-500">{helper}</p></Panel>)}
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.25fr,.75fr]">
          <Panel>
            <div className="flex items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Academic progress</p><h2 className="mt-2 text-xl font-black">Published chapter mastery</h2></div><BarChart3 className="text-slate-300"/></div>
            <div className="mt-5 space-y-3">{mastery.map((row) => <div key={row.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><div className="flex justify-between gap-4"><div><p className="font-bold">{row.subject}</p><p className="text-xs text-slate-500">{row.chapter}</p></div><p className="font-black text-blue-700 dark:text-blue-300">{row.score == null ? 'Pending' : `${Math.round(row.score)}%`}</p></div><div className="mt-3 h-2 rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-2 rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, row.score || 0))}%` }}/></div><p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">{row.level?.replace(/_/g, ' ') || 'Insufficient data'}</p></div>)}{!isLoading && mastery.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Published learning evidence will appear here after assessment.</div>}</div>
          </Panel>

          <Panel>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Quick access</p><h2 className="mt-2 text-xl font-black">Parent services</h2>
            <div className="mt-5 space-y-3">{[
              [Activity, 'Academic analytics', 'Strengths, focus areas and recommended next steps', '/analytics/students'],
              [CalendarCheck, 'Attendance details', 'Review daily and monthly attendance', '/dashboard/parent/attendance'],
              [UserRound, 'Parent profile', 'Update permitted contact information', '/dashboard/parent/profile'],
              [Image, 'School gallery', 'See school events and activities', '/dashboard/gallery'],
            ].map(([Icon, title, copy, to]) => <Link key={title} to={to} className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-blue-300 hover:bg-blue-50/50 dark:border-slate-700 dark:hover:bg-blue-950/20"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"><Icon size={18}/></span><span className="min-w-0 flex-1"><span className="block font-bold">{title}</span><span className="block text-xs text-slate-500">{copy}</span></span><ArrowRight size={17} className="text-slate-400 transition group-hover:translate-x-1"/></Link>)}</div>
          </Panel>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
