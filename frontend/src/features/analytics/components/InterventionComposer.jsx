import React, { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Plus, X } from 'lucide-react';
import { analyticsApi } from '../api/analyticsApi';
import { Button } from '../../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';

const inputClass = 'mt-1 h-10 w-full rounded-xl border bg-transparent px-3 text-sm dark:border-slate-700';

export default function InterventionComposer({ studentId, subjects = [], chapters = [] }) {
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ subjectId: '', chapterId: '', type: 'REMEDIAL_CLASS', priority: 'MEDIUM', title: '', reason: '', recommendedAction: '', dueDate: '', parentVisible: false });
  const availableChapters = useMemo(() => chapters.filter((row) => !form.subjectId || row.subjectId === form.subjectId), [chapters, form.subjectId]);
  const mutation = useMutation({
    mutationFn: () => analyticsApi.createIntervention({ ...form, studentId, dueDate: form.dueDate || null }),
    onSuccess: () => {
      toast.success('Intervention created');
      client.invalidateQueries({ queryKey: ['analytics', 'student', studentId] });
      setOpen(false);
      setForm({ subjectId: '', chapterId: '', type: 'REMEDIAL_CLASS', priority: 'MEDIUM', title: '', reason: '', recommendedAction: '', dueDate: '', parentVisible: false });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Intervention could not be created'),
  });
  if (!open) return <Button variant="primary" leftIcon={Plus} onClick={() => setOpen(true)}>Plan intervention</Button>;
  const change = (key, value) => setForm((old) => ({ ...old, [key]: value, ...(key === 'subjectId' ? { chapterId: '' } : {}) }));
  return <Card className="w-full"><CardHeader><CardTitle>Plan an academic intervention</CardTitle><Button size="icon" variant="ghost" onClick={() => setOpen(false)} aria-label="Close intervention form"><X size={17} /></Button></CardHeader><CardContent>
    <div className="grid gap-4 sm:grid-cols-2">
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Subject<select className={inputClass} value={form.subjectId} onChange={(event) => change('subjectId', event.target.value)}><option value="">Select subject</option>{subjects.map((row) => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Chapter<select className={inputClass} value={form.chapterId} onChange={(event) => change('chapterId', event.target.value)}><option value="">Select chapter</option>{availableChapters.map((row) => <option key={row.id} value={row.id}>{row.sequence}. {row.title}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Type<select className={inputClass} value={form.type} onChange={(event) => change('type', event.target.value)}>{['TEACHER_COUNSELLING', 'PARENT_CONTACT', 'REMEDIAL_CLASS', 'ADDITIONAL_HOMEWORK', 'REVISION_PLAN', 'PEER_SUPPORT', 'ATTENDANCE_FOLLOW_UP', 'ACADEMIC_COUNSELLING', 'BEHAVIOUR_SUPPORT', 'CUSTOM'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Priority<select className={inputClass} value={form.priority} onChange={(event) => change('priority', event.target.value)}>{['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2">Title<input className={inputClass} value={form.title} onChange={(event) => change('title', event.target.value)} placeholder="Focused revision plan" /></label>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2">Reason<textarea className="mt-1 min-h-20 w-full rounded-xl border bg-transparent p-3 text-sm dark:border-slate-700" value={form.reason} onChange={(event) => change('reason', event.target.value)} /></label>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300 sm:col-span-2">Recommended action<textarea className="mt-1 min-h-20 w-full rounded-xl border bg-transparent p-3 text-sm dark:border-slate-700" value={form.recommendedAction} onChange={(event) => change('recommendedAction', event.target.value)} /></label>
      <label className="text-xs font-semibold text-slate-600 dark:text-slate-300">Due date<input type="date" className={inputClass} value={form.dueDate} onChange={(event) => change('dueDate', event.target.value)} /></label>
      <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" checked={form.parentVisible} onChange={(event) => change('parentVisible', event.target.checked)} /> Share summary with parent</label>
    </div>
    <div className="mt-5 flex justify-end"><Button variant="primary" loading={mutation.isPending} disabled={!form.subjectId || !form.chapterId || !form.reason || !form.recommendedAction} onClick={() => mutation.mutate()}>Create intervention</Button></div>
  </CardContent></Card>;
}
