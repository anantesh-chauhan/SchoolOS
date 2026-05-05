import React from 'react';
import { NavLink } from 'react-router-dom';

const SidebarItem = ({ item, desktopCollapsed }) => {
  const Icon = item.icon;

  return (
    <NavLink
      to={item.href}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition w-full ${
          isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-slate-100'
        } ${desktopCollapsed ? 'justify-center' : ''}`
      }
      title={item.label}
    >
      {Icon && <Icon size={18} />}
      {!desktopCollapsed && <span className="truncate">{item.label}</span>}
    </NavLink>
  );
};

export default React.memo(SidebarItem);
