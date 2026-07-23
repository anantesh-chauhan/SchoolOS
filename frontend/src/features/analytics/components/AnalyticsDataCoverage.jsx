import React from 'react';
import { Info } from 'lucide-react';

export default function AnalyticsDataCoverage({ value = 0, compact = false }) {
  const quality = value >= 75 ? 'Strong coverage' : value >= 45 ? 'Partial coverage' : 'Limited coverage';
  return (
    <div className={compact ? 'min-w-28' : 'rounded-xl bg-slate-50 p-3 dark:bg-slate-950'}>
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="flex items-center gap-1 font-medium text-slate-600 dark:text-slate-300">
          <Info size={13} aria-hidden="true" /> Data coverage
        </span>
        <span className="font-bold text-slate-900 dark:text-white">{Math.round(value)}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800" role="progressbar" aria-valuenow={value} aria-valuemin="0" aria-valuemax="100" aria-label={`Analytics data coverage ${Math.round(value)} percent`}>
        <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
      {!compact && <p className="mt-1.5 text-[11px] text-slate-500">{quality}. Missing components are excluded, not scored as zero.</p>}
    </div>
  );
}

