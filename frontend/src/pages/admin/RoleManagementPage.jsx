import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Plus, ShieldCheck, UserRoundCog } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { roleManagementService } from '../../services/roleManagementService';

const ROLE_OPTIONS = ['TEACHER', 'CLASS_TEACHER', 'EXAM_CONTROLLER', 'CURRICULUM_MANAGER', 'FEE_MANAGER', 'HR_MANAGER', 'ADMIN', 'PRINCIPAL'];
const label = (value) => value.split('_').map((part) => part[0] + part.slice(1).toLowerCase()).join(' ');

export default function RoleManagementPage() {
  const [users, setUsers] = useState([]);
  const [selectedId, setSelectedId] = useState('');
  const [profile, setProfile] = useState(null);
  const [templates, setTemplates] = useState({});
  const [policy, setPolicy] = useState({ mode: 'STRICT', principalApprovalRequired: false });
  const [form, setForm] = useState({ role: 'TEACHER', isActive: true, isDefault: false, validFrom: '', validUntil: '', assignmentNotes: '' });
  const [saving, setSaving] = useState(false);

  const loadProfile = async (id) => { setSelectedId(id); setProfile(id ? await roleManagementService.getRoles(id) : null); };
  useEffect(() => { Promise.all([roleManagementService.listUsers(), roleManagementService.getTemplates(), roleManagementService.getPolicy()]).then(([rows, roleTemplates, savedPolicy]) => { setUsers(Array.isArray(rows) ? rows : rows?.users || []); setTemplates(roleTemplates); setPolicy(savedPolicy); }).catch((error) => toast.error(error.message || 'Could not load role management')); }, []);

  const save = async (role = form.role) => {
    if (!selectedId) return toast.error('Choose a staff member first');
    setSaving(true);
    try { await roleManagementService.saveRole(selectedId, { ...form, role, validFrom: form.validFrom || null, validUntil: form.validUntil || null }); await loadProfile(selectedId); toast.success('Assigned responsibilities updated'); }
    catch (error) { toast.error(error.response?.data?.message || error.message || 'Could not update responsibility'); }
    finally { setSaving(false); }
  };

  const applyTemplate = async (roles) => {
    if (!selectedId) return toast.error('Choose a staff member first');
    setSaving(true);
    try { for (const role of roles) await roleManagementService.saveRole(selectedId, { role, isActive: true }); await loadProfile(selectedId); toast.success('Role template applied'); }
    catch (error) { toast.error(error.response?.data?.message || 'Could not apply template'); }
    finally { setSaving(false); }
  };

  return (
    <DashboardLayout role="ADMIN"><div className="space-y-6">
      <header><p className="text-sm font-bold uppercase tracking-widest text-[var(--school-primary)]">People & access</p><h1 className="mt-1 text-3xl font-black">Assigned responsibilities</h1><p className="mt-2 text-[var(--text-muted)]">Give one staff account separate workspaces without creating another login.</p></header>
      <section className="grid gap-5 xl:grid-cols-[.8fr_1.2fr]">
        <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-5 shadow-sm">
          <label className="text-sm font-bold">Staff member</label><select value={selectedId} onChange={(event) => loadProfile(event.target.value)} className="mt-2 h-11 w-full rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3"><option value="">Choose staff member</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name} — {user.email}</option>)}</select>
          <h2 className="mt-6 font-bold">Quick templates</h2><div className="mt-3 space-y-2">{Object.entries(templates).map(([name, roles]) => <button key={name} disabled={saving} onClick={() => applyTemplate(roles)} className="w-full rounded-xl border border-[var(--border-soft)] p-3 text-left hover:bg-[var(--surface-hover)]"><span className="block text-sm font-bold">{label(name)}</span><span className="text-xs text-[var(--text-muted)]">{roles.map(label).join(' · ')}</span></button>)}</div>
        </div>
        <div className="space-y-5">
          <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-5 shadow-sm"><div className="flex items-center gap-3"><UserRoundCog className="text-[var(--school-primary)]" /><div><h2 className="font-bold">{profile?.name || 'Choose a staff member'}</h2><p className="text-sm text-[var(--text-muted)]">{profile?.email || 'Assigned workspaces will appear here'}</p></div></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{profile?.roleAssignments?.map((item) => <div key={item.id} className="rounded-2xl border border-[var(--border-soft)] p-4"><div className="flex justify-between"><span className="font-bold">{label(item.role)}</span>{item.isActive ? <CheckCircle2 className="text-emerald-600" size={18} /> : <span className="text-xs text-red-600">Inactive</span>}</div><p className="mt-2 text-xs text-[var(--text-muted)]">{item.isDefault ? 'Default workspace · ' : ''}{item.validUntil ? `Until ${new Date(item.validUntil).toLocaleDateString()}` : 'No expiry'}</p></div>)}</div></div>
          <div className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold"><Plus size={18} /> Add or update responsibility</h2><div className="mt-4 grid gap-3 sm:grid-cols-2"><select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })} className="h-11 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3">{ROLE_OPTIONS.map((role) => <option key={role}>{role}</option>)}</select><input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} className="h-11 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3" aria-label="Expiry date" /><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.isDefault} onChange={(e) => setForm({ ...form, isDefault: e.target.checked })} /> Default workspace</label><button disabled={saving || !selectedId} onClick={() => save()} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[var(--school-primary)] font-bold text-white disabled:opacity-50">{saving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />} Save responsibility</button></div></div>
        </div>
      </section>
      <section className="rounded-3xl border border-[var(--border-soft)] bg-[var(--surface-elevated)] p-5 shadow-sm"><h2 className="flex items-center gap-2 font-bold"><ShieldCheck size={18} /> Separation of duties</h2><div className="mt-4 flex flex-wrap gap-3"><select value={policy.mode} onChange={(e) => setPolicy({ ...policy, mode: e.target.value })} className="h-11 rounded-xl border border-[var(--border-soft)] bg-[var(--surface-base)] px-3"><option value="STRICT">Strict</option><option value="PRINCIPAL_APPROVAL">Allow with Principal approval</option><option value="AUDIT_WARNING">Allow with audit warning</option></select><button onClick={async () => { await roleManagementService.savePolicy(policy); toast.success('Approval safeguards updated'); }} className="rounded-xl bg-slate-900 px-5 font-bold text-white dark:bg-white dark:text-slate-900">Save safeguards</button></div></section>
    </div></DashboardLayout>
  );
}
