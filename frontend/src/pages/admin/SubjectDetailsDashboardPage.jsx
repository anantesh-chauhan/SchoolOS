import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { subjectDetailsDataService } from '../../features/classes/services/subjectDetailsData';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import SearchInput from '../../components/ui/SearchInput';

function StatCard({ icon, label, value, tone = 'blue' }) {
  const toneStyles = {
    blue: 'bg-blue-50 border-blue-100 text-blue-900',
    purple: 'bg-purple-50 border-purple-100 text-purple-900',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    amber: 'bg-amber-50 border-amber-100 text-amber-900',
    rose: 'bg-rose-50 border-rose-100 text-rose-900',
    gray: 'bg-slate-50 border-slate-200 text-slate-800',
  }[tone];

  return (
    <div className={`rounded-2xl border ${toneStyles} p-4 shadow-sm`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-wide font-semibold opacity-80">{label}</p>
          <p className="mt-1 text-2xl font-extrabold leading-tight">{value}</p>
        </div>
        <div className="text-xl">{icon}</div>
      </div>
    </div>
  );
}

function Badge({ children, tone = 'blue' }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    gray: 'bg-slate-50 text-slate-700 border-slate-200',
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function ChapterCard({ chapter, onOpen }) {
  const statusTone =
    chapter.status === 'Completed' ? 'emerald' : chapter.status === 'In Progress' ? 'amber' : 'gray';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-11 w-11 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xl">
              📖
            </div>
            <div className="min-w-0">
              <p className="text-sm font-extrabold text-slate-900 truncate">
                {chapter.chapterName}
              </p>
              <p className="mt-1 text-xs text-slate-500">Chapter No. <span className="font-semibold text-slate-700">{chapter.chapterNumber}</span></p>
            </div>
          </div>
          <Badge tone={statusTone}>{chapter.status}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Duration</p>
            <p className="text-sm font-semibold text-slate-900">{chapter.estimatedClasses} classes</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Resources</p>
            <p className="text-sm font-semibold text-slate-900">{chapter.resources}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Assignments</p>
            <p className="text-sm font-semibold text-slate-900">{chapter.assignments}</p>
          </div>
          <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wide text-slate-500">Completion</p>
            <p className="text-sm font-extrabold text-slate-900">{chapter.completion}%</p>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500">Updated: {new Date(chapter.updatedAt).toLocaleDateString()}</div>
      </button>
    </motion.div>
  );
}

function ComingSoonModuleCard({ title, icon }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/50 p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-xl">{icon}</div>
          <div className="mt-2 text-sm font-extrabold text-slate-900">{title}</div>
          <div className="mt-1 text-xs text-slate-500">Coming Soon</div>
        </div>
        <Badge tone="gray">Soon</Badge>
      </div>
    </div>
  );
}

