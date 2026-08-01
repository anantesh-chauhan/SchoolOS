import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const searchableText = (item) =>
  [item.label, item.group, item.subgroup, item.description].filter(Boolean).join(' ').toLowerCase();

export default function GlobalNavigator({ groups, compact = false }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);

  const items = useMemo(
    () => groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.group }))),
    [groups],
  );
  const results = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return items.slice(0, 8);
    return items.filter((item) => searchableText(item).includes(needle)).slice(0, 10);
  }, [items, query]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen(true);
        window.setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (event.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = (href) => {
    setOpen(false);
    setQuery('');
    navigate(href);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          window.setTimeout(() => inputRef.current?.focus(), 0);
        }}
        className={`${compact ? 'w-full' : 'w-72'} flex h-10 items-center gap-2 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 text-left text-sm text-[var(--text-muted)] shadow-sm transition hover:border-[var(--school-primary)]`}
        aria-label="Open workspace navigator"
      >
        <Search size={16} />
        <span className="min-w-0 flex-1 truncate">Find any page or workspace</span>
        {!compact && <kbd className="rounded border border-[var(--border-soft)] px-1.5 py-0.5 text-[10px]">Ctrl K</kbd>}
      </button>

      {open && (
        <div className="fixed inset-0 z-[80] flex items-start justify-center bg-slate-950/55 p-3 pt-[10vh] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="Workspace navigator">
          <button type="button" className="absolute inset-0" onClick={() => setOpen(false)} aria-label="Close navigator" />
          <div className="relative w-full max-w-2xl overflow-hidden rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-[var(--border-soft)] px-4">
              <Search size={20} className="text-[var(--text-muted)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && results[0]) go(results[0].href);
                }}
                placeholder="Search classes, people, attendance, polls, fees..."
                className="h-14 min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--surface-hover)]" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {results.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={`${item.group}-${item.href}-${item.label}`} type="button" onClick={() => go(item.href)} className="flex w-full items-center gap-3 rounded-2xl p-3 text-left hover:bg-[var(--surface-hover)]">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--school-primary-soft)] text-[var(--school-primary-soft-text)]">
                      {Icon && <Icon size={18} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--text-primary)]">{item.label}</span>
                      <span className="block truncate text-xs text-[var(--text-muted)]">{item.group}{item.subgroup ? ` · ${item.subgroup}` : ''}</span>
                    </span>
                    <ArrowRight size={16} className="text-[var(--text-muted)]" />
                  </button>
                );
              })}
              {!results.length && <p className="p-8 text-center text-sm text-[var(--text-muted)]">No matching page in your role.</p>}
            </div>
            <p className="border-t border-[var(--border-soft)] px-4 py-2 text-xs text-[var(--text-muted)]">Search only shows pages available to your role and permissions.</p>
          </div>
        </div>
      )}
    </>
  );
}
