import React from 'react';
import { BellRing, ClipboardCheck, MessageSquare, UsersRound, WalletCards } from 'lucide-react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { authService } from '../../services/authService';

const actions = [
  { label: 'Class attendance', description: 'Mark and review attendance for your assigned section', to: '/teacher/attendance', icon: ClipboardCheck },
  { label: 'Students', description: 'View students within your class-teacher scope', to: '/teacher/my-class', icon: UsersRound },
  { label: 'Class fee status', description: 'View fee records and send reminders; collection and editing stay with Finance', to: '/teacher/fees', icon: WalletCards },
  { label: 'Announcements', description: 'Send a message to your class community', to: '/communication', icon: MessageSquare },
  { label: 'Result verification', description: 'Review submitted subject results for your section', to: '/examinations', icon: BellRing },
];

export default function ClassTeacherDashboard() {
  const user = authService.getCurrentUser();
  const sections = user?.classTeacherContext?.sections || [];
  return (
    <DashboardLayout role="CLASS_TEACHER">
      <div className="space-y-6">
        <section className="rounded-3xl bg-gradient-to-br from-indigo-700 to-violet-700 p-7 text-white shadow-xl">
          <p className="text-sm font-bold uppercase tracking-widest text-indigo-100">Class Teacher workspace</p>
          <h1 className="mt-2 text-3xl font-black">Welcome back, {user?.name}</h1>
          <p className="mt-3 max-w-2xl text-indigo-100">Signed in as {user?.classTeacherContext?.teacherName || user?.name}. Attendance, class communication and result verification stay together here.</p>
          <div className="mt-5 flex flex-wrap gap-2">{sections.length ? sections.map((section) => <span key={section.sectionId} className="rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold backdrop-blur">{section.className} · Section {section.sectionName}</span>) : <span className="rounded-full bg-amber-300/20 px-3 py-1.5 text-sm font-semibold text-amber-50">Class allocation pending</span>}</div>
        </section>
        <div className="grid gap-4 md:grid-cols-2">
          {actions.map(({ label, description, to, icon: Icon }) => (
            <Link key={label} to={to} className="group rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-200"><Icon /></span>
              <h2 className="mt-4 text-lg font-bold">{label}</h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>
            </Link>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
}
