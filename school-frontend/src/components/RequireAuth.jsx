import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../context/authStore.js';

const ADMIN_ROLES = new Set([
  'super_admin',
  'school_admin',
  'content_manager',
  'superAdmin',
  'schoolAdmin',
  'contentEditor',
]);

export const RequireAuth = ({ children }) => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  const role = user?.role;
  if (!role || !ADMIN_ROLES.has(role)) {
    return <Navigate to="/admin/login" replace state={{ from: location }} />;
  }

  return children;
};

export default RequireAuth;
