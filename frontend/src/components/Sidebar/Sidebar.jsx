import React from 'react';
import PropTypes from 'prop-types';
import { ArrowLeft, Clock3, LogOut, Menu, Star, X } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import SidebarItem from './SidebarItem';

const Sidebar = ({ workspaces, activeWorkspace, onSelectWorkspace, desktopCollapsed, setDesktopCollapsed, branding, handleLogout, mobile = false, onNavigate, memory }) => {
  const isCollapsed = mobile ? false : desktopCollapsed;
  const isHome = !activeWorkspace || activeWorkspace.id === 'home';
  const ActiveWorkspaceIcon = activeWorkspace?.icon;
  const sidePanelClasses = mobile ? 'w-full' : isCollapsed ? 'w-20' : 'w-[280px]';
  const select = (workspace) => { onSelectWorkspace(workspace); onNavigate?.(); };

  return (
    <aside className={`${sidePanelClasses} flex h-full flex-col border-r border-[var(--border-soft)] bg-[var(--surface-sidebar)] shadow-[4px_0_24px_rgb(var(--school-focus-rgb)/0.06)] transition-[width,background-color,border-color] duration-300`}>
      <div className="flex h-16 items-center justify-between border-b border-[var(--border-soft)] px-4">
        <button type="button" onClick={() => select(workspaces[0])} className="flex min-w-0 items-center gap-2 overflow-hidden text-left" aria-label="Open SchoolOS Home">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-slate-100 font-bold text-white dark:bg-slate-800">
            {branding?.logoUrl ? <img src={branding.logoUrl} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center brand-bg-primary">S</span>}
          </span>
          {!isCollapsed && <span className="min-w-0"><span className="block truncate font-semibold">{branding?.schoolName || 'SchoolOS'}</span><span className="block truncate text-xs text-[var(--text-muted)]">Choose your workspace</span></span>}
        </button>
        <button type="button" onClick={() => setDesktopCollapsed((value) => !value)} className="hidden h-8 w-8 items-center justify-center rounded-lg border border-[var(--border-soft)] text-[var(--text-muted)] hover:bg-[var(--surface-hover)] lg:inline-flex" aria-label={desktopCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{desktopCollapsed ? <Menu size={16} /> : <X size={16} />}</button>
      </div>

      <nav className="flex-1 overflow-y-auto p-3" aria-label="Workspace navigation">
        {isHome ? <>
          {!isCollapsed && <p className="px-3 pb-2 text-[10px] font-black uppercase tracking-[.16em] text-[var(--text-muted)]">Workspaces</p>}
          <div className="space-y-1">
          {workspaces.filter((workspace) => workspace.id !== 'home').map((workspace) => {
            const Icon = workspace.icon;
            return <button key={workspace.id} type="button" onClick={() => select(workspace)} title={workspace.label} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)] ${isCollapsed ? 'justify-center' : ''}`}><Icon size={18} /><span className={isCollapsed ? 'sr-only' : 'truncate'}>{workspace.label}</span>{!isCollapsed && workspace.pendingCount > 0 && <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[10px] text-amber-800">{workspace.pendingCount}</span>}</button>;
          })}
          </div>

        {!isCollapsed && memory?.favoriteWorkspaceIds?.length > 0 && (
          <section className="mt-5 border-t border-[var(--border-soft)] pt-4" aria-labelledby="favorite-workspaces-title">
            <p id="favorite-workspaces-title" className="flex items-center gap-2 px-3 pb-2 text-[10px] font-black uppercase tracking-[.16em] text-[var(--text-muted)]"><Star size={12} className="text-amber-500" fill="currentColor" /> Favorites</p>
            <div className="space-y-1">{workspaces.filter((workspace) => memory.favoriteWorkspaceIds.includes(workspace.id)).map((workspace) => <button key={`favorite-${workspace.id}`} type="button" onClick={() => select(workspace)} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold hover:bg-[var(--surface-hover)]"><workspace.icon size={16} className="text-[var(--school-primary)]" /><span className="truncate">{workspace.label}</span></button>)}</div>
          </section>
        )}

        {!isCollapsed && memory?.recents?.length > 0 && (
          <section className="mt-5 border-t border-[var(--border-soft)] pt-4" aria-labelledby="recent-title">
            <p id="recent-title" className="flex items-center gap-2 px-3 pb-2 text-[10px] font-black uppercase tracking-[.16em] text-[var(--text-muted)]"><Clock3 size={12} /> Recent activity</p>
            <div className="space-y-1">{memory.recents.slice(0, 4).map((item) => <SidebarItem key={`recent-${item.href}`} item={item} desktopCollapsed={false} onNavigate={onNavigate} />)}</div>
            <NavLink to="/workspace/home#recent" onClick={onNavigate} className="mt-1 block px-3 py-2 text-xs font-bold text-[var(--school-primary)]">View all recent activity</NavLink>
          </section>
        )}
        </> : <>
          <button type="button" onClick={() => select(workspaces.find((workspace) => workspace.id === 'home') || workspaces[0])} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-bold text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] ${isCollapsed ? 'justify-center' : ''}`} title="Switch workspace">
            <ArrowLeft size={17} /><span className={isCollapsed ? 'sr-only' : ''}>Switch workspace</span>
          </button>
          <section className="mt-3 border-t border-[var(--border-soft)] pt-4" aria-labelledby="workspace-tools-title">
            {!isCollapsed && <div className="mb-3 rounded-2xl bg-[var(--school-primary-soft)] px-3 py-3"><p id="workspace-tools-title" className="font-black text-[var(--school-primary-soft-text)]">{activeWorkspace.label}</p><p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{activeWorkspace.description}</p></div>}
            {isCollapsed && ActiveWorkspaceIcon && <div className="mb-3 flex justify-center text-[var(--school-primary)]" title={activeWorkspace.label}><ActiveWorkspaceIcon size={20} /></div>}
            <div className="space-y-1">{activeWorkspace.items.map((item) => <SidebarItem key={`${item.href}-${item.label}`} item={item} desktopCollapsed={isCollapsed} onNavigate={onNavigate} />)}</div>
          </section>
        </>}
      </nav>

      <div className="border-t border-[var(--border-soft)] p-3"><button type="button" onClick={handleLogout} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-700 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40 ${isCollapsed ? 'justify-center' : ''}`}><LogOut size={18} /><span className={isCollapsed ? 'sr-only' : ''}>Logout</span></button></div>
    </aside>
  );
};

Sidebar.propTypes = {
  workspaces: PropTypes.arrayOf(PropTypes.object).isRequired, activeWorkspace: PropTypes.object,
  onSelectWorkspace: PropTypes.func.isRequired, desktopCollapsed: PropTypes.bool,
  setDesktopCollapsed: PropTypes.func.isRequired, branding: PropTypes.object,
  handleLogout: PropTypes.func.isRequired, mobile: PropTypes.bool, onNavigate: PropTypes.func,
  memory: PropTypes.shape({ recents: PropTypes.array, favoriteWorkspaceIds: PropTypes.array }),
};

export default React.memo(Sidebar);
