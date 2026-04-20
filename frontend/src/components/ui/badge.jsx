import React from 'react';
import { cn } from '../../lib/utils';

const variants = {
  success: 'bg-emerald-100 text-emerald-800',
  muted: 'bg-slate-100 text-slate-700',
};

export function Badge({ className, variant = 'muted', ...props }) {
  return (
    <span
      className={cn('inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium', variants[variant], className)}
      {...props}
    />
  );
}
