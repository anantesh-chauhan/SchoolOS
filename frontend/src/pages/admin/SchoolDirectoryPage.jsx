import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, ChevronRight, GraduationCap, Layers, Search, Shapes, UserRound, Users, UsersRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { useAcademicStructure } from '../../hooks/useAcademicStructure';
import { teacherService } from '../../services/managementService';
import { studentService } from '../../services/studentService';
import { authService } from '../../services/authService';

const views = [
  ['classes', 'Classes', Layers],
  ['sections', 'Sections', Shapes],
  ['subjects', 'Subjects', BookOpen],
  ['teachers', 'Teachers', UsersRound],
  ['students', 'Students', GraduationCap],
  ['parents', 'Parents', UserRound],
];

const nameOf = (student) => [student.studentFirstName, student.studentLastName].filter(Boolean).join(' ');
const parentNameOf = (student) => student.parentName || student.fatherName || student.motherName || student.guardianName || 'Parent / guardian';
const parentContactOf = (student) => student.parentMobile || student.fatherMobile || student.motherMobile || student.parentEmail || student.parentUserId || '';

function Empty({ loading }) {
  return <div className="rounded-2xl border border-dashed border-[var(--border-soft)] p-10 text-center text-sm text-[var(--text-muted)]">{loading ? 'Loading directory…' : 'No matching records found.'}</div>;
}

