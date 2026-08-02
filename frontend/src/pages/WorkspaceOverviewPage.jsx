import React, { useMemo } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import DashboardLayout from '../layouts/DashboardLayout';
import { authService } from '../services/authService';
import { buildDashboardNavigation } from '../config/navigation/dashboardNavigation';
import { buildWorkspaceNavigation } from '../config/navigation/workspaceNavigation';

export default function WorkspaceOverviewPage() {
  const { workspaceId } = useParams();
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const role = String(user?.role || user?.activeRole?.role || '');
  const groups = useMemo(() => buildDashboardNavigation(role, user), [role, user]);
  const workspaces = useMemo(() => buildWorkspaceNavigation(groups, role), [groups, role]);
  const workspace = workspaces.find((item) => item.id === workspaceId);

  if (!workspace || workspace.id === 'home') return <Navigate to="/workspace/home" replace />;

  const sections = workspace.items.reduce((result, item) => {
    const section = item.sourceGroup || workspace.label;
    if (!result.has(section)) result.set(section, []);
    result.get(section).push(item);
    return result;
  }, new Map());
  const WorkspaceIcon = workspace.icon;

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <header className={`overflow-hidden rounded-3xl bg-gradient-to-br ${workspace.accent} p-6 text-white shadow-lg sm:p-8`}>
          <button type="button" onClick={() => navigate('/workspace/home')} className="mb-6 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold backdrop-blur hover:bg-white/20">
            <ArrowLeft size={15} /> Switch workspace
          </button>
          <div className="flex items-start gap-4">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/15"><WorkspaceIcon size={27} /></span>
            <div><p className="text-xs font-black uppercase tracking-[.18em] text-white/70">Active workspace</p><h1 className="mt-1 text-3xl font-black">{workspace.label}</h1><p className="mt-2 max-w-2xl text-sm text-white/80">{workspace.description}</p></div>
          </div>
        </header>

        {[...sections.entries()].map(([section, items]) => (
          <section key={section} aria-labelledby={`section-${section.replace(/\W+/g, '-').toLowerCase()}`}>
            <h2 id={`section-${section.replace(/\W+/g, '-').toLowerCase()}`} className="mb-3 text-xs font-black uppercase tracking-[.16em] text-[var(--text-muted)]">{section}</h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={`${item.href}-${item.label}`} type="button" onClick={() => navigate(item.href)} className="group flex min-h-24 items-center gap-4 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--school-primary)] hover:shadow-md">
                    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--school-primary-soft)] text-[var(--school-primary-soft-text)]">{Icon && <Icon size={20} />}</span>
                    <span className="min-w-0 flex-1"><span className="block font-bold">{item.label}</span>{item.subgroup && <span className="mt-1 block text-xs text-[var(--text-muted)]">{item.subgroup}</span>}</span>
                    <ArrowRight size={16} className="text-[var(--text-muted)] transition group-hover:translate-x-1" />
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </DashboardLayout>
  );
}
