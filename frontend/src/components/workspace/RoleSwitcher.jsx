import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, LayoutDashboard, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { authService } from '../../services/authService';

export default function RoleSwitcher() {
  const navigate = useNavigate();
  const rootRef = useRef(null);
  const [user, setUser] = useState(() => authService.getCurrentUser());
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(null);
  const roles = user?.availableRoles || [];
  const activeId = user?.activeRoleAssignmentId || user?.activeRole?.assignmentId;
  const active = roles.find((item) => item.assignmentId === activeId) || user?.activeRole;

  useEffect(() => {
    const refresh = () => setUser(authService.getCurrentUser());
    const close = (event) => { if (!rootRef.current?.contains(event.target)) setOpen(false); };
    window.addEventListener('schoolos:workspace-changed', refresh);
    document.addEventListener('mousedown', close);
    return () => { window.removeEventListener('schoolos:workspace-changed', refresh); document.removeEventListener('mousedown', close); };
  }, []);

  if (!active) return null;

  const switchTo = async (role) => {
    if (role.assignmentId === activeId || switching) return;
    setSwitching(role.assignmentId);
    try {
      const result = await authService.switchRole(role.assignmentId);
      setUser(result.user);
      setOpen(false);
      toast.success(result.message);
      navigate(authService.getDashboardRouteByRole(result.user.role), { replace: true });
    } catch (error) { toast.error(error.message || 'Could not switch workspace'); }
    finally { setSwitching(null); }
  };

  return (
    <div className="relative" ref={rootRef}>
      <button type="button" onClick={() => setOpen((value) => !value)} aria-haspopup="menu" aria-expanded={open} aria-label={`Current workspace: ${active.label || active.role}`} className="flex h-10 w-10 items-center justify-center gap-3 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-2 text-left shadow-sm transition hover:bg-[var(--surface-hover)] sm:h-auto sm:w-auto sm:min-w-48 sm:justify-start sm:px-3 sm:py-2">
        <LayoutDashboard size={18} className="text-[var(--school-primary)]" />
        <span className="hidden min-w-0 flex-1 sm:block"><span className="block text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Current workspace</span><span className="block truncate text-sm font-semibold">{active.label || active.role}</span></span>
        <ChevronDown size={16} className={`hidden transition sm:block ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && roles.length > 1 && (
        <div role="menu" className="fixed left-3 right-3 top-20 z-50 max-h-[70dvh] overflow-y-auto rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-2 shadow-2xl sm:absolute sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-80">
          <p className="px-3 py-2 text-xs font-bold uppercase tracking-wider text-[var(--text-muted)]">Switch workspace</p>
          {roles.map((role) => (
            <button key={role.assignmentId} type="button" role="menuitem" disabled={Boolean(switching)} onClick={() => switchTo(role)} className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left hover:bg-[var(--surface-hover)] disabled:opacity-60">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--school-primary-soft)] text-[var(--school-primary)]">{switching === role.assignmentId ? <Loader2 className="animate-spin" size={16} /> : role.assignmentId === activeId ? <Check size={16} /> : <LayoutDashboard size={16} />}</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold">{role.label}</span><span className="block truncate text-xs text-[var(--text-muted)]">{role.description}</span></span>
              {role.pendingTasks > 0 && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">{role.pendingTasks}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
