import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../../components/ui/button';

export function AnalyticsLoading() {
  return <div className="space-y-4" aria-label="Loading analytics">{[1, 2, 3].map((item) => <div key={item} className="h-36 animate-pulse rounded-2xl border bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />)}</div>;
}

export function AnalyticsError({ error, retry }) {
  return <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900 dark:bg-red-950/30"><AlertCircle className="mx-auto text-red-600" /><h2 className="mt-3 font-bold">Analytics could not be loaded</h2><p className="mt-1 text-sm text-slate-500">{error?.response?.data?.message || 'Please try again.'}</p><Button className="mt-4" variant="outline" leftIcon={RefreshCw} onClick={retry}>Try again</Button></div>;
}

