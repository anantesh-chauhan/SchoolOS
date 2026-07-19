import React, { useEffect, useState } from 'react';
import { Archive, Bell, Check, CheckCheck, ChevronLeft, ChevronRight, Loader2, Search, ShieldAlert } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useMarkNotification, useNotifications } from '../../hooks/useCommunication';
import { communicationService } from '../../services/communicationService';
import { authService } from '../../services/authService';

const categoryOptions = ['', 'GENERAL', 'SYSTEM', 'SECURITY', 'ACADEMIC', 'HOMEWORK', 'RESOURCE', 'ATTENDANCE', 'FEE', 'EXAM', 'RESULT', 'EVENT', 'HOLIDAY', 'SPORTS', 'EMERGENCY'];
const tone = {
  EMERGENCY: 'border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30',
  URGENT: 'border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/30',
  HIGH: 'border-blue-300 bg-blue-50/40 dark:border-blue-900 dark:bg-blue-950/20',
};

export default function NotificationCenterPage() {
  const user = authService.getCurrentUser();
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState({ page: 1, pageSize: 20, search: '', category: '', read: '' });
  const [selected, setSelected] = useState(null);
  const query = useNotifications(filters);
  const mutation = useMarkNotification();
  const result = query.data || { items: [], total: 0, pages: 0, page: 1 };

  useEffect(() => {
    const requestedId = searchParams.get('notification');
    if (!requestedId || !result.items.length) return;
    const row = result.items.find((item) => item.id === requestedId);
    if (row) setSelected(row);
  }, [result.items, searchParams]);

  const act = async (id, action) => {
    try {
      await mutation.mutateAsync({ id, action });
      toast.success(action === 'acknowledge' ? 'Acknowledged' : action === 'archive' ? 'Archived' : 'Marked as read');
      if (action === 'archive') {
        setSelected(null);
        setSearchParams({}, { replace: true });
      } else {
        setSelected((old) => old?.id === id ? {
          ...old,
          isRead: action === 'read' ? true : old.isRead,
          recipient: { ...old.recipient, readAt: action === 'read' ? new Date().toISOString() : old.recipient.readAt, acknowledgedAt: action === 'acknowledge' ? new Date().toISOString() : old.recipient.acknowledgedAt },
        } : old);
      }
    } catch (error) {
      toast.error(error.response?.data?.message || 'Action failed');
    }
  };

  const open = async (row) => {
    setSelected(row);
    setSearchParams({ notification: row.id }, { replace: true });
    if (!row.isRead) await act(row.id, 'read');
  };

  const readAll = async () => {
    try {
      await communicationService.readAll();
      await query.refetch();
      setSelected((old) => old ? { ...old, isRead: true, recipient: { ...old.recipient, readAt: old.recipient.readAt || new Date().toISOString() } } : old);
      toast.success('Notifications marked as read');
    } catch {
      toast.error('Could not mark notifications as read');
    }
  };

  return (
    <DashboardLayout role={user?.role}>
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-6 text-white shadow-lg">
          <div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">Communication</p><h1 className="mt-2 text-2xl font-black">Notification center</h1><p className="mt-1 text-sm text-slate-300">Announcements, academic updates, system alerts and required actions in one place.</p></div>
          <div className="flex items-center gap-3"><div className="rounded-2xl bg-white/10 px-4 py-3 text-center"><p className="text-2xl font-black">{result.total}</p><p className="text-[10px] font-bold uppercase text-slate-300">Matching</p></div><button onClick={readAll} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-900"><CheckCheck size={16} />Mark all read</button></div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,.9fr)_minmax(360px,1.1fr)]">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="grid gap-2 border-b p-3 sm:grid-cols-[1fr_150px_120px] dark:border-slate-800">
              <label className="relative"><Search className="absolute left-3 top-3 text-slate-400" size={16} /><input aria-label="Search notifications" value={filters.search} onChange={(event) => setFilters({ ...filters, search: event.target.value, page: 1 })} placeholder="Search notifications" className="w-full rounded-xl border border-slate-200 bg-transparent py-2.5 pl-9 pr-3 text-sm dark:border-slate-700" /></label>
              <select aria-label="Category" value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value, page: 1 })} className="rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700">{categoryOptions.map((value) => <option key={value} value={value}>{value || 'All categories'}</option>)}</select>
              <select aria-label="Read status" value={filters.read} onChange={(event) => setFilters({ ...filters, read: event.target.value, page: 1 })} className="rounded-xl border border-slate-200 bg-transparent px-3 text-sm dark:border-slate-700"><option value="">All</option><option value="false">Unread</option><option value="true">Read</option></select>
            </div>
            <div className="max-h-[62vh] overflow-auto">
              {query.isLoading ? <div className="flex justify-center p-10"><Loader2 className="animate-spin" /></div> : query.isError ? <div className="p-8 text-center"><p className="text-sm text-rose-600">Could not load notifications.</p><button onClick={() => query.refetch()} className="mt-3 text-sm font-bold text-blue-600">Retry</button></div> : !result.items.length ? <div className="p-10 text-center"><Bell className="mx-auto text-slate-300" /><p className="mt-3 font-bold">You’re all caught up</p><p className="text-sm text-slate-500">New communication from every connected school module will appear here.</p></div> : result.items.map((row) => <button key={row.id} onClick={() => open(row)} className={`block w-full border-b p-4 text-left transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/60 ${selected?.id === row.id ? 'ring-inset ring-2 ring-blue-500' : !row.isRead ? 'bg-blue-50/50 dark:bg-blue-950/20' : ''}`}><div className="flex gap-3"><span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${row.isRead ? 'bg-slate-300' : row.priority === 'EMERGENCY' ? 'bg-rose-600' : 'bg-blue-600'}`} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-2"><p className="truncate text-sm font-black">{row.title}</p><ChevronRight size={15} /></div><p className="mt-1 line-clamp-2 text-xs text-slate-500">{row.shortMessage || row.message}</p><div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold uppercase tracking-wide text-slate-400"><span>{row.category}</span><span>•</span><span>{row.sourceModule?.replaceAll('_', ' ')}</span><span>•</span><time title={new Date(row.createdAt).toLocaleString()}>{new Date(row.createdAt).toLocaleDateString()}</time>{row.requiresAcknowledgement && !row.recipient.acknowledgedAt && <span className="text-amber-600">Action required</span>}</div></div></div></button>)}
            </div>
            {result.pages > 1 && <div className="flex items-center justify-between border-t p-3 text-xs dark:border-slate-800"><button disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 font-bold disabled:opacity-40"><ChevronLeft size={14} />Previous</button><span className="text-slate-500">Page {result.page} of {result.pages}</span><button disabled={filters.page >= result.pages} onClick={() => setFilters({ ...filters, page: filters.page + 1 })} className="inline-flex items-center gap-1 rounded-lg px-3 py-2 font-bold disabled:opacity-40">Next<ChevronRight size={14} /></button></div>}
          </div>

          <div className={`min-h-[360px] rounded-2xl border p-5 ${selected ? tone[selected.priority] || 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900' : 'border-dashed border-slate-300 dark:border-slate-700'}`}>
            {selected ? <><div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-500">{selected.priority === 'EMERGENCY' ? <ShieldAlert className="text-rose-600" size={18} /> : <Bell size={18} />} {selected.category} · {selected.priority}</div><h2 className="mt-4 text-xl font-black">{selected.title}</h2>{selected.recipient.context?.studentName && <p className="mt-2 rounded-lg bg-white/60 px-3 py-2 text-xs font-bold dark:bg-slate-900/60">Regarding {selected.recipient.context.studentName}</p>}<p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-slate-700 dark:text-slate-200">{selected.message}</p><div className="mt-5 rounded-xl bg-white/60 p-3 text-xs text-slate-500 dark:bg-slate-900/50"><p><strong>Source:</strong> {selected.sourceModule?.replaceAll('_', ' ')}</p><time className="mt-1 block">{new Date(selected.createdAt).toLocaleString()}</time></div><div className="mt-6 flex flex-wrap gap-2">{selected.requiresAcknowledgement && !selected.recipient.acknowledgedAt && <button onClick={() => act(selected.id, 'acknowledge')} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white"><Check size={16} />Acknowledge</button>}<button onClick={() => act(selected.id, 'archive')} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold dark:border-slate-700"><Archive size={16} />Archive</button>{selected.actionUrl && <a href={selected.actionUrl} className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white dark:bg-white dark:text-slate-900">{selected.actionLabel || 'Open related page'}</a>}</div></> : <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center text-sm text-slate-500"><Bell className="mb-3 h-10 w-10 text-slate-300" />Select a notification to read its full details.</div>}
          </div>
        </div>
      </section>
    </DashboardLayout>
  );
}
