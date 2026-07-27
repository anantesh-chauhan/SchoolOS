import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { classDetailsDataService } from '../../features/classes/services/classDetailsData';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import SearchInput from '../../components/ui/SearchInput';

const academicPillClass = 'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700';

function Badge({ children, tone = 'blue' }) {
  const toneClass = {
    blue: 'bg-blue-50 text-blue-700 border-blue-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-100',
    rose: 'bg-rose-50 text-rose-700 border-rose-100',
    gray: 'bg-slate-50 text-slate-700 border-slate-200',
  }[tone];

  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${toneClass}`}>
      {children}
    </span>
  );
}

function StatsCard({ icon, label, value, tone = 'blue' }) {
  const toneStyles = {
    blue: 'bg-blue-50 border-blue-100 text-blue-900',
    purple: 'bg-purple-50 border-purple-100 text-purple-900',
    emerald: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    amber: 'bg-amber-50 border-amber-100 text-amber-900',
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

function SubjectCard({ subject, onOpen }) {
  const statusTone = subject.status === 'Active' ? 'emerald' : 'gray';
  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <button
        type="button"
        onClick={onOpen}
        className="w-full text-left"
        aria-label={`Open ${subject.name} details`}
      >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-xl">
              {subject.icon}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-slate-900 truncate">{subject.name}</p>
              <p className="mt-1 text-xs text-slate-500">Teacher: <span className="font-semibold text-slate-700">{subject.teacher}</span></p>
            </div>
          </div>
        </div>
        <Badge tone={statusTone}>{subject.status}</Badge>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">

        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Weekly</p>
          <p className="text-sm font-semibold text-slate-900">{subject.periodsPerWeek}/week</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Room</p>
          <p className="text-sm font-semibold text-slate-900">{subject.room}</p>
        </div>
      </div>
      </button>
    </motion.div>
  );
}


function EmptyStudentsState() {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
      <div className="text-4xl">🧑‍🎓</div>
      <p className="mt-3 text-sm font-semibold text-slate-800">No students available.</p>
      <p className="mt-1 text-xs text-slate-500">When the student management backend is connected, this section will populate automatically.</p>
    </div>
  );
}

function StudentDrawer({ open, student, onClose, subjectsForLookup }) {
  return (
    <AnimatePresence>
      {open && student && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50"
        >
          <button
            type="button"
            aria-label="Close"
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: 320 }}
            animate={{ x: 0 }}
            exit={{ x: 320 }}
            transition={{ type: 'spring', stiffness: 260, damping: 24 }}
            className="absolute right-0 top-0 h-full w-full max-w-md bg-white border-l border-slate-200 shadow-xl p-5 overflow-auto"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <img
                  src={student.photo}
                  alt={student.name}
                  className="h-14 w-14 rounded-2xl border border-slate-200 bg-slate-50 object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div className="min-w-0">
                  <p className="text-base font-extrabold text-slate-900 truncate">{student.name}</p>
                  <p className="text-xs text-slate-500">{student.rollNo} • {student.admissionNo}</p>
                </div>
              </div>
              <Button variant="ghost" className="h-10 px-3" onClick={onClose}>
                Close
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Gender</p>
                      <p className="text-sm font-semibold text-slate-900">{student.gender}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Blood Group</p>
                      <p className="text-sm font-semibold text-slate-900">{student.bloodGroup}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">DOB</p>
                      <p className="text-sm font-semibold text-slate-900">{student.dob}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">House</p>
                      <p className="text-sm font-semibold text-slate-900">{student.house}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">Attendance</p>
                    <p className="text-sm font-extrabold text-slate-900">{student.attendance}</p>
                    <p className="text-xs text-slate-500 mt-1">Status: <span className="font-semibold text-slate-700">{student.status}</span></p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Parent Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 gap-3">
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Father</p>
                      <p className="text-sm font-semibold text-slate-900">{student.fatherName}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500">Phone</p>
                      <p className="text-sm font-semibold text-slate-900">{student.phone}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Subjects</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {(student.subjects || []).map((s) => (
                      <span
                        key={s.name}
                        className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold bg-slate-50 border border-slate-200 text-slate-700"
                      >
                        {s.name}
                      </span>
                    ))}
                    {(student.subjects || []).length === 0 && (
                      <p className="text-sm text-slate-500">No subjects assigned.</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <div className="rounded-xl bg-slate-50 border border-slate-200 p-3 text-xs text-slate-600">
                Future-ready: this drawer can support actions like Attendance/Marks without changing UI structure.
              </div>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function StudentCard({ student, onOpen }) {
  const tone = student.status === 'Present' ? 'emerald' : 'rose';
  const statusClass =
    tone === 'emerald'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
      : 'bg-rose-50 text-rose-700 border-rose-100';

  return (
    <motion.div
      whileHover={{ y: -2 }}
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col"
    >
      <div className="flex items-start gap-3">
        <img
          src={student.photo}
          alt={student.name}
          className="h-12 w-12 rounded-2xl border border-slate-200 bg-slate-50 object-cover"
          loading="lazy"
          decoding="async"
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-extrabold text-slate-900 truncate">{student.name}</p>
          <p className="text-xs text-slate-500 mt-1">{student.rollNo} • {student.admissionNo}</p>
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold bg-slate-50 border border-slate-200 text-slate-700">
              {student.gender}
            </span>
            <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold border ${statusClass}`}>
              {student.status}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">Attendance</p>
          <p className="text-sm font-extrabold text-slate-900">{student.attendance}</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">House</p>
          <p className="text-sm font-semibold text-slate-900 truncate">{student.house}</p>
        </div>
      </div>

      <div className="mt-4">
        <Button className="w-full" onClick={() => onOpen(student)}>
          View Profile
        </Button>
      </div>
    </motion.div>
  );
}

