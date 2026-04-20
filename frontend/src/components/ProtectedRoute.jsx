import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { authService } from '../services/authService';

const ProtectedRoute = ({ children, allowedRoles = null }) => {
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [redirectPath, setRedirectPath] = useState(null);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      try {
        const user = await authService.validateSession();

        if (!mounted) {
          return;
        }

        if (!user) {
          setIsAuthorized(false);
          setRedirectPath('/login');
          return;
        }

        if (allowedRoles && !allowedRoles.includes(user.role)) {
          setIsAuthorized(false);
          const fallback = authService.getDashboardRouteByRole(user.role);
          setRedirectPath(fallback === '/login' ? '/login' : fallback);
          return;
        }

        setIsAuthorized(true);
        setRedirectPath(null);
      } catch (error) {
        if (mounted) {
          setIsAuthorized(false);
          setRedirectPath('/login');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    checkSession();

    return () => {
      mounted = false;
    };
  }, [allowedRoles]);

  if (loading) {
    return (
      <motion.div
        className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
          <p className="text-gray-600 font-medium">Loading your workspace...</p>
        </div>
      </motion.div>
    );
  }

  if (redirectPath) {
    return <Navigate to={redirectPath} replace />;
  }

  if (!isAuthorized) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
