import React, { forwardRef, useMemo, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { cn } from '../../lib/utils';

const PasswordInput = forwardRef(function PasswordInput({ label, error, helperText, showStrength = false, className, onKeyUp, ...props }, ref) {
  const [visible, setVisible] = useState(false);
  const [capsLock, setCapsLock] = useState(false);
  const value = String(props.value || '');
  const strength = useMemo(() => [value.length >= 10, /[a-z]/.test(value) && /[A-Z]/.test(value), /\d/.test(value), /[^A-Za-z0-9]/.test(value)].filter(Boolean).length, [value]);

  return (
    <label className="block space-y-1.5 text-sm font-medium text-[var(--text-primary)]">
      {label && <span>{label}</span>}
      <span className="relative block">
        <input
          {...props}
          ref={ref}
          type={visible ? 'text' : 'password'}
          className={cn('h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3 pr-11 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--school-primary)] focus:ring-2 focus:ring-[rgb(var(--school-focus-rgb)/0.2)]', error && 'border-rose-500 focus:border-rose-500 focus:ring-rose-200', className)}
          onKeyUp={(event) => { setCapsLock(event.getModifierState?.('CapsLock') || false); onKeyUp?.(event); }}
        />
        <button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible} className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-[var(--text-muted)] transition hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--school-primary)]">
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
      {capsLock && <span className="block text-xs text-amber-600">Caps Lock is on.</span>}
      {showStrength && value && <span className="block space-y-1"><span className="flex gap-1" aria-label={`Password strength ${strength} of 4`}>{[1, 2, 3, 4].map((item) => <span key={item} className={cn('h-1 flex-1 rounded-full bg-slate-200 dark:bg-slate-700', item <= strength && (strength < 3 ? 'bg-amber-500' : 'bg-emerald-500'))} />)}</span><span className="block text-xs font-normal text-slate-500">Use 10+ characters with uppercase, lowercase, number, and symbol.</span></span>}
      {helperText && !error && <span className="block text-xs font-normal text-[var(--text-muted)]">{helperText}</span>}
      {error && <span className="block text-xs font-normal text-rose-600">{error}</span>}
    </label>
  );
});

export default PasswordInput;
