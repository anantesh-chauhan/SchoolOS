import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRight, Search, Users } from 'lucide-react';
import DashboardLayout from '../../../layouts/DashboardLayout';
import { authService } from '../../../services/authService';
import { analyticsApi } from '../api/analyticsApi';
import { AnalyticsError, AnalyticsLoading } from '../components/AnalyticsState';

export default function StudentAnalyticsListPage() {
  const user = authService.getCurrentUser();
  const [filters, setFilters] = useState({ page: 1, limit: 20, search: '', className: '', section: '' });
  const selfRedirect = user?.role === 'STUDENT' && user?.studentId;
  const query = useQuery({ queryKey: ['analytics', 'students', filters], queryFn: () => analyticsApi.students(filters), placeholderData: (old) => old, enabled: !selfRedirect });
  if (selfRedirect) return <Navigate replace to={`/analytics/students/${user.studentId}`} />;
  return (
    <DashboardLayout role={user?.role}>
      <div className="space-y-5">
        <header><p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Academic intelligence</p><h1 className="mt-1 text-2xl font-bold">{user?.role === 'PARENT' ? 'Child analytics' : 'Student analytics'}</h1><p className="mt-1 text-sm text-slate-500">{user?.role === 'PARENT' ? 'Select a linked child to review progress and recommended next steps.' : 'Find a student to review academic health, evidence, risks, and next steps.'}</p></header>
        {user?.role !== 'PARENT' && <div className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <label className="relative min-w-60 flex-1"><Search className="absolute left-3 top-3 text-slate-400" size={17} /><input aria-label="Search students" value={filters.search} onChange={(event) => setFilters((old) => ({ ...old, search: event.target.value, page: 1 }))} placeholder="Search name or admission number" className="h-11 w-full rounded-xl border bg-transparent pl-10 pr-3 dark:border-slate-700" /></label>
          <input aria-label="Filter by class" value={filters.className} onChange={(event) => setFilters((old) => ({ ...old, className: event.target.value, page: 1 }))} placeholder="Class" className="h-11 w-32 rounded-xl border bg-transparent px-3 dark:border-slate-700" />
          <input aria-label="Filter by section" value={filters.section} onChange={(event) => setFilters((old) => ({ ...old, section: event.target.value, page: 1 }))} placeholder="Section" className="h-11 w-32 rounded-xl border bg-transparent px-3 dark:border-slate-700" />
        </div>}
        {query.isLoading ? <AnalyticsLoading /> : query.isError ? <AnalyticsError error={query.error} retry={query.refetch} /> : (
          <div className="overflow-hidden rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950"><tr>{['Student', 'Admission', 'Class', 'Roll', 'Session', ''].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody>{query.data.items.map((student) => <tr key={student.id} className="border-t dark:border-slate-800"><td className="px-4 py-4"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-indigo-50 text-indigo-600 dark:bg-indigo-950"><Users size={17} /></span><span className="font-semibold">{student.studentFirstName} {student.studentLastName}</span></div></td><td className="px-4 text-slate-500">{student.admissionNo || '—'}</td><td className="px-4">{student.className} {student.section ? `· ${student.section}` : ''}</td><td className="px-4">{student.rollNumber || '—'}</td><td className="px-4">{student.session}</td><td className="px-4"><Link className="inline-flex items-center gap-1 font-semibold text-indigo-600 dark:text-indigo-300" to={`/analytics/students/${student.id}`}>Open <ArrowRight size={14} /></Link></td></tr>)}</tbody></table></div>
            {!query.data.items.length && <div className="p-12 text-center text-sm text-slate-500">No students match these filters.</div>}
          </div>
        )}
        {query.data?.pagination && <div className="flex items-center justify-end gap-3 text-sm"><button className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={filters.page <= 1} onClick={() => setFilters((old) => ({ ...old, page: old.page - 1 }))}>Previous</button><span>Page {query.data.pagination.page} of {query.data.pagination.pages || 1}</span><button className="rounded-lg border px-3 py-2 disabled:opacity-40" disabled={filters.page >= query.data.pagination.pages} onClick={() => setFilters((old) => ({ ...old, page: old.page + 1 }))}>Next</button></div>}
      </div>
    </DashboardLayout>
  );
}
