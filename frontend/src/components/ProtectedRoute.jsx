import React, { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { motion } from "framer-motion";
import { authService } from "../services/authService";

const ProtectedRoute = ({
  children,
  allowedRoles = null,
}) => {
  const [loading, setLoading] =
    useState(true);

  const [isAuthorized, setIsAuthorized] =
    useState(false);

  const [redirectPath, setRedirectPath] =
    useState(null);

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

        if (
          allowedRoles &&
          !allowedRoles.includes(user.role)
        ) {

          setIsAuthorized(false);

          const fallback =
            authService.getDashboardRouteByRole(
              user.role
            );

          setRedirectPath(
            fallback === "/login"
              ? "/login"
              : fallback
          );

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

  }, [allowedRoles]);

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
          bg-gradient-to-br
          from-slate-50
          via-blue-50
          to-indigo-100
          dark:from-slate-900
          dark:via-slate-900
          dark:to-slate-800
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
            bg-white/80
            dark:bg-slate-900/70
            backdrop-blur-xl
            border
            border-slate-200
            dark:border-slate-700
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
                border-blue-200
                dark:border-blue-900
                border-t-blue-600
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
                bg-blue-400
              "
            />

          </div>

          {/* Text */}

          <div className="text-center">

            <p
              className="
                text-slate-700
                dark:text-slate-200
                font-semibold
                text-base
              "
            >

              Loading your workspace...

            </p>

            <p
              className="
                text-sm
                text-slate-500
                dark:text-slate-400
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