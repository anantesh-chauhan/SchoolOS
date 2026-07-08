import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BookOpen, CheckCircle2, FileText, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { studentAcademicsService } from '../../services/studentAcademicsService';

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    studentAcademicsService
      .getMyAcademics()
      .then(setPayload)
      .catch((error) => toast.error(error.response?.data?.message || 'Unable to load student academics'))
      .finally(() => setLoading(false));
  }, []);

  const chapters = useMemo(() => (payload?.subjects || []).flatMap((subject) => subject.chapters || []), [payload]);
  const completed = chapters.filter((chapter) => chapter.status === 'COMPLETED').length;
  const ongoing = chapters.filter((chapter) => chapter.status === 'ONGOING').length;

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
            <Stat icon={FileText} label="Resources" value={payload?.resources?.length || 0} />
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
