import React from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';

const SidebarItem = ({ item, desktopCollapsed }) => {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200 w-full hover:scale-[1.01] active:scale-[0.98] ${
          isActive ? 'text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'
        } ${desktopCollapsed ? 'justify-center' : ''}`
      }
      title={item.label}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active-item"
              className="absolute inset-0 rounded-xl bg-blue-600 shadow-sm dark:bg-blue-500"
              transition={{ duration: 0.25, ease: 'easeOut' }}
            />
          )}
          {Icon && <Icon size={18} className="relative z-10" />}
          {!desktopCollapsed && <span className="relative z-10 truncate">{item.label}</span>}
        </>
      )}
    </NavLink>
  );
};

export default React.memo(SidebarItem);
