import React, { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import securityService from '../../services/securityService';
import PasswordInput from '../ui/PasswordInput';

export default function SecuritySettingsCard() {
  const queryClient = useQueryClient();
  const settings = useQuery({ queryKey: ['profile-security'], queryFn: securityService.settings });
  const available = settings.data?.data?.availableQuestions || [];
  const [currentPassword, setCurrentPassword] = useState('');
  const [questions, setQuestions] = useState([{ questionKey: '', answer: '' }, { questionKey: '', answer: '' }]);
  useEffect(() => {
    const selected = settings.data?.data?.selectedQuestions;
    if (selected?.length) setQuestions(selected.map((item) => ({ questionKey: item.questionKey, answer: '' })));
  }, [settings.data]);
  const mutation = useMutation({ mutationFn: securityService.configureQuestions, onSuccess: () => { toast.success('Security questions saved'); setCurrentPassword(''); queryClient.invalidateQueries({ queryKey: ['profile-security'] }); }, onError: (error) => toast.error(error.response?.data?.message || 'Could not save security questions') });
  const update = (index, field, value) => setQuestions((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  const submit = (event) => { event.preventDefault(); mutation.mutate({ currentPassword, questions }); };

  return <section id="security-settings" className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-6 text-[var(--text-primary)] shadow-sm">
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-bold text-[var(--text-primary)]">Account recovery</h2><p className="mt-1 text-sm text-[var(--text-muted)]">Choose two or three private questions. Saved answers are hashed and can never be displayed.</p></div>{settings.data?.data?.configured ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700"><CheckCircle2 size={14}/> Configured</span> : <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700"><ShieldAlert size={14}/> Setup required</span>}</div>
    {settings.isLoading ? <div className="mt-5 h-28 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" /> : <form onSubmit={submit} className="mt-5 space-y-4">
      {questions.map((item, index) => <div key={index} className="grid gap-3 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-muted)] p-4 md:grid-cols-2"><label className="space-y-1 text-sm font-medium">Question {index + 1}<select required className="h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3" value={item.questionKey} onChange={(event) => update(index, 'questionKey', event.target.value)}><option value="">Select a question</option>{available.map((question) => <option key={question.questionKey} value={question.questionKey} disabled={questions.some((selected, selectedIndex) => selectedIndex !== index && selected.questionKey === question.questionKey)}>{question.question}</option>)}</select></label><label className="space-y-1 text-sm font-medium">New answer<input required minLength={3} autoComplete="off" className="h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-3" value={item.answer} onChange={(event) => update(index, 'answer', event.target.value)} /></label></div>)}
      <div className="flex flex-wrap items-end gap-3"><button type="button" disabled={questions.length >= 3} onClick={() => setQuestions((items) => [...items, { questionKey: '', answer: '' }])} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-semibold disabled:opacity-40">Add third question</button>{questions.length === 3 && <button type="button" onClick={() => setQuestions((items) => items.slice(0, 2))} className="rounded-xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-semibold">Remove third</button>}<div className="min-w-[240px] flex-1"><PasswordInput label="Confirm current password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></div><button disabled={mutation.isPending} className="h-11 rounded-xl bg-[var(--school-primary)] px-5 text-sm font-bold text-[var(--on-primary)] disabled:opacity-60">{mutation.isPending ? 'Saving…' : 'Save security setup'}</button></div>
    </form>}
  </section>;
}
