import React, { useMemo, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { BookOpen, Briefcase, CheckCircle2, GraduationCap, Loader2, ShieldCheck, UsersRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { authService } from '../services/authService';

const iconByRole = {
  TEACHER: BookOpen,
  CLASS_TEACHER: UsersRound,
  PRINCIPAL: GraduationCap,
  EXAM_CONTROLLER: ShieldCheck,
  EXAM_COORDINATOR: ShieldCheck,
  ADMIN: Briefcase,
};

export default function WorkspaceSelectionPage() {
  const navigate = useNavigate();
  const user = useMemo(() => authService.getCurrentUser(), []);
  const [selected, setSelected] = useState(null);
  const [preferred, setPreferred] = useState(false);
  const roles = user?.availableRoles || [];

  if (!user) return <Navigate to="/login" replace />;
  if (roles.length < 2) return <Navigate to={authService.getDashboardRouteByRole(user.role)} replace />;

  const continueToWorkspace = async (role) => {
    setSelected(role.assignmentId);
    try {
      const result = await authService.switchRole(role.assignmentId, { setDefault: preferred });
      toast.success(result.message || `Opened ${role.label} workspace`);
      navigate(authService.getDashboardRouteByRole(result.user.role), { replace: true });
    } catch (error) {
      toast.error(error.message || 'That workspace is no longer available');
    } finally { setSelected(null); }
  };

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--text-primary)] sm:px-6">
      <section className="mx-auto max-w-5xl">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--school-primary)] text-white shadow-lg"><GraduationCap /></div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[var(--school-primary)]">Welcome, {user.name}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">Choose your workspace</h1>
          <p className="mt-3 text-[var(--text-muted)]">Each workspace keeps its dashboard, tools and responsibilities separate.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            const Icon = iconByRole[role.role] || Briefcase;
            const busy = selected === role.assignmentId;
            return (
              <article key={role.assignmentId} className="flex min-h-64 flex-col rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                <div className="flex items-start justify-between">
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--school-primary-soft)] text-[var(--school-primary)]"><Icon size={24} /></span>
                  {role.pendingTasks > 0 && <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">{role.pendingTasks} pending</span>}
                </div>
                <h2 className="mt-5 text-xl font-bold">{role.label}</h2>
                <p className="mt-2 flex-1 text-sm leading-6 text-[var(--text-muted)]">{role.description}</p>
                <button type="button" disabled={Boolean(selected)} onClick={() => continueToWorkspace(role)} className="mt-5 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--school-primary)] px-4 font-semibold text-white transition hover:opacity-90 disabled:opacity-60">
                  {busy ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} Continue
                </button>
              </article>
            );
          })}
        </div>

        <label className="mx-auto mt-7 flex w-fit cursor-pointer items-center gap-2 text-sm text-[var(--text-muted)]">
          <input type="checkbox" checked={preferred} onChange={(event) => setPreferred(event.target.checked)} className="h-4 w-4 rounded border-[var(--border-soft)] text-[var(--school-primary)]" />
          Make my choice the default workspace
        </label>
      </section>
    </main>
  );
}
