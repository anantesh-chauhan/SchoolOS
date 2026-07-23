import React from 'react';
import { ArrowRight, BookOpen, TrendingDown, TrendingUp } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { label, statusVariant } from '../constants/analyticsStyles';
import AnalyticsDataCoverage from './AnalyticsDataCoverage';

export default function SubjectPerformanceCard({ subject, studentId }) {
  const score = subject.score?.score;
  const TrendIcon = subject.trend?.change > 0 ? TrendingUp : TrendingDown;
  return (
    <Card hover>
      <CardContent>
        <div className="flex items-start justify-between gap-3"><div className="grid h-10 w-10 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-300"><BookOpen size={19} /></div><Badge variant={statusVariant[subject.score?.subjectStatus]}>{label(subject.score?.subjectStatus)}</Badge></div>
        <div className="mt-4 flex items-end justify-between"><div><h3 className="font-bold">{subject.name}</h3><p className="text-xs text-slate-500">{subject.assignedTeacher || 'Teacher assignment unavailable'}</p></div><p className="text-3xl font-bold">{score === null ? '—' : Math.round(score)}</p></div>
        <div className="mt-4 grid grid-cols-2 gap-2 text-xs"><div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950"><span className="text-slate-500">Weak chapters</span><p className="font-bold">{subject.weakChapters.length}</p></div><div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950"><span className="text-slate-500">Trend</span><p className="flex items-center gap-1 font-bold"><TrendIcon size={13} />{label(subject.trend?.trend)}</p></div></div>
        <div className="mt-4"><AnalyticsDataCoverage compact value={subject.score?.dataCoverage || 0} /></div>
        <Link className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 dark:text-indigo-300" to={`/analytics/students/${studentId}/subjects/${subject.id}`}>Open subject detail <ArrowRight size={15} /></Link>
      </CardContent>
    </Card>
  );
}

