import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { authService } from '../services/authService';

export default function PermissionDeniedPage() {
  const user = authService.getCurrentUser();
  const dashboard = authService.getDashboardRouteByRole(user?.role);
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16 dark:bg-slate-950">
      <section className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <ShieldX className="mx-auto h-12 w-12 text-amber-500" aria-hidden="true" />
        <h1 className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">Permission denied</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Your account does not have permission to open this page. If this is part of your work, contact your school administrator.
        </p>
        <Link className="mt-6 inline-flex rounded-xl bg-slate-900 px-4 py-2 text-white dark:bg-white dark:text-slate-900" to={dashboard}>
          Return to dashboard
        </Link>
      </section>
    </main>
  );
}
