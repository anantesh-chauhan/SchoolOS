import React, { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Badge, ErrorState, Loading, PageTitle, Panel, Progress } from '../../components/student/StudentUI';
import { chapterFeedbackService } from '../../services/chapterFeedbackService';

const questions = [
  ['understandingRating', 'Understanding', 'How well do you understand this chapter now?'],
  ['teachingRating', 'Teaching Clarity', 'How clearly was this chapter explained?'],
  ['paceRating', 'Pace', 'How comfortable were you with the teaching pace?'],
  ['examplesRating', 'Examples', 'How useful were the examples used during teaching?'],
  ['practiceRating', 'Practice', 'How helpful were the exercises, homework and practice questions?'],
  ['resourcesRating', 'Resources', 'How useful were the notes, videos and worksheets?'],
  ['confidenceRating', 'Confidence', 'How confident are you in answering questions from this chapter?'],
  ['interestRating', 'Interest', 'How interesting and engaging was this chapter?'],
  ['doubtResolutionRating', 'Doubt Resolution', 'How well were your questions and doubts resolved?'],
  ['testReadinessRating', 'Test Readiness', 'How ready are you to revise or attempt a test?'],
];
const difficultAreas = ['Concepts','Formulas','Calculations','Diagrams','Definitions','Application Questions','Language','Remembering Facts','Nothing Difficult','Other'];
const helpfulMethods = ['Teacher Explanation','Classroom Examples','Textbook','Notes','Video','Worksheet','Homework','Group Activity','Practical Activity','Self-study','Other'];
const supportOptions = ['More Explanation','More Examples','Extra Practice','Revision Class','One-to-One Help','Video Resource','Notes or Summary','Doubt Session','No Additional Support'];
const locked = (response) => ['SUBMITTED','LOCKED','COMPILED'].includes(response?.state);
const normalizeRating = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return '';
  return Math.max(1, Math.min(5, number > 5 ? Math.round(number / 2) : Math.round(number)));
};

function Scale({ value, onChange, disabled, label }) {
  return <div className="grid grid-cols-5 gap-2" role="radiogroup" aria-label={`${label}, rating 1 to 5`}>{[1,2,3,4,5].map((n) => <button type="button" role="radio" aria-checked={value === n} disabled={disabled} onClick={() => onChange(n)} key={n} className={`h-10 rounded-xl border text-sm font-black ${value === n ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-slate-200 hover:border-indigo-400 dark:border-slate-700'}`}>{n}</button>)}</div>;
}

