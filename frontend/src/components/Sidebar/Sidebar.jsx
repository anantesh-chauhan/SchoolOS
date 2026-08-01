import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SidebarGroup from './SidebarGroup';
import { LogOut, Menu, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const Sidebar = ({ groupedItems = [], desktopCollapsed, setDesktopCollapsed, user, branding, handleLogout, mobile = false, onNavigate }) => {
  const [openGroup, setOpenGroup] = useState(null);

  const location = useLocation();

  const toggleGroup = useCallback((group) => {
    setOpenGroup((prev) => (prev === group ? null : group));
  }, []);

  // Persist open group based on current route. If the current path matches any
  // item in a group, keep that group open. Do not collapse groups on navigation.
  useEffect(() => {
    if (!groupedItems || groupedItems.length === 0) return;
    const path = location.pathname;

    const matched = groupedItems.find((g) =>
      g.items.some((item) => {
        if (!item.href) return false;
        const itemPath = item.href.split(/[?#]/)[0];
        // Exact match or parent path match
        if (path === itemPath) return true;
        // If the configured href is a prefix of the path
        if (itemPath !== '/' && path.startsWith(`${itemPath}/`)) return true;
        // If the path is a shorter prefix of the href (rare)
        if (itemPath.startsWith(path)) return true;
        return false;
      })
    );

    if (matched) {
      setOpenGroup(matched.group);
    }
    // If no match, keep current openGroup unchanged (do not collapse)
  }, [location.pathname, groupedItems]);

  const isCollapsed = mobile ? false : desktopCollapsed;
  const sidePanelClasses = mobile ? 'w-full' : isCollapsed ? 'w-20' : 'w-[260px]';

  return (
    <aside className={`${sidePanelClasses} flex h-full flex-col border-r border-[var(--border-soft)] bg-[var(--surface-sidebar)] shadow-[4px_0_24px_rgb(var(--school-focus-rgb)/0.06)] transition-[width,background-color,border-color] duration-300`}>
      <div className="flex h-16 items-center justify-between border-b border-[var(--border-soft)] px-4 transition-colors">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="h-10 w-10 rounded-xl overflow-hidden bg-slate-100 text-white font-bold flex items-center justify-center dark:bg-slate-800">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="School logo" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center brand-bg-primary">S</div>
            )}
          </div>
          {!isCollapsed && (
            <div className="min-w-0">
              <p className="truncate font-semibold text-[var(--text-primary)]">{branding?.schoolName || 'SchoolOS'}</p>
              <p className="truncate text-xs text-[var(--text-muted)]">School learning workspace</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDesktopCollapsed((p) => !p)}
            className="hidden h-8 w-8 items-center justify-center rounded-md border border-[var(--border-soft)] text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] active:scale-[0.97] lg:inline-flex"
            aria-label="Toggle sidebar collapse"
          >
            {desktopCollapsed ? <Menu size={16} /> : <X size={16} />}
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-4">
        {groupedItems.map((group) => (
          <SidebarGroup
            key={group.group}
            group={group}
            isOpen={openGroup === group.group}
            onToggle={() => toggleGroup(group.group)}
            desktopCollapsed={isCollapsed}
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="border-t border-[var(--border-soft)] p-3 transition-colors">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-700 transition hover:bg-red-50 active:scale-[0.98] dark:text-red-300 dark:hover:bg-red-950/40"
        >
          <LogOut size={18} />
          {!isCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default React.memo(Sidebar);
