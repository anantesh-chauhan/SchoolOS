import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BarChart3, BellRing, CheckCircle2, Inbox as InboxIcon, Loader2, MessageSquare, Plus, RefreshCw, Send, Settings2, Users, X } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { authService } from '../../services/authService';
import { communicationService } from '../../services/communicationService';

const managers = new Set(['SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER', 'FEE_MANAGER', 'TEACHER']);
const field = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100';
const card = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900';

const principalKey = (user) => user?.role === 'STUDENT' ? `student:${user.studentId || user.id}` : user?.role === 'PARENT' ? `parent:${user.email}` : `user:${user?.id}`;

const announcementConfig = (role) => {
  if (role === 'TEACHER') return { category: 'ACADEMIC', audiences: ['CLASS', 'SECTION', 'DIRECT'] };
  if (role === 'FEE_MANAGER') return { category: 'FEE', audiences: ['ROLE', 'CLASS', 'SECTION', 'DIRECT'] };
  return { category: role === 'CURRICULUM_MANAGER' ? 'ACADEMIC' : 'GENERAL', audiences: ['SCHOOL_WIDE', 'STAFF', 'ROLE', 'DIRECT'] };
};

const conversationTypes = (role) => ({
  PARENT: ['PARENT_TEACHER', 'FEE_SUPPORT', 'ACADEMIC_SUPPORT', 'DIRECT'],
  STUDENT: ['STUDENT_TEACHER', 'ACADEMIC_SUPPORT', 'DIRECT'],
  FEE_MANAGER: ['FEE_SUPPORT'],
  CURRICULUM_MANAGER: ['ACADEMIC_SUPPORT', 'DIRECT'],
  STAFF: ['DIRECT'],
  TEACHER: ['DIRECT', 'PARENT_TEACHER', 'STUDENT_TEACHER', 'ACADEMIC_SUPPORT'],
  SCHOOL_OWNER: ['DIRECT', 'ADMIN_STAFF', 'PARENT_TEACHER', 'FEE_SUPPORT', 'ACADEMIC_SUPPORT'],
  ADMIN: ['DIRECT', 'ADMIN_STAFF', 'PARENT_TEACHER', 'FEE_SUPPORT', 'ACADEMIC_SUPPORT'],
}[role] || ['DIRECT']);

function ErrorState({ message, onRetry }) {
  return <div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center dark:border-rose-900 dark:bg-rose-950/20"><p className="text-sm font-semibold text-rose-700 dark:text-rose-300">{message}</p><button type="button" onClick={onRetry} className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-rose-700 dark:text-rose-300"><RefreshCw size={15} />Retry</button></div>;
}

