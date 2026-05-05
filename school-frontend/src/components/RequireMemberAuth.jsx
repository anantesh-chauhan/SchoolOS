import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../context/authStore.js';

export const RequireMemberAuth = ({ children }) => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  return children;
};

export default RequireMemberAuth;
