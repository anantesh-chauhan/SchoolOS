import React from 'react';
import { ArrowLeft, RefreshCw, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <section className="offline-page__card" aria-labelledby="offline-title">
        <img src={`${import.meta.env.BASE_URL}pwa-192x192.png`} alt="" className="mx-auto h-20 w-20 rounded-2xl" />
        <div className="offline-page__symbol">
          <WifiOff aria-hidden="true" size={24} />
        </div>
        <h1 id="offline-title" className="mt-5 text-2xl font-bold text-slate-950 dark:text-white">
          SchoolOS is offline
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">
          An internet connection is required for live school data and for every save,
          submission, upload, attendance, fee, or payment action.
        </p>
        <div className="mt-6 grid gap-2 sm:grid-cols-2">
          <button type="button" className="pwa-primary-action justify-center" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" size={16} />
            Retry
          </button>
          <Link className="pwa-secondary-action justify-center" to="/">
            <ArrowLeft aria-hidden="true" size={16} />
            Return to app
          </Link>
        </div>
        <p className="mt-5 text-xs text-slate-500 dark:text-slate-400">
          SchoolOS does not create fake offline records or queue sensitive changes.
        </p>
      </section>
    </main>
  );
}