export default function SubjectDetailsDashboardPage() {
  const { classId, sectionId, subjectId } = useParams();

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('All');
  const [sortBy, setSortBy] = useState('Chapter Number');
  const [view, setView] = useState('Grid');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await subjectDetailsDataService.getDashboardPayload({ classId, sectionId, subjectId });
      setPayload(data);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setPayload(null);
      setError(e.response?.data?.message || 'Unable to load subject data from the server.');
      toast.error('Failed to load subject details');
    }
  }, [classId, sectionId, subjectId]);

  useEffect(() => {
    load();
  }, [load]);

  const chapters = payload?.chapters || [];

  const filteredChapters = useMemo(() => {
    const q = query.trim().toLowerCase();

    return chapters.filter((ch) => {
      const matchesQuery =
        !q ||
        ch.chapterName.toLowerCase().includes(q) ||
        String(ch.chapterNumber).toLowerCase().includes(q);

      const matchesStatus =
        filter === 'All'
          ? true
          : filter === 'Completed'
            ? ch.status === 'Completed'
            : filter === 'In Progress'
              ? ch.status === 'In Progress'
              : ch.status === 'Not Started';

      return matchesQuery && matchesStatus;
    });
  }, [chapters, query, filter]);

  const sortedChapters = useMemo(() => {
    const copy = [...filteredChapters];

    switch (sortBy) {
      case 'Chapter Number':
        copy.sort((a, b) => a.chapterNumber - b.chapterNumber);
        break;
      case 'Alphabetical':
        copy.sort((a, b) => a.chapterName.localeCompare(b.chapterName));
        break;
      case 'Completion':
        copy.sort((a, b) => b.completion - a.completion);
        break;
      case 'Latest Updated':
        copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
        break;
      default:
        break;
    }

    return copy;
  }, [filteredChapters, sortBy]);

  const stats = payload?.stats;
  const meta = payload?.meta;
  const subject = payload?.subject;

  return (
    <DashboardLayout role="ADMIN">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        {loading && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-8 w-56 bg-slate-100 rounded animate-pulse" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            <p className="text-sm font-bold">Subject data unavailable</p>
            <p className="mt-1 text-sm">{error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={load}>Retry</Button>
              <Link className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700" to={`/dashboard/admin/academic/classes/${classId}/sections/${sectionId}`}>
                Back to Section
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && meta && subject && (
          <>
            {/* Subject Header */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Link className="font-semibold text-slate-700 hover:text-blue-700" to="/dashboard/admin/classes">Classes</Link>
                <span>/</span>
                <Link className="font-semibold text-slate-700 hover:text-blue-700" to={`/dashboard/admin/academic/classes/${classId}/sections/${sectionId}`}>{meta.className}</Link>
                <span>/</span>
                <span>{meta.sectionName}</span>
                <span>/</span>
                <span className="text-slate-900 font-semibold">{subject.name}</span>
                <span>/</span>
                <span>Chapters</span>
              </div>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-2xl font-extrabold text-slate-900">{subject.name}</div>
                    <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700">
                      {meta.className} • {meta.sectionName.replace('Section ', 'Section ')}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <div className="text-sm text-slate-600">Teacher</div>
                    <div className="text-sm font-semibold text-slate-900">{subject.teacher}</div>
                    <div className="text-sm text-slate-300">•</div>
                    <div className="text-sm text-slate-600">Session</div>
                    <div className="text-sm font-semibold text-slate-900">{meta.academicSession}</div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatCard icon="📘" label="Chapters" value={stats.totalChapters} tone="blue" />
                  <StatCard icon="✅" label="Completion %" value={`${stats.completionPct}%`} tone="emerald" />
                  <StatCard icon="👦" label="Students" value={meta.totalStudents} tone="purple" />
                </div>
              </div>
            </div>

            {/* Dashboard Layout */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <StatCard icon="📚" label="Total Chapters" value={stats.totalChapters} tone="blue" />
                  <StatCard icon="✅" label="Completed Chapters" value={stats.completedChapters} tone="emerald" />
                  <StatCard icon="⏳" label="Upcoming Chapters" value={stats.upcomingChapters} tone="amber" />
                  <StatCard icon="📝" label="Assignments" value={stats.assignments} tone="amber" />
                  <StatCard icon="📒" label="Homework" value={stats.homework} tone="rose" />
                  <StatCard icon="📎" label="Resources" value={stats.resources} tone="purple" />
                </div>
              </CardContent>
            </Card>

            {/* Chapters + Controls */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                  <CardTitle>Chapters</CardTitle>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="w-full sm:w-80">
                      <SearchInput
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by Chapter Name or Chapter Number"
                        ariaLabel="Search chapters"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={view === 'Grid' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setView('Grid')}
                      >
                        Grid View
                      </Button>
                      <Button
                        variant={view === 'List' ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => setView('List')}
                      >
                        List View
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
                  <div className="flex flex-wrap gap-3">
                    <select
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      value={filter}
                      onChange={(e) => setFilter(e.target.value)}
                    >
                      <option>All</option>
                      <option>Completed</option>
                      <option>In Progress</option>
                      <option>Not Started</option>
                    </select>

                    <select
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option>Chapter Number</option>
                      <option>Alphabetical</option>
                      <option>Completion</option>
                      <option>Latest Updated</option>
                    </select>
                  </div>

                  <div className="text-sm text-slate-500">
                    Showing <span className="font-semibold text-slate-800">{sortedChapters.length}</span> chapters
                  </div>
                </div>
              </CardHeader>

              <CardContent>
                {sortedChapters.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                    <div className="text-4xl">🧩</div>
                    <p className="mt-3 text-sm font-semibold text-slate-800">No chapters available.</p>
                    <p className="mt-1 text-xs text-slate-500">Add chapters for this subject to show them here.</p>
                  </div>
                ) : (
                  <div
                    className={
                      view === 'Grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4'
                        : 'space-y-3'
                    }
                  >
                    {sortedChapters.map((ch) => (
                      <ChapterCard
                        key={ch.id}
                        chapter={ch}
                        onOpen={() => {
                          // Navigate to placeholder chapter route (future content)
                          // Using Link keeps future deep-linking architecture stable.
                          // onClick uses window.location to avoid adding another wrapper component.
                          // Replace with Link when adding chapter layout fully.
                          window.location.href = `/dashboard/admin/academic/classes/${classId}/sections/${sectionId}/subjects/${subjectId}/chapters/${ch.id}`;
                        }}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Future Academic Modules */}
            <Card>
              <CardHeader>
                <CardTitle>Future Academic Modules</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <ComingSoonModuleCard title="Topics" icon="🧠" />
                  <ComingSoonModuleCard title="Lesson Plans" icon="🗓️" />
                  <ComingSoonModuleCard title="Homework" icon="✍️" />
                  <ComingSoonModuleCard title="Assignments" icon="📝" />
                  <ComingSoonModuleCard title="Question Bank" icon="❓" />
                  <ComingSoonModuleCard title="Resources" icon="📎" />
                  <ComingSoonModuleCard title="Videos" icon="🎞️" />
                  <ComingSoonModuleCard title="Worksheets" icon="📄" />
                  <ComingSoonModuleCard title="Attendance" icon="✅" />
                  <ComingSoonModuleCard title="Assessments" icon="📊" />
                  <ComingSoonModuleCard title="Notes" icon="📚" />
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </motion.div>
    </DashboardLayout>
  );
}

