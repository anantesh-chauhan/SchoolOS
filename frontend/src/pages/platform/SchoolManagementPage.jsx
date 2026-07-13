import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { schoolService } from '../../services/managementService';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Modal } from '../../components/ui/dialog';
import { Badge } from '../../components/ui/badge';

const initialSchool = {
  schoolName: '',
  schoolCode: '',
  logoUrl: '',
  address: '',
  city: '',
  state: '',
  phone: '',
  email: '',
  ownerName: '',
  ownerEmail: '',
  ownerPassword: '',
  adminName: '',
  adminEmail: '',
  adminPassword: '',
};

export default function SchoolManagementPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialSchool);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [credentials, setCredentials] = useState(null);
  const limit = 8;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['schools', page, search],
    queryFn: () => schoolService.list({ page, limit, search }),
  });

  const initializeMutation = useMutation({
    mutationFn: async ({ schoolId }) => {
      const toastId = toast.loading('Creating CBSE classes, sections, subjects and chapters…');
      try {
        const response = await schoolService.initializeAcademics(schoolId);
        toast.success('CBSE academic structure created', { id: toastId });
        return response;
      } catch (error) {
        toast.error(error.response?.data?.message || 'Academic setup failed', { id: toastId, duration: 7000 });
        throw error;
      }
    },
    onSuccess: (response) => {
      const setup = response.data?.academicSetup;
      toast.success(`${setup?.classes || 14} classes and ${setup?.sections || 42} sections added`);
      toast.success(`${setup?.subjects || 0} subjects and ${setup?.chapters || 0} chapters added`);
      toast.success(`${setup?.resources || 0} default learning resources added`);
      setCredentials((current) => current ? { ...current, setupStatus: 'READY', academicSetup: setup } : current);
      queryClient.invalidateQueries({ queryKey: ['schools'] });
    },
    onError: () => setCredentials((current) => current ? { ...current, setupStatus: 'FAILED' } : current),
  });

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      const toastId = toast.loading('Creating school tenant and login accounts…');
      try {
        const response = await schoolService.create(payload);
        toast.success('School tenant created successfully', { id: toastId });
        return response;
      } catch (error) {
        toast.error(error.response?.data?.message || 'School tenant creation failed', { id: toastId, duration: 7000 });
        throw error;
      }
    },
    onSuccess: (response) => {
      const schoolId = response.data?.school?.id;
      toast.success('School branding and default settings created');
      toast.success('School Owner login credentials created');
      toast.success('School Admin login credentials created');
      setCredentials({ ...(response.data?.credentials || {}), schoolId, setupStatus: 'INITIALIZING' });
      setOpen(false);
      setForm(initialSchool);
      queryClient.invalidateQueries({ queryKey: ['schools'] });
      initializeMutation.mutate({ schoolId });
    },
    onError: () => undefined,
  });

  const deleteMutation = useMutation({
    mutationFn: schoolService.remove,
    onSuccess: () => {
      toast.success('School deleted');
      queryClient.invalidateQueries({ queryKey: ['schools'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Delete failed'),
  });

  const rows = data?.data || [];
  const meta = data?.meta || { page: 1, totalPages: 1 };

  const hasData = useMemo(() => rows.length > 0, [rows]);

  const onCreate = (event) => {
    event.preventDefault();
    createMutation.mutate(form);
  };

  return (
    <DashboardLayout role="PLATFORM_OWNER">
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
        <Card className="border-none shadow-2xl shadow-slate-200/60 rounded-[2.5rem] overflow-hidden">
          <CardHeader className="p-8 pb-4 flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between border-b border-slate-50">
            <div>
              <CardTitle className="text-3xl font-black tracking-tight text-slate-900">Institutions</CardTitle>
              <p className="text-sm text-slate-500 font-medium mt-1">Global management of platform tenant schools.</p>
            </div>
            <div className="flex w-full gap-3 sm:w-auto">
              <Input
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder="Filter institutions..."
                className="sm:w-72 h-12 rounded-xl bg-slate-50/50 border-slate-100 focus:bg-white transition-all"
              />
              <Button onClick={() => setOpen(true)} className="h-12 px-6 rounded-xl font-bold bg-slate-900 shadow-lg shadow-slate-900/20">Add School</Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50/50 text-slate-400">
                  <tr>
                    <th className="px-8 py-4 font-bold uppercase tracking-widest text-[10px]">School Name</th>
                    <th className="px-8 py-4 font-bold uppercase tracking-widest text-[10px]">Code</th>
                    <th className="px-8 py-4 font-bold uppercase tracking-widest text-[10px]">City</th>
                    <th className="px-8 py-4 font-bold uppercase tracking-widest text-[10px]">State</th>
                    <th className="px-8 py-4 font-bold uppercase tracking-widest text-[10px]">Status</th>
                    <th className="px-8 py-4 font-bold uppercase tracking-widest text-[10px]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {isLoading && (
                    <tr>
                      <td className="px-8 py-10 text-slate-400 text-center font-medium" colSpan={6}>
                        Loading schools...
                      </td>
                    </tr>
                  )}
                  {!isLoading && !hasData && (
                    <tr>
                      <td className="px-8 py-10 text-slate-400 text-center font-medium" colSpan={6}>
                        No schools found.
                      </td>
                    </tr>
                  )}
                  {rows.map((school) => (
                    <tr key={school.id} className="group hover:bg-slate-50/50 transition-colors">
                      <td className="px-8 py-5 font-bold text-slate-900">{school.schoolName}</td>
                      <td className="px-8 py-5 text-slate-500 font-medium">{school.schoolCode}</td>
                      <td className="px-8 py-5 text-slate-500">{school.city}</td>
                      <td className="px-8 py-5 text-slate-500">{school.state}</td>
                      <td className="px-8 py-5">
                        <Badge variant={school.status === 'ACTIVE' ? 'success' : 'muted'} className="rounded-md px-2 py-0.5 text-[10px]">{school.status}</Badge>
                      </td>
                      <td className="px-8 py-5">
                        <Button
                          variant="danger"
                          className="h-9 px-4 rounded-lg font-bold opacity-0 group-hover:opacity-100 transition-all"
                          onClick={() => deleteMutation.mutate(school.id)}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button
                variant="secondary"
                disabled={meta.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
              >
                Previous
              </Button>
              <span className="text-sm text-slate-600">
                Page {meta.page} of {meta.totalPages}
              </span>
              <Button
                variant="secondary"
                disabled={meta.page >= meta.totalPages}
                onClick={() => setPage((current) => Math.min(meta.totalPages, current + 1))}
              >
                Next
              </Button>
            </div>
          </CardContent>
        </Card>

        <Modal open={open} onClose={() => setOpen(false)} title="Add New School">
          <form onSubmit={onCreate} className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              required
              placeholder="School Name"
              value={form.schoolName}
              onChange={(event) => setForm({ ...form, schoolName: event.target.value })}
            />
            <Input
              placeholder="Logo URL"
              value={form.logoUrl}
              onChange={(event) => setForm({ ...form, logoUrl: event.target.value })}
            />
            <Input
              required
              placeholder="School Code"
              value={form.schoolCode}
              onChange={(event) => setForm({ ...form, schoolCode: event.target.value })}
            />
            <Input
              required
              placeholder="Address"
              className="sm:col-span-2"
              value={form.address}
              onChange={(event) => setForm({ ...form, address: event.target.value })}
            />
            <Input
              required
              placeholder="City"
              value={form.city}
              onChange={(event) => setForm({ ...form, city: event.target.value })}
            />
            <Input
              required
              placeholder="State"
              value={form.state}
              onChange={(event) => setForm({ ...form, state: event.target.value })}
            />
            <Input
              required
              placeholder="Phone"
              value={form.phone}
              onChange={(event) => setForm({ ...form, phone: event.target.value })}
            />
            <Input
              required
              type="email"
              placeholder="Email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
            />
            <div className="sm:col-span-2 mt-2 border-t border-slate-200 pt-4">
              <p className="font-bold text-slate-900 dark:text-slate-100">School owner login</p>
              <p className="text-xs text-slate-500">Leave password empty to generate a secure temporary password.</p>
            </div>
            <Input required placeholder="Owner full name" value={form.ownerName} onChange={(event) => setForm({ ...form, ownerName: event.target.value })} />
            <Input required type="email" placeholder="Owner login email" value={form.ownerEmail} onChange={(event) => setForm({ ...form, ownerEmail: event.target.value })} />
            <Input type="password" placeholder="Temporary password (optional)" value={form.ownerPassword} onChange={(event) => setForm({ ...form, ownerPassword: event.target.value })} className="sm:col-span-2" />
            <div className="sm:col-span-2 mt-2 border-t border-slate-200 pt-4">
              <p className="font-bold text-slate-900 dark:text-slate-100">School administrator login</p>
            </div>
            <Input required placeholder="Admin full name" value={form.adminName} onChange={(event) => setForm({ ...form, adminName: event.target.value })} />
            <Input required type="email" placeholder="Admin login email" value={form.adminEmail} onChange={(event) => setForm({ ...form, adminEmail: event.target.value })} />
            <Input type="password" placeholder="Temporary password (optional)" value={form.adminPassword} onChange={(event) => setForm({ ...form, adminPassword: event.target.value })} className="sm:col-span-2" />
            <div className="sm:col-span-2 flex justify-end gap-3 pt-1">
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Save School'}
              </Button>
            </div>
          </form>
        </Modal>
        <Modal open={Boolean(credentials)} onClose={() => setCredentials(null)} title="Tenant credentials created">
          {credentials && <div className="space-y-4">
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Copy these credentials now. Temporary passwords are returned only once and both users must change them after login.</div>
            <div className={`rounded-xl border p-4 text-sm font-bold ${credentials.setupStatus === 'READY' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : credentials.setupStatus === 'FAILED' ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
              {credentials.setupStatus === 'READY' ? 'Academic setup complete: LKG to Class 12, three sections per class, CBSE subjects, chapters and resources are ready.' : credentials.setupStatus === 'FAILED' ? 'Accounts were created, but academic setup failed. Your credentials are safe; use Retry Academic Setup.' : 'Academic setup is running. Keep this dialog open to follow progress.'}
            </div>
            {[['School Owner', credentials.schoolOwner], ['Administrator', credentials.admin]].map(([label, account]) => <div key={label} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700"><p className="font-black">{label}</p><p className="mt-2 text-sm">Name: {account.name}</p><p className="text-sm">Login ID: <span className="font-mono font-bold">{account.loginId}</span></p><p className="text-sm">Temporary password: <span className="font-mono font-bold">{account.temporaryPassword}</span></p></div>)}
            <div className="flex flex-wrap justify-end gap-2">{credentials.setupStatus === 'FAILED' && <Button variant="secondary" onClick={() => initializeMutation.mutate({ schoolId: credentials.schoolId })} disabled={initializeMutation.isPending}>Retry Academic Setup</Button>}<Button onClick={() => setCredentials(null)} disabled={initializeMutation.isPending}>I have copied them</Button></div>
          </div>}
        </Modal>
      </motion.div>
    </DashboardLayout>
  );
}
