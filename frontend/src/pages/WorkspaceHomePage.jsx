import React, { useMemo, useState } from 'react';
import { ArrowRight, CheckCircle2, Clock3, Loader2, Search, Sparkles, Star } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../layouts/DashboardLayout';
import { authService } from '../services/authService';
import { buildDashboardNavigation } from '../config/navigation/dashboardNavigation';
import { buildWorkspaceNavigation, mergeRoleWorkspaces } from '../config/navigation/workspaceNavigation';
import { useNavigationMemory } from '../hooks/useNavigationMemory';

const relativeTime = (value) => {
  if (!value) return 'Recently opened';
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
};

export default function WorkspaceHomePage() {
  const navigate = useNavigate();
  const [switching, setSwitching] = useState('');
  const user = authService.getCurrentUser();
  const role = String(user?.role || user?.activeRole?.role || '');
  const activeAssignmentId = user?.activeRoleAssignmentId || user?.activeRole?.assignmentId;
  const assignments = user?.availableRoles?.length ? user.availableRoles : [{ role, assignmentId: activeAssignmentId, label: role }];
  const activeGroups = useMemo(() => buildDashboardNavigation(role, user), [role, user]);
  const activeItems = useMemo(() => activeGroups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.group }))), [activeGroups]);
  const memory = useNavigationMemory(activeItems);
  const workspaces = useMemo(() => mergeRoleWorkspaces(assignments.map((assignment) => ({
    assignment,
    workspaces: buildWorkspaceNavigation(buildDashboardNavigation(assignment.role, user, { skipPermissionFilter: assignment.role !== role }), assignment.role),
  })), role).filter((workspace) => workspace.id !== 'home'), [assignments, role, user]);

  const openWorkspace = async (workspace) => {
    const source = workspace.sources.find((item) => item.role === role) || workspace.sources[0];
    if (!source) return;
    if (source.assignmentId && source.assignmentId !== activeAssignmentId) {
      setSwitching(workspace.id);
      try {
        await authService.switchRole(source.assignmentId);
        navigate(source.href);
      } catch (error) { toast.error(error.message || 'Could not open this workspace'); }
      finally { setSwitching(''); }
      return;
    }
    navigate(source.href);
  };

  const favoriteWorkspaces = workspaces.filter((workspace) => memory.isFavoriteWorkspace(workspace.id));
  const actionPattern = /attendance|homework|collect fee|marks|verification|message|pending|my classes|admission/i;
  const myWork = activeItems.filter((item, index, rows) => actionPattern.test(item.label) && rows.findIndex((row) => row.href === item.href) === index).slice(0, 6);

  return (
    <DashboardLayout role={role}>
      <div className="space-y-8">
        <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div><p className="text-xs font-black uppercase tracking-[.2em] text-[var(--school-primary)]">SchoolOS Home</p><h1 className="mt-1 text-3xl font-black tracking-tight">Welcome back, {user?.name?.split(' ')[0] || 'there'}</h1><p className="mt-1 text-sm text-[var(--text-muted)]">Choose the kind of work you want to do, or continue where you left off.</p></div>
          <button type="button" onClick={() => window.dispatchEvent(new CustomEvent('schoolos:navigator-open'))} className="inline-flex h-11 items-center gap-2 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-4 text-sm font-bold shadow-sm hover:border-[var(--school-primary)]"><Search size={17} />Search SchoolOS <kbd className="ml-2 rounded border px-1.5 py-0.5 text-[10px] text-[var(--text-muted)]">Ctrl K</kbd></button>
        </header>

        {memory.recentEntries.length > 0 && <section aria-labelledby="continue-heading"><div className="mb-3 flex items-end justify-between"><div><p className="text-xs font-black uppercase tracking-[.16em] text-[var(--text-muted)]">Pick up instantly</p><h2 id="continue-heading" className="text-xl font-black">Continue working</h2></div></div><div className="grid gap-3 md:grid-cols-3">{memory.recentEntries.slice(0, 3).map(({ item, visitedAt }) => { const Icon = item.icon || Clock3; return <button type="button" key={item.href} onClick={() => navigate(item.href)} className="group flex items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--school-primary)]"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[var(--school-primary-soft)] text-[var(--school-primary-soft-text)]"><Icon size={19} /></span><span className="min-w-0 flex-1"><span className="block truncate font-bold">{item.label}</span><span className="block truncate text-xs text-[var(--text-muted)]">{item.group} · {relativeTime(visitedAt)}</span></span><ArrowRight size={16} className="text-[var(--text-muted)] transition group-hover:translate-x-1" /></button>; })}</div></section>}

        {favoriteWorkspaces.length > 0 && <section aria-labelledby="favorites-heading"><h2 id="favorites-heading" className="mb-3 flex items-center gap-2 text-lg font-black"><Star size={18} className="text-amber-500" fill="currentColor" />Favorite workspaces</h2><div className="flex gap-3 overflow-x-auto pb-1">{favoriteWorkspaces.map((workspace) => <button key={workspace.id} type="button" onClick={() => openWorkspace(workspace)} className="flex min-w-52 items-center gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-4 text-left"><workspace.icon size={20} className="text-[var(--school-primary)]" /><span className="font-bold">{workspace.label}</span></button>)}</div></section>}

        <section aria-labelledby="workspace-heading"><div className="mb-4"><p className="text-xs font-black uppercase tracking-[.16em] text-[var(--text-muted)]">Apps for your responsibilities</p><h2 id="workspace-heading" className="text-2xl font-black">Choose your workspace</h2></div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{workspaces.map((workspace) => { const Icon = workspace.icon; const favorite = memory.isFavoriteWorkspace(workspace.id); return <article key={workspace.id} className="group relative overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"><button type="button" onClick={() => openWorkspace(workspace)} disabled={Boolean(switching)} className="flex w-full items-start gap-4 text-left disabled:opacity-60"><span className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${workspace.accent} p-3 text-white shadow-md`}>{switching === workspace.id ? <Loader2 className="animate-spin" size={24} /> : <Icon size={24} />}</span><span className="min-w-0 flex-1"><span className="flex items-center gap-2"><span className="text-lg font-black">{workspace.label}</span>{workspace.pendingCount > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-black text-amber-800">{workspace.pendingCount} pending</span>}</span><span className="mt-1 block text-sm leading-5 text-[var(--text-muted)]">{workspace.description}</span><span className="mt-4 inline-flex items-center gap-1 text-xs font-black text-[var(--school-primary)]">Open workspace <ArrowRight size={13} /></span></span></button><button type="button" onClick={() => memory.toggleFavoriteWorkspace(workspace.id)} className={`absolute right-3 top-3 rounded-xl p-2 ${favorite ? 'text-amber-500' : 'text-[var(--text-muted)] opacity-70 hover:bg-[var(--surface-hover)] group-hover:opacity-100'}`} aria-label={`${favorite ? 'Remove' : 'Add'} ${workspace.label} ${favorite ? 'from' : 'to'} favorites`}><Star size={16} fill={favorite ? 'currentColor' : 'none'} /></button></article>; })}</div></section>

        {myWork.length > 0 && <section aria-labelledby="my-work-heading"><div className="mb-3 flex items-center gap-2"><Sparkles size={18} className="text-[var(--school-primary)]" /><h2 id="my-work-heading" className="text-xl font-black">My work</h2></div><div className="grid gap-2 rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-3 sm:grid-cols-2 lg:grid-cols-3">{myWork.map((item) => { const Icon = item.icon || CheckCircle2; return <button type="button" key={item.href} onClick={() => navigate(item.href)} className="flex items-center gap-3 rounded-2xl p-3 text-left hover:bg-[var(--surface-hover)]"><Icon size={18} className="text-[var(--school-primary)]" /><span className="min-w-0 flex-1 truncate text-sm font-bold">{item.label}</span><ArrowRight size={14} className="text-[var(--text-muted)]" /></button>; })}</div></section>}

        <section id="recent" aria-labelledby="recent-heading"><h2 id="recent-heading" className="mb-3 flex items-center gap-2 text-xl font-black"><Clock3 size={18} />Recent activity</h2><div className="divide-y divide-[var(--border-soft)] overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated)]">{memory.recentEntries.length ? memory.recentEntries.map(({ item, visitedAt }) => <button type="button" key={item.href} onClick={() => navigate(item.href)} className="flex w-full items-center gap-3 p-4 text-left hover:bg-[var(--surface-hover)]"><span className="min-w-0 flex-1"><span className="block truncate text-sm font-bold">{item.label}</span><span className="block text-xs text-[var(--text-muted)]">{item.group}</span></span><time className="text-xs text-[var(--text-muted)]">{relativeTime(visitedAt)}</time><ArrowRight size={15} /></button>) : <p className="p-8 text-center text-sm text-[var(--text-muted)]">Pages you open will appear here.</p>}</div></section>
      </div>
    </DashboardLayout>
  );
}
