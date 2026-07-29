import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Badge, ErrorState, Loading, PageTitle, Panel, Progress } from '../../components/student/StudentUI';
import { chapterFeedbackService } from '../../services/chapterFeedbackService';

const dimensions = [
  ['understandingRating', 'Understanding'],
  ['participationRating', 'Participation'],
  ['practiceRating', 'Practice'],
  ['applicationRating', 'Application'],
  ['confidenceRating', 'Confidence'],
  ['improvementRating', 'Improvement'],
  ['independenceRating', 'Independence'],
  ['consistencyRating', 'Consistency'],
];
const lockedState = (value) => ['SUBMITTED', 'LOCKED', 'COMPILED'].includes(value);
const meaning = (n) => n === 1 ? 'Needs immediate support' : n === 2 ? 'Developing' : n === 3 ? 'Satisfactory' : n === 4 ? 'Good' : 'Excellent and independent';
const btn = 'min-h-10 rounded-xl px-4 text-sm font-bold disabled:opacity-50';
const normalizeRating = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';
  return Math.max(1, Math.min(5, number > 5 ? Math.round(number / 2) : Math.round(number)));
};

function Rating({ value, disabled, onChange }) {
  return <div className="grid min-w-28 grid-cols-5 gap-1" role="radiogroup" aria-label="Rating from 1 to 5">
    {[1,2,3,4,5].map((n) => <button type="button" role="radio" aria-checked={value === n} title={`${n}: ${meaning(n)}`} key={n} disabled={disabled} onClick={() => onChange(n)} className={`h-8 rounded text-xs font-black ${value === n ? 'bg-cyan-700 text-white' : 'bg-slate-100 hover:bg-cyan-100 dark:bg-slate-800'}`}>{n}</button>)}
  </div>;
}

