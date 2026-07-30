import React, { useEffect, useMemo, useState } from 'react';
import { Download, Share, X } from 'lucide-react';

const DISMISS_KEY = 'schoolosPwaInstallDismissedAt';
const DISMISS_FOR_MS = 14 * 24 * 60 * 60 * 1000;

const isStandalone = () => (
  window.matchMedia('(display-mode: standalone)').matches
  || window.navigator.standalone === true
);

const wasRecentlyDismissed = () => {
  const timestamp = Number(localStorage.getItem(DISMISS_KEY));
  return Number.isFinite(timestamp) && Date.now() - timestamp < DISMISS_FOR_MS;
};

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);
  const [dismissed, setDismissed] = useState(wasRecentlyDismissed);
  const isIosSafari = useMemo(() => {
    const agent = navigator.userAgent;
    const ios = /iPad|iPhone|iPod/.test(agent)
      || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    return ios && /Safari/.test(agent) && !/CriOS|FxiOS|EdgiOS/.test(agent);
  }, []);

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallEvent(event);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setInstallEvent(null);
      localStorage.removeItem(DISMISS_KEY);
    };

    window.addEventListener('beforeinstallprompt', handleInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handleInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setDismissed(true);
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    setInstallEvent(null);
  };

  if (installed || dismissed || (!installEvent && !isIosSafari)) return null;

  return (
    <section className="pwa-action-card pwa-install-card" role="region" aria-label="Install SchoolOS">
      <div className="pwa-action-card__icon">
        {isIosSafari && !installEvent
          ? <Share aria-hidden="true" size={20} />
          : <Download aria-hidden="true" size={20} />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-slate-950 dark:text-slate-50">Install SchoolOS</p>
        {isIosSafari && !installEvent ? (
          <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
            For faster home-screen access, open Share and select “Add to Home Screen”.
          </p>
        ) : (
          <>
            <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">
              Add SchoolOS to this device for faster access.
            </p>
            <button type="button" className="pwa-primary-action mt-3" onClick={install}>
              Install
            </button>
          </>
        )}
      </div>
      <button type="button" className="pwa-close-action" onClick={dismiss} aria-label="Dismiss install suggestion">
        <X aria-hidden="true" size={18} />
      </button>
    </section>
  );
}