function AnnouncementComposer({ user, onCreated }) {
  const config = useMemo(() => announcementConfig(user?.role), [user?.role]);
  const initial = useMemo(() => ({ title: '', content: '', category: config.category, priority: 'NORMAL', audience: config.audiences[0], role: '', targetId: '', recipientGroup: user?.role === 'FEE_MANAGER' ? 'PARENT' : 'BOTH', requiresAcknowledgement: false, publishAt: '', expiresAt: '' }), [config, user?.role]);
  const [form, setForm] = useState(initial);
  const [options, setOptions] = useState(null);
  const [optionsError, setOptionsError] = useState(false);
  const [busy, setBusy] = useState(false);

  const loadOptions = () => {
    setOptionsError(false);
    communicationService.audienceOptions().then((result) => {
      setOptions(result);
      setForm((old) => ({ ...old, audience: result.audiences.includes(old.audience) ? old.audience : result.audiences[0], role: result.roles.includes(old.role) ? old.role : result.roles[0] || '', recipientGroup: result.recipientGroups.includes(old.recipientGroup) ? old.recipientGroup : result.recipientGroups[0] || 'PARENT', targetId: '' }));
    }).catch(() => setOptionsError(true));
  };
  useEffect(loadOptions, []);

  const submit = async (event) => {
    event.preventDefault();
    const scopedAudience = ['CLASS', 'SECTION', 'SUBJECT', 'DIRECT', 'PARENT_OF_STUDENT'].includes(form.audience);
    if (scopedAudience && !form.targetId) return toast.error('Choose an audience target');
    setBusy(true);
    try {
      const entityIds = scopedAudience ? [form.targetId] : [];
      const groupRoles = form.recipientGroup === 'BOTH' ? ['STUDENT', 'PARENT'] : [form.recipientGroup];
      const metadata = ['CLASS', 'SECTION', 'SUBJECT'].includes(form.audience) ? { roles: groupRoles, ...(form.audience === 'SUBJECT' ? { includeStudents: true, includeTeachers: false } : {}) } : null;
      await communicationService.createAnnouncement({
        title: form.title,
        content: form.content,
        category: form.category,
        priority: form.category === 'EMERGENCY' ? 'EMERGENCY' : form.priority,
        requiresAcknowledgement: form.requiresAcknowledgement || form.category === 'EMERGENCY',
        publishAt: form.publishAt || null,
        expiresAt: form.expiresAt || null,
        audienceRules: [{ kind: form.audience, role: form.audience === 'ROLE' ? form.role : null, entityIds, metadata }],
      });
      toast.success(form.publishAt ? 'Announcement scheduled' : 'Announcement published');
      setForm({ ...initial });
      onCreated?.();
    } catch (error) {
      toast.error(error.response?.data?.message || 'Could not create announcement');
    } finally { setBusy(false); }
  };

  const categories = user?.role === 'FEE_MANAGER' ? ['FEE'] : user?.role === 'TEACHER' ? ['ACADEMIC', 'HOMEWORK', 'RESOURCE', 'ATTENDANCE', 'GENERAL'] : user?.role === 'CURRICULUM_MANAGER' ? ['ACADEMIC', 'HOMEWORK', 'RESOURCE', 'EXAM', 'RESULT', 'EVENT', 'HOLIDAY', 'GENERAL'] : ['GENERAL', 'ACADEMIC', 'HOMEWORK', 'ATTENDANCE', 'FEE', 'EXAM', 'RESULT', 'EVENT', 'HOLIDAY', 'EMERGENCY'];
  const targetItems = form.audience === 'CLASS' ? options?.classes : form.audience === 'SECTION' ? options?.sections : form.audience === 'SUBJECT' ? options?.subjects : form.audience === 'DIRECT' ? options?.people?.map((person) => ({ id: person.key, name: `${person.name} · ${person.role}${person.className ? ` · ${person.className} ${person.section}` : ''}` })) : form.audience === 'PARENT_OF_STUDENT' ? options?.students?.filter((student) => student.hasParent).map((student) => ({ id: student.id, name: `${student.parentName || 'Parent'} · parent of ${student.name} · ${student.className} ${student.section}` })) : [];
  const targetLabel = form.audience === 'CLASS' ? 'Class' : form.audience === 'SECTION' ? 'Section' : form.audience === 'SUBJECT' ? 'Subject' : form.audience === 'PARENT_OF_STUDENT' ? 'Student’s parent' : 'Individual recipient';
  if (optionsError) return <ErrorState message="Could not load your permitted communication audiences." onRetry={loadOptions} />;
  return <form onSubmit={submit} className={`${card} space-y-4`}>
    <div className="flex items-start justify-between gap-4"><div><h2 className="text-lg font-black">Compose notification</h2><p className="text-xs text-slate-500">Bulk and individual recipients are limited automatically by your role and teaching assignments.</p></div><BellRing className="text-blue-600" size={22} /></div>
    <div className="grid gap-3 md:grid-cols-2"><label><span className="mb-1 block text-xs font-bold text-slate-500">Title</span><input required placeholder="Announcement title" className={field} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><div className="grid grid-cols-2 gap-2"><label><span className="mb-1 block text-xs font-bold text-slate-500">Category</span><select className={field} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((value) => <option key={value}>{value}</option>)}</select></label><label><span className="mb-1 block text-xs font-bold text-slate-500">Priority</span><select className={field} value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>{['LOW', 'NORMAL', 'HIGH', 'URGENT', 'EMERGENCY'].map((value) => <option key={value}>{value}</option>)}</select></label></div></div>
    <label><span className="mb-1 block text-xs font-bold text-slate-500">Message</span><textarea required rows="5" placeholder="Write a clear school update…" className={field} value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label>
    <div className="grid gap-3 md:grid-cols-4"><label><span className="mb-1 block text-xs font-bold text-slate-500">Send to</span><select className={field} disabled={!options} value={form.audience} onChange={(event) => setForm({ ...form, audience: event.target.value, targetId: '' })}><option value="">{options ? 'Choose audience' : 'Loading your scope…'}</option>{(options?.audiences || []).map((value) => <option key={value} value={value}>{value === 'PARENT_OF_STUDENT' ? 'Specific parent' : value === 'DIRECT' ? 'Specific person' : value.replaceAll('_', ' ')}</option>)}</select></label>{form.audience === 'ROLE' ? <label><span className="mb-1 block text-xs font-bold text-slate-500">Permitted role</span><select required className={field} value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>{(options?.roles || []).map((value) => <option key={value}>{value.replaceAll('_', ' ')}</option>)}</select></label> : targetItems ? <label><span className="mb-1 block text-xs font-bold text-slate-500">{targetLabel}</span><select required={['CLASS', 'SECTION', 'SUBJECT', 'DIRECT', 'PARENT_OF_STUDENT'].includes(form.audience)} className={field} value={form.targetId} onChange={(event) => setForm({ ...form, targetId: event.target.value })}><option value="">Choose {targetLabel.toLowerCase()}</option>{targetItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label> : <div />}{['CLASS', 'SECTION', 'SUBJECT'].includes(form.audience) ? <label><span className="mb-1 block text-xs font-bold text-slate-500">Recipients</span><select className={field} value={form.recipientGroup} onChange={(event) => setForm({ ...form, recipientGroup: event.target.value })}>{(options?.recipientGroups || []).map((value) => <option key={value}>{value === 'BOTH' ? 'Students and parents' : value === 'PARENT' ? 'Parents only' : 'Students only'}</option>)}</select></label> : <div />}<label><span className="mb-1 block text-xs font-bold text-slate-500">Schedule (optional)</span><input type="datetime-local" className={field} value={form.publishAt} onChange={(event) => setForm({ ...form, publishAt: event.target.value })} /></label></div>
    {user?.role === 'TEACHER' && <p className="rounded-xl bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 dark:bg-blue-950/30 dark:text-blue-300">Your scope: {options?.classes?.length || 0} assigned classes · {options?.sections?.length || 0} assigned sections · {options?.students?.length || 0} students. School-wide sending is not permitted.</p>}
    <div className="flex flex-wrap items-center justify-between gap-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.requiresAcknowledgement} onChange={(event) => setForm({ ...form, requiresAcknowledgement: event.target.checked })} />Require acknowledgement</label><button disabled={busy} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-60">{busy ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}Send or schedule</button></div>
  </form>;
}

