import React, { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, CheckCircle2, GraduationCap, Search, ShieldAlert, UserRoundCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { authService } from '../../services/authService';
import { classService, sectionService } from '../../services/managementService';
import { studentService } from '../../services/studentService';
import { queryKeys } from '../../lib/queryClient';

const currentSession = () => {
  const today = new Date();
  const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${year}-${String(year + 1).slice(-2)}`;
};

export default function StudentAllocationPage() {
  const role = authService.getCurrentUser()?.role || 'ADMIN';
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [view, setView] = useState('PENDING');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [allocation, setAllocation] = useState({ classId: '', sectionId: '', session: currentSession() });

  const deferredSearch = useDeferredValue(search.trim());
  const rosterParams = { page, limit: 25, status: view, search: deferredSearch };
  const rosterKey = queryKeys.reference('student-allocation-roster', rosterParams);
  const rosterQuery = useQuery({
    queryKey: rosterKey,
    queryFn: ({ signal }) => studentService.allocationRoster(rosterParams, signal),
    placeholderData: (previous) => previous,
    staleTime: 15_000,
  });
  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: classService.list });
  const sectionsQuery = useQuery({ queryKey: ['sections', 'all'], queryFn: () => sectionService.list() });

  const students = rosterQuery.data?.data || [];
  const classes = classesQuery.data?.data || [];
  const sections = sectionsQuery.data?.data || [];
  const availableSections = sections.filter((row) => row.classId === allocation.classId);

  useEffect(() => { setPage(1); }, [deferredSearch, view]);

  const visibleStudents = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return students.filter((student) => {
      const isPending = !student.section || !student.rollNumber;
      if (view === 'PENDING' && !isPending) return false;
      if (view === 'ALLOCATED' && isPending) return false;
      if (!needle) return true;
      return [student.studentFirstName, student.studentLastName, student.admissionNo, student.studentUserId, student.className, student.section]
        .filter(Boolean).join(' ').toLowerCase().includes(needle);
    });
  }, [search, students, view]);

  const allocationMutation = useMutation({
    mutationFn: ({ id, payload }) => studentService.allocate(id, payload),
    onSuccess: (response) => {
      toast.success(response.message || 'Student allocation saved');
      setSelected(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.reference('student-allocation-roster') });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to save allocation'),
  });

  const deleteMutation = useMutation({
    mutationFn: studentService.remove,
    onSuccess: (response) => {
      toast.success(response.message || 'Student deactivated');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: queryKeys.reference('student-allocation-roster') });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to deactivate student'),
  });

  const openAllocation = (student) => {
    const classRow = classes.find((row) => row.className === student.className);
    const sectionRow = sections.find((row) => row.classId === classRow?.id && row.sectionName === student.section);
    setAllocation({ classId: classRow?.id || '', sectionId: sectionRow?.id || '', session: student.session || currentSession() });
    setSelected(student);
  };

  const pendingCount = rosterQuery.data?.summary?.pending || 0;
  const allocatedCount = rosterQuery.data?.summary?.allocated || 0;

  return (
    <DashboardLayout role={role}>
      <div className="space-y-6">
        <section className="overflow-hidden rounded-3xl bg-slate-950 text-white shadow-xl">
          <div className="grid gap-6 p-7 lg:grid-cols-[1.25fr,.75fr] lg:p-9">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.26em] text-cyan-300">Student operations</p>
              <h1 className="mt-3 text-3xl font-black sm:text-4xl">Class and section allocation</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">Place newly admitted students, move existing students between sections, and keep every section roll register sequential automatically.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-3xl font-black">{pendingCount}</p><p className="mt-1 text-xs text-slate-300">Awaiting allocation</p></div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="text-3xl font-black">{allocatedCount}</p><p className="mt-1 text-xs text-slate-300">Allocated students</p></div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative flex-1 lg:max-w-xl"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400"/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, admission number, login ID..." className="h-10 w-full rounded-xl border border-slate-300 pl-10 pr-3 text-sm outline-none focus:border-blue-500"/></div>
            <div className="flex rounded-xl bg-slate-100 p-1">
              {[['PENDING', 'Needs allocation'], ['ALLOCATED', 'Allocated'], ['ALL', 'All students']].map(([value, label]) => <button key={value} onClick={() => setView(value)} className={`rounded-lg px-3 py-2 text-xs font-bold ${view === value ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'}`}>{label}</button>)}
            </div>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead><tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500"><th className="px-3 py-3">Student</th><th className="px-3 py-3">Credentials</th><th className="px-3 py-3">Placement</th><th className="px-3 py-3">Roll no.</th><th className="px-3 py-3 text-right">Actions</th></tr></thead>
              <tbody>
                {visibleStudents.map((student) => <tr key={student.id} className="border-b border-slate-100 last:border-0">
                  <td className="px-3 py-4"><p className="font-bold text-slate-900">{student.studentFirstName} {student.studentLastName}</p><p className="text-xs text-slate-500">{student.admissionNo}</p></td>
                  <td className="px-3 py-4"><div className="flex items-center gap-2 text-xs font-semibold text-emerald-700"><UserRoundCheck size={15}/>Student + parent IDs ready</div><p className="mt-1 max-w-56 truncate text-xs text-slate-400">{student.studentUserId}</p></td>
                  <td className="px-3 py-4"><p className="font-semibold">{student.className}{student.section ? ` - ${student.section}` : ''}</p><p className="text-xs text-slate-500">Session {student.session}</p></td>
                  <td className="px-3 py-4">{student.rollNumber ? <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full bg-blue-50 px-2 font-black text-blue-700">{student.rollNumber}</span> : <span className="text-xs font-semibold text-amber-600">Pending</span>}</td>
                  <td className="px-3 py-4"><div className="flex justify-end gap-2"><button onClick={() => openAllocation(student)} className="inline-flex items-center gap-1 rounded-xl bg-slate-900 px-3 py-2 text-xs font-bold text-white"><ArrowRightLeft size={14}/>{student.section ? 'Change section' : 'Allocate'}</button><button onClick={() => setDeleteTarget(student)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700">Deactivate</button></div></td>
                </tr>)}
              </tbody>
            </table>
            {!rosterQuery.isLoading && visibleStudents.length === 0 && <div className="py-14 text-center"><CheckCircle2 className="mx-auto h-9 w-9 text-emerald-500"/><p className="mt-3 font-bold text-slate-800">No students in this view</p><p className="text-sm text-slate-500">Try another filter or search term.</p></div>}
            {rosterQuery.isLoading && <p className="py-12 text-center text-sm text-slate-500">Loading student roster...</p>}
          </div>
          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
            <span className="text-slate-500">{rosterQuery.data?.pagination?.total || 0} matching students</span>
            <div className="flex items-center gap-2">
              <button disabled={page <= 1 || rosterQuery.isFetching} onClick={() => setPage((value) => value - 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Previous</button>
              <span>Page {page} of {rosterQuery.data?.pagination?.totalPages || 1}</span>
              <button disabled={!rosterQuery.data?.pagination?.hasNextPage || rosterQuery.isFetching} onClick={() => setPage((value) => value + 1)} className="rounded-lg border px-3 py-2 disabled:opacity-40">Next</button>
            </div>
          </div>
        </section>
      </div>

      {selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><form onSubmit={(event) => { event.preventDefault(); allocationMutation.mutate({ id: selected.id, payload: allocation }); }} className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><GraduationCap/></div><h2 className="mt-4 text-2xl font-black">Allocate {selected.studentFirstName}</h2><p className="mt-1 text-sm text-slate-500">The roll number is assigned automatically. Moving this student will resequence both affected sections.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2"><label className="text-sm font-semibold text-slate-700">Class<select required value={allocation.classId} onChange={(event) => setAllocation((current) => ({ ...current, classId: event.target.value, sectionId: '' }))} className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="">Select class</option>{classes.map((row) => <option key={row.id} value={row.id}>{row.className}</option>)}</select></label><label className="text-sm font-semibold text-slate-700">Section<select required value={allocation.sectionId} onChange={(event) => setAllocation((current) => ({ ...current, sectionId: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-slate-300 bg-white px-3"><option value="">Select section</option>{availableSections.map((row) => <option key={row.id} value={row.id}>{row.sectionName}</option>)}</select></label><label className="text-sm font-semibold text-slate-700 sm:col-span-2">Academic session<input required value={allocation.session} onChange={(event) => setAllocation((current) => ({ ...current, session: event.target.value }))} className="mt-1 h-11 w-full rounded-xl border border-slate-300 px-3"/></label></div>
        <div className="mt-6 flex justify-end gap-3"><button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold">Cancel</button><button disabled={allocationMutation.isPending} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{allocationMutation.isPending ? 'Saving...' : 'Save allocation'}</button></div>
      </form></div>}

      {deleteTarget && <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"><div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><ShieldAlert/></div><h2 className="mt-4 text-xl font-black">Deactivate this student?</h2><p className="mt-2 text-sm leading-6 text-slate-600"><strong>{deleteTarget.studentFirstName} {deleteTarget.studentLastName}</strong> will lose portal access. Remaining students in {deleteTarget.className}{deleteTarget.section ? ` - ${deleteTarget.section}` : ''} will be renumbered sequentially from 1.</p><div className="mt-6 flex justify-end gap-3"><button onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold">Cancel</button><button disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(deleteTarget.id)} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white">{deleteMutation.isPending ? 'Deactivating...' : 'Yes, deactivate'}</button></div></div></div>}
    </DashboardLayout>
  );
}
