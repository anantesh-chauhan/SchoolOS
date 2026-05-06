import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import useAuthStore from '../context/authStore.js';
import useSchoolStore from '../store/schoolStore.js';
import { schoolPath } from '../utils/schoolPath.js';

export const RequireMemberAuth = ({ children }) => {
  const location = useLocation();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const schoolSlug = useSchoolStore((state) => state.schoolSlug);

  if (!isAuthenticated) {
    return <Navigate to={schoolPath('/', schoolSlug)} replace state={{ from: location }} />;
  }

  return children;
};

export default RequireMemberAuth;