function Row({ icon: Icon, title, meta, children }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-4 sm:flex-row sm:items-center">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--school-primary-soft)] text-[var(--school-primary-soft-text)]"><Icon size={20} /></span>
      <div className="min-w-0 flex-1"><p className="truncate font-bold text-[var(--text-primary)]">{title}</p><p className="mt-1 truncate text-xs text-[var(--text-muted)]">{meta}</p></div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

const actionClass = 'inline-flex h-9 items-center gap-1 rounded-xl border border-[var(--border-soft)] px-3 text-xs font-bold text-[var(--text-primary)] transition hover:bg-[var(--surface-hover)]';

export default function SchoolDirectoryPage() {
  const role = authService.getCurrentUser()?.role || 'ADMIN';
  const [view, setView] = useState('classes');
  const [query, setQuery] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [sectionFilter, setSectionFilter] = useState('');
  const academics = useAcademicStructure();
  const teachersQuery = useQuery({ queryKey: ['teachers', 'directory'], queryFn: () => teacherService.listAll() });
  const studentsQuery = useQuery({ queryKey: ['student-allocation-roster'], queryFn: studentService.allocationRoster });
  const teachers = teachersQuery.data?.data || [];
  const students = studentsQuery.data?.data || [];
  const sections = academics.classes.flatMap((classRow) => (classRow.sections || []).map((section) => ({ ...section, class: classRow })));
  const selectedClass = academics.classes.find((row) => row.id === classFilter);
  const availableSections = selectedClass?.sections || [];

  const subjectRows = useMemo(() => academics.subjectMappings.map((subject) => {
    const placements = [
      ...(subject.sectionSubjects || []).map((item) => ({ class: item.section.class, section: item.section })),
      ...(subject.classSubjects || []).flatMap((item) => {
        const classRow = academics.classes.find((row) => row.id === item.class.id);
        return (classRow?.sections || []).map((section) => ({ class: item.class, section }));
      }),
    ];
    const unique = Array.from(new Map(placements.map((item) => [`${item.class.id}-${item.section.id}`, item])).values());
    return { ...subject, placements: unique };
  }), [academics.subjectMappings, academics.classes]);

  const normalized = query.trim().toLowerCase();
  const includes = (...values) => !normalized || values.filter(Boolean).join(' ').toLowerCase().includes(normalized);
  const placementMatches = (className, sectionName) =>
    (!classFilter || selectedClass?.className === className) &&
    (!sectionFilter || availableSections.find((item) => item.id === sectionFilter)?.sectionName === sectionName);

  const visibleClasses = academics.classes.filter((row) => includes(row.className));
  const visibleSections = sections.filter((row) => (!classFilter || row.class.id === classFilter) && includes(row.class.className, row.sectionName));
  const visibleSubjects = subjectRows.filter((row) => {
    const matchesPlacement = (!classFilter && !sectionFilter) || row.placements.some((item) => (!classFilter || item.class.id === classFilter) && (!sectionFilter || item.section.id === sectionFilter));
    return matchesPlacement && includes(row.subjectName, row.subjectCode, ...row.placements.map((item) => `${item.class.className} ${item.section.sectionName}`));
  });
  const visibleTeachers = teachers.filter((row) => includes(row.teacherName, row.employeeId, row.email, row.specialization));
  const visibleStudents = students.filter((row) => placementMatches(row.className, row.section) && includes(nameOf(row), row.admissionNo, row.studentUserId, row.className, row.section, parentNameOf(row), parentContactOf(row)));
  const parentRows = Array.from(visibleStudents.reduce((groups, student) => {
    if (!includes(parentNameOf(student), parentContactOf(student), nameOf(student))) return groups;
    const key = parentContactOf(student) || `${parentNameOf(student)}-${student.id}`;
    const current = groups.get(key) || { key, name: parentNameOf(student), contact: parentContactOf(student), children: [] };
    current.children.push(student);
    groups.set(key, current);
    return groups;
  }, new Map()).values());
  const loading = academics.isLoading || teachersQuery.isLoading || studentsQuery.isLoading;

  return (
    <DashboardLayout role={role}>
      <div className="space-y-5">
        <section className="overflow-hidden rounded-3xl bg-slate-950 p-6 text-white shadow-xl sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">Connected school directory</p>
          <h1 className="mt-3 text-3xl font-black">Browse the school from any angle</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">Move between classes, sections, subjects, teachers, students and parents without returning to the dashboard. Filters stay available while you switch views.</p>
          <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            {views.map(([value, label, Icon]) => <button key={value} type="button" onClick={() => setView(value)} className={`flex items-center gap-2 rounded-2xl px-3 py-3 text-left text-sm font-bold transition ${view === value ? 'bg-white text-slate-950' : 'bg-white/10 text-slate-200 hover:bg-white/15'}`}><Icon size={17}/>{label}</button>)}
          </div>
        </section>

        <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1fr_220px_220px]">
            <label className="relative"><Search className="absolute left-3 top-3 text-[var(--text-muted)]" size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search ${view}, names, IDs or contacts…`} className="h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] pl-10 pr-3 text-sm outline-none focus:border-[var(--school-primary)]"/></label>
            <select value={classFilter} onChange={(event) => { setClassFilter(event.target.value); setSectionFilter(''); }} className="h-11 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 text-sm"><option value="">All classes</option>{academics.classes.map((row) => <option key={row.id} value={row.id}>{row.className}</option>)}</select>
            <select value={sectionFilter} disabled={!classFilter} onChange={(event) => setSectionFilter(event.target.value)} className="h-11 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3 text-sm disabled:opacity-50"><option value="">All sections</option>{availableSections.map((row) => <option key={row.id} value={row.id}>Section {row.sectionName}</option>)}</select>
          </div>
        </section>

        <section className="space-y-3">
          {view === 'classes' && visibleClasses.map((row) => <Row key={row.id} icon={Layers} title={row.className} meta={`${row.sections?.length || 0} sections · ${row.classSubjects?.length || 0} common subjects`}>{(row.sections || []).slice(0, 4).map((section) => <Link key={section.id} to={`/dashboard/admin/academic/classes/${row.id}/sections/${section.id}`} className={actionClass}>Section {section.sectionName}<ChevronRight size={14}/></Link>)}<Link to={`/analytics/classes/${row.id}`} className={actionClass}>Analytics</Link></Row>)}
          {view === 'sections' && visibleSections.map((row) => <Row key={row.id} icon={Shapes} title={`${row.class.className} · Section ${row.sectionName}`} meta={`${row.sectionSubjects?.length || row.class.classSubjects?.length || 0} subjects`}><Link to={`/dashboard/admin/academic/classes/${row.class.id}/sections/${row.id}`} className={actionClass}>Open workspace<ChevronRight size={14}/></Link><Link to={`/analytics/sections/${row.id}`} className={actionClass}>Analytics</Link></Row>)}
          {view === 'subjects' && visibleSubjects.map((row) => { const placement = row.placements[0]; return <Row key={row.id} icon={BookOpen} title={row.subjectName} meta={`${row.subjectCode || 'No code'} · ${row.placements.length} section placements`}>{placement && <Link to={`/dashboard/admin/academic/classes/${placement.class.id}/sections/${placement.section.id}/subjects/${row.id}`} className={actionClass}>Open subject<ChevronRight size={14}/></Link>}<Link to="/dashboard/admin/subjects" className={actionClass}>Manage</Link></Row>; })}
          {view === 'teachers' && visibleTeachers.map((row) => <Row key={row.id} icon={UsersRound} title={row.teacherName} meta={[row.employeeId, row.specialization, row.email].filter(Boolean).join(' · ')}><Link to={`/dashboard/admin/teacher-assignment-summary?teacherId=${row.id}`} className={actionClass}>View assignments<ChevronRight size={14}/></Link></Row>)}
          {view === 'students' && visibleStudents.map((row) => <Row key={row.id} icon={GraduationCap} title={nameOf(row)} meta={`${row.admissionNo || 'No admission no.'} · ${row.className || 'Unallocated'}${row.section ? ` · Section ${row.section}` : ''}`}><Link to={`/analytics/students/${row.id}`} className={actionClass}>Academic view</Link><Link to={`/attendance/students/${row.id}`} className={actionClass}>Attendance</Link></Row>)}
          {view === 'parents' && parentRows.map((row) => { const child = row.children[0]; return <Row key={row.key} icon={UserRound} title={row.name} meta={`${row.contact || 'No contact on record'} · ${row.children.map((item) => `${nameOf(item)} (${item.className || 'Unallocated'}${item.section ? `-${item.section}` : ''})`).join(', ')}`}><Link to={`/dashboard/fees/students/${child.id}`} className={actionClass}>{row.children.length > 1 ? 'Family fees' : 'Fee record'}</Link><Link to={`/analytics/students/${child.id}`} className={actionClass}>Child progress</Link></Row>; })}
          {!loading && ((view === 'classes' && !visibleClasses.length) || (view === 'sections' && !visibleSections.length) || (view === 'subjects' && !visibleSubjects.length) || (view === 'teachers' && !visibleTeachers.length) || (view === 'students' && !visibleStudents.length) || (view === 'parents' && !parentRows.length)) && <Empty />}
          {loading && <Empty loading />}
        </section>
      </div>
    </DashboardLayout>
  );
}
