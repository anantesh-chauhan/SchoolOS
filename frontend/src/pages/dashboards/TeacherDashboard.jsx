import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileText,
  GraduationCap,
  Layers,
  Link as LinkIcon,
  Loader2,
  Plus,
  RefreshCw,
  School,
  Send,
  Users,
} from 'lucide-react';
import DashboardLayout from '../../layouts/DashboardLayout';
import { teacherDashboardService } from '../../services/teacherDashboardService';
import { cloudinaryUploadService } from '../../services/cloudinaryUploadService';
import { chapterFeedbackService } from '../../services/chapterFeedbackService';

const statusStyles = {
  NOT_STARTED: 'bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700',
  ONGOING: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-800',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800',
};

const statusLabels = {
  NOT_STARTED: 'Not Started',
  ONGOING: 'Ongoing',
  COMPLETED: 'Completed',
};

function StatCard({ icon: Icon, label, value }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: reduceMotion ? 0 : -2 }}
      transition={{ duration: 0.24, ease: 'easeOut' }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 text-3xl font-black text-slate-900 dark:text-slate-100">{value ?? 0}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-cyan-50 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-200">
          <Icon size={20} />
        </div>
      </div>
    </motion.div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-5">
      <div className="h-36 rounded-3xl bg-white border border-slate-200 animate-pulse dark:border-slate-800 dark:bg-slate-900" />
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-4">
        {Array.from({ length: 7 }).map((_, index) => (
          <div key={index} className="h-28 rounded-2xl bg-white border border-slate-200 animate-pulse dark:border-slate-800 dark:bg-slate-900" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-44 rounded-2xl bg-white border border-slate-200 animate-pulse dark:border-slate-800 dark:bg-slate-900" />
        ))}
      </div>
    </div>
  );
}

function flattenAssignments(groups) {
  return groups.flatMap((classGroup) =>
    classGroup.sections.flatMap((section) =>
      section.subjects.map((subject) => ({
        ...subject,
        classId: classGroup.classId,
        className: classGroup.className,
        sectionId: section.sectionId,
        sectionName: section.sectionName,
      }))
    )
  );
}

