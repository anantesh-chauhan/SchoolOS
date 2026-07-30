import React from 'react';
import { motion } from 'framer-motion';
import { NavLink } from 'react-router-dom';

const SidebarItem = ({ item, desktopCollapsed, onNavigate }) => {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.href}
      onClick={onNavigate}
      className={({ isActive }) =>
        `relative flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition-all duration-200 w-full hover:scale-[1.01] active:scale-[0.98] ${
          isActive ? 'text-[var(--on-primary)] shadow-sm' : 'text-[var(--text-primary)] hover:bg-[var(--surface-hover)]'
        } ${desktopCollapsed ? 'justify-center' : ''}`
      }
      title={item.label}
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active-item"
              className="absolute inset-0 rounded-xl bg-[var(--school-primary)] shadow-[0_5px_14px_rgb(var(--school-focus-rgb)/0.2)]"
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