function Workspace({ poll }) {
  const qc = useQueryClient();
  const enabledKeys = Array.isArray(poll.enabledTeacherDimensions) && poll.enabledTeacherDimensions.length ? poll.enabledTeacherDimensions : dimensions.map(([key]) => key);
  const activeDimensions = dimensions.filter(([key]) => enabledKeys.includes(key));
  const [rows, setRows] = useState(() => Object.fromEntries(poll.students.map((student) => [student.id, {
    studentId: student.id,
    ...Object.fromEntries(dimensions.map(([key]) => [key, normalizeRating(student.evaluation?.[key])])),
    remark: student.evaluation?.remark || '',
    version: student.evaluation?.version || 0,
    state: student.evaluation?.state || 'NOT_STARTED',
  }])));
  const [search, setSearch] = useState('');
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const editRevision = useRef(0);
  const pollLocked = !['ACTIVE', 'OPEN'].includes(poll.status);
  const complete = (row) => activeDimensions.every(([key]) => row[key]);
  const completed = Object.values(rows).filter(complete).length;
  const visible = useMemo(() => poll.students.filter((student) => {
    const query = search.toLowerCase();
    return (!query || student.name.toLowerCase().includes(query) || String(student.rollNumber || '').includes(query))
      && (!onlyIncomplete || !complete(rows[student.id]));
  }), [onlyIncomplete, poll.students, rows, search]);

  const mutation = useMutation({
    mutationFn: ({ final }) => {
      const all = Object.values(rows);
      const started = all.filter((row) => row.remark || activeDimensions.some(([key]) => row[key]));
      return final ? chapterFeedbackService.submitTeacherEvaluations(poll.id, all) : chapterFeedbackService.saveTeacherDraft(poll.id, started);
    },
    onSuccess: (data, variables) => {
      const responseByStudent = new Map((data.responses || []).map((response) => [response.studentId, response]));
      setRows((current) => Object.fromEntries(Object.entries(current).map(([studentId, row]) => {
        const response = responseByStudent.get(studentId);
        return [studentId, response ? { ...row, version: response.version, state: response.state } : row];
      })));
      if (editRevision.current === variables.revision) setDirty(false);
      setLastSaved(data.lastSavedAt || new Date().toISOString());
      toast.success(variables.final ? 'Final feedback submitted and locked' : 'Draft saved');
      qc.invalidateQueries({ queryKey: ['teacher-polls'] });
    },
    onError: (error) => {
      const conflict = error.response?.data?.data;
      if (conflict?.studentId && conflict.currentVersion != null) setRows((current) => ({ ...current, [conflict.studentId]: { ...current[conflict.studentId], version: conflict.currentVersion } }));
      toast.error(error.response?.data?.message || 'Unable to save feedback');
    },
  });
  useEffect(() => {
    if (!dirty || pollLocked || mutation.isPending) return undefined;
    const timeout = setTimeout(() => mutation.mutate({ final: false, revision: editRevision.current }), 4000);
    return () => clearTimeout(timeout);
  }, [dirty, rows, pollLocked]);
  useEffect(() => {
    const warning = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', warning);
    return () => window.removeEventListener('beforeunload', warning);
  }, [dirty]);
  const setValue = (studentId, key, value) => { editRevision.current += 1; setRows((current) => ({ ...current, [studentId]: { ...current[studentId], [key]: value } })); setDirty(true); };
  const fillColumn = (key) => {
    const value = Number(window.prompt('Rating to apply (1–5)'));
    if (!Number.isInteger(value) || value < 1 || value > 5) return;
    setRows((current) => Object.fromEntries(Object.entries(current).map(([id, row]) => [id, lockedState(row.state) ? row : { ...row, [key]: value }])));
    editRevision.current += 1;
    setDirty(true);
  };
  const submit = () => {
    if (completed !== poll.students.length) { setOnlyIncomplete(true); toast.error(`${poll.students.length - completed} student rows are incomplete`); return; }
    if (window.confirm('Once submitted, this feedback will become read-only. Please review all student ratings before continuing.')) mutation.mutate({ final: true, revision: editRevision.current });
  };

  return <>
    <div className="sticky top-0 z-30 rounded-2xl border bg-white/95 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="font-black">{completed} of {poll.students.length} students completed</p><p className="text-xs text-slate-500">{lastSaved ? `Last saved ${new Date(lastSaved).toLocaleTimeString()}` : dirty ? 'Autosave pending' : 'No unsaved changes'} · {poll.endAt ? `Due ${new Date(poll.endAt).toLocaleString()}` : 'No deadline'}</p></div>
        <div className="flex gap-2"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name or roll" className="h-10 rounded-xl border bg-transparent px-3 dark:border-slate-700" /><button onClick={() => setOnlyIncomplete((value) => !value)} className={`${btn} border dark:border-slate-700`}>{onlyIncomplete ? 'Show all' : 'Show incomplete'}</button></div>
      </div>
      <Progress value={poll.students.length ? completed / poll.students.length * 100 : 0} />
    </div>
    <Panel><details><summary className="cursor-pointer text-sm font-bold">1–5 rating guide</summary><p className="mt-2 text-sm text-slate-500">1 Needs immediate support · 2 Developing · 3 Satisfactory · 4 Good · 5 Excellent and independent</p></details></Panel>
    <div className="hidden overflow-x-auto rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-900 lg:block">
      <table className="min-w-max text-left text-xs"><thead className="sticky top-0 z-20 bg-slate-100 dark:bg-slate-800"><tr><th className="sticky left-0 z-30 min-w-52 bg-slate-100 p-3 dark:bg-slate-800">Student</th>{activeDimensions.map(([key, label]) => <th className="p-2" key={key}><button title="Quick-fill column" onClick={() => fillColumn(key)} className="font-bold hover:text-cyan-700">{label} ↓</button></th>)}<th className="p-2">Remark</th><th className="p-2">Status</th></tr></thead>
        <tbody>{visible.map((student) => { const row = rows[student.id]; const locked = lockedState(row.state); return <tr key={student.id} className="border-t dark:border-slate-800"><td className="sticky left-0 z-10 bg-white p-3 dark:bg-slate-900"><p className="font-bold">{student.name}</p><p className="text-slate-500">Roll {student.rollNumber || '—'} · {student.admissionNumber || 'No admission no.'}</p></td>{activeDimensions.map(([key]) => <td className="p-2" key={key}><Rating value={row[key]} disabled={locked} onChange={(value) => setValue(student.id, key, value)} /></td>)}<td className="p-2"><input value={row.remark} disabled={locked} maxLength={500} onChange={(e) => setValue(student.id, 'remark', e.target.value)} className="h-9 w-40 rounded-lg border bg-transparent px-2 dark:border-slate-700" /></td><td className="p-2"><Badge>{row.state.replaceAll('_', ' ')}</Badge></td></tr>; })}</tbody>
      </table>
    </div>
    <div className="space-y-4 lg:hidden">{visible.map((student, index) => { const row = rows[student.id]; const locked = lockedState(row.state); return <Panel key={student.id}><div className="flex justify-between"><div><p className="text-xs text-slate-500">Student {index + 1} · Roll {student.rollNumber || '—'}</p><h2 className="font-black">{student.name}</h2></div><Badge>{row.state.replaceAll('_', ' ')}</Badge></div><div className="mt-4 space-y-3">{activeDimensions.map(([key, label]) => <div key={key}><div className="mb-1 flex justify-between text-xs font-bold"><span>{label}</span><span>{row[key] ? `${row[key]} · ${meaning(row[key])}` : 'Not rated'}</span></div><Rating value={row[key]} disabled={locked} onChange={(value) => setValue(student.id, key, value)} /></div>)}<textarea value={row.remark} disabled={locked} onChange={(e) => setValue(student.id, 'remark', e.target.value)} placeholder="Optional short remark" className="min-h-16 w-full rounded-xl border bg-transparent p-3 dark:border-slate-700" /></div></Panel>; })}</div>
    {!pollLocked && <div className="sticky bottom-3 z-30 flex flex-wrap justify-end gap-2 rounded-2xl border bg-white/95 p-3 shadow-lg dark:border-slate-800 dark:bg-slate-950/95"><button disabled={mutation.isPending || !dirty} onClick={() => mutation.mutate({ final: false, revision: editRevision.current })} className={`${btn} border dark:border-slate-700`}>Save draft</button><button onClick={() => setOnlyIncomplete(true)} className={`${btn} border dark:border-slate-700`}>Review</button><button disabled={mutation.isPending} onClick={submit} className={`${btn} bg-cyan-700 text-white`}>Submit final feedback</button></div>}
  </>;
}

export default function TeacherWholeClassRatingPage() {
  const { pollId } = useParams();
  const query = useQuery({ queryKey: ['teacher-poll', pollId], queryFn: async () => {
    const rows = await chapterFeedbackService.getTeacherPolls();
    const poll = rows.find((item) => item.id === pollId);
    if (!poll) throw new Error('Poll is outside your assigned classes');
    return poll;
  } });
  return <DashboardLayout role="TEACHER">{query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} retry={query.refetch} /> : <><PageTitle title={query.data.title} description={`${query.data.class.className} ${query.data.section.sectionName} · ${query.data.subject.subjectName} · ${query.data.chapter.chapterName}`} back="/teacher/polls" /><Workspace poll={query.data} /><p className="mt-4 text-center text-xs text-slate-500"><Link to="/teacher/polls">Return to assigned polls</Link></p></>}</DashboardLayout>;
}
