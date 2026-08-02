import React, { Suspense, useEffect, useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import NetworkStatus from './components/pwa/NetworkStatus';
import PWAInstallPrompt from './components/pwa/PWAInstallPrompt';
import PWAUpdatePrompt from './components/pwa/PWAUpdatePrompt';
import { coreRoutes } from './routes/CoreRoutes';
import { adminRoutes } from './routes/AdminRoutes';
import { operationsRoutes } from './routes/OperationsRoutes';
import { portalRoutes } from './routes/PortalRoutes';

const AppFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-slate-50 transition-colors dark:bg-slate-950">
    <div className="w-72 space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="h-4 w-32 rounded-full bg-slate-200 animate-pulse dark:bg-slate-800" />
      <div className="h-3 w-full rounded-full bg-slate-100 animate-pulse dark:bg-slate-800" />
      <div className="h-3 w-2/3 rounded-full bg-slate-100 animate-pulse dark:bg-slate-800" />
    </div>
  </div>
);

export default function App() {
  const [workspaceVersion, setWorkspaceVersion] = useState(0);
  useEffect(() => {
    const remountWorkspace = () => setWorkspaceVersion((version) => version + 1);
    window.addEventListener('schoolos:workspace-changed', remountWorkspace);
    return () => window.removeEventListener('schoolos:workspace-changed', remountWorkspace);
  }, []);
  return (
    <Router basename={import.meta.env.BASE_URL} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <NetworkStatus />
      <Toaster
        position="top-right"
        toastOptions={{
          className: 'dark:!bg-slate-900 dark:!text-slate-100 dark:!border dark:!border-slate-800',
          duration: 3200,
        }}
      />
      <Suspense fallback={<AppFallback />}>
        <Routes key={workspaceVersion}>
          {coreRoutes}
          {adminRoutes}
          {operationsRoutes}
          {portalRoutes}
          {/* Default Routes */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
      <div className="pwa-prompt-stack" aria-live="polite">
        <PWAUpdatePrompt />
        <PWAInstallPrompt />
      </div>
    </Router>
  );
}
