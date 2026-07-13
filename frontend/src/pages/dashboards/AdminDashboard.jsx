import React, { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';


import { BarChart3, Calendar, CheckCircle, Loader2, Play, Send, Users, Users2 } from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { SummaryCard } from '../../components/DashboardCards';
import { chapterFeedbackService } from '../../services/chapterFeedbackService';
import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../../services/dashboardService';
import { useBranding } from '../../contexts/BrandingContext';

export default function AdminDashboard() {
  const { branding } = useBranding();
  const [user] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || '{}');
    } catch (error) {
      return {};
    }
  });
  const [completionQueue, setCompletionQueue] = useState([]);
  const [polls, setPolls] = useState([]);
  const [feedbackLoading, setFeedbackLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const dashboardQuery = useQuery({ queryKey: ['dashboard-summary', 'admin'], queryFn: dashboardService.summary });

  const loadFeedback = useCallback(async () => {
    setFeedbackLoading(true);
    try {
      const [queueRows, pollRows] = await Promise.all([
        chapterFeedbackService.getAdminCompletions(),
        chapterFeedbackService.getAdminPolls(),
      ]);
      setCompletionQueue(queueRows);
      setPolls(pollRows);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load chapter feedback analysis');
    } finally {
      setFeedbackLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFeedback();
  }, [loadFeedback]);

  const stats = dashboardQuery.data?.stats || {};

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: {
      opacity: 1,
      y: 0,
      transition: { duration: 0.5 },
    },
  };

  const createPoll = async (row, activate = false) => {
    setBusyId(row.id);
    try {
      await chapterFeedbackService.createPoll({
        classId: row.classId,
        sectionId: row.sectionId,
        subjectId: row.subjectId,
        chapterId: row.chapterId,
        status: activate ? 'ACTIVE' : 'DRAFT',
      });
      toast.success(activate ? 'Poll created and activated' : 'Poll created as draft');
      await loadFeedback();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to create poll');
    } finally {
      setBusyId(null);
    }
  };

  const setPollStatus = async (poll, status) => {
    if (!window.confirm(`Change poll status to ${status}?`)) return;
    setBusyId(poll.id);
    try {
      await chapterFeedbackService.updatePollStatus(poll.id, status);
      toast.success(`Poll marked ${status.toLowerCase()}`);
      await loadFeedback();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update poll');
    } finally {
      setBusyId(null);
    }
  };

  const compilePoll = async (poll) => {
    if (!window.confirm('Compile and save the final chapter analysis?')) return;
    setBusyId(poll.id);
    try {
      await chapterFeedbackService.compilePoll(poll.id, { recompile: poll.status === 'COMPILED' || poll.status === 'PUBLISHED' });
      toast.success('Analysis compiled');
      await loadFeedback();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to compile analysis');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <DashboardLayout role="ADMIN">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-6"
      >
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="h-2 brand-bg-primary" />
          <div className="flex flex-col justify-between gap-5 p-6 lg:flex-row lg:items-center">
            <div className="flex items-center gap-4">
              {branding.logoUrl ? <img src={branding.logoUrl} alt="School logo" className="h-14 w-14 rounded-2xl object-cover" /> : <span className="flex h-14 w-14 items-center justify-center rounded-2xl brand-bg-primary text-xl font-black text-white">{branding.schoolName?.[0] || 'S'}</span>}
              <div><p className="text-sm font-bold brand-text-primary">School administration</p><h1 className="text-3xl font-black text-slate-950 dark:text-white">Welcome, {user.name}</h1><p className="mt-1 text-sm text-slate-500">{branding.schoolName} · Daily academic and operational control</p></div>
            </div>
            <Link to="/dashboard/admin/students/add" className="inline-flex h-11 items-center justify-center rounded-xl brand-bg-primary px-5 text-sm font-bold text-white">Add student</Link>
          </div>
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Users className="w-8 h-8" />}
              label="Total Students"
              value={dashboardQuery.isLoading ? '…' : stats.totalStudents || 0}
              color="blue"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Users2 className="w-8 h-8" />}
              label="Total Staff"
              value={dashboardQuery.isLoading ? '…' : stats.totalStaff || 0}
              color="purple"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<Calendar className="w-8 h-8" />}
              label="Today's Attendance"
              value={dashboardQuery.isLoading ? '…' : stats.todayPresent || 0}
              color="green"
            />
          </motion.div>

          <motion.div variants={itemVariants}>
            <SummaryCard
              icon={<CheckCircle className="w-8 h-8" />}
              label="Attendance Rate"
              value={dashboardQuery.isLoading ? '…' : `${stats.attendanceRate || 0}%`}
              color="orange"
            />
          </motion.div>
        </div>

        {/* Today's Overview */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Today's Overview
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div>
                <p className="font-semibold text-green-900 dark:text-green-100">Present</p>
                <p className="text-sm text-green-600 dark:text-green-300">{stats.todayPresent || 0} of {stats.todayMarked || 0} marked students</p>
              </div>
              <span className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.attendanceRate}%</span>
            </div>
            <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div>
                <p className="font-semibold text-blue-900 dark:text-blue-100">Classes Today</p>
                <p className="text-sm text-blue-600 dark:text-blue-300">All classes in session</p>
              </div>
              <span className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.totalClasses || 0}</span>
            </div>
          </div>
        </motion.div>

        {/* Admin Actions */}
        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Admin Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Link to="/dashboard/admin/classes" className="block p-4 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-blue-900 dark:text-blue-100">Class Management</p>
              <p className="text-sm text-blue-600 dark:text-blue-300 mt-1">Add and delete classes</p>
            </Link>
            <Link to="/dashboard/admin/sections" className="block p-4 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-purple-900 dark:text-purple-100">Section Management</p>
              <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">Auto-sequential sections</p>
            </Link>
            <Link to="/dashboard/admin/subjects" className="block p-4 bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-green-900 dark:text-green-100">Subject Management</p>
              <p className="text-sm text-green-600 dark:text-green-300 mt-1">Assign subjects to class/section</p>
            </Link>
            <Link to="/dashboard/admin/subject-assignment" className="block p-4 bg-amber-50 dark:bg-amber-900/20 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-amber-900 dark:text-amber-100">Subject Assignment</p>
              <p className="text-sm text-amber-600 dark:text-amber-300 mt-1">Bulk and section-level mapping</p>
            </Link>
            <Link to="/dashboard/admin/teachers" className="block p-4 bg-cyan-50 dark:bg-cyan-900/20 hover:bg-cyan-100 dark:hover:bg-cyan-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-cyan-900 dark:text-cyan-100">Teacher Management</p>
              <p className="text-sm text-cyan-600 dark:text-cyan-300 mt-1">Add, edit, search and track load</p>
            </Link>
            <Link to="/dashboard/admin/teacher-assignment" className="block p-4 bg-rose-50 dark:bg-rose-900/20 hover:bg-rose-100 dark:hover:bg-rose-900/30 rounded-lg transition text-left">
              <p className="font-semibold text-rose-900 dark:text-rose-100">Teacher Assignment</p>
              <p className="text-sm text-rose-600 dark:text-rose-300 mt-1">Assign teacher to section subjects</p>
            </Link>
          </div>
        </motion.div>

        <motion.div variants={itemVariants} className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow">
          <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Chapter Understanding & Teaching Feedback Analysis
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Create polls after teacher completion, monitor counts, compile summaries, and publish only final analysis.
              </p>
            </div>
            <button type="button" onClick={loadFeedback} className="inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 px-3 text-sm font-bold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-200 dark:hover:bg-gray-700">
              <BarChart3 size={16} />
              Refresh
            </button>
          </div>

          {feedbackLoading ? (
            <div className="mt-5 flex h-32 items-center justify-center rounded-xl border border-gray-200 text-gray-500 dark:border-gray-700">
              <Loader2 className="mr-2 animate-spin" size={18} />
              Loading feedback flow...
            </div>
          ) : (
            <div className="mt-5 grid grid-cols-1 xl:grid-cols-2 gap-5">
              <div>
                <h4 className="font-black text-gray-900 dark:text-white">Chapter Completion Queue</h4>
                <div className="mt-3 space-y-3">
                  {completionQueue.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm font-semibold text-gray-500 dark:border-gray-700">
                      No completed chapters waiting for poll creation.
                    </div>
                  )}
                  {completionQueue.map((row) => (
                    <div key={row.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                      <p className="font-black text-gray-900 dark:text-white">{row.chapter?.chapterName}</p>
                      <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">
                        {row.class?.className} · Section {row.section?.sectionName} · {row.subject?.subjectName} · {row.teacher?.teacherName || 'Teacher'}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button type="button" onClick={() => createPoll(row, false)} disabled={busyId === row.id} className="inline-flex h-9 items-center gap-2 rounded-lg border border-indigo-200 bg-white px-3 text-xs font-bold text-indigo-700 hover:bg-indigo-50 disabled:opacity-60">
                          {busyId === row.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                          Create Draft
                        </button>
                        <button type="button" onClick={() => createPoll(row, true)} disabled={busyId === row.id} className="inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-xs font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
                          <Play size={14} />
                          Create & Activate
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="font-black text-gray-900 dark:text-white">Poll Management</h4>
                <div className="mt-3 space-y-3">
                  {polls.length === 0 && (
                    <div className="rounded-xl border border-dashed border-gray-300 p-5 text-center text-sm font-semibold text-gray-500 dark:border-gray-700">
                      No polls created yet.
                    </div>
                  )}
                  {polls.map((poll) => {
                    const total = poll.counts?.totalStudents || 0;
                    const votes = poll.counts?.studentVotesSubmitted || 0;
                    const evaluations = poll.counts?.teacherEvaluationsSubmitted || 0;
                    const progress = total ? Math.round((votes / total) * 100) : 0;
                    return (
                      <div key={poll.id} className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-gray-900/40">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-black text-gray-900 dark:text-white">{poll.chapter?.chapterName}</p>
                            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{poll.subject?.subjectName} · {poll.class?.className}-{poll.section?.sectionName}</p>
                          </div>
                          <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">{poll.status}</span>
                        </div>
                        <div className="mt-3">
                          <div className="flex justify-between text-xs font-bold text-gray-500">
                            <span>Student votes {votes}/{total}</span>
                            <span>Teacher evals {evaluations}/{total}</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                            <div className="h-full rounded-full bg-indigo-600" style={{ width: `${progress}%` }} />
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {poll.status === 'DRAFT' && <button type="button" onClick={() => setPollStatus(poll, 'ACTIVE')} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">Activate</button>}
                          {poll.status === 'ACTIVE' && <button type="button" onClick={() => setPollStatus(poll, 'CLOSED')} className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-bold text-white">Close</button>}
                          {['CLOSED', 'COMPILED', 'PUBLISHED'].includes(poll.status) && <button type="button" onClick={() => compilePoll(poll)} disabled={busyId === poll.id} className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-60">Compile</button>}
                          {poll.status === 'COMPILED' && <button type="button" onClick={() => setPollStatus(poll, 'PUBLISHED')} className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-bold text-white">Publish</button>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </DashboardLayout>
  );
}