function Announcements({ user }) {
  const [data, setData] = useState(null); const [error, setError] = useState(false);
  const load = () => { setError(false); return communicationService.announcements().then(setData).catch(() => setError(true)); };
  useEffect(() => { load(); }, []);
  return <div className="space-y-5"><AnnouncementComposer user={user} onCreated={load} />{error ? <ErrorState message="Could not load announcements." onRetry={load} /> : <div className={card}><div className="flex items-center justify-between"><h2 className="font-black">Recent announcements</h2><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{data?.total || 0} total</span></div><div className="mt-4 space-y-3">{!data ? <Loader2 className="animate-spin" /> : !data.items?.length ? <p className="py-8 text-center text-sm text-slate-500">No announcements yet.</p> : data.items.map((row) => <article key={row.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4 dark:border-slate-700"><div><div className="flex gap-2"><span className="text-xs font-black text-blue-600">{row.category}</span><span className="text-xs text-slate-400">{row.status}</span></div><p className="mt-1 font-bold">{row.title}</p><p className="mt-1 text-xs text-slate-500">{row.notification.resolvedRecipientCount} recipients · {new Date(row.createdAt).toLocaleString()}</p></div>{row.status === 'SCHEDULED' && <button onClick={() => communicationService.publishAnnouncement(row.id).then(() => { toast.success('Published'); load(); }).catch((error) => toast.error(error.response?.data?.message || 'Could not publish'))} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">Publish now</button>}</article>)}</div></div>}</div>;
}

