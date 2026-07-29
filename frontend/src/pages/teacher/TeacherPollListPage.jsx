import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Badge, Empty, ErrorState, Loading, PageTitle, Panel, Progress } from '../../components/student/StudentUI';
import { chapterFeedbackService } from '../../services/chapterFeedbackService';

const views = [['assigned', 'Assigned Polls'], ['pending', 'Pending & Drafts'], ['submitted', 'Submitted']];

export default function TeacherPollListPage() {
  const [params] = useSearchParams();
  const view = views.some(([key]) => key === params.get('view')) ? params.get('view') : 'assigned';
  const query = useQuery({ queryKey: ['teacher-polls'], queryFn: chapterFeedbackService.getTeacherPolls });
  const matchesView = (poll) => {
    const submitted = poll.teacherEvaluation?.submitted || 0;
    const total = poll.teacherEvaluation?.total || 0;
    if (view === 'pending') return ['ACTIVE', 'OPEN'].includes(poll.status) && submitted < total;
    if (view === 'submitted') return total > 0 && submitted === total;
    return true;
  };

  return <DashboardLayout role="TEACHER">
    <PageTitle title="Polls & Feedback" description="Rate assigned classes, continue drafts, and review submitted feedback." />
    <nav className="flex gap-2 overflow-x-auto rounded-2xl border bg-white p-2 dark:border-slate-800 dark:bg-slate-900" aria-label="Teacher feedback views">
      {views.map(([key, label]) => <Link key={key} to={`/teacher/polls?view=${key}`} className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold ${view === key ? 'bg-cyan-700 text-white' : 'text-slate-600 dark:text-slate-300'}`}>{label}</Link>)}
    </nav>
    {query.isLoading ? <Loading /> : query.isError ? <ErrorState error={query.error} retry={query.refetch} /> : (() => {
      const rows = query.data.filter(matchesView);
      return rows.length ? <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{rows.map((poll) => {
        const submitted = poll.teacherEvaluation?.submitted || 0;
        const drafted = poll.teacherEvaluation?.drafted || 0;
        const total = poll.teacherEvaluation?.total || 0;
        return <Link key={poll.id} to={`/teacher/polls/${poll.id}`}><Panel className="h-full hover:border-cyan-400"><div className="flex justify-between gap-3"><p className="text-xs font-bold text-cyan-700">Class {poll.class.className} {poll.section.sectionName} · {poll.subject.subjectName}</p><Badge>{poll.status}</Badge></div><h2 className="mt-3 font-black">{poll.title}</h2><p className="text-sm text-slate-500">{poll.chapter.chapterName}</p><div className="mt-4 flex justify-between text-xs"><span>{submitted}/{total} submitted</span><span>{drafted} drafts</span></div><Progress value={total ? submitted / total * 100 : 0} /><p className="mt-3 text-xs font-bold text-cyan-700">{submitted === total && total ? 'View submitted feedback' : drafted ? 'Continue rating' : 'Start class rating'}</p></Panel></Link>;
      })}</div> : <Empty>{view === 'submitted' ? 'No fully submitted class feedback yet.' : view === 'pending' ? 'No active polls require a response.' : 'No feedback polls are assigned to you.'}</Empty>;
    })()}
  </DashboardLayout>;
}
