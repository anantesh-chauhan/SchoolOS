import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookCheck, CalendarCheck, ClipboardList, Download, MessageSquare, MousePointerClick, Printer } from 'lucide-react';
import DashboardLayout from '../../../layouts/DashboardLayout';
import { authService } from '../../../services/authService';
import { useChapterAnalytics } from '../hooks/useAnalytics';
import AcademicHealthCard from '../components/AcademicHealthCard';
import { AnalyticsError, AnalyticsLoading } from '../components/AnalyticsState';
import { Badge } from '../../../components/ui/badge';
import { label, statusVariant } from '../constants/analyticsStyles';
import { analyticsApi, saveReport } from '../api/analyticsApi';
import { Button } from '../../../components/ui/button';

export default function ChapterAnalyticsPage() {
  const user = authService.getCurrentUser();
  const { studentId, subjectId, chapterId } = useParams();
  const query = useChapterAnalytics(studentId, subjectId, chapterId);
  if (query.isLoading) return <DashboardLayout role={user?.role}><AnalyticsLoading /></DashboardLayout>;
  if (query.isError) return <DashboardLayout role={user?.role}><AnalyticsError error={query.error} retry={query.refetch} /></DashboardLayout>;
  const { student, subject, chapter } = query.data;
  const evidence = [
    [ClipboardList, 'Quiz average', chapter.quizAverage],
    [BookCheck, 'Homework completion', chapter.homeworkCompletion],
    [CalendarCheck, 'Attendance in teaching period', chapter.attendance],
    [MessageSquare, 'Self-understanding', chapter.selfUnderstanding],
    [MessageSquare, 'Teacher evaluation', chapter.teacherEvaluation],
    [MousePointerClick, 'Resource completion', chapter.resourceCompletionRate],
  ];
  return <DashboardLayout role={user?.role}><div className="space-y-5">
    <header><Link className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600" to={`/analytics/students/${studentId}/subjects/${subjectId}`}><ArrowLeft size={15} /> {subject.name}</Link><div className="mt-3 flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Chapter intelligence · {student.name}</p><h1 className="text-2xl font-bold">{chapter.sequence}. {chapter.title}</h1><p className="text-sm text-slate-500">{label(chapter.teachingStatus)} {chapter.completionDate ? `· Completed ${new Date(chapter.completionDate).toLocaleDateString()}` : ''}</p></div><div className="flex flex-wrap items-center gap-2 print:hidden"><Badge variant={statusVariant[chapter.health.chapterStatus]}>{label(chapter.health.chapterStatus)}</Badge><Button size="sm" variant="outline" leftIcon={Download} onClick={async () => saveReport(await analyticsApi.chapterReport(studentId, subjectId, chapterId, 'pdf'), `${chapter.title}-analytics.pdf`)}>PDF</Button><Button size="sm" variant="outline" onClick={async () => saveReport(await analyticsApi.chapterReport(studentId, subjectId, chapterId, 'csv'), `${chapter.title}-analytics.csv`)}>CSV</Button><Button size="sm" variant="outline" leftIcon={Printer} onClick={() => window.print()}>Print</Button></div></div></header>
    <AcademicHealthCard health={chapter.health} />
    <section><h2 className="mb-3 text-lg font-bold">Evidence summary</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{evidence.map(([Icon, title, value]) => <div key={title} className="rounded-2xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between"><div><p className="text-xs uppercase tracking-wider text-slate-500">{title}</p><p className="mt-2 text-2xl font-bold">{value === null ? '—' : `${Math.round(value)}%`}</p></div><Icon className="text-indigo-600" size={18} /></div></div>)}</div></section>
    <div className="grid gap-4 lg:grid-cols-2"><div className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold">Teacher observation</h2><p className="mt-2 text-sm leading-6 text-slate-500">{chapter.teacherRemarks || 'No teacher-shared remark is available for this chapter.'}</p></div><div className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold">Student reflection</h2><p className="mt-2 text-sm leading-6 text-slate-500">{chapter.studentRemarks || 'No student reflection is available for this chapter.'}</p></div></div>
    <div className="rounded-2xl border bg-white p-5 dark:border-slate-800 dark:bg-slate-900"><h2 className="font-bold">Learning outcomes and concepts</h2><p className="text-xs text-slate-500">Outcome scores appear only where assessment components have been mapped.</p><div className="mt-4 space-y-2">{(chapter.learningOutcomes || []).map((outcome) => <div key={outcome.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 dark:border-slate-800"><div><p className="text-sm font-semibold">{outcome.title}</p><p className="text-xs text-slate-500">{outcome.assessedComponents} mapped component{outcome.assessedComponents === 1 ? '' : 's'}</p></div><span className={`font-bold ${outcome.score !== null && outcome.score < 60 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>{outcome.score === null ? 'Not assessed' : `${Math.round(outcome.score)}%`}</span></div>)}{!chapter.learningOutcomes?.length && <p className="py-4 text-sm text-slate-500">No learning outcomes have been defined for this chapter.</p>}</div></div>
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-5 dark:border-indigo-900 dark:bg-indigo-950/30"><h2 className="font-bold text-indigo-950 dark:text-indigo-100">Recommended action</h2><p className="mt-1 text-sm text-indigo-800 dark:text-indigo-200">{['WEAK', 'AT_RISK', 'NEEDS_REVISION'].includes(chapter.health.chapterStatus) ? 'Review the available evidence with the subject teacher, revise the chapter, then use a short reassessment to check understanding.' : 'Continue regular practice and revisit the chapter during the next revision cycle.'}</p></div>
  </div></DashboardLayout>;
}
