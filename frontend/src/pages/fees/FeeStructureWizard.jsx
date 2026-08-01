/* eslint-disable react/prop-types */
import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Copy, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { feeService } from '../../services/feeService';

const MONTHS = [
  { number: 4, short: 'Apr' }, { number: 5, short: 'May' }, { number: 6, short: 'Jun' },
  { number: 7, short: 'Jul' }, { number: 8, short: 'Aug' }, { number: 9, short: 'Sep' },
  { number: 10, short: 'Oct' }, { number: 11, short: 'Nov' }, { number: 12, short: 'Dec' },
  { number: 1, short: 'Jan' }, { number: 2, short: 'Feb' }, { number: 3, short: 'Mar' },
];
const STEPS = ['Plan details', 'Select class', 'Fee heads & months', 'Due-date rules', 'Review & publish'];
const PRESETS = ['Tuition Fee', 'Admission Fee', 'Examination Fee', 'Annual Charge', 'Development Fee', 'Activity Fee', 'Computer Fee', 'Laboratory Fee', 'Library Fee', 'Sports Fee', 'Transport Fee', 'Miscellaneous Fee'];
const field = 'h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 dark:border-slate-700 dark:bg-slate-950';
const panel = 'rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';
const allMonths = MONTHS.map((month) => month.number);
const defaultMonths = (frequency) => ({
  MONTHLY: allMonths, QUARTERLY: [4, 7, 10, 1], HALF_YEARLY: [4, 10], ANNUAL: [4], ONE_TIME: [4], CUSTOM: [],
}[frequency] || [4]);
const slug = (value) => value.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '').slice(0, 36);
const newHead = (name = 'Tuition Fee', index = 0) => ({
  name, code: `${slug(name)}${index ? `_${index + 1}` : ''}`, amount: '', frequency: name === 'Tuition Fee' ? 'MONTHLY' : 'ONE_TIME',
  months: name === 'Tuition Fee' ? allMonths : [4], dueDay: 10, gracePeriodDays: 5, differentAmounts: false, monthAmounts: {},
  newAdmissionsOnly: name === 'Admission Fee', fromAdmissionMonth: false,
});
const initial = {
  academicSession: '2026-27', name: '', code: '', description: '', classId: '', effectiveDate: '2026-04-01',
  components: [newHead()],
};
const money = (value = 0) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(value);