export default function ClassDetailsDashboardPage() {
  const { classId, sectionId } = useParams();

  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [query, setQuery] = useState('');
  const [filterGender, setFilterGender] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');
  const [filterHouse, setFilterHouse] = useState('All');
  const [sortBy, setSortBy] = useState('Roll Number');
  const [view, setView] = useState('Grid');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeStudent, setActiveStudent] = useState(null);

  const houseOptions = useMemo(() => {
    const students = payload?.students || [];
    const set = new Set(students.map((s) => s.house).filter(Boolean));
    return ['All', ...Array.from(set)];
  }, [payload]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await classDetailsDataService.getDashboardPayload({ classId, sectionId });
      setPayload(data);
      setLoading(false);
    } catch (e) {
      setLoading(false);
      setPayload(null);
      setError(e.response?.data?.message || 'Unable to load academic data from the server.');
      toast.error('Failed to load class details');
    }
  }, [classId, sectionId]);

  useEffect(() => {
    load();
  }, [load]);

  const students = payload?.students || [];

  const filteredStudents = useMemo(() => {
    const q = query.trim().toLowerCase();

    return students.filter((s) => {
      const matchesQuery = !q
        || s.name.toLowerCase().includes(q)
        || s.rollNo.toLowerCase().includes(q)
        || s.admissionNo.toLowerCase().includes(q);

      const matchesGender = filterGender === 'All'
        || s.gender === filterGender;

      const matchesStatus = filterStatus === 'All'
        || s.status === (filterStatus === 'Present' ? 'Present' : 'Absent');

      const matchesHouse = filterHouse === 'All'
        || s.house === filterHouse;

      return matchesQuery && matchesGender && matchesStatus && matchesHouse;
    });
  }, [students, query, filterGender, filterStatus, filterHouse]);

  const sortedStudents = useMemo(() => {
    const copy = [...filteredStudents];

    const rollNum = (rollNoStr) => {
      // "Roll 01" -> 1
      const m = (rollNoStr || '').match(/(\d+)/);
      return m ? Number(m[1]) : 0;
    };

    const attendancePct = (attendanceStr) => {
      const m = (attendanceStr || '').match(/(\d+)/);
      return m ? Number(m[1]) : 0;
    };

    switch (sortBy) {
      case 'Roll Number':
        copy.sort((a, b) => rollNum(a.rollNo) - rollNum(b.rollNo));
        break;
      case 'Name':
        copy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'Attendance':
        copy.sort((a, b) => attendancePct(b.attendance) - attendancePct(a.attendance));
        break;
      case 'Admission Number':
        copy.sort((a, b) => a.admissionNo.localeCompare(b.admissionNo));
        break;
      default:
        break;
    }

    return copy;
  }, [filteredStudents, sortBy]);

  const meta = payload?.meta;
  const subjects = payload?.subjects || [];

  const skeleton = (
    <div className="space-y-4">
      <div className="h-20 rounded-2xl border border-slate-200 bg-white animate-pulse" />
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-28 rounded-2xl border border-slate-200 bg-white animate-pulse" />
        ))}
      </div>
      <div className="h-10 w-52 rounded-2xl bg-white border border-slate-200 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-2xl border border-slate-200 bg-white animate-pulse" />
        ))}
      </div>
    </div>
  );

  return (
    <DashboardLayout role="ADMIN">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="space-y-6"
      >
        {loading && skeleton}

        {!loading && error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            <p className="text-sm font-bold">Academic data unavailable</p>
            <p className="mt-1 text-sm">{error}</p>
            <Button className="mt-4" variant="secondary" onClick={load}>Retry</Button>
          </div>
        )}

        {!loading && !error && meta && (
          <>
            {/* Header */}
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <Link className="font-semibold text-slate-700 hover:text-blue-700" to="/dashboard/admin/classes">Classes</Link>
                <span>/</span>
                <span>{meta.className}</span>
                <span>/</span>
                <span className="text-slate-900 font-semibold">{meta.sectionName}</span>
              </div>
              <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="text-2xl font-extrabold text-slate-900">
                      {meta.className} • {meta.sectionName.replace('Section ', 'Section ')}
                    </div>
                    <span className={academicPillClass}>{'Academic Session '}{meta.academicSession}</span>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-slate-600">Class Teacher</span>
                    <span className="text-sm font-semibold text-slate-900">{meta.classTeacher}</span>
                    <span className="text-sm text-slate-400">•</span>
                    <span className="text-sm text-slate-600">Total Students</span>
                    <span className="text-sm font-semibold text-slate-900">{meta.totalStudents}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  <StatsCard icon="👥" label="Students" value={meta.totalStudents} tone="emerald" />
                  <StatsCard icon="📚" label="Subjects" value={meta.subjectsCount} tone="blue" />
                  <StatsCard icon="✅" label="Attendance" value={`${meta.attendancePercent}%`} tone="amber" />
                </div>
              </div>
            </div>

            {/* Quick Stats */}
            <Card>
              <CardHeader>
                <CardTitle>Quick Stats</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                  <StatsCard icon="👦" label="Boys" value={Math.round(meta.totalStudents * 0.52)} tone="blue" />
                  <StatsCard icon="👧" label="Girls" value={Math.round(meta.totalStudents * 0.48)} tone="purple" />
                  <StatsCard icon="📈" label="Average Attendance" value={`${meta.attendancePercent}%`} tone="emerald" />
                  <StatsCard icon="📝" label="Assignments" value={7} tone="amber" />
                  <StatsCard icon="📅" label="Upcoming Exams" value={2} tone="rose" />
                  <StatsCard icon="🧾" label="Attendance %" value={`${meta.attendancePercent}%`} tone="blue" />
                </div>
              </CardContent>
            </Card>

            {/* Subjects */}
            <Card>
              <CardHeader>
                <CardTitle>Subjects</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjects.map((sub) => (
                    <SubjectCard
                      key={sub.id}
                      subject={sub}
                      onOpen={() => {
                        window.location.href = `/dashboard/admin/academic/classes/${classId}/sections/${sectionId}/subjects/${sub.id}`;
                      }}
                    />
                  ))}
                  {subjects.length === 0 && (
                    <div className="col-span-full rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                      <p className="text-sm font-semibold text-slate-800">No subjects assigned.</p>
                      <p className="mt-1 text-xs text-slate-500">Assign subjects to this class or section to show them here.</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Students */}
            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 w-full">
                  <CardTitle>Students</CardTitle>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="w-full sm:w-80">
                      <SearchInput
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search by Name, Roll Number, Admission Number"
                        ariaLabel="Search students"
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
                      value={filterGender}
                      onChange={(e) => setFilterGender(e.target.value)}
                    >
                      <option>All</option>
                      <option>Boys</option>
                      <option>Girls</option>
                      <option>Male</option>
                      <option>Female</option>
                    </select>

                    <select
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      value={filterStatus}
                      onChange={(e) => setFilterStatus(e.target.value)}
                    >
                      <option>All</option>
                      <option>Present</option>
                      <option>Absent</option>
                    </select>

                    <select
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      value={filterHouse}
                      onChange={(e) => setFilterHouse(e.target.value)}
                    >
                      {houseOptions.map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>

                    <select
                      className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm"
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                    >
                      <option>Roll Number</option>
                      <option>Name</option>
                      <option>Attendance</option>
                      <option>Admission Number</option>
                    </select>
                  </div>

                  <div className="text-sm text-slate-500">
                    Showing <span className="font-semibold text-slate-800">{sortedStudents.length}</span> students
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {sortedStudents.length === 0 ? (
                  <EmptyStudentsState />
                ) : (
                  <div
                    className={
                      view === 'Grid'
                        ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4'
                        : 'space-y-3'
                    }
                  >
                    {sortedStudents.map((s) => (
                      <div key={s.id} className={view === 'List' ? 'lg:col-span-1' : ''}>
                        <StudentCard
                          student={s}
                          onOpen={(student) => {
                            setActiveStudent(student);
                            setDrawerOpen(true);
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <StudentDrawer
              open={drawerOpen}
              student={activeStudent}
              onClose={() => {
                setDrawerOpen(false);
                setActiveStudent(null);
              }}
              subjectsForLookup={subjects}
            />
          </>
        )}
      </motion.div>
    </DashboardLayout>
  );
}

