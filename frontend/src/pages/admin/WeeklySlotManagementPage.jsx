import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { AlertTriangle, BarChart3, BookOpenCheck, CheckCircle2, RotateCcw, Sparkles, UsersRound } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { academicStaffingService } from '../../services/managementService';
import { authService } from '../../services/authService';
import { useAcademicStructure } from '../../hooks/useAcademicStructure';
import { Button } from '../../components/ui/button';

const panel = 'rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900';
const input = 'h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950';
const errorMessage = (error) => error.response?.data?.message || 'The operation could not be completed';
const useStaffingMutation = (mutationFn, success) => {
  const qc = useQueryClient();
  return useMutation({ mutationFn, onSuccess: () => { toast.success(success); ['staffing-slots', 'staffing-workloads', 'staffing-audit'].forEach((key) => qc.invalidateQueries({ queryKey: [key] })); }, onError: (error) => toast.error(errorMessage(error)) });
};

function Metric({ label, value, tone = 'text-slate-950 dark:text-white' }) {
  return <div className={`${panel} p-4`}><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</p><p className={`mt-2 text-2xl font-black ${tone}`}>{value}</p></div>;
}

export default function WeeklySlotManagementPage() {
  const structure = useAcademicStructure(); const role = authService.getCurrentUser()?.role || 'ADMIN';
  const [tab, setTab] = useState('slots'); const [classId, setClassId] = useState(''); const [sectionId, setSectionId] = useState('');
  const params = { ...(classId ? { classId } : {}), ...(sectionId ? { sectionId } : {}) };
  const slots = useQuery({ queryKey: ['staffing-slots', params], queryFn: () => academicStaffingService.weeklySlots(params) });
  const workloads = useQuery({ queryKey: ['staffing-workloads'], queryFn: () => academicStaffingService.workloads(), enabled: tab === 'workload' || tab === 'audit' });
  const audit = useQuery({ queryKey: ['staffing-audit'], queryFn: () => academicStaffingService.audit(), enabled: tab === 'audit' });
  const config = slots.data?.data?.config; const allocations = slots.data?.data?.allocations || []; const templates = slots.data?.data?.templates || [];
  const update = useStaffingMutation(academicStaffingService.updateSlot, 'Weekly allocation updated');
  const apply = useStaffingMutation(academicStaffingService.applyTemplate, 'Class template applied');
  const reset = useStaffingMutation(academicStaffingService.resetDefaults, 'CBSE-aligned defaults restored');
  const allocate = useStaffingMutation(academicStaffingService.autoAllocate, 'Teacher allocation completed');
  const summary = useMemo(() => ({ allocated: allocations.reduce((sum, row) => sum + row.weeklySlots, 0), ready: allocations.filter((row) => row.status === 'READY').length, missing: allocations.filter((row) => !row.teacherId).length }), [allocations]);
  const sections = structure.getSections(classId);

  return <DashboardLayout role={role}><div className="space-y-6">
    <header className="overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-950 via-violet-900 to-indigo-700 p-7 text-white shadow-xl">
      <div className="flex flex-wrap items-end justify-between gap-5"><div><p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.2em] text-indigo-200"><Sparkles size={15}/> Academic staffing control centre</p><h1 className="mt-2 text-3xl font-black">Weekly slots & teacher capacity</h1><p className="mt-2 max-w-2xl text-sm text-indigo-100">Plan session-aware subject demand, keep every section staffed, and catch workload or timetable risks before publication.</p></div><div className="rounded-2xl bg-white/10 px-4 py-3 text-sm backdrop-blur"><b>{slots.data?.data?.session?.name || 'Active session'}</b><br/>{config ? `${config.workingDaysPerWeek} days × ${config.periodsPerDay} periods` : 'Loading configuration…'}</div></div>
    </header>
    <nav className="grid gap-2 rounded-2xl bg-slate-100 p-1.5 sm:grid-cols-3 dark:bg-slate-950">{[['slots','Weekly slots',BookOpenCheck],['workload','Teacher workload',BarChart3],['audit','Staffing audit',UsersRound]].map(([key,label,Icon]) => <button key={key} onClick={() => setTab(key)} className={`rounded-xl px-4 py-3 text-sm font-black ${tab === key ? 'bg-white text-indigo-700 shadow dark:bg-slate-800' : 'text-slate-500'}`}><Icon size={16} className="mr-2 inline"/>{label}</button>)}</nav>

    {tab === 'slots' && <>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Weekly capacity" value={config?.totalPeriodsPerWeek || '—'}/><Metric label="Selected allocation" value={sectionId ? `${summary.allocated}/${config?.totalPeriodsPerWeek || 0}` : `${allocations.length} records`}/><Metric label="Ready allocations" value={summary.ready} tone="text-emerald-600"/><Metric label="Teacher required" value={summary.missing} tone={summary.missing ? 'text-amber-600' : 'text-emerald-600'}/></section>
      <section className={`${panel} p-5`}><div className="grid gap-3 md:grid-cols-[1fr,1fr,auto,auto]">
        <select className={input} value={classId} onChange={(e) => { setClassId(e.target.value); setSectionId(''); }}><option value="">All classes</option>{structure.classes.map((row) => <option key={row.id} value={row.id}>{row.className}</option>)}</select>
        <select className={input} value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}><option value="">All sections</option>{sections.map((row) => <option key={row.id} value={row.id}>Section {row.sectionName}</option>)}</select>
        <Button variant="outline" disabled={!classId || apply.isPending} onClick={() => apply.mutate({ classId, ...(sectionId ? { sectionId } : {}) })}>Apply template</Button>
        <Button variant="outline" disabled={reset.isPending} onClick={() => reset.mutate(classId ? { classId } : {})}><RotateCcw size={15} className="mr-2"/>Reset defaults</Button>
      </div></section>
      {!sectionId && classId && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{templates.map((row) => <article key={row.id} className={`${panel} p-5`}><div className="flex items-start justify-between"><div><h2 className="font-black">{row.subject.subjectName}</h2><p className="text-xs text-slate-500">{row.subject.subjectCode}</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700 dark:bg-indigo-950">{row.sourceType.replaceAll('_',' ')}</span></div><p className="mt-4 text-sm">Recommended: <b>{row.minimumSlots}–{row.maximumSlots}</b> periods</p><p className="mt-1 text-2xl font-black">{row.recommendedSlots}<span className="ml-1 text-sm font-medium text-slate-500">/ week</span></p><p className="mt-2 text-xs text-slate-500">Theory {row.theorySlots} · Practical {row.practicalSlots}{row.labDoublePeriods ? ` · ${row.labDoublePeriods} double lab` : ''}</p></article>)}</section>}
      {sectionId && <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{allocations.map((row) => <article key={row.id} className={`${panel} p-5`}><div className="flex items-start justify-between"><div><h2 className="font-black">{row.subject.subjectName}</h2><p className="text-xs text-slate-500">{row.class.className} · Section {row.section.sectionName}</p></div>{row.status === 'READY' ? <CheckCircle2 className="text-emerald-500"/> : <AlertTriangle className="text-amber-500"/>}</div><label className="mt-4 block text-xs font-bold uppercase text-slate-500">Weekly periods</label><input className={`${input} mt-1 w-24`} type="number" min="0" max={row.subject.subjectType === 'ACTIVITY' ? 5 : 10} defaultValue={row.weeklySlots} onBlur={(e) => Number(e.target.value) !== row.weeklySlots && update.mutate({ id: row.id, weeklySlots: Number(e.target.value), theorySlots: Math.max(0, Number(e.target.value) - row.practicalSlots - row.remedialSlots) })}/><div className="mt-4 rounded-2xl bg-slate-50 p-3 text-sm dark:bg-slate-950"><p className="font-bold">{row.teacher?.teacherName || 'Teacher required'}</p><p className="text-xs text-slate-500">{row.teacher ? `${row.teacher.designation || row.teacher.specialization} · target ${row.teacher.targetPeriodsPerWeek}` : 'Run auto-allocation after adding a qualified teacher.'}</p></div></article>)}</section>}
      {!slots.isLoading && !templates.length && !allocations.length && <div className={`${panel} p-10 text-center text-sm text-slate-500`}>Choose a class, then reset CBSE-aligned defaults to create templates.</div>}
    </>}

    {tab === 'workload' && <section className="space-y-4"><div className="flex justify-end"><Button onClick={() => allocate.mutate({})} disabled={allocate.isPending}><Sparkles size={15} className="mr-2"/>Auto-allocate lowest compatible workload</Button></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{(workloads.data?.data || []).map((row) => <article key={row.teacherId} className={`${panel} p-5`}><div className="flex items-start justify-between"><div><h2 className="font-black">{row.teacher.teacherName}</h2><p className="text-xs text-slate-500">{row.teacher.employeeId} · {row.teacher.designation || row.teacher.specialization}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${row.warningLevel === 'OVERLOADED' ? 'bg-rose-100 text-rose-700' : row.warningLevel === 'UNDERUTILIZED' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>{row.warningLevel.replace('_',' ')}</span></div><div className="mt-5 flex items-end justify-between"><p className="text-3xl font-black">{row.totalAllocatedPeriods}<span className="text-sm font-medium text-slate-500">/{row.maximumPeriods}</span></p><p className="text-sm font-bold">{row.utilizationPercentage}% target</p></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100,row.totalAllocatedPeriods / row.maximumPeriods * 100)}%` }}/></div><p className="mt-3 text-xs text-slate-500">{row.assignedSections.length} sections · {row.assignedSubjects.length} subjects · class duty {row.classTeacherDutyPeriods}</p></article>)}</div></section>}

    {tab === 'audit' && <section className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Sections" value={audit.data?.data?.summary?.sections ?? '—'}/><Metric label="Subject allocations" value={audit.data?.data?.summary?.allocations ?? '—'}/><Metric label="Errors" value={audit.data?.data?.summary?.totalErrors ?? '—'} tone="text-rose-600"/><Metric label="Warnings" value={audit.data?.data?.summary?.totalWarnings ?? '—'} tone="text-amber-600"/></div><div className={`${panel} overflow-hidden`}><div className="border-b p-5 dark:border-slate-800"><h2 className="font-black">Validation findings</h2><p className="text-sm text-slate-500">Tenant, qualification, capacity, class-teacher, and section-period checks.</p></div><div className="divide-y dark:divide-slate-800">{[...(audit.data?.data?.errors || []), ...(audit.data?.data?.warnings || [])].map((item, index) => <div key={`${item.code}-${index}`} className="flex gap-3 p-4"><AlertTriangle size={18} className={index < (audit.data?.data?.errors?.length || 0) ? 'text-rose-500' : 'text-amber-500'}/><div><p className="text-xs font-black uppercase tracking-wider">{item.code.replaceAll('_',' ')}</p><p className="text-sm text-slate-600 dark:text-slate-300">{item.message}</p></div></div>)}{audit.data?.data?.isValid && <div className="flex gap-3 p-6 text-emerald-700"><CheckCircle2/><b>All required staffing checks passed.</b></div>}</div></div></section>}
  </div></DashboardLayout>;
}