function NewConversation({ user, onCreated }) {
  const types = useMemo(() => conversationTypes(user?.role), [user?.role]);
  const [open, setOpen] = useState(false); const [people, setPeople] = useState([]); const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ participantKey: '', subject: '', message: '', type: types[0] });
  useEffect(() => { if (!open) return; setLoading(true); communicationService.directory().then(setPeople).catch(() => toast.error('Could not load permitted recipients')).finally(() => setLoading(false)); }, [open]);
  const submit = async (event) => { event.preventDefault(); setBusy(true); try { await communicationService.createConversation({ type: form.type, subject: form.subject, participantKeys: [form.participantKey], message: form.message }); toast.success('Conversation started'); setOpen(false); setForm({ participantKey: '', subject: '', message: '', type: types[0] }); onCreated(); } catch (error) { toast.error(error.response?.data?.message || 'Could not start conversation'); } finally { setBusy(false); } };
  if (!open) return <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white"><Plus size={14} />New conversation</button>;
  return <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm"><form onSubmit={submit} className="w-full max-w-md space-y-3 rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900"><div className="flex items-center justify-between"><h3 className="font-black">Start a conversation</h3><button type="button" onClick={() => setOpen(false)}><X size={18} /></button></div><select required className={field} value={form.participantKey} disabled={loading} onChange={(event) => setForm({ ...form, participantKey: event.target.value })}><option value="">{loading ? 'Loading permitted recipients…' : 'Choose recipient'}</option>{people.map((person) => <option key={person.key} value={person.key}>{person.name} · {person.role}</option>)}</select><select className={field} value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value })}>{types.map((value) => <option key={value}>{value.replaceAll('_', ' ')}</option>)}</select><input required className={field} placeholder="Subject" value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /><textarea required rows="4" className={field} placeholder="Write the first message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} /><button disabled={busy} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-sm font-bold text-white disabled:opacity-50">{busy && <Loader2 size={15} className="animate-spin" />}Start conversation</button></form></div>;
}

