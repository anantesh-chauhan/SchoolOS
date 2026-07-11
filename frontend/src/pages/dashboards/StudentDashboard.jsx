import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, BookOpen, CheckCircle2, FileText, Loader2, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { studentAcademicsService } from '../../services/studentAcademicsService';
import { chapterFeedbackService } from '../../services/chapterFeedbackService';

const statusClass = {
  NOT_STARTED: 'bg-slate-50 text-slate-700 border-slate-200',
  ONGOING: 'bg-amber-50 text-amber-700 border-amber-200',
  COMPLETED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

const label = (status) => String(status || 'NOT_STARTED').replace(/_/g, ' ');

function Stat({ icon: Icon, label: text, value }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{text}</p>
          <p className="mt-2 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
          <Icon size={20} />
        </div>
      </div>
    </div>
  );
}

export default function StudentDashboard() {
  const [payload, setPayload] = useState(null);
  const [polls, setPolls] = useState([]);
  const [masteryRows, setMasteryRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submittingPollId, setSubmittingPollId] = useState(null);
  const [voteForms, setVoteForms] = useState({});

  useEffect(() => {
    Promise.all([
      studentAcademicsService.getMyAcademics(),
      chapterFeedbackService.getStudentPolls(),
      chapterFeedbackService.getStudentMastery(),
    ])
      .then(([academics, pollRows, mastery]) => {
        setPayload(academics);
        setPolls(pollRows);
        setMasteryRows(mastery);
      })
      .catch((error) => toast.error(error.response?.data?.message || 'Unable to load student dashboard'))
      .finally(() => setLoading(false));
  }, []);

  const chapters = useMemo(() => (payload?.subjects || []).flatMap((subject) => subject.chapters || []), [payload]);
  const completed = chapters.filter((chapter) => chapter.status === 'COMPLETED').length;
  const ongoing = chapters.filter((chapter) => chapter.status === 'ONGOING').length;
  const pendingPolls = polls.filter((poll) => poll.status === 'ACTIVE' && !poll.submitted);
  const reliableMastery = masteryRows.filter((row) => Number.isFinite(row.score));
  const averageMastery = reliableMastery.length
    ? Math.round(reliableMastery.reduce((sum, row) => sum + row.score, 0) / reliableMastery.length)
    : null;

  const setVoteField = (pollId, field, value) => {
    setVoteForms((prev) => ({
      ...prev,
      [pollId]: {
        understandingRating: 4,
        difficultyRating: 3,
        confidenceRating: 4,
        teachingRating: 4,
        paceRating: 4,
        clarityRating: 4,
        comment: '',
        ...(prev[pollId] || {}),
        [field]: value,
      },
    }));
  };

  const submitVote = async (pollId) => {
    setSubmittingPollId(pollId);
    try {
      await chapterFeedbackService.submitStudentVote(pollId, voteForms[pollId] || {
        understandingRating: 4,
        difficultyRating: 3,
        confidenceRating: 4,
        teachingRating: 4,
        paceRating: 4,
        clarityRating: 4,
        comment: '',
      });
      toast.success('Your response has been submitted. Results will be visible after admin compilation.');
      const freshPolls = await chapterFeedbackService.getStudentPolls();
      setPolls(freshPolls);
    } catch (error) {
      toast.error(error.response?.data?.message || 'Unable to submit poll');
    } finally {
      setSubmittingPollId(null);
    }
  };

  return (
    <DashboardLayout role="STUDENT">
      {loading ? (
        <div className="flex h-80 items-center justify-center rounded-3xl border border-slate-200 bg-white text-slate-500">
          <Loader2 className="mr-2 animate-spin" size={18} />
          Loading your section academics...
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-bold text-indigo-700">{payload?.school?.schoolName}</p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">Welcome, {payload?.student?.name || 'Student'}</h1>
            <p className="mt-2 text-sm text-slate-600">
              {payload?.student?.className} · Section {payload?.student?.sectionName || '-'} · Your section subjects, progress, and visible resources
            </p>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Stat icon={BookOpen} label="Subjects" value={payload?.subjects?.length || 0} />
            <Stat icon={FileText} label="Chapters" value={chapters.length} />
            <Stat icon={CheckCircle2} label="Completed" value={completed} />
            <Stat icon={Bell} label="Pending Polls" value={pendingPolls.length} />
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-950">My Chapter Mastery</h2>
                <p className="mt-1 text-sm text-slate-500">Scores appear only when enough chapter evidence has been collected.</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">
                {averageMastery === null ? 'Insufficient data' : `${averageMastery}% average`}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-1 gap-3 xl:grid-cols-2">
              {masteryRows.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-600">
                  No mastery summaries have been published for your chapters yet.
                </div>
              )}
              {masteryRows.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-black text-slate-950">{row.subject?.subjectName} · {row.chapter?.chapterName}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {row.masteryLevel?.replace(/_/g, ' ') || 'INSUFFICIENT DATA'} · {row.confidence?.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <span className="rounded-xl border border-indigo-100 bg-white px-3 py-1 text-sm font-black text-indigo-700">
                      {Number.isFinite(row.score) ? `${Math.round(row.score)}%` : '--'}
                    </span>
                  </div>
                  {row.summary && <p className="mt-3 text-sm leading-6 text-slate-700">{row.summary}</p>}
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                    <div className="h-full rounded-full bg-indigo-600" style={{ width: `${Math.max(0, Math.min(100, row.score || 0))}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-slate-950">Chapter Understanding Polls</h2>
                <p className="mt-1 text-sm text-slate-500">Raw responses stay private. Summaries appear only after admin publishes them.</p>
              </div>
              <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold text-indigo-700">{pendingPolls.length} pending</span>
            </div>
            <div className="mt-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
              {polls.length === 0 && (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-600">
                  No active chapter polls right now.
                </div>
              )}
              {polls.map((poll) => {
                const form = voteForms[poll.id] || {};
                return (
                  <div key={poll.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-black text-slate-950">{poll.subject?.subjectName} · {poll.chapter?.chapterName}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{poll.class?.className} · Section {poll.section?.sectionName}</p>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-slate-600">{poll.submitted ? 'Submitted' : poll.status}</span>
                    </div>
                    {poll.submitted ? (
                      <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
                        Your response has been submitted. Results will be visible after admin compilation.
                      </p>
                    ) : poll.status === 'ACTIVE' ? (
                      <div className="mt-4 space-y-3">
                        {[
                          ['understandingRating', 'How well did you understand this chapter?'],
                          ['difficultyRating', 'How difficult was this chapter?'],
                          ['confidenceRating', 'How confident are you in solving questions?'],
                          ['teachingRating', "How was the teacher's teaching quality?"],
                          ['clarityRating', "How clear was the teacher's explanation?"],
                          ['paceRating', 'Was the teaching pace comfortable?'],
                        ].map(([field, text]) => (
                          <label key={field} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                            <span>{text}</span>
                            <select value={form[field] || (field === 'difficultyRating' ? 3 : 4)} onChange={(event) => setVoteField(poll.id, field, Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 px-2">
                              {[1, 2, 3, 4, 5].map((value) => <option key={value} value={value}>{value}</option>)}
                            </select>
                          </label>
                        ))}
                        <textarea value={form.comment || ''} onChange={(event) => setVoteField(poll.id, 'comment', event.target.value)} placeholder="Optional comment" className="min-h-[72px] w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-400" />
                        <button type="button" onClick={() => submitVote(poll.id)} disabled={submittingPollId === poll.id} className="inline-flex h-10 items-center gap-2 rounded-xl bg-indigo-600 px-4 text-sm font-bold text-white transition hover:bg-indigo-700 disabled:opacity-60">
                          {submittingPollId === poll.id ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                          Submit Poll
                        </button>
                      </div>
                    ) : (
                      <p className="mt-4 text-sm font-semibold text-slate-600">This poll is not open for submission.</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid grid-cols-1 xl:grid-cols-[1.25fr_0.75fr] gap-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">My Subjects</h2>
              <div className="mt-4 space-y-4">
                {(payload?.subjects || []).map((subject) => (
                  <div key={subject.subjectId} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-slate-950">{subject.subjectName}</p>
                      <span className="text-xs font-bold text-slate-500">{subject.chapters.length} chapters</span>
                    </div>
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {subject.chapters.map((chapter) => (
                        <div key={chapter.chapterId} className="rounded-xl border border-slate-200 bg-white p-3">
                          <p className="text-sm font-bold text-slate-900">{chapter.chapterOrder}. {chapter.chapterName}</p>
                          <span className={`mt-2 inline-flex rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusClass[chapter.status]}`}>
                            {label(chapter.status)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="text-lg font-black text-slate-950">Visible Resources</h2>
              <div className="mt-4 space-y-3">
                {(payload?.resources || []).length === 0 && (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-600">
                    No resources shared yet.
                  </div>
                )}
                {(payload?.resources || []).map((resource) => (
                  <a
                    key={resource.id}
                    href={resource.externalUrl || resource.fileUrl || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-2xl border border-slate-200 p-4 hover:border-indigo-300 hover:bg-indigo-50/40"
                  >
                    <p className="text-sm font-black text-slate-950">{resource.title}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{resource.subject?.subjectName} · {resource.resourceType}</p>
                    {resource.description && <p className="mt-2 text-sm text-slate-600">{resource.description}</p>}
                  </a>
                ))}
              </div>
            </div>
          </section>
        </motion.div>
      )}
    </DashboardLayout>
  );
}
