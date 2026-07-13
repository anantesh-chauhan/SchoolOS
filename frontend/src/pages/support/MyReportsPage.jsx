import React, { useState } from 'react'; 
import { useQuery } from '@tanstack/react-query'; 
import { MessageSquareWarning, Plus } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout'; 
import { authService } from '../../services/authService'; 
import { issueReportService } from '../../services/issueReportService'; 
import { IssueBadge } from '../../components/issue-report/IssueBadges'; 
import ReportIssueModal from '../../components/issue-report/ReportIssueModal';

export default function MyReportsPage() { 
    const user = authService.getCurrentUser(); 
    const [open, setOpen] = useState(false); 
    const [page, setPage] = useState(1); 
    const q = useQuery({ queryKey: ['my-issues', page], queryFn: () => issueReportService.mine({ page, limit: 12 }) }); 
    return <DashboardLayout role={user?.role}>
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">My reports</h1>
                <p className="text-sm text-slate-500">Track issues and feedback you submitted.</p>
            </div>
               <button onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">
                <Plus size={18} />
                New report
                </button>
            </div>{q.isLoading ? <div className="grid gap-4 md:grid-cols-2">{[1, 2, 3, 4].map(x => <div key={x} className="h-36 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" />)}</div> : q.isError ? <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-red-700">Reports could not be loaded.</div> : !q.data?.items.length ? <div className="rounded-2xl border border-dashed p-12 text-center dark:border-slate-700"><MessageSquareWarning className="mx-auto text-slate-400" size={40} /><h2 className="mt-3 font-semibold">No reports yet</h2><p className="mt-1 text-sm text-slate-500">Submit your first issue or suggestion.</p></div> : <><div className="grid gap-4 md:grid-cols-2">{q.data.items.map(i => <article key={i.id} className="rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between gap-3"><div><p className="text-xs text-slate-400">#{i.id}</p><h2 className="mt-1 font-semibold text-slate-900 dark:text-white">{i.title}</h2></div><IssueBadge value={i.status} /></div><p className="mt-3 line-clamp-2 text-sm text-slate-600 dark:text-slate-300">{i.description}</p><div className="mt-4 flex flex-wrap items-center gap-2"><IssueBadge value={i.priority} /><span className="text-xs text-slate-500">{i.category.replaceAll('_', ' ')}</span><span className="ml-auto text-xs text-slate-500">{new Date(i.updatedAt).toLocaleDateString()}</span></div>{i.resolutionNote && <div className="mt-3 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950 dark:text-green-200">{i.resolutionNote}</div>}</article>)}</div><div className="flex justify-end gap-2"><button disabled={page === 1} onClick={() => setPage(x => x - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button><button disabled={page >= q.data.pagination.pages} onClick={() => setPage(x => x + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button></div></>}<ReportIssueModal open={open} onClose={() => setOpen(false)} /></DashboardLayout> }