export default function FeeStructureWizard({ onClose, onPublished, initialStructure }) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initial);
  const [hierarchy, setHierarchy] = useState({ classes: [] });
  const [structure, setStructure] = useState();
  const [preview, setPreview] = useState();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!initialStructure) return;
    const assignment = initialStructure.assignments?.[0] || initialStructure.sourceAssignment;
    setForm({
      academicSession: initialStructure.academicSession,
      name: initialStructure.name,
      code: initialStructure.code,
      description: initialStructure.description || '',
      classId: '',
      targetClassName: assignment?.targetType === 'CLASS' ? assignment.targetValue : '',
      effectiveDate: (initialStructure.effectiveFrom || `${initialStructure.academicSession.slice(0, 4)}-04-01`).slice(0, 10),
      changeReason: initialStructure.status === 'DRAFT' ? initialStructure.changeReason || '' : '',
      components: initialStructure.components.map((component) => ({
        name: component.name,
        code: component.code,
        amount: Number(component.amountMinor) / 100,
        frequency: component.frequency,
        months: component.applicability?.months || defaultMonths(component.frequency),
        dueDay: component.dueDay || 10,
        gracePeriodDays: component.gracePeriodDays || 0,
        differentAmounts: Boolean(Object.keys(component.applicability?.monthAmountsMinor || {}).length),
        monthAmounts: Object.fromEntries(Object.entries(component.applicability?.monthAmountsMinor || {}).map(([month, amount]) => [month, Number(amount) / 100])),
        newAdmissionsOnly: component.applicability?.newAdmissionsOnly === true,
        fromAdmissionMonth: component.applicability?.fromAdmissionMonth === true,
      })),
    });
    setStructure(initialStructure.status === 'DRAFT' ? initialStructure : undefined);
  }, [initialStructure]);

  useEffect(() => {
    let active = true;
    feeService.hierarchy(form.academicSession).then((result) => {
      if (!active) return;
      setHierarchy(result);
      setForm((old) => {
        if (old.classId || !result.classes?.length) return old;
        const matched = result.classes.find((row) => row.className === old.targetClassName);
        return { ...old, classId: matched?.id || result.classes[0].id };
      });
    }).catch((error) => toast.error(error.response?.data?.message || 'Unable to load classes'));
    return () => { active = false; };
  }, [form.academicSession]);

  const selectedClass = hierarchy.classes?.find((row) => row.id === form.classId);
  const update = (key, value) => { setStructure(undefined); setPreview(undefined); setForm((old) => ({ ...old, [key]: value })); };
  const updateHead = (index, patch) => { setStructure(undefined); setPreview(undefined); setForm((old) => ({ ...old, components: old.components.map((head, i) => i === index ? { ...head, ...patch } : head) })); };
  const annualTotal = useMemo(() => form.components.reduce((sum, head) => sum + head.months.reduce((headTotal, month) => headTotal + Number(head.differentAmounts ? head.monthAmounts[month] ?? head.amount : head.amount || 0), 0), 0), [form.components]);
  const monthlyTotals = useMemo(() => Object.fromEntries(MONTHS.map(({ number }) => [number, form.components.reduce((sum, head) => head.months.includes(number) ? sum + Number(head.differentAmounts ? head.monthAmounts[number] ?? head.amount : head.amount || 0) : sum, 0)])), [form.components]);

  const validateStep = () => {
    if (step === 0 && (!form.name.trim() || !form.code.trim() || !/^\d{4}-\d{2,4}$/.test(form.academicSession) || (initialStructure && !form.changeReason?.trim()))) return initialStructure ? 'Enter a revision reason for the audit trail.' : 'Enter a plan name, code, and valid academic session.';
    if (step === 1 && !form.classId) return 'Select the class that will receive this plan.';
    if (step === 2 && (!form.components.length || form.components.some((head) => !head.name.trim() || !head.code.trim() || Number(head.amount) <= 0 || !head.months.length))) return 'Every fee head needs a name, code, positive amount, and at least one month.';
    if (step === 3 && form.components.some((head) => head.dueDay < 1 || head.dueDay > 28 || head.gracePeriodDays < 0)) return 'Due day must be 1–28 and grace days cannot be negative.';
    return null;
  };

  const saveDraft = async () => {
    if (structure) return structure;
    const payload = {
      academicSession: form.academicSession, name: form.name.trim(), code: form.code.trim(), description: form.description,
      changeReason: form.changeReason || undefined,
      mode: 'COMPONENT_BASED', components: form.components.map((head, index) => ({
        name: head.name.trim(), code: head.code.trim(), amountMinor: Math.round(Number(head.amount) * 100), frequency: head.frequency,
        dueDay: Number(head.dueDay), gracePeriodDays: Number(head.gracePeriodDays), displayOrder: index,
        applicability: {
          months: head.months,
          monthAmountsMinor: head.differentAmounts ? Object.fromEntries(head.months.map((month) => [String(month), Math.round(Number(head.monthAmounts[month] ?? head.amount) * 100)])) : {},
          newAdmissionsOnly: head.newAdmissionsOnly,
          fromAdmissionMonth: head.fromAdmissionMonth,
        },
      })),
    };
    let result;
    if (initialStructure) {
      const draft = structure || (initialStructure.status === 'DRAFT' ? initialStructure : await feeService.reviseStructure(initialStructure.id, form.changeReason));
      result = await feeService.updateStructure(draft.id, payload);
    } else {
      result = await feeService.createStructure(payload);
    }
    setStructure(result);
    return result;
  };

  const next = async () => {
    const error = validateStep();
    if (error) return toast.error(error);
    if (step === 3) {
      setBusy(true);
      try {
        const draft = await saveDraft();
        setPreview(await feeService.previewAssignment({ feeStructureId: draft.id, targetType: 'CLASS', targetValue: form.classId }));
      } catch (errorValue) {
        toast.error(errorValue.response?.data?.message || 'Could not prepare the allocation preview');
        return;
      } finally { setBusy(false); }
    }
    setStep((current) => Math.min(STEPS.length - 1, current + 1));
  };

  const publish = async () => {
    setBusy(true);
    let structurePublished = false;
    try {
      const draft = await saveDraft();
      await feeService.publishStructure(draft.id);
      structurePublished = true;
      const assignmentPayload = { feeStructureId: draft.id, targetType: 'CLASS', targetValue: form.classId, scheduleStart: form.effectiveDate };
      const result = await feeService.publishAssignment(assignmentPayload);
      toast.success(`Plan published: ${result.chargesCreated} dues generated for ${result.affectedStudents} students`);
      onPublished?.();
    } catch (error) {
      const reason = error.response?.data?.message || error.message || 'Unknown server error';
      toast.error(structurePublished
        ? `Plan published, but student allocation failed: ${reason}. Click Publish again to retry.`
        : `Publishing failed: ${reason}`,
      );
    }
    finally { setBusy(false); }
  };

  const setFrequency = (index, frequency) => updateHead(index, { frequency, months: defaultMonths(frequency), differentAmounts: false, monthAmounts: {} });
  const toggleMonth = (index, month) => {
    const head = form.components[index];
    updateHead(index, { months: head.months.includes(month) ? head.months.filter((value) => value !== month) : [...head.months, month] });
  };
  const addHead = (name = 'Custom Fee Head') => update('components', [...form.components, newHead(name, form.components.length)]);

  return <div className={panel}>
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div><p className="text-sm font-semibold text-blue-600">Step {step + 1} of {STEPS.length}</p><h1 className="text-2xl font-bold">{STEPS[step]}</h1><p className="mt-1 text-sm text-slate-500">Create one session plan for the whole class. Every current and future section inherits it.</p></div>
      <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">Close</button>
    </div>
    <div className="mb-7 grid grid-cols-5 gap-2" aria-label="Fee plan progress">{STEPS.map((label, index) => <div key={label}><div className={`h-2 rounded-full ${index <= step ? 'bg-blue-600' : 'bg-slate-100 dark:bg-slate-800'}`} /><span className="mt-1 hidden text-xs text-slate-500 md:block">{label}</span></div>)}</div>

    {step === 0 && <div className="grid gap-4 md:grid-cols-2">
      <label>Academic session<input disabled={Boolean(initialStructure)} className={`${field} mt-1 disabled:opacity-60`} value={form.academicSession} onChange={(event) => update('academicSession', event.target.value)} placeholder="2026-27" /></label>
      <label>Plan name<input className={`${field} mt-1`} value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="Class 5 fee plan" /></label>
      <label>Plan code<input disabled={Boolean(initialStructure)} className={`${field} mt-1 disabled:opacity-60`} value={form.code} onChange={(event) => update('code', slug(event.target.value))} placeholder="CLASS_5_2026" /></label>
      <label>Effective date<input type="date" className={`${field} mt-1`} value={form.effectiveDate} onChange={(event) => update('effectiveDate', event.target.value)} /></label>
      <label className="md:col-span-2">Description<textarea className={`${field} mt-1 h-24 py-3`} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Optional notes for finance staff" /></label>
      {initialStructure && <label className="md:col-span-2">Revision reason<textarea required className={`${field} mt-1 h-20 py-3`} value={form.changeReason || ''} onChange={(event) => update('changeReason', event.target.value)} placeholder="Required audit reason for adding, changing, or removing fee heads" /></label>}
    </div>}

    {step === 1 && <div className="space-y-4">
      <label className="block max-w-xl">Class<select className={`${field} mt-1`} value={form.classId} onChange={(event) => update('classId', event.target.value)}><option value="">Select class</option>{hierarchy.classes?.map((row) => <option key={row.id} value={row.id}>{row.className}</option>)}</select></label>
      {selectedClass && <div className="grid gap-3 sm:grid-cols-3"><Metric label="Class" value={selectedClass.className} /><Metric label="Sections affected" value={selectedClass.sections.length} /><Metric label="Current students" value={selectedClass.sections.reduce((count, section) => count + section.students.length, 0)} /></div>}
      <div className="rounded-xl bg-blue-50 p-4 text-sm text-blue-900 dark:bg-blue-950/30 dark:text-blue-100"><strong>Class-wide allocation:</strong> you configure this once. Transfers between sections and newly created sections do not need a duplicate fee plan.</div>
    </div>}

    {step === 2 && <div className="space-y-5">
      <div className="flex flex-wrap gap-2">{PRESETS.map((name) => <button type="button" key={name} onClick={() => addHead(name)} className="rounded-full border px-3 py-1.5 text-sm hover:border-blue-500"><Plus size={14} className="mr-1 inline" />{name}</button>)}</div>
      {form.components.map((head, index) => <div key={`${index}-${head.code}`} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
        <div className="grid gap-3 md:grid-cols-[1.5fr_1fr_1fr_1fr_auto]">
          <label>Fee head<input className={`${field} mt-1`} value={head.name} onChange={(event) => updateHead(index, { name: event.target.value })} /></label>
          <label>Code<input className={`${field} mt-1`} value={head.code} onChange={(event) => updateHead(index, { code: slug(event.target.value) })} /></label>
          <label>Amount (₹)<input type="number" min="0" step="0.01" className={`${field} mt-1`} value={head.amount} onChange={(event) => updateHead(index, { amount: event.target.value })} /></label>
          <label>Frequency<select className={`${field} mt-1`} value={head.frequency} onChange={(event) => setFrequency(index, event.target.value)}>{['ONE_TIME', 'MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'ANNUAL', 'CUSTOM'].map((value) => <option key={value} value={value}>{value.replace('_', ' ')}</option>)}</select></label>
          <button type="button" aria-label={`Remove ${head.name}`} onClick={() => update('components', form.components.filter((_, row) => row !== index))} className="mt-6 h-11 rounded-xl px-3 text-red-600 hover:bg-red-50"><Trash2 size={18} /></button>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs"><span className="font-semibold">Quick select:</span><button type="button" onClick={() => updateHead(index, { months: allMonths })}>All months</button><span>·</span><button type="button" onClick={() => updateHead(index, { months: [] })}>Clear</button><span>·</span><button type="button" onClick={() => updateHead(index, { months: [4, 7, 10, 1] })}>Quarterly</button>{index > 0 && <><span>·</span><button type="button" onClick={() => updateHead(index, { months: [...form.components[index - 1].months] })}><Copy size={12} className="mr-1 inline" />Copy previous</button></>}</div>
        <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6 lg:grid-cols-12">{MONTHS.map((month) => <button type="button" key={month.number} onClick={() => toggleMonth(index, month.number)} aria-pressed={head.months.includes(month.number)} className={`rounded-lg border px-2 py-2 text-sm font-semibold ${head.months.includes(month.number) ? 'border-blue-600 bg-blue-600 text-white' : 'border-slate-200 dark:border-slate-700'}`}>{month.short}</button>)}</div>
        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={head.differentAmounts} onChange={(event) => updateHead(index, { differentAmounts: event.target.checked })} />Use different amounts in selected months</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={head.newAdmissionsOnly} onChange={(event) => updateHead(index, { newAdmissionsOnly: event.target.checked })} />New admissions only</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={head.fromAdmissionMonth} onChange={(event) => updateHead(index, { fromAdmissionMonth: event.target.checked })} />For mid-session admissions, charge from admission month</label></div>
        {head.differentAmounts && <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">{MONTHS.filter((month) => head.months.includes(month.number)).map((month) => <label key={month.number} className="text-xs">{month.short}<input type="number" min="0" step="0.01" className={`${field} mt-1`} value={head.monthAmounts[month.number] ?? head.amount} onChange={(event) => updateHead(index, { monthAmounts: { ...head.monthAmounts, [month.number]: event.target.value } })} /></label>)}</div>}
        <p className="mt-3 text-right text-sm font-semibold">Fee-head total: {money(head.months.reduce((total, month) => total + Number(head.differentAmounts ? head.monthAmounts[month] ?? head.amount : head.amount || 0), 0))}</p>
      </div>)}
      <button type="button" onClick={() => addHead()} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 font-semibold"><Plus size={16} />Add custom fee head</button>
    </div>}

    {step === 3 && <div className="space-y-3">{form.components.map((head, index) => <div key={head.code} className="grid gap-3 rounded-xl border p-4 dark:border-slate-800 sm:grid-cols-[1fr_180px_180px]"><div><p className="font-semibold">{head.name}</p><p className="text-sm text-slate-500">{head.months.length} installment{head.months.length === 1 ? '' : 's'}</p></div><label>Due day<input type="number" min="1" max="28" className={`${field} mt-1`} value={head.dueDay} onChange={(event) => updateHead(index, { dueDay: Number(event.target.value) })} /></label><label>Grace period (days)<input type="number" min="0" className={`${field} mt-1`} value={head.gracePeriodDays} onChange={(event) => updateHead(index, { gracePeriodDays: Number(event.target.value) })} /></label></div>)}</div>}

    {step === 4 && <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4"><Metric label="Class" value={selectedClass?.className || '—'} /><Metric label="Sections" value={selectedClass?.sections.length || 0} /><Metric label="Students affected" value={preview?.affectedStudents ?? '—'} /><Metric label="Annual fee / student" value={money(annualTotal)} /></div>
      <div className="overflow-x-auto rounded-xl border dark:border-slate-800"><table className="min-w-full text-sm"><thead className="bg-slate-50 dark:bg-slate-950"><tr><th className="p-3 text-left">Fee head</th>{MONTHS.map((month) => <th key={month.number} className="p-2 text-right">{month.short}</th>)}<th className="p-3 text-right">Total</th></tr></thead><tbody>{form.components.map((head) => <tr key={head.code} className="border-t dark:border-slate-800"><td className="p-3 font-medium">{head.name}</td>{MONTHS.map((month) => <td key={month.number} className="p-2 text-right">{head.months.includes(month.number) ? money(head.differentAmounts ? head.monthAmounts[month.number] ?? head.amount : head.amount) : '—'}</td>)}<td className="p-3 text-right font-semibold">{money(head.months.reduce((total, month) => total + Number(head.differentAmounts ? head.monthAmounts[month] ?? head.amount : head.amount || 0), 0))}</td></tr>)}<tr className="border-t bg-slate-50 font-bold dark:border-slate-800 dark:bg-slate-950"><td className="p-3">Monthly total</td>{MONTHS.map((month) => <td key={month.number} className="p-2 text-right">{money(monthlyTotals[month.number])}</td>)}<td className="p-3 text-right">{money(annualTotal)}</td></tr></tbody></table></div>
      {preview?.conflicts?.length > 0 && <div className="flex gap-3 rounded-xl bg-amber-50 p-4 text-amber-900 dark:bg-amber-950/30 dark:text-amber-100"><AlertTriangle className="shrink-0" /><div><p className="font-semibold">Existing higher-priority assignments found</p><p className="text-sm">{preview.conflicts.length} student record(s) will be protected from duplicate charges.</p></div></div>}
      <div className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-100">Publishing creates idempotent dues for all active students in this class. Published history and paid transactions cannot be silently overwritten.</div>
    </div>}

    <div className="sticky bottom-0 mt-8 flex justify-between border-t bg-white/95 pt-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/95">
      <button type="button" disabled={step === 0 || busy} onClick={() => setStep((current) => current - 1)} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 disabled:opacity-40"><ArrowLeft size={16} />Back</button>
      {step < STEPS.length - 1 ? <button type="button" disabled={busy} onClick={next} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Preparing preview…' : 'Continue'}<ArrowRight size={16} /></button> : <button type="button" disabled={busy || !preview} onClick={publish} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white disabled:opacity-50"><Check size={16} />{busy ? 'Publishing…' : 'Publish class plan'}</button>}
    </div>
  </div>;
}

function Metric({ label, value }) { return <div className="rounded-xl border p-4 dark:border-slate-800"><p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p><p className="mt-1 text-xl font-bold">{value}</p></div>; }
