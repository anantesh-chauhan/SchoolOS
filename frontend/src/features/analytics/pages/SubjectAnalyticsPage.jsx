import React, { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, BookOpen, ClipboardCheck, Download, Gauge, Printer, UserRound } from 'lucide-react';
import DashboardLayout from '../../../layouts/DashboardLayout';
import { authService } from '../../../services/authService';
import { useSubjectAnalytics } from '../hooks/useAnalytics';
import AnalyticsDataCoverage from '../components/AnalyticsDataCoverage';
import ChapterHealthTable from '../components/ChapterHealthTable';
import { AnalyticsError, AnalyticsLoading } from '../components/AnalyticsState';
import { Badge } from '../../../components/ui/badge';
import { label, statusVariant } from '../constants/analyticsStyles';
import { analyticsApi, saveReport } from '../api/analyticsApi';
import { Button } from '../../../components/ui/button';

const filters = ['ALL', 'STRONG', 'WEAK', 'NEEDS_REVISION', 'NOT_ASSESSED', 'ONGOING', 'COMPLETED'];

export default function SubjectAnalyticsPage() {
  const user = authService.getCurrentUser();
  const { studentId, subjectId } = useParams();
  const [filter, setFilter] = useState('ALL');
  const query = useSubjectAnalytics(studentId, subjectId);
  const chapters = useMemo(() => (query.data?.chapters || []).filter((chapter) => {
    const status = chapter.health.chapterStatus;
    if (filter === 'ALL') return true;
    if (filter === 'STRONG') return ['MASTERED', 'COMPLETED'].includes(status);
    if (filter === 'WEAK') return ['WEAK', 'AT_RISK'].includes(status);
    if (filter === 'NOT_ASSESSED') return status === 'INSUFFICIENT_DATA';
    return status === filter || chapter.teachingStatus === filter;
  }), [query.data, filter]);
  if (query.isLoading) return <DashboardLayout role={user?.role}><AnalyticsLoading /></DashboardLayout>;
  if (query.isError) return <DashboardLayout role={user?.role}><AnalyticsError error={query.error} retry={query.refetch} /></DashboardLayout>;
  const { student, subject } = query.data;
  const metrics = [
    [Gauge, 'Current score', subject.score.score === null ? '—' : `${Math.round(subject.score.score)}%`],
    [ClipboardCheck, 'Assessment average', subject.quizAverage === null ? '—' : `${subject.quizAverage}%`],
    [BookOpen, 'Homework completion', subject.homeworkCompletion === null ? '—' : `${subject.homeworkCompletion}%`],
    [UserRound, 'Teacher evaluation', subject.teacherEvaluation === null ? '—' : `${subject.teacherEvaluation}%`],
  ];
  return <DashboardLayout role={user?.role}><div className="space-y-5">
    <header><Link to={`/analytics/students/${studentId}`} className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600"><ArrowLeft size={15} /> {student.name}</Link><div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Subject intelligence</p><h1 className="text-2xl font-bold">{subject.name}</h1><p className="text-sm text-slate-500">{subject.assignedTeacher || 'Teacher not assigned'}</p></div><div className="flex flex-wrap items-center gap-2 print:hidden"><Badge variant={statusVariant[subject.score.subjectStatus]}>{label(subject.score.subjectStatus)}</Badge><Button size="sm" variant="outline" leftIcon={Download} onClick={async () => saveReport(await analyticsApi.subjectReport(studentId, subjectId, 'pdf'), `${subject.name}-analytics.pdf`)}>PDF</Button><Button size="sm" variant="outline" onClick={async () => saveReport(await analyticsApi.subjectReport(studentId, subjectId, 'csv'), `${subject.name}-analytics.csv`)}>CSV</Button><Button size="sm" variant="outline" leftIcon={Printer} onClick={() => window.print()}>Print</Button></div></div></header>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{metrics.map(([Icon, title, value]) => <div key={title} className="rounded-2xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><Icon size={18} className="text-indigo-600" /><p className="mt-3 text-xs uppercase tracking-wider text-slate-500">{title}</p><p className="text-2xl font-bold">{value}</p></div>)}</div>
    <div className="grid gap-3 sm:grid-cols-3"><div className="rounded-xl border bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"><span className="text-slate-500">Class average</span><p className="font-bold">{subject.classAverage === null ? '—' : `${subject.classAverage}%`}</p></div><div className="rounded-xl border bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"><span className="text-slate-500">Difference</span><p className="font-bold">{subject.differenceFromClassAverage === null ? '—' : `${subject.differenceFromClassAverage > 0 ? '+' : ''}${subject.differenceFromClassAverage}%`}</p></div><div className="rounded-xl border bg-white p-3 text-sm dark:border-slate-800 dark:bg-slate-900"><span className="text-slate-500">Rank</span><p className="font-bold">{subject.rankingEnabled ? subject.subjectRank || '—' : 'Disabled by school'}</p></div></div>
    <div className="rounded-2xl border bg-white p-4 dark:border-slate-800 dark:bg-slate-900"><AnalyticsDataCoverage value={subject.score.dataCoverage} /></div>
    <section><div className="mb-3"><h2 className="text-lg font-bold">Chapter performance</h2><p className="text-sm text-slate-500">{subject.weakChapters.length} chapters currently need attention.</p></div><div className="mb-3 flex flex-wrap gap-2">{filters.map((item) => <button key={item} onClick={() => setFilter(item)} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${filter === item ? 'border-indigo-600 bg-indigo-600 text-white' : 'bg-white dark:border-slate-700 dark:bg-slate-900'}`}>{label(item)}</button>)}</div><ChapterHealthTable chapters={chapters} studentId={studentId} subjectId={subjectId} /></section>
  </div></DashboardLayout>;
}
