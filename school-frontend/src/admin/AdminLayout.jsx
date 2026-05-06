import React from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { adminMenu } from './adminConfigs.js';
import useAuthStore from '../context/authStore.js';
import useSchoolStore from '../store/schoolStore.js';
import { schoolPath } from '../utils/schoolPath.js';

export const AdminLayout = () => {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const schoolSlug = useSchoolStore((state) => state.schoolSlug);

  return (
    <div className="min-h-screen bg-[#f6f7fb] flex">
      <aside className="w-72 bg-white border-r border-black/10 p-4 hidden md:block">
        <Link to={schoolPath('/admin/dashboard', schoolSlug)} className="block text-xl font-semibold px-2 py-3">CMS Dashboard</Link>
        <nav className="mt-4 space-y-1">
          {adminMenu.map((item) => (
            <NavLink
              key={item.key}
              to={schoolPath(item.path, schoolSlug)}
              className={({ isActive }) => `block px-3 py-2 rounded-lg text-sm ${isActive ? 'bg-[var(--color-primary)] text-white' : 'hover:bg-black/5'}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8">
        <div className="admin-surface p-4 md:p-5 flex items-center justify-between mb-6">
          <h1 className="text-2xl">Admin Panel</h1>
          <button
            className="px-4 py-2 rounded-lg border border-black/15"
            onClick={() => {
              logout();
              navigate(schoolPath('/admin/login', schoolSlug));
            }}
          >
            Logout
          </button>
        </div>
        <Outlet />
      </main>
    </div>
  );
};

export default AdminLayout;
