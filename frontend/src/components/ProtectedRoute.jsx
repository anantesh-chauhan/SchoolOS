import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { authService } from "../services/authService";
import { canAll } from "../security/permissions";

const ProtectedRoute = ({
  children,
  allowedRoles = null,
  requiredPermissions = [],
}) => {
  const [loading, setLoading] =
    useState(true);

  const [isAuthorized, setIsAuthorized] =
    useState(false);

  const [redirectPath, setRedirectPath] =
    useState(null);
  const permissionKey = requiredPermissions.join('|');

  useEffect(() => {

    let mounted = true;

    const checkSession = async () => {

      try {

        const user =
          await authService.validateSession();

        if (!mounted) return;

        if (!user) {

          setIsAuthorized(false);

          setRedirectPath("/login");

          return;

        }

        // Session data can originate from older accounts where role casing was
        // persisted differently. Route access must compare canonical roles.
        const role = String(user.role || '').trim().toUpperCase();
        const permittedRoles = allowedRoles?.map((item) => String(item).trim().toUpperCase());

        if (
          permittedRoles &&
          !permittedRoles.includes(role)
        ) {

          setIsAuthorized(false);

          const fallback =
            authService.getDashboardRouteByRole(
              role
            );

          setRedirectPath(
            fallback === "/login"
              ? "/login"
              : fallback
          );

          return;

        }

        if (requiredPermissions.length && !canAll(user, requiredPermissions)) {
          setIsAuthorized(false);
          setRedirectPath('/permission-denied');
          return;
        }

        setIsAuthorized(true);

        setRedirectPath(null);

      } catch (error) {

        if (mounted) {

          setIsAuthorized(false);

          setRedirectPath("/login");

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

  }, [allowedRoles, permissionKey]);

  /* ======================================
     Premium Loading Screen
  ====================================== */

  if (loading) {

    return (

      <motion.div

        className="
          min-h-screen
          flex
          items-center
          justify-center
          bg-[var(--background)]
        "

        initial={{ opacity: 0 }}

        animate={{ opacity: 1 }}

        exit={{ opacity: 0 }}

      >

        {/* Glass Loader Card */}

        <motion.div

          initial={{ y: 20, opacity: 0 }}

          animate={{ y: 0, opacity: 1 }}

          transition={{ duration: 0.3 }}

          className="
            flex
            flex-col
            items-center
            gap-5
            px-8
            py-8
            rounded-2xl
          bg-[var(--surface-elevated)]
            backdrop-blur-xl
            border
          border-[var(--border-soft)]
            shadow-xl
          "

        >

          {/* Animated Loader */}

          <div className="relative">

            <div
              className="
                w-14
                h-14
                border-4
                border-[var(--school-primary-soft)]
                border-t-[var(--school-primary)]
                rounded-full
                animate-spin
              "
            />

            {/* Glow */}

            <div
              className="
                absolute
                inset-0
                rounded-full
                blur-md
                opacity-40
                bg-[var(--school-primary)]
              "
            />

          </div>

          {/* Text */}

          <div className="text-center">

            <p
              className="
                text-[var(--text-primary)]
                font-semibold
                text-base
              "
            >

              Loading your workspace...

            </p>

            <p
              className="
                text-sm
                text-[var(--text-muted)]
                mt-1
              "
            >

              Please wait while we verify your session

            </p>

          </div>

        </motion.div>

      </motion.div>

    );

  }

  if (redirectPath) {

    return (
      <Navigate
        to={redirectPath}
        replace
      />
    );

  }

  if (!isAuthorized) {

    return (
      <Navigate
        to="/login"
        replace
      />
    );

  }

  return children;

};

export default ProtectedRoute;
