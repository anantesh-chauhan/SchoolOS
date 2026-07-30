import React from 'react';
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export const Panel = ({ children, className = '' }) => (
  <section className={`rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-5 text-[var(--text-primary)] shadow-[0_8px_24px_rgb(var(--school-focus-rgb)/0.07)] ${className}`}>
    {children}
  </section>
);

export const Badge = ({ children, tone = 'indigo' }) => (
  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
    tone === 'green'
      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200'
      : tone === 'red'
        ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200'
        : 'bg-[var(--school-primary-soft)] text-[var(--school-primary-soft-text)]'
  }`}>
    {children}
  </span>
);

export const PageTitle = ({ title, description, back }) => (
  <div className="flex items-start gap-3">
    {back && (
      <Link to={back} className="mt-1 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-2 hover:bg-[var(--surface-hover)]" aria-label="Back">
        ←
      </Link>
    )}
    <div>
      <h1 className="text-2xl font-black text-[var(--text-primary)]">{title}</h1>
      {description && <p className="mt-1 text-sm text-[var(--text-muted)]">{description}</p>}
    </div>
  </div>
);

export const Loading = () => (
  <div className="flex min-h-64 items-center justify-center text-[var(--text-muted)]">
    <Loader2 className="mr-2 animate-spin" />
    Loading your academic information…
  </div>
);

export const ErrorState = ({ error, retry }) => (
  <Panel className="text-center">
    <AlertCircle className="mx-auto text-rose-500" />
    <p className="mt-3 font-bold">{error?.response?.data?.message || 'Unable to load this page'}</p>
    <button onClick={retry} className="mt-4 rounded-xl bg-[var(--school-primary)] px-4 py-2 text-sm font-bold text-[var(--on-primary)]">Retry</button>
  </Panel>
);

export const Empty = ({ children }) => (
  <div className="rounded-2xl border border-dashed border-[var(--border-soft)] bg-[var(--surface-muted)] p-8 text-center text-sm font-semibold text-[var(--text-muted)]">
    {children}
  </div>
);

export const Progress = ({ value }) => (
  <div className="h-2 overflow-hidden rounded-full bg-[var(--surface-hover)]">
    <div className="h-full rounded-full bg-[var(--school-primary)]" style={{ width: `${Math.max(0, Math.min(100, value || 0))}%` }} />
  </div>
);

export const ActionLink = ({ to, children }) => (
  <Link to={to} className="inline-flex items-center gap-1 text-sm font-bold text-[var(--school-primary)]">
    {children}<ChevronRight size={15} />
  </Link>
);