export default function TeacherDashboard() {
  const reduceMotion = useReducedMotion();
  const [dashboard, setDashboard] = useState(null);
  const [assignmentGroups, setAssignmentGroups] = useState([]);
  const [selected, setSelected] = useState(null);
  const [chaptersPayload, setChaptersPayload] = useState(null);
  const [resources, setResources] = useState([]);
  const [polls, setPolls] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [uploadingResource, setUploadingResource] = useState(false);
  const [submittingEvaluationId, setSubmittingEvaluationId] = useState(null);
  const [activeTab, setActiveTab] = useState('Overview');
  const [remarksByChapter, setRemarksByChapter] = useState({});
  const [evaluationForms, setEvaluationForms] = useState({});
  const [resourceForm, setResourceForm] = useState({
    title: '',
    description: '',
    resourceType: 'NOTE',
    externalUrl: '',
    fileUrl: '',
    file: null,
    chapterId: '',
    isVisibleToStudents: true,
  });

  const assignments = useMemo(() => flattenAssignments(assignmentGroups), [assignmentGroups]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardData, assignmentData] = await Promise.all([
        teacherDashboardService.getDashboard(),
        teacherDashboardService.getAssignments(),
      ]);
      setDashboard(dashboardData);
      setAssignmentGroups(assignmentData);
      const first = flattenAssignments(assignmentData)[0] || null;
      setSelected((current) => current || first);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load teacher dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadDetails = useCallback(async (target) => {
    if (!target) return;
    setDetailLoading(true);
    try {
      const [chapterData, resourceData] = await Promise.all([
        teacherDashboardService.getChapters({ sectionId: target.sectionId, subjectId: target.subjectId }),
        teacherDashboardService.getResources({ sectionId: target.sectionId, subjectId: target.subjectId }),
      ]);
      setChaptersPayload(chapterData);
      setResources(resourceData);
      setRemarksByChapter(Object.fromEntries((chapterData.chapters || []).map((chapter) => [chapter.chapterId, chapter.remarks || ''])));
    } catch (error) {
      setChaptersPayload(null);
      toast.error(error.response?.data?.message || 'You are not assigned to this section or subject.');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const loadPolls = useCallback(async () => {
    try {
      setPolls(await chapterFeedbackService.getTeacherPolls());
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to load chapter feedback polls');
    }
  }, []);

  useEffect(() => {
    load();
    loadPolls();
  }, [load, loadPolls]);

  useEffect(() => {
    loadDetails(selected);
  }, [selected, loadDetails]);

  const updateProgress = async (chapter, status) => {
    if (!selected) return;
    try {
      await teacherDashboardService.updateProgress({
        classId: selected.classId,
        sectionId: selected.sectionId,
        subjectId: selected.subjectId,
        chapterId: chapter.chapterId,
        status,
        remarks: remarksByChapter[chapter.chapterId] || '',
      });
      toast.success('Chapter progress updated');
      await Promise.all([loadDetails(selected), load()]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to update progress');
    }
  };

  const createResource = async (event) => {
    event.preventDefault();
    if (!selected || !resourceForm.title.trim()) return;
    setUploadingResource(true);
    try {
      let fileUrl = resourceForm.fileUrl;
      let resourceType = resourceForm.resourceType;

      if (resourceForm.file) {
        const signature = await cloudinaryUploadService.getSectionResourceSignature({
          classId: selected.classId,
          sectionId: selected.sectionId,
          subjectId: selected.subjectId,
        });
        const uploaded = await cloudinaryUploadService.uploadToCloudinary(resourceForm.file, signature.data);
        fileUrl = uploaded.secure_url;
        if (resourceForm.file.type?.startsWith('image/')) resourceType = 'IMAGE';
        else if (resourceForm.file.type?.startsWith('video/')) resourceType = 'VIDEO';
        else if (resourceForm.file.type === 'application/pdf') resourceType = 'PDF';
      }

      await teacherDashboardService.createResource({
        ...resourceForm,
        file: undefined,
        fileUrl,
        resourceType,
        classId: selected.classId,
        sectionId: selected.sectionId,
        subjectId: selected.subjectId,
        chapterId: resourceForm.chapterId || null,
      });
      toast.success('Resource shared');
      setResourceForm({
        title: '',
        description: '',
        resourceType: 'NOTE',
        externalUrl: '',
        fileUrl: '',
        file: null,
        chapterId: '',
        isVisibleToStudents: true,
      });
      await Promise.all([loadDetails(selected), load()]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to share resource');
    } finally {
      setUploadingResource(false);
    }
  };

  const deleteResource = async (resourceId) => {
    try {
      await teacherDashboardService.deleteResource(resourceId);
      toast.success('Resource deleted');
      await Promise.all([loadDetails(selected), load()]);
    } catch (error) {
      toast.error(error.response?.data?.message || 'You do not have permission to manage this resource.');
    }
  };

  const setEvaluationField = (pollId, studentId, field, value) => {
    setEvaluationForms((prev) => ({
      ...prev,
      [pollId]: {
        ...(prev[pollId] || {}),
        [studentId]: {
          attentionRating: 4,
          participationRating: 4,
          homeworkRating: 4,
          conceptClarityRating: 4,
          improvementNeedRating: 2,
          strengths: '',
          weaknesses: '',
          recommendation: '',
          ...((prev[pollId] || {})[studentId] || {}),
          [field]: value,
        },
      },
    }));
  };

  const submitEvaluations = async (poll) => {
    const rows = (poll.students || []).map((student) => ({
      studentId: student.id,
      attentionRating: 4,
      participationRating: 4,
      homeworkRating: 4,
      conceptClarityRating: 4,
      improvementNeedRating: 2,
      strengths: '',
      weaknesses: '',
      recommendation: '',
      ...((evaluationForms[poll.id] || {})[student.id] || {}),
    }));
    setSubmittingEvaluationId(poll.id);
    try {
      await chapterFeedbackService.submitTeacherEvaluations(poll.id, rows);
      toast.success('Student evaluations submitted');
      await loadPolls();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to submit evaluations');
    } finally {
      setSubmittingEvaluationId(null);
    }
  };

  const today = new Intl.DateTimeFormat('en-IN', { dateStyle: 'full' }).format(new Date());

  if (loading) {
    return (
      <DashboardLayout role="TEACHER">
        <Skeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="TEACHER">
      <motion.div initial={{ opacity: 0, y: reduceMotion ? 0 : 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28 }} className="space-y-6">
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-cyan-100 bg-cyan-50 px-3 py-1 text-xs font-bold text-cyan-700 dark:border-cyan-800 dark:bg-cyan-950/50 dark:text-cyan-200">
                  <GraduationCap size={14} />
                  Teacher
                </span>
                <span className="text-sm text-slate-500 dark:text-slate-400">{today}</span>
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 dark:text-slate-100">
                Welcome, {dashboard?.teacher?.name || 'Teacher'}
              </h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                {dashboard?.school?.schoolName || 'SchoolOS'} · Manage your assigned sections and subjects
              </p>
            </div>
            <button
              type="button"
              onClick={load}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 shadow-sm transition-all hover:scale-[1.02] hover:bg-slate-50 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-7 gap-4">
          <StatCard icon={School} label="Assigned Classes" value={dashboard?.stats?.assignedClasses} />
          <StatCard icon={Users} label="Assigned Sections" value={dashboard?.stats?.assignedSections} />
          <StatCard icon={Layers} label="Assigned Subjects" value={dashboard?.stats?.assignedSubjects} />
          <StatCard icon={CheckCircle2} label="Completed" value={dashboard?.stats?.completedChapters} />
          <StatCard icon={BookOpenCheck} label="Ongoing" value={dashboard?.stats?.ongoingChapters} />
          <StatCard icon={ClipboardList} label="Pending" value={dashboard?.stats?.pendingChapters} />
          <StatCard icon={FileText} label="Resources" value={dashboard?.stats?.totalSharedResources} />
        </section>

        {assignments.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center dark:border-slate-700 dark:bg-slate-900">
            <p className="text-base font-bold text-slate-900 dark:text-slate-100">No assignments found. Please contact your school admin.</p>
          </div>
        ) : (
          <section className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.35fr] gap-5">
            <div className="space-y-4">
              <div>
                <h2 className="text-lg font-black text-slate-950 dark:text-slate-100">My Teaching Assignments</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Select a class-section-subject to manage chapters and resources.</p>
              </div>
              <div className="grid grid-cols-1 gap-4">
                {assignments.map((assignment) => (
                  <button
                    key={`${assignment.classId}-${assignment.sectionId}-${assignment.subjectId}`}
                    type="button"
                    onClick={() => {
                      setSelected(assignment);
                      setActiveTab('Chapters');
                    }}
                    className={`rounded-2xl border bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md active:scale-[0.99] dark:bg-slate-900 ${
                      selected?.sectionId === assignment.sectionId && selected?.subjectId === assignment.subjectId
                        ? 'border-cyan-300 ring-2 ring-cyan-100 dark:border-cyan-600 dark:ring-cyan-950'
                        : 'border-slate-200 dark:border-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-950 dark:text-slate-100">{assignment.className} · Section {assignment.sectionName}</p>
                        <p className="mt-1 text-sm font-semibold text-cyan-700 dark:text-cyan-300">{assignment.subjectName}</p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
                        {assignment.roleType.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                        <span>{assignment.completedChapters}/{assignment.totalChapters} completed</span>
                        <span>{assignment.progressPercentage}%</span>
                      </div>
                      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><motion.div className="h-full rounded-full bg-cyan-600 dark:bg-cyan-400" initial={{ width: 0 }} animate={{ width: `${assignment.progressPercentage}%` }} transition={{ duration: reduceMotion ? 0 : 0.32, ease: 'easeOut' }} /></div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-xl bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-200">View Chapters</span>
                      <span className="rounded-xl bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-200">Share Resource</span>
                      <span className="rounded-xl bg-slate-50 px-3 py-1.5 text-xs font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-300">View Resources</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="border-b border-slate-200 p-4 dark:border-slate-800">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      Dashboard / {selected?.className} / Section {selected?.sectionName} / {selected?.subjectName}
                    </p>
                    <h2 className="mt-1 text-xl font-black text-slate-950 dark:text-slate-100">{activeTab}</h2>
                  </div>
                  <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
                    {['Overview', 'Chapters', 'Resources', 'Feedback', 'Students'].map((tab) => (
                      <button
                        key={tab}
                        type="button"
                        onClick={() => setActiveTab(tab)}
                        className={`rounded-lg px-3 py-2 text-xs font-bold transition-all active:scale-[0.97] ${activeTab === tab ? 'bg-white text-cyan-700 shadow-sm dark:bg-slate-800 dark:text-cyan-200' : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'}`}
                      >
                        {tab}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-4">
                {detailLoading ? (
                  <div className="flex h-56 items-center justify-center text-slate-500 dark:text-slate-400">
                    <Loader2 className="mr-2 animate-spin" size={18} />
                    Loading assigned data...
                  </div>
                ) : activeTab === 'Overview' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <StatCard icon={CheckCircle2} label="Completed" value={selected?.completedChapters} />
                    <StatCard icon={BookOpenCheck} label="Ongoing" value={selected?.ongoingChapters} />
                    <StatCard icon={ClipboardList} label="Pending" value={selected?.pendingChapters} />
                  </div>
                ) : activeTab === 'Chapters' ? (
                  <div className="space-y-3">
                    {(chaptersPayload?.chapters || []).length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                        No chapters added for this subject yet.
                      </div>
                    )}
                    {(chaptersPayload?.chapters || []).map((chapter) => (
                      <motion.div key={chapter.chapterId} initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Chapter {chapter.chapterOrder}</p>
                            <h3 className="mt-1 text-base font-black text-slate-950 dark:text-slate-100">{chapter.chapterName}</h3>
                            {chapter.completedAt && (
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Completed {new Date(chapter.completedAt).toLocaleDateString()}</p>
                            )}
                          </div>
                          <span className={`w-fit rounded-full border px-3 py-1 text-xs font-bold ${statusStyles[chapter.status]}`}>
                            {statusLabels[chapter.status]}
                          </span>
                        </div>
                        <textarea
                          value={remarksByChapter[chapter.chapterId] || ''}
                          onChange={(event) => setRemarksByChapter((prev) => ({ ...prev, [chapter.chapterId]: event.target.value }))}
                          placeholder="Add or edit remarks"
                          className="mt-4 min-h-[76px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-cyan-950"
                        />
                        <div className="mt-3 flex flex-wrap gap-2">
                          {['NOT_STARTED', 'ONGOING', 'COMPLETED'].map((status) => (
                            <button
                              key={status}
                              type="button"
                              onClick={() => updateProgress(chapter, status)}
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700 active:scale-[0.97] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-cyan-700 dark:hover:text-cyan-200"
                            >
                              Mark {statusLabels[status]}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => {
                              setResourceForm((prev) => ({ ...prev, chapterId: chapter.chapterId }));
                              setActiveTab('Resources');
                            }}
                            className="inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-3 py-2 text-xs font-bold text-white transition hover:scale-[1.02] hover:bg-cyan-700 active:scale-[0.97]"
                          >
                            <Send size={14} />
                            Share Resource
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : activeTab === 'Resources' ? (
                  <div className="space-y-5">
                    <form onSubmit={createResource} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-cyan-950" placeholder="Resource title" value={resourceForm.title} onChange={(event) => setResourceForm((prev) => ({ ...prev, title: event.target.value }))} />
                        <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950" value={resourceForm.resourceType} onChange={(event) => setResourceForm((prev) => ({ ...prev, resourceType: event.target.value }))}>
                          {['NOTE', 'LINK', 'PDF', 'IMAGE', 'VIDEO', 'ASSIGNMENT', 'OTHER'].map((type) => <option key={type}>{type}</option>)}
                        </select>
                        <input className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-cyan-950" placeholder="External URL" value={resourceForm.externalUrl} onChange={(event) => setResourceForm((prev) => ({ ...prev, externalUrl: event.target.value }))} />
                        <input className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-cyan-950" placeholder="File URL" value={resourceForm.fileUrl} onChange={(event) => setResourceForm((prev) => ({ ...prev, fileUrl: event.target.value }))} />
                        <input className="h-11 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100" type="file" accept=".pdf,image/*,video/*" onChange={(event) => setResourceForm((prev) => ({ ...prev, file: event.target.files?.[0] || null }))} />
                        <select className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:ring-cyan-950" value={resourceForm.chapterId} onChange={(event) => setResourceForm((prev) => ({ ...prev, chapterId: event.target.value }))}>
                          <option value="">Attach to subject</option>
                          {(chaptersPayload?.chapters || []).map((chapter) => <option key={chapter.chapterId} value={chapter.chapterId}>{chapter.chapterOrder}. {chapter.chapterName}</option>)}
                        </select>
                        <label className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                          <input type="checkbox" checked={resourceForm.isVisibleToStudents} onChange={(event) => setResourceForm((prev) => ({ ...prev, isVisibleToStudents: event.target.checked }))} />
                          Visible to students
                        </label>
                      </div>
                      <textarea className="mt-3 min-h-[72px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 transition focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:ring-cyan-950" placeholder="Description or note" value={resourceForm.description} onChange={(event) => setResourceForm((prev) => ({ ...prev, description: event.target.value }))} />
                      <button type="submit" disabled={uploadingResource} className="mt-3 inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-600 px-4 text-sm font-bold text-white transition hover:scale-[1.02] hover:bg-cyan-700 active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100">
                        {uploadingResource ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                        {uploadingResource ? 'Uploading...' : 'Add Resource'}
                      </button>
                    </form>

                    {resources.length === 0 ? (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                        No resources shared yet.
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {resources.map((resource) => (
                          <motion.div key={resource.id} initial={{ opacity: 0, y: reduceMotion ? 0 : 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.24 }} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-black text-slate-950 dark:text-slate-100">{resource.title}</p>
                                <p className="mt-1 text-xs font-bold text-slate-500">{resource.resourceType} · {resource.chapter?.chapterName || 'Subject resource'}</p>
                              </div>
                              <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                {resource.isVisibleToStudents ? 'Students' : 'Private'}
                              </span>
                            </div>
                            {resource.description && <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">{resource.description}</p>}
                            <div className="mt-4 flex flex-wrap gap-2">
                              {(resource.externalUrl || resource.fileUrl) && (
                                <a className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-cyan-700 transition hover:bg-cyan-50 dark:border-slate-700 dark:text-cyan-300 dark:hover:bg-cyan-950/40" href={resource.externalUrl || resource.fileUrl} target="_blank" rel="noreferrer">
                                  {resource.externalUrl ? <ExternalLink size={14} /> : <LinkIcon size={14} />}
                                  Open
                                </a>
                              )}
                              <button type="button" onClick={() => deleteResource(resource.id)} className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold text-rose-700 transition hover:bg-rose-50 active:scale-[0.97] dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-950/40">
                                Delete
                              </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : activeTab === 'Feedback' ? (
                  <div className="space-y-4">
                    {polls.length === 0 && (
                      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                        No chapter feedback polls assigned yet.
                      </div>
                    )}
                    {polls.map((poll) => (
                      <div key={poll.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">{poll.class?.className} · Section {poll.section?.sectionName} · {poll.subject?.subjectName}</p>
                            <h3 className="mt-1 text-base font-black text-slate-950 dark:text-slate-100">{poll.chapter?.chapterName}</h3>
                            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                              Teacher evaluations: {poll.teacherEvaluation?.submitted || 0}/{poll.teacherEvaluation?.total || 0}
                            </p>
                          </div>
                          <span className="w-fit rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                            {poll.status}
                          </span>
                        </div>
                        {['ACTIVE', 'CLOSED'].includes(poll.status) ? (
                          <div className="mt-4 space-y-3">
                            {(poll.students || []).map((student) => {
                              const form = (evaluationForms[poll.id] || {})[student.id] || {};
                              return (
                                <div key={student.id} className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <p className="text-sm font-black text-slate-950 dark:text-slate-100">{student.rollNumber || '-'} · {student.name}</p>
                                    <div className="flex flex-wrap gap-2">
                                      {['Excellent', 'Needs Revision', 'Low Participation', 'Strong Concepts', 'Homework Pending'].map((tag) => (
                                        <button key={tag} type="button" onClick={() => setEvaluationField(poll.id, student.id, 'recommendation', tag)} className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600 hover:bg-cyan-50 hover:text-cyan-700 dark:bg-slate-800 dark:text-slate-300">
                                          {tag}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                  <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
                                    {[
                                      ['attentionRating', 'Attention'],
                                      ['participationRating', 'Participation'],
                                      ['homeworkRating', 'Homework'],
                                      ['conceptClarityRating', 'Concepts'],
                                      ['improvementNeedRating', 'Needs Help'],
                                    ].map(([field, text]) => (
                                      <label key={field} className="text-xs font-bold text-slate-500 dark:text-slate-400">
                                        {text}
                                        <select value={form[field] || (field === 'improvementNeedRating' ? 2 : 4)} onChange={(event) => setEvaluationField(poll.id, student.id, field, Number(event.target.value))} className="mt-1 h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
                                          {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                                        </select>
                                      </label>
                                    ))}
                                  </div>
                                  <div className="mt-3 grid grid-cols-1 md:grid-cols-3 gap-2">
                                    {[
                                      ['strengths', 'Strengths'],
                                      ['weaknesses', 'Weaknesses'],
                                      ['recommendation', 'Recommendation'],
                                    ].map(([field, placeholder]) => (
                                      <input key={field} value={form[field] || ''} onChange={(event) => setEvaluationField(poll.id, student.id, field, event.target.value)} placeholder={placeholder} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-cyan-400 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
                                    ))}
                                  </div>
                                </div>
                              );
                            })}
                            <button type="button" onClick={() => submitEvaluations(poll)} disabled={submittingEvaluationId === poll.id} className="inline-flex h-10 items-center gap-2 rounded-xl bg-cyan-600 px-4 text-sm font-bold text-white transition hover:bg-cyan-700 disabled:opacity-60">
                              {submittingEvaluationId === poll.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                              Submit Evaluations
                            </button>
                          </div>
                        ) : (
                          <p className="mt-4 rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                            Evaluations open after admin activates the poll. Student votes are never shown here.
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">
                    Student list access is controlled by school policy. Assigned section students can be connected here when enabled.
                  </div>
                )}
              </div>
            </div>
          </section>
        )}
      </motion.div>
    </DashboardLayout>
  );
}

