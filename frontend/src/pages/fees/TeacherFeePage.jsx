/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, ChevronRight, Clock3, Layers3, Users, WalletCards } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import FeeStructurePreviewTable from '../../components/fees/FeeStructurePreviewTable';
import { feeService } from '../../services/feeService';
import { authService } from '../../services/authService';

const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';
const field = 'h-10 rounded-xl border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950';
const currentSession = () => { const now = new Date(); const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1; return `${year}-${String(year + 1).slice(-2)}`; };
const money = (value = 0, settings = {}) => new Intl.NumberFormat(settings.locale || 'en-IN', { style: 'currency', currency: settings.currencyCode || 'INR' }).format(Number(value) / 100);
const statusTone = { PAID: 'bg-emerald-100 text-emerald-700', PARTIALLY_PAID: 'bg-amber-100 text-amber-700', OVERDUE: 'bg-red-100 text-red-700', PENDING: 'bg-blue-100 text-blue-700', NOT_ASSIGNED: 'bg-slate-100 text-slate-600' };

function Loading({ label = 'Loading fee records…' }) { return <div className={`${card} animate-pulse text-sm text-slate-500`}>{label}</div>; }
function Metric({ label, value, detail }) { return <div className={card}><p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-black">{value}</p>{detail && <p className="mt-1 text-xs text-slate-500">{detail}</p>}</div>; }

function StudentFeeDetail({ studentId, academicSession, settings, onBack }) {
  const [fees, setFees] = useState();
  const [error, setError] = useState('');
  useEffect(() => {
    setFees(undefined); setError('');
    feeService.teacherStudentFees(studentId, academicSession).then(setFees).catch((errorValue) => setError(errorValue.response?.data?.message || 'Unable to load this student fee record'));
  }, [studentId, academicSession]);
  if (error) return <div className="space-y-4"><button onClick={onBack} className="flex items-center gap-2 font-semibold text-blue-600"><ArrowLeft size={16}/>Back to section</button><div className="rounded-xl bg-red-50 p-4 text-red-700">{error}</div></div>;
  if (!fees) return <Loading label="Loading student fee details…"/>;
  const structures = fees.assignedStructures?.length ? fees.assignedStructures : fees.assignedStructure ? [fees.assignedStructure] : [];
  return <div className="space-y-5">
    <button onClick={onBack} className="flex items-center gap-2 font-semibold text-blue-600"><ArrowLeft size={16}/>Back to section summary</button>
    <div className={card}><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Individual fee record</p><h1 className="mt-1 text-2xl font-black">{fees.student.studentFirstName} {fees.student.studentLastName}</h1><p className="text-sm text-slate-500">{fees.student.admissionNo || fees.student.studentUserId} · {fees.student.className} {fees.student.section}</p></div>
    <div className="grid gap-4 sm:grid-cols-3"><Metric label="Expected" value={money(fees.totals.expected, settings)}/><Metric label="Collected" value={money(fees.totals.paid, settings)}/><Metric label="Pending" value={money(fees.totals.pending, settings)}/></div>
    <div className="grid gap-5 xl:grid-cols-2">
      <section className={card}><h2 className="text-lg font-black">Shared fee structures</h2><div className="mt-4 space-y-4">{structures.map((structure) => <FeeStructurePreviewTable key={structure.id} structure={structure} settings={settings} studentFees={fees} />)}{!structures.length && <p className="text-sm text-slate-500">No published structure is assigned.</p>}</div></section>
      <section className={card}><h2 className="text-lg font-black">Installments and status</h2><div className="mt-4 max-h-[620px] space-y-2 overflow-y-auto">{(fees.account?.charges || []).map((charge) => <div key={charge.id} className="flex justify-between gap-3 rounded-xl border p-3 dark:border-slate-700"><div><p className="font-semibold">{charge.installmentName}</p><p className="text-xs text-slate-500">{charge.feeComponent?.name} · Due {new Date(charge.dueDate).toLocaleDateString()}</p></div><div className="text-right"><p className="font-bold">{money(charge.baseAmountMinor, settings)}</p><p className="text-xs">{charge.status.replaceAll('_', ' ')}</p></div></div>)}{!fees.account?.charges?.length && <p className="text-sm text-slate-500">No installments generated.</p>}</div></section>
    </div>
    <section className={card}><h2 className="text-lg font-black">Payment history</h2><div className="mt-4 space-y-2">{(fees.account?.payments || []).map((payment) => <div key={payment.id} className="flex flex-wrap justify-between rounded-xl border p-3 dark:border-slate-700"><span>{new Date(payment.paymentDate).toLocaleDateString()} · {payment.method.replaceAll('_', ' ')}</span><strong>{money(payment.amountMinor, settings)}</strong></div>)}{!fees.account?.payments?.length && <p className="text-sm text-slate-500">No payments recorded.</p>}</div></section>
  </div>;
}

export default function TeacherFeePage() {
  const user = authService.getCurrentUser();
  const [academicSession, setAcademicSession] = useState(currentSession());
  const [settings, setSettings] = useState({ locale: 'en-IN', currencyCode: 'INR' });
  const [sections, setSections] = useState([]);
  const [section, setSection] = useState();
  const [overview, setOverview] = useState();
  const [selected, setSelected] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { feeService.settings().then(setSettings).catch(() => {}); feeService.teacherSections().then((rows) => { setSections(rows); setSection((current) => current || rows[0]); }).catch((error) => toast.error(error.response?.data?.message || 'Unable to load assigned sections')); }, []);
  useEffect(() => {
    if (!section) return;
    setOverview(undefined); setSelectedStudentId('');
    feeService.teacherSectionFees(section.sectionId, academicSession).then((result) => { setOverview(result); setSelected(result.students.filter((row) => row.dueMinor > 0).map((row) => row.id)); }).catch((error) => toast.error(error.response?.data?.message || 'Unable to load fee data'));
  }, [section, academicSession]);
  const collectionRate = useMemo(() => overview?.summary.expectedMinor ? Math.round(overview.summary.paidMinor / overview.summary.expectedMinor * 100) : 0, [overview]);
  const send = async () => { setBusy(true); try { const result = await feeService.teacherReminder({ sectionId: section.sectionId, academicSession, studentIds: selected, message }); toast.success(`${result.sent} in-app reminder${result.sent === 1 ? '' : 's'} sent and logged`); setMessage(''); } catch (error) { toast.error(error.response?.data?.message || 'Could not send reminders'); } finally { setBusy(false); } };

  if (selectedStudentId) return <DashboardLayout role={user?.role || 'CLASS_TEACHER'}><StudentFeeDetail studentId={selectedStudentId} academicSession={academicSession} settings={settings} onBack={() => setSelectedStudentId('')}/></DashboardLayout>;
  return <DashboardLayout role={user?.role || 'CLASS_TEACHER'}><div className="space-y-5">
    <header className={card}><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wide text-blue-600">Assigned-class finance</p><h1 className="mt-1 text-2xl font-black">Class fee status</h1><p className="text-sm text-slate-500">Published structures, section totals, and individual student fee records for your assigned sections.</p></div><label className="text-sm font-semibold">Academic session<input className={`${field} ml-2`} value={academicSession} onChange={(event) => setAcademicSession(event.target.value)}/></label></div><div className="mt-4 flex flex-wrap gap-2">{sections.map((row) => <button type="button" key={row.sectionId} onClick={() => setSection(row)} className={`rounded-xl px-4 py-2 text-sm font-semibold ${section?.sectionId === row.sectionId ? 'bg-blue-600 text-white' : 'border dark:border-slate-700'}`}>{row.className} · {row.sectionName}</button>)}</div>{!sections.length && <p className="mt-4 rounded-xl bg-slate-50 p-4 text-sm text-slate-500 dark:bg-slate-950">No active class or subject assignment is linked to your teacher account.</p>}</header>
    {section && !overview && <Loading/>}
    {overview && <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Metric label="Section expected" value={money(overview.summary.expectedMinor, settings)} detail={`${overview.summary.students} students`}/><Metric label="Collected" value={money(overview.summary.paidMinor, settings)} detail={`${collectionRate}% collection rate`}/><Metric label="Pending" value={money(overview.summary.dueMinor, settings)} detail={`${overview.summary.studentsWithDues} students with dues`}/><Metric label="Overdue" value={money(overview.summary.overdueMinor, settings)} detail={`${overview.summary.paidStudents} fully paid`}/></div>
      <section className={card}><div className="flex items-center gap-3"><Layers3 className="text-blue-600"/><div><h2 className="text-lg font-black">Fee structures shared by admin</h2><p className="text-sm text-slate-500">Published plans applicable to {overview.section.className} · Section {overview.section.sectionName}</p></div></div><div className="mt-4 space-y-4">{overview.structures.map((structure) => <FeeStructurePreviewTable key={structure.id} structure={structure} settings={settings} scopeSummary={overview.summary} />)}{!overview.structures.length && <p className="text-sm text-slate-500">No class-wide published structure is assigned.</p>}</div></section>
      <section className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div className="flex items-center gap-3"><Users className="text-blue-600"/><div><h2 className="text-lg font-black">Whole-section student summary</h2><p className="text-sm text-slate-500">Click any student to open the complete fee structure, installment, and payment record.</p></div></div>{section.canSendReminders && <button type="button" onClick={() => setSelected(overview.students.filter((row) => row.dueMinor > 0).map((row) => row.id))} className="text-sm font-bold text-blue-600">Select all with dues</button>}</div><div className="mt-4 space-y-2">{overview.students.map((student) => <article key={student.id} onClick={() => setSelectedStudentId(student.id)} className="grid cursor-pointer items-center gap-3 rounded-xl border p-4 transition hover:border-blue-400 sm:grid-cols-[auto_1fr_repeat(3,140px)_auto] dark:border-slate-700">{section.canSendReminders ? <input type="checkbox" aria-label={`Select ${student.name}`} checked={selected.includes(student.id)} disabled={!student.dueMinor} onClick={(event) => event.stopPropagation()} onChange={() => setSelected((old) => old.includes(student.id) ? old.filter((id) => id !== student.id) : [...old, student.id])}/> : <WalletCards size={18} className="text-slate-400"/>}<div><p className="font-bold">{student.name}</p><p className="text-xs text-slate-500">{student.admissionNo} · Roll {student.rollNumber || '—'}</p></div><div><p className="text-xs text-slate-500">Expected</p><p className="font-semibold">{money(student.expectedMinor, settings)}</p></div><div><p className="text-xs text-slate-500">Collected</p><p className="font-semibold text-emerald-700">{money(student.paidMinor, settings)}</p></div><div><p className="text-xs text-slate-500">Pending</p><p className="font-semibold text-amber-700">{money(student.dueMinor, settings)}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusTone[student.feeStatus]}`}>{student.feeStatus.replaceAll('_', ' ')}</span><ChevronRight size={17}/></div></article>)}</div></section>
      {section.canSendReminders && <section className={card}><div className="flex items-center gap-3"><Clock3 className="text-emerald-600"/><h2 className="font-black">Send fee reminder</h2></div><p className="mt-1 text-sm text-slate-500">Creates a traceable in-app notification for selected students and parents.</p><textarea className="mt-3 h-24 w-full rounded-xl border p-3 dark:border-slate-700 dark:bg-slate-950" value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Optional note for parents"/><button type="button" disabled={!selected.length || busy} onClick={send} className="mt-3 rounded-xl bg-emerald-600 px-5 py-3 font-semibold text-white disabled:opacity-50">{busy ? 'Sending…' : `Send in-app reminder (${selected.length})`}</button></section>}
    </>}
  </div></DashboardLayout>;
}