export default function StudentChapterFeedbackPage() {
  const { pollId, submissionId } = useParams(); const routeId = submissionId || pollId;
  const qc = useQueryClient(); const navigate = useNavigate();
  const query = useQuery({ queryKey: ['student-feedback', routeId], queryFn: async () => {
    const polls = await chapterFeedbackService.getStudentPolls();
    const poll = polls.find((item) => item.id === routeId || item.response?.id === routeId);
    if (!poll) throw new Error('Feedback poll not found');
    return poll;
  } });
  const [form, setForm] = useState(null); const [dirty, setDirty] = useState(false); const [lastSaved, setLastSaved] = useState(null);
  const editRevision = useRef(0);
  const mutation = useMutation({
    mutationFn: ({ final, poll, values }) => final ? chapterFeedbackService.submitStudentVote(poll.id, values) : chapterFeedbackService.saveStudentDraft(poll.id, values),
    onSuccess: (data, variables) => {
      setForm((current) => ({ ...(current || variables.values), version: data.version }));
      if (editRevision.current === variables.revision) setDirty(false);
      setLastSaved(data.lastSavedAt);
      toast.success(variables.final ? 'Feedback submitted and locked' : 'Draft saved');
      qc.invalidateQueries({ queryKey: ['student-feedback'] });
      qc.invalidateQueries({ queryKey: ['student-polls-pending'] });
      qc.invalidateQueries({ queryKey: ['student-polls-submitted'] });
      if (variables.final) navigate('/student/polls/submitted');
    },
    onError: (error) => {
      const currentVersion = error.response?.data?.data?.currentVersion;
      if (currentVersion != null) setForm((current) => ({ ...(current || {}), version: currentVersion }));
      toast.error(error.response?.data?.message || 'Unable to save feedback');
    },
  });
  useEffect(() => {
    if (!dirty || !query.data || locked(query.data.response) || mutation.isPending) return undefined;
    const timeout = setTimeout(() => mutation.mutate({ final: false, poll: query.data, values: form, revision: editRevision.current }), 4000);
    return () => clearTimeout(timeout);
  }, [dirty, form, query.data]);
  useEffect(() => { const warning = (event) => { if (dirty) { event.preventDefault(); event.returnValue = ''; } }; window.addEventListener('beforeunload', warning); return () => window.removeEventListener('beforeunload', warning); }, [dirty]);
  if (query.isLoading) return <DashboardLayout role="STUDENT"><Loading /></DashboardLayout>;
  if (query.isError) return <DashboardLayout role="STUDENT"><ErrorState error={query.error} retry={query.refetch} /></DashboardLayout>;
  const poll = query.data;
  const enabledKeys = Array.isArray(poll.enabledStudentDimensions) && poll.enabledStudentDimensions.length ? poll.enabledStudentDimensions : questions.map(([key]) => key);
  const activeQuestions = questions.filter(([key]) => enabledKeys.includes(key));
  const values = form || { ...Object.fromEntries(questions.map(([key]) => [key, normalizeRating(poll.response?.[key])])), difficultArea: poll.response?.difficultArea || '', helpfulMethod: poll.response?.helpfulMethod || '', supportNeeded: Array.isArray(poll.response?.supportNeeded) ? poll.response.supportNeeded : [], difficultTopic: poll.response?.difficultTopic || '', helpfulExplanation: poll.response?.helpfulExplanation || '', explainAgain: poll.response?.explainAgain || '', suggestion: poll.response?.suggestion || '', version: poll.response?.version || 0 };
  const readOnly = locked(poll.response);
  const canEdit = poll.editable !== false && !readOnly;
  const completed = activeQuestions.filter(([key]) => values[key]).length;
  const update = (key, value) => { editRevision.current += 1; setForm({ ...values, [key]: value }); setDirty(true); };
  const toggleSupport = (option) => {
    if (option === 'No Additional Support') return update('supportNeeded', ['No Additional Support']);
    const withoutNone = values.supportNeeded.filter((item) => item !== 'No Additional Support');
    return update('supportNeeded', withoutNone.includes(option) ? withoutNone.filter((item) => item !== option) : [...withoutNone, option]);
  };
  const submit = () => {
    if (!canEdit) { toast.error('This poll is not accepting responses.'); return; }
    if (completed < activeQuestions.length) { toast.error(`${activeQuestions.length - completed} rating questions are incomplete`); return; }
    if (poll.commentsRequired && !values.suggestion.trim()) { toast.error('Please add a suggestion/comment before submitting.'); return; }
    if (window.confirm('Once submitted, you can view your response but cannot edit it.')) mutation.mutate({ final: true, poll, values, revision: editRevision.current });
  };
  return <DashboardLayout role="STUDENT"><PageTitle title={poll.title} description={`${poll.subject.subjectName} · Chapter ${poll.chapter.chapterNumber}: ${poll.chapter.chapterName}`} back={readOnly ? '/student/polls/submitted' : '/student/polls/pending'} />
    <div className="sticky top-0 z-20 rounded-2xl border bg-white/95 p-4 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-950/95"><div className="flex justify-between text-sm"><strong>{completed} of {activeQuestions.length} ratings completed</strong><span className="text-slate-500">{readOnly ? `Submitted ${new Date(poll.response.submittedAt).toLocaleString()}` : lastSaved ? `Saved ${new Date(lastSaved).toLocaleTimeString()}` : dirty ? 'Autosave pending' : 'Draft restored'}</span></div><Progress value={activeQuestions.length ? completed / activeQuestions.length * 100 : 0} /></div>
    {poll.instructions && <Panel><p className="text-sm">{poll.instructions}</p></Panel>}
    {readOnly && <Panel><div className="flex items-center gap-2"><Badge>READ ONLY</Badge><p className="text-sm">Your submitted response is permanently locked.</p></div></Panel>}
    {!canEdit && !readOnly && <Panel><p className="font-bold text-amber-700">This poll is closed, has not opened yet, or its deadline has passed. Your saved draft remains viewable.</p></Panel>}
    <div className="space-y-4">{activeQuestions.map(([key, label, question], index) => <Panel key={key}><p className="text-xs font-bold text-indigo-600">Question {index + 1} · {label}</p><h2 className="mb-4 mt-1 font-bold">{question}</h2><Scale label={label} value={values[key]} disabled={!canEdit} onChange={(value) => update(key, value)} /></Panel>)}</div>
    <Panel><h2 className="text-lg font-black">A few quick follow-ups</h2><div className="mt-4 grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">What was most difficult?<select disabled={!canEdit} value={values.difficultArea} onChange={(e) => update('difficultArea', e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-transparent px-3 dark:border-slate-700"><option value="">Choose an option</option>{difficultAreas.map((item) => <option key={item}>{item}</option>)}</select></label><label className="text-sm font-bold">What helped you most?<select disabled={!canEdit} value={values.helpfulMethod} onChange={(e) => update('helpfulMethod', e.target.value)} className="mt-1 h-11 w-full rounded-xl border bg-transparent px-3 dark:border-slate-700"><option value="">Choose an option</option>{helpfulMethods.map((item) => <option key={item}>{item}</option>)}</select></label></div><p className="mb-2 mt-5 text-sm font-bold">What support do you need? (Choose any)</p><div className="flex flex-wrap gap-2">{supportOptions.map((item) => <button type="button" disabled={!canEdit} aria-pressed={values.supportNeeded.includes(item)} onClick={() => toggleSupport(item)} key={item} className={`rounded-full border px-3 py-2 text-xs font-bold ${values.supportNeeded.includes(item) ? 'border-indigo-600 bg-indigo-600 text-white' : 'dark:border-slate-700'}`}>{item}</button>)}</div><div className="mt-5 grid gap-3 md:grid-cols-2">{[['difficultTopic','Which topic was most difficult?'],['helpfulExplanation','What helped you understand the chapter?'],['explainAgain','What should be explained again?'],['suggestion','Any other suggestion?']].map(([key, label]) => <label className="text-sm font-bold" key={key}>{label}<textarea disabled={!canEdit} value={values[key]} onChange={(e) => update(key, e.target.value)} maxLength={1000} className="mt-1 min-h-20 w-full rounded-xl border bg-transparent p-3 dark:border-slate-700" /></label>)}</div>{poll.commentsRequired && <p className="mt-3 text-xs font-bold text-amber-700">A suggestion/comment is required before final submission.</p>}</Panel>
    {canEdit && <div className="sticky bottom-3 z-20 flex justify-end gap-2 rounded-2xl border bg-white/95 p-3 shadow-lg dark:border-slate-800 dark:bg-slate-950/95"><button disabled={mutation.isPending || !dirty} onClick={() => mutation.mutate({ final: false, poll, values, revision: editRevision.current })} className="rounded-xl border px-5 py-3 font-bold disabled:opacity-50 dark:border-slate-700">Save draft</button><button disabled={mutation.isPending} onClick={submit} className="rounded-xl bg-indigo-600 px-5 py-3 font-bold text-white disabled:opacity-50">Review & submit</button></div>}
  </DashboardLayout>;
}
