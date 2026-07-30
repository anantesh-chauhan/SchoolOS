import React, { useCallback, useEffect } from 'react';
import { CheckCircle2, RefreshCw, X } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';

const UPDATE_CHECK_INTERVAL = 60 * 60 * 1000;

export default function PWAUpdatePrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    immediate: true,
    onRegisterError(error) {
      console.error('SchoolOS service worker registration failed:', error);
    },
  });

  const dismiss = useCallback(() => setNeedRefresh(false), [setNeedRefresh]);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined;

    let registration;
    const checkForUpdate = () => registration?.update().catch(() => undefined);
    navigator.serviceWorker.ready.then((value) => {
      registration = value;
    }).catch(() => undefined);

    const intervalId = window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL);
    return () => window.clearInterval(intervalId);
  }, []);

  if (!needRefresh && !offlineReady) return null;

  return (
    <section className="pwa-action-card" role="status" aria-live="polite">
      <div className="pwa-action-card__icon">
        {needRefresh
          ? <RefreshCw aria-hidden="true" size={20} />
          : <CheckCircle2 aria-hidden="true" size={20} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-950 dark:text-slate-50">
          {needRefresh ? 'SchoolOS update available' : 'SchoolOS app shell is ready'}
        </p>
        {needRefresh ? (
          <>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Update when you’re ready. Unsaved work will not be reloaded automatically.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" className="pwa-primary-action" onClick={() => updateServiceWorker(true)}>
                Update now
              </button>
              <button type="button" className="pwa-secondary-action" onClick={dismiss}>
                Later
              </button>
            </div>
          </>
        ) : (
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            Static interface files are available offline. Live school data still requires a connection.
          </p>
        )}
      </div>
      <button
        type="button"
        className="pwa-close-action"
        onClick={needRefresh ? dismiss : () => setOfflineReady(false)}
        aria-label={needRefresh ? 'Dismiss update' : 'Dismiss offline-ready notice'}
      >
        <X aria-hidden="true" size={18} />
      </button>
    </section>
  );
}
