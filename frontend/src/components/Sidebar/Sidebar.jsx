import React, { useState, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import SidebarGroup from './SidebarGroup';
import { LogOut, Menu, X } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const Sidebar = ({ groupedItems = [], desktopCollapsed, setDesktopCollapsed, user, branding, handleLogout, mobile = false }) => {
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
        // Exact match or parent path match
        if (path === item.href) return true;
        // If the configured href is a prefix of the path
        if (path.startsWith(item.href)) return true;
        // If the path is a shorter prefix of the href (rare)
        if (item.href.startsWith(path)) return true;
        return false;
      })
    );

    if (matched) {
      setOpenGroup(matched.group);
    }
    // If no match, keep current openGroup unchanged (do not collapse)
  }, [location.pathname, groupedItems]);

  const sidePanelClasses = desktopCollapsed ? 'w-20' : 'w-[260px]';

  return (
    <aside className={`${sidePanelClasses} border-r border-slate-200 bg-white flex flex-col shadow-sm`}>
      <div className="h-16 px-4 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="h-10 w-10 rounded-xl overflow-hidden bg-slate-100 text-white font-bold flex items-center justify-center">
            {branding?.logoUrl ? (
              <img src={branding.logoUrl} alt="School logo" className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full flex items-center justify-center brand-bg-primary">S</div>
            )}
          </div>
          {!desktopCollapsed && (
            <div>
              <p className="font-semibold text-slate-900">{branding?.schoolName || 'SchoolOS'}</p>
              <p className="text-xs text-slate-500">School Management SaaS</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDesktopCollapsed((p) => !p)}
            className="hidden lg:inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-600"
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
            desktopCollapsed={desktopCollapsed}
          />
        ))}
      </nav>

      <div className="p-3 border-t border-slate-200">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-red-700 hover:bg-red-50"
        >
          <LogOut size={18} />
          {!desktopCollapsed && <span>Logout</span>}
        </button>
      </div>
    </aside>
  );
};

export default React.memo(Sidebar);
