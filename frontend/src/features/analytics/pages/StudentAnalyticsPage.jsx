import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { BookCheck, CalendarCheck, ClipboardList, Download, ExternalLink, GraduationCap, Printer } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import DashboardLayout from '../../../layouts/DashboardLayout';
import { authService } from '../../../services/authService';
import { useStudentAnalytics } from '../hooks/useAnalytics';
import AcademicHealthCard from '../components/AcademicHealthCard';
import StudentRiskCard from '../components/StudentRiskCard';
import PerformanceTrendChart from '../components/PerformanceTrendChart';
import SubjectPerformanceCard from '../components/SubjectPerformanceCard';
import ChapterHealthTable from '../components/ChapterHealthTable';
import RecommendationList from '../components/RecommendationList';
import InterventionTimeline from '../components/InterventionTimeline';
import { AnalyticsError, AnalyticsLoading } from '../components/AnalyticsState';
import { analyticsApi, saveReport } from '../api/analyticsApi';
import { Button } from '../../../components/ui/button';
import InterventionComposer from '../components/InterventionComposer';

const Metric = ({ icon: Icon, label, value, detail }) => <div className="rounded-2xl border bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"><div className="flex items-start justify-between"><div><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold">{value ?? '—'}</p><p className="mt-1 text-xs text-slate-500">{detail}</p></div><span className="grid h-9 w-9 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/50 dark:text-indigo-300"><Icon size={17} /></span></div></div>;

export default function StudentAnalyticsPage() {
  const user = authService.getCurrentUser();
  const { studentId: routeStudentId } = useParams();
  const studentId = routeStudentId || user?.studentId;
  const query = useStudentAnalytics(studentId);
  if (query.isLoading) return <DashboardLayout role={user?.role}><AnalyticsLoading /></DashboardLayout>;
  if (query.isError) return <DashboardLayout role={user?.role}><AnalyticsError error={query.error} retry={query.refetch} /></DashboardLayout>;
  const data = query.data;
  return (
    <DashboardLayout role={user?.role}>
      <div className="space-y-6">
        <header className="flex flex-col justify-between gap-4 rounded-2xl border bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:flex-row sm:items-center">
          <div className="flex items-center gap-4"><span className="grid h-14 w-14 place-items-center rounded-2xl bg-indigo-600 text-white"><GraduationCap size={26} /></span><div><p className="text-xs font-bold uppercase tracking-wider text-indigo-600">Student 360° academic profile</p><h1 className="text-2xl font-bold">{data.student.name}</h1><p className="text-sm text-slate-500">{data.student.admissionNo || 'No admission number'} · {data.student.className} {data.student.section ? `· Section ${data.student.section}` : ''} · Roll {data.student.rollNumber || '—'}</p></div></div>
          <div className="text-left text-sm sm:text-right"><p className="font-semibold">{data.student.academicSession}</p><p className="text-slate-500">Class teacher: {data.student.classTeacher || 'Not assigned'}</p><p className="mt-1 text-xs text-slate-400">Formula {data.formulaVersion}</p><div className="mt-3 flex flex-wrap gap-2 sm:justify-end print:hidden">{['SCHOOL_OWNER', 'ADMIN'].includes(user?.role) && data.student.academicSessionId && <Button size="sm" variant="outline" onClick={async () => { if (!window.confirm('Create an immutable analytics snapshot from the current evidence?')) return; try { await analyticsApi.createSnapshot({ studentId, academicSessionId: data.student.academicSessionId, snapshotType: 'MANUAL' }); toast.success('Analytics snapshot created'); } catch (error) { toast.error(error.response?.data?.message || 'Snapshot could not be created'); } }}>Create snapshot</Button>}<Button size="sm" variant="outline" leftIcon={Download} onClick={async () => saveReport(await analyticsApi.studentReport(studentId, 'pdf'), `${data.student.name}-analytics.pdf`)}>PDF</Button><Button size="sm" variant="outline" onClick={async () => saveReport(await analyticsApi.studentReport(studentId, 'csv'), `${data.student.name}-analytics.csv`)}>CSV</Button><Button size="sm" variant="outline" leftIcon={Printer} onClick={() => window.print()}>Print</Button></div></div>
        </header>
        <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]"><AcademicHealthCard health={data.academicHealth} /><StudentRiskCard risk={data.risk} /></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={CalendarCheck} label="Attendance" value={data.attendance.percentage === null ? null : `${data.attendance.percentage}%`} detail={`${data.attendance.present} present · ${data.attendance.absent} absent`} />
          <Metric icon={ClipboardList} label="Homework" value={data.homework.percentage === null ? null : `${data.homework.percentage}%`} detail={`${data.homework.missing} missing · ${data.homework.late} late`} />
          <Metric icon={BookCheck} label="Weak chapters" value={data.weakChapters.length} detail={`${data.strongChapters.length} mastered chapters`} />
          <Metric icon={ExternalLink} label="Resource engagement" value={data.resources.score === null ? null : `${data.resources.score}%`} detail={`${data.resources.opened} of ${data.resources.assigned} opened`} />
        </div>
        <PerformanceTrendChart trend={data.performanceTrend} attendance={data.attendance} />
        {data.insights.length > 0 && <section aria-labelledby="evidence-insights"><h2 id="evidence-insights" className="mb-3 text-lg font-bold">Evidence-based insights</h2><div className="grid gap-3 md:grid-cols-2">{data.insights.map((insight) => <div key={insight} className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">{insight}</div>)}</div></section>}
        <section><div className="mb-3 flex items-end justify-between"><div><h2 className="text-lg font-bold">Subject performance</h2><p className="text-sm text-slate-500">Scores use only available subject evidence.</p></div></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{data.subjects.map((subject, index) => <motion.div key={subject.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * .04, .2) }}><SubjectPerformanceCard subject={subject} studentId={studentId} /></motion.div>)}</div>{!data.subjects.length && <div className="rounded-2xl border bg-white p-10 text-center text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900">Subject analytics will appear when curriculum and assessment data are available.</div>}</section>
        <section><div className="mb-3 flex items-end justify-between"><div><h2 className="text-lg font-bold">Chapters requiring attention</h2><p className="text-sm text-slate-500">Review the evidence behind each chapter score.</p></div>{data.weakChapters[0] && <Link className="text-sm font-semibold text-indigo-600" to={`/analytics/students/${studentId}/subjects/${data.weakChapters[0].subjectId}`}>Open subject</Link>}</div><ChapterHealthTable chapters={data.weakChapters} studentId={studentId} /></section>
        {['SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER', 'TEACHER'].includes(user?.role) && <div className="print:hidden"><InterventionComposer studentId={studentId} subjects={data.subjects} chapters={data.chapters} /></div>}
        <div className="grid gap-4 xl:grid-cols-2"><RecommendationList items={data.recommendations} role={user?.role} /><InterventionTimeline items={data.interventions} /></div>
      </div>
    </DashboardLayout>
  );
}
