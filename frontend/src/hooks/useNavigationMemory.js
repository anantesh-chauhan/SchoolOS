import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { authService } from '../services/authService';

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key) || '') || fallback; } catch { return fallback; }
};

export function useNavigationMemory(items = []) {
  const location = useLocation();
  const user = authService.getCurrentUser();
  const prefix = `schoolos:navigation:${user?.id || 'anonymous'}:${user?.schoolId || 'platform'}`;
  const recentKey = `${prefix}:recent`;
  const workspaceFavoritesKey = `${prefix}:favorite-workspaces`;
  const [recentEntries, setRecentEntries] = useState(() => read(recentKey, []).map((entry) => (
    typeof entry === 'string' ? { href: entry, itemHref: entry, visitedAt: null } : entry
  )));
  const [favoriteWorkspaceIds, setFavoriteWorkspaceIds] = useState(() => read(workspaceFavoritesKey, []));

  useEffect(() => {
    const path = `${location.pathname}${location.search}${location.hash}`;
    const match = items.find((item) => item.href === path)
      || items.find((item) => item.href?.split(/[?#]/)[0] === location.pathname);
    if (!match) return;
    setRecentEntries((current) => current[0]?.href === path
      ? current
      : [{ href: path, itemHref: match.href, visitedAt: new Date().toISOString() }, ...current.filter((entry) => entry.href !== path)].slice(0, 10));
  }, [items, location.pathname, location.search, location.hash]);

  useEffect(() => { try { localStorage.setItem(recentKey, JSON.stringify(recentEntries)); } catch { /* noop */ } }, [recentEntries, recentKey]);
  useEffect(() => { try { localStorage.setItem(workspaceFavoritesKey, JSON.stringify(favoriteWorkspaceIds)); } catch { /* noop */ } }, [favoriteWorkspaceIds, workspaceFavoritesKey]);

  const byHref = useMemo(() => new Map(items.map((item) => [item.href, item])), [items]);
  const toggleFavoriteWorkspace = useCallback((id) => setFavoriteWorkspaceIds((current) => (
    current.includes(id) ? current.filter((item) => item !== id) : [id, ...current].slice(0, 6)
  )), []);

  return {
    recentEntries: recentEntries.map((entry) => {
      const item = byHref.get(entry.itemHref || entry.href);
      return item ? { ...entry, item: { ...item, href: entry.href } } : null;
    }).filter(Boolean),
    recents: recentEntries.map((entry) => {
      const item = byHref.get(entry.itemHref || entry.href);
      return item ? { ...item, href: entry.href } : null;
    }).filter(Boolean),
    favoriteWorkspaceIds,
    toggleFavoriteWorkspace,
    isFavoriteWorkspace: (id) => favoriteWorkspaceIds.includes(id),
  };
}
