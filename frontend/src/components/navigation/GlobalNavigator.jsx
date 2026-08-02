import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import { ArrowRight, Clock3, Loader2, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { globalSearchService } from '../../services/globalSearchService';

const searchableText = (item) =>
  [item.label, item.group, item.subgroup, item.description].filter(Boolean).join(' ').toLowerCase();

export default function GlobalNavigator({ groups, workspaces = [], workspaceId = 'home', onSelectWorkspace, compact = false, memory }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [view, setView] = useState('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [entityResults, setEntityResults] = useState([]);
  const [searchingEntities, setSearchingEntities] = useState(false);

  const items = useMemo(
    () => [
      ...workspaces.filter((workspace) => workspace.id !== 'home').map((workspace) => ({ label: workspace.label, description: workspace.description, group: 'Workspaces', href: workspace.href, icon: workspace.icon, workspace })),
      ...groups.flatMap((group) => group.items.map((item) => ({ ...item, group: group.group }))),
    ],
    [groups, workspaces],
  );
  const scopedRecents = useMemo(() => workspaceId === 'home'
    ? memory?.recents || []
    : (memory?.recents || []).filter((recent) => items.some((item) => item.href === recent.href)), [items, memory?.recents, workspaceId]);
  const pool = view === 'recent' ? scopedRecents : items;
  const localResults = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return pool.slice(0, 10);
    return pool.filter((item) => searchableText(item).includes(needle)).slice(0, 12);
  }, [pool, query]);
  const results = useMemo(() => view === 'all' ? [...localResults, ...entityResults].slice(0, 18) : localResults, [view, localResults, entityResults]);

  useEffect(() => {
    const needle = query.trim();
    if (!open || view !== 'all' || needle.length < 2) { setEntityResults([]); setSearchingEntities(false); return undefined; }
    let live = true;
    const timer = window.setTimeout(async () => {
      setSearchingEntities(true);
      const user = authService.getCurrentUser();
      const found = await globalSearchService.search({ role: user?.role, query: needle, workspaceId });
      if (live) { setEntityResults(found); setSearchingEntities(false); }
    }, 300);
    return () => { live = false; window.clearTimeout(timer); };
  }, [open, query, view, workspaceId]);

  useEffect(() => setActiveIndex(0), [query, view]);

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
    const openFromShell = (event) => {
      setView(event.detail?.view || 'all');
      setOpen(true);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    };
    window.addEventListener('schoolos:navigator-open', openFromShell);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('schoolos:navigator-open', openFromShell);
    };
  }, []);

  const go = (item) => {
    setOpen(false);
    setQuery('');
    if (item.workspace && onSelectWorkspace) onSelectWorkspace(item.workspace);
    else navigate(item.href);
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
        <span className="min-w-0 flex-1 truncate">{workspaceId === 'home' ? 'Find any page or workspace' : 'Search this workspace'}</span>
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
                  if (event.key === 'ArrowDown') { event.preventDefault(); setActiveIndex((index) => Math.min(results.length - 1, index + 1)); }
                  if (event.key === 'ArrowUp') { event.preventDefault(); setActiveIndex((index) => Math.max(0, index - 1)); }
                  if (event.key === 'Enter' && results[activeIndex]) go(results[activeIndex]);
                }}
                placeholder="Search classes, people, attendance, polls, fees..."
                className="h-14 min-w-0 flex-1 bg-transparent text-sm text-[var(--text-primary)] outline-none placeholder:text-[var(--text-muted)]"
              />
              <button type="button" onClick={() => setOpen(false)} className="rounded-xl p-2 text-[var(--text-muted)] hover:bg-[var(--surface-hover)]" aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="flex gap-1 border-b border-[var(--border-soft)] px-3 py-2" role="tablist" aria-label="Navigator result type">
              {[['all', 'All pages', Search], ['recent', 'Recent activity', Clock3]].map(([id, label, Icon]) => (
                <button key={id} type="button" role="tab" aria-selected={view === id} onClick={() => setView(id)} className={`inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-bold ${view === id ? 'bg-[var(--school-primary-soft)] text-[var(--school-primary-soft-text)]' : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'}`}><Icon size={13} />{label}</button>
              ))}
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-3">
              {results.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={`${item.group}-${item.href}-${item.label}`} className={`flex w-full items-center rounded-2xl ${index === activeIndex ? 'bg-[var(--surface-hover)]' : ''}`}>
                  <button type="button" onMouseEnter={() => setActiveIndex(index)} onClick={() => go(item)} className="flex min-w-0 flex-1 items-center gap-3 p-3 text-left">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--school-primary-soft)] text-[var(--school-primary-soft-text)]">
                      {Icon && <Icon size={18} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-[var(--text-primary)]">{item.label}</span>
                      <span className="block truncate text-xs text-[var(--text-muted)]">{item.group}{item.subgroup ? ` · ${item.subgroup}` : ''}</span>
                    </span>
                    <ArrowRight size={16} className="text-[var(--text-muted)]" />
                  </button>
                  </div>
                );
              })}
              {!results.length && <p className="p-8 text-center text-sm text-[var(--text-muted)]">No matching page in your role.</p>}
              {searchingEntities && <p className="flex items-center justify-center gap-2 p-3 text-xs text-[var(--text-muted)]"><Loader2 size={14} className="animate-spin" />Searching permitted school records…</p>}
            </div>
            <p className="border-t border-[var(--border-soft)] px-4 py-2 text-xs text-[var(--text-muted)]">Search only shows pages available to your role and permissions.</p>
          </div>
        </div>
      )}
    </>
  );
}

GlobalNavigator.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.shape({ group: PropTypes.string, items: PropTypes.array.isRequired })).isRequired,
  workspaces: PropTypes.arrayOf(PropTypes.object),
  workspaceId: PropTypes.string,
  onSelectWorkspace: PropTypes.func,
  compact: PropTypes.bool,
  memory: PropTypes.shape({ recents: PropTypes.array }),
};
