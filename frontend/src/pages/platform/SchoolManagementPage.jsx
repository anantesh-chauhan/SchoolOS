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
  address: '',
  city: '',
  state: '',
  phone: '',
  email: '',
};

export default function SchoolManagementPage() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(initialSchool);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const limit = 8;
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['schools', page, search],
    queryFn: () => schoolService.list({ page, limit, search }),
  });

  const createMutation = useMutation({
    mutationFn: schoolService.create,
    onSuccess: () => {
      toast.success('School added successfully');
      setOpen(false);
      setForm(initialSchool);
      queryClient.invalidateQueries({ queryKey: ['schools'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to add school'),
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
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        <Card>
          <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>School Management</CardTitle>
              <p className="text-sm text-slate-600">Add, search, paginate, and manage tenant schools.</p>
            </div>
            <div className="flex w-full gap-3 sm:w-auto">
              <Input
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder="Search by name, code, city, state"
                className="sm:w-72"
              />
              <Button onClick={() => setOpen(true)}>Add School</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold">School Name</th>
                    <th className="px-4 py-3 font-semibold">School Code</th>
                    <th className="px-4 py-3 font-semibold">City</th>
                    <th className="px-4 py-3 font-semibold">State</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={6}>
                        Loading schools...
                      </td>
                    </tr>
                  )}
                  {!isLoading && !hasData && (
                    <tr>
                      <td className="px-4 py-6 text-slate-500" colSpan={6}>
                        No schools found.
                      </td>
                    </tr>
                  )}
                  {rows.map((school) => (
                    <tr key={school.id} className="border-b border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{school.schoolName}</td>
                      <td className="px-4 py-3">{school.schoolCode}</td>
                      <td className="px-4 py-3">{school.city}</td>
                      <td className="px-4 py-3">{school.state}</td>
                      <td className="px-4 py-3">
                        <Badge variant={school.status === 'ACTIVE' ? 'success' : 'muted'}>{school.status}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Button
                          variant="danger"
                          className="h-8 px-3"
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
      </motion.div>
    </DashboardLayout>
  );
}