function Inbox({ user, initialConversationId }) {
  const selfKey = principalKey(user); const [list, setList] = useState(null); const [error, setError] = useState(false); const [active, setActive] = useState(null); const [detail, setDetail] = useState(null); const [opening, setOpening] = useState(false); const [message, setMessage] = useState(''); const [sending, setSending] = useState(false);
  const openedInitial = useRef(false);
  const load = () => { setError(false); return communicationService.conversations().then(setList).catch(() => setError(true)); };
  const open = async (row) => { setActive(row.id); setOpening(true); try { const result = await communicationService.conversation(row.id); setDetail(result); await communicationService.readConversation(row.id); await load(); } catch (requestError) { toast.error(requestError.response?.data?.message || 'Could not open conversation'); } finally { setOpening(false); } };
  useEffect(() => {
    load();
    const refreshWhenVisible = () => {
      if (document.visibilityState === 'visible') load();
    };
    const timer = setInterval(refreshWhenVisible, 15000);
    document.addEventListener('visibilitychange', refreshWhenVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshWhenVisible);
    };
  }, []);
  useEffect(() => {
    if (!initialConversationId || openedInitial.current || !list) return;
    openedInitial.current = true;
    open({ id: initialConversationId });
  }, [initialConversationId, list]);
  const send = async (event) => { event.preventDefault(); if (!message.trim() || !active) return; setSending(true); try { await communicationService.sendMessage(active, { content: message }); setMessage(''); await open({ id: active }); } catch (requestError) { toast.error(requestError.response?.data?.message || 'Could not send message'); } finally { setSending(false); } };
  if (error) return <ErrorState message="Could not load conversations." onRetry={load} />;
  return <div className="relative grid gap-4 lg:grid-cols-[340px_1fr]"><div className={`${card} overflow-hidden p-0`}><div className="flex items-center justify-between border-b p-4 dark:border-slate-800"><div><h2 className="font-black">Conversations</h2><p className="text-[11px] text-slate-500">{list?.total || 0} secure thread{list?.total === 1 ? '' : 's'}</p></div><NewConversation user={user} onCreated={load} /></div>{!list ? <Loader2 className="m-8 animate-spin" /> : !list.items?.length ? <div className="p-10 text-center"><InboxIcon className="mx-auto text-slate-300" /><p className="mt-3 text-sm font-semibold">No conversations yet</p><p className="mt-1 text-xs text-slate-500">Start a secure conversation with an authorized recipient.</p></div> : list.items.map((row) => { const self = row.participants.find((participant) => participant.participantKey === selfKey); const latest = row.messages?.[0]; const unread = latest && latest.senderKey !== selfKey && (!self?.lastReadAt || new Date(latest.createdAt) > new Date(self.lastReadAt)); return <button key={row.id} onClick={() => open(row)} className={`block w-full border-b p-4 text-left dark:border-slate-800 ${active === row.id ? 'bg-blue-50 dark:bg-blue-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800'}`}><div className="flex items-start justify-between gap-2"><p className="truncate font-bold">{row.subject || row.type.replaceAll('_', ' ')}</p>{unread && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-600" />}</div><p className="mt-1 truncate text-xs text-slate-500">{latest?.content || 'No messages'}</p><p className="mt-2 text-[10px] font-bold uppercase text-slate-400">{row.type.replaceAll('_', ' ')}</p></button>; })}</div><div className={`${card} flex min-h-[560px] flex-col`}>{opening ? <Loader2 className="m-auto animate-spin" /> : !detail ? <div className="m-auto text-center text-sm text-slate-500"><MessageSquare className="mx-auto mb-2 h-10 w-10 text-slate-300" />Choose a conversation</div> : <><div className="border-b pb-3 dark:border-slate-800"><h2 className="font-black">{detail.subject || detail.type.replaceAll('_', ' ')}</h2><p className="text-xs text-slate-500">{detail.participants.length} participants · {detail.status}</p></div><div className="flex-1 space-y-3 overflow-auto py-4">{[...(detail.messages || [])].reverse().map((row) => <div key={row.id} className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${row.senderKey === selfKey ? 'ml-auto bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800'}`}><p>{row.content}</p><time className="mt-1 block text-[10px] opacity-60">{new Date(row.createdAt).toLocaleString()}</time></div>)}</div>{detail.status === 'OPEN' && <form onSubmit={send} className="flex gap-2 border-t pt-3 dark:border-slate-800"><input aria-label="Message" className={field} placeholder="Write a message" value={message} onChange={(event) => setMessage(event.target.value)} /><button disabled={sending || !message.trim()} className="rounded-xl bg-blue-600 px-4 text-white disabled:opacity-50" aria-label="Send">{sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}</button></form>}</>}</div></div>;
}

function Preferences() {
  const [data, setData] = useState(null); const [error, setError] = useState(false); const [saving, setSaving] = useState(false);
  const load = () => { setError(false); communicationService.preferences().then(setData).catch(() => setError(true)); };
  useEffect(load, []);
  if (error) return <ErrorState message="Could not load notification preferences." onRetry={load} />;
  if (!data) return <Loader2 className="animate-spin" />;
  const categories = ['GENERAL', 'ACADEMIC', 'HOMEWORK', 'ATTENDANCE', 'FEE', 'EXAM', 'RESULT', 'EVENT', 'EMERGENCY', 'SECURITY'];
  const rows = categories.map((category) => data.preferences.find((preference) => preference.category === category) || { category, inAppEnabled: true, emailEnabled: true, pushEnabled: false, smsEnabled: false });
  const toggle = (category, key) => setData({ ...data, preferences: rows.map((row) => row.category === category ? { ...row, [key]: !row[key] } : row) });
  const save = async () => { setSaving(true); try { await communicationService.updatePreferences(rows); toast.success('Preferences saved'); await communicationService.preferences().then(setData); } catch { toast.error('Could not save preferences'); } finally { setSaving(false); } };
  return <div className={card}><h2 className="text-lg font-black">Notification preferences</h2><p className="text-sm text-slate-500">Emergency, security and legal notices always remain enabled.</p><div className="mt-5 overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase text-slate-500 dark:border-slate-700"><th className="py-3">Category</th>{['In app', 'Email', 'SMS', 'Push'].map((value) => <th key={value} className="text-center">{value}</th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.category} className="border-b dark:border-slate-800"><td className="py-3 font-bold">{row.category}</td>{['inAppEnabled', 'emailEnabled', 'smsEnabled', 'pushEnabled'].map((key) => <td key={key} className="text-center"><input aria-label={`${row.category} ${key}`} type="checkbox" disabled={data.mandatoryCategories.includes(row.category) && ['inAppEnabled', 'emailEnabled'].includes(key)} checked={Boolean(row[key])} onChange={() => toggle(row.category, key)} /></td>)}</tr>)}</tbody></table></div><button disabled={saving} onClick={save} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-black text-white disabled:opacity-50">{saving ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}Save preferences</button></div>;
}

function Analytics() {
  const [summary, setSummary] = useState(null); const [error, setError] = useState(false);
  const load = () => { setError(false); communicationService.summary().then(setSummary).catch(() => setError(true)); };
  useEffect(load, []);
  if (error) return <ErrorState message="Could not load communication analytics." onRetry={load} />;
  if (!summary) return <Loader2 className="animate-spin" />;
  const metrics = [['Sent today', summary.sentToday], ['Active', summary.active], ['Scheduled', summary.scheduled], ['Unread', summary.unread], ['Acknowledgements pending', summary.pendingAcknowledgements]];
  return <div className="space-y-5"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{metrics.map(([label, value]) => <div className={card} key={label}><p className="text-xs font-bold uppercase text-slate-500">{label}</p><p className="mt-2 text-3xl font-black">{value}</p></div>)}</div><div className={card}><h2 className="font-black">Delivery by channel and status</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{summary.delivery.length ? summary.delivery.map((row) => <div key={`${row.channel}-${row.status}`} className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950"><p className="text-xs font-bold text-slate-500">{row.channel} · {row.status}</p><p className="mt-1 text-xl font-black">{typeof row._count === 'number' ? row._count : row._count?._all || 0}</p></div>) : <p className="text-sm text-slate-500">No delivery activity yet.</p>}</div></div></div>;
}

export default function CommunicationWorkspacePage() {
  const user = authService.getCurrentUser();
  const [searchParams] = useSearchParams();
  const available = [...(managers.has(user?.role) ? [{ id: 'announcements', label: 'Announcements', icon: BellRing }] : []), { id: 'inbox', label: 'Inbox', icon: MessageSquare }, { id: 'preferences', label: 'Preferences', icon: Settings2 }, ...(['SCHOOL_OWNER', 'ADMIN'].includes(user?.role) ? [{ id: 'analytics', label: 'Analytics', icon: BarChart3 }] : [])];
  const requestedTab = searchParams.get('tab');
  const [tab, setTab] = useState(available.some((item) => item.id === requestedTab) ? requestedTab : available[0]?.id || 'inbox');
  return <DashboardLayout role={user?.role}><section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-gradient-to-r from-blue-700 via-indigo-700 to-violet-700 p-6 text-white shadow-lg"><div><p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-200">School workspace</p><h1 className="mt-2 text-2xl font-black">Communication Hub</h1><p className="mt-1 text-sm text-blue-100">Announcements, secure conversations, delivery status and notification preferences.</p></div><div className="flex gap-2"><span className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold"><Users size={15} />{user?.role?.replaceAll('_', ' ')}</span><Link to="/notifications" className="inline-flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-xs font-bold text-indigo-700"><BellRing size={15} />Notifications</Link></div></div><div className="flex gap-2 overflow-auto rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-800 dark:bg-slate-900">{available.map((item) => { const Icon = item.icon; return <button key={item.id} onClick={() => setTab(item.id)} className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold ${tab === item.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><Icon size={16} />{item.label}</button>; })}</div>{tab === 'announcements' && <Announcements user={user} />}{tab === 'inbox' && <Inbox user={user} initialConversationId={searchParams.get('conversation')} />}{tab === 'preferences' && <Preferences />}{tab === 'analytics' && <Analytics />}</section></DashboardLayout>;
}
