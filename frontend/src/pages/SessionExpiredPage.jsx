import React from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Clock3, ShieldAlert } from 'lucide-react';

export default function SessionExpiredPage() {
  const [params] = useSearchParams();
  const revoked = params.get('reason') === 'role-revoked';
  const Icon = revoked ? ShieldAlert : Clock3;
  return <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-5 text-[var(--text-primary)]"><section className="w-full max-w-md rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-8 text-center shadow-xl"><span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700"><Icon /></span><h1 className="mt-5 text-2xl font-black">{revoked ? 'Workspace access changed' : 'Your session has ended'}</h1><p className="mt-3 text-sm leading-6 text-[var(--text-muted)]">{revoked ? 'An administrator removed or changed your current workspace. Sign in again to open another available workspace.' : 'For your security, please sign in again to continue.'}</p><Link to="/login" className="mt-6 inline-flex h-11 items-center justify-center rounded-xl bg-[var(--school-primary)] px-6 font-bold text-white">Return to sign in</Link></section></main>;
}
