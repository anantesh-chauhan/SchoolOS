import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, CheckCheck, Loader2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { communicationService, NOTIFICATIONS_CHANGED_EVENT } from '../../services/communicationService';
import NotificationButton from './NotificationButton';

export default function NotificationCenter({ enabled = true }) {
  const navigate = useNavigate();
  const root = useRef(null);
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [unread, setUnread] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!enabled) return;
    try {
      const [preview, count] = await Promise.all([
        communicationService.notifications({ pageSize: 6 }),
        communicationService.unreadCount(),
      ]);
      setRows(preview.items || []);
      setTotal(preview.total || 0);
      setUnread(count.count || 0);
      setFailed(false);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) { setLoading(false); return undefined; }
    load();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    const timer = setInterval(refreshWhenVisible, 60000);
    const refresh = () => load();
    window.addEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      clearInterval(timer);
      window.removeEventListener(NOTIFICATIONS_CHANGED_EVENT, refresh);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, [enabled, load]);

  useEffect(() => {
    const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const select = async (row) => {
    if (!row.isRead) await communicationService.read(row.id);
    setOpen(false);
    navigate(`/notifications?notification=${encodeURIComponent(row.id)}`);
  };

  const markAllRead = async () => {
    await communicationService.readAll();
    await load();
  };

  if (!enabled) return null;
  return (
    <div ref={root} className="relative">
      <NotificationButton icon={<Bell size={16} className="mx-auto" />} badge={unread > 0} onClick={() => { setOpen((old) => !old); if (!open) load(); }} ariaLabel={`${unread} unread notifications`} />
      {unread > 0 && <span className="pointer-events-none absolute -right-1 -top-1 min-w-5 rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-5 text-white">{unread > 99 ? '99+' : unread}</span>}
      {open && <div className="fixed inset-x-3 top-[4.75rem] z-50 overflow-hidden rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-2xl min-[480px]:absolute min-[480px]:inset-x-auto min-[480px]:right-0 min-[480px]:top-auto min-[480px]:mt-2 min-[480px]:w-[min(92vw,390px)]">
        <div className="flex items-center justify-between border-b p-4 dark:border-slate-800"><div><p className="font-bold">Notifications</p><p className="text-xs text-slate-500">{unread} unread · {total} total</p></div><button type="button" disabled={!unread} onClick={markAllRead} aria-label="Mark all read" className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 disabled:opacity-40 dark:hover:bg-slate-800"><CheckCheck size={18} /></button></div>
        <div className="max-h-[min(24rem,calc(100dvh-10rem))] overflow-auto overscroll-contain">
          {loading ? <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div> : failed ? <button type="button" onClick={load} className="flex w-full flex-col items-center gap-2 p-8 text-sm text-rose-600"><RefreshCw size={18} />Could not load notifications. Retry</button> : rows.length === 0 ? <p className="p-8 text-center text-sm text-slate-500">You’re all caught up.</p> : rows.map((row) => <button key={row.id} type="button" onClick={() => select(row)} className={`block w-full border-b p-4 text-left hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800 ${row.isRead ? 'opacity-70' : row.priority === 'EMERGENCY' ? 'bg-rose-50 dark:bg-rose-950/30' : 'bg-blue-50/60 dark:bg-blue-950/20'}`}><div className="flex gap-3"><span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${row.isRead ? 'bg-slate-300' : row.priority === 'EMERGENCY' ? 'bg-rose-600' : 'bg-blue-600'}`} /><div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate text-sm font-bold">{row.title}</p><span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-bold text-slate-500 dark:bg-slate-800">{row.category}</span></div><p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">{row.shortMessage || row.message}</p><p className="mt-2 text-[10px] text-slate-400">{new Date(row.createdAt).toLocaleString()}</p></div></div></button>)}
        </div>
        <button type="button" onClick={() => { setOpen(false); navigate('/notifications'); }} className="w-full border-t p-3 text-sm font-bold text-blue-600 dark:border-slate-800">View all notifications</button>
      </div>}
    </div>
  );
}
