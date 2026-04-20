import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { teacherService } from '../../services/managementService';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

const emptyForm = {
  teacherName: '',
  email: '',
  phone: '',
  employeeId: '',
  qualification: '',
  specialization: '',
  subjectsHandled: '',
};

export default function TeacherManagementPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [form, setForm] = useState(emptyForm);

  const teachersQuery = useQuery({
    queryKey: ['teachers', page, search, subjectFilter],
    queryFn: () => teacherService.list({ page, limit: 10, search, subject: subjectFilter }),
  });

  const createMutation = useMutation({
    mutationFn: teacherService.create,
    onSuccess: () => {
      toast.success('Teacher added');
      setForm(emptyForm);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to add teacher'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => teacherService.update(id, payload),
    onSuccess: () => {
      toast.success('Teacher updated');
      setForm(emptyForm);
      setEditingTeacher(null);
      setShowForm(false);
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to update teacher'),
  });

  const deleteMutation = useMutation({
    mutationFn: teacherService.remove,
    onSuccess: () => {
      toast.success('Teacher deleted');
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to delete teacher'),
  });

  const rows = teachersQuery.data?.data || [];
  const pagination = teachersQuery.data?.pagination || { page: 1, totalPages: 1 };

  const subjectOptions = useMemo(() => {
    const subjects = new Set();
    rows.forEach((teacher) => {
      (teacher.subjectsHandled || []).forEach((subject) => subjects.add(subject));
      if (teacher.specialization) {
        subjects.add(teacher.specialization);
      }
    });
    return [...subjects].sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const openCreate = () => {
    setEditingTeacher(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const openEdit = (teacher) => {
    setEditingTeacher(teacher);
    setForm({
      teacherName: teacher.teacherName || '',
      email: teacher.email || '',
      phone: teacher.phone || '',
      employeeId: teacher.employeeId || '',
      qualification: teacher.qualification || '',
      specialization: teacher.specialization || '',
      subjectsHandled: (teacher.subjectsHandled || []).join(', '),
    });
    setShowForm(true);
  };

  const submitTeacher = (event) => {
    event.preventDefault();

    const payload = {
      ...form,
      subjectsHandled: form.subjectsHandled
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean),
    };

    if (editingTeacher) {
      updateMutation.mutate({ id: editingTeacher.id, payload });
      return;
    }

    createMutation.mutate(payload);
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <CardTitle>Teacher Management</CardTitle>
              <Button onClick={openCreate}>Add Teacher</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <Input
                placeholder="Search by name/email/employee ID"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
              />
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={subjectFilter}
                onChange={(event) => {
                  setSubjectFilter(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">Filter by subject</option>
                {subjectOptions.map((subject) => (
                  <option key={subject} value={subject}>{subject}</option>
                ))}
              </select>
              <div className="text-sm text-slate-600 flex items-center">
                Overload threshold: <span className="font-semibold ml-1">8 sections</span>
              </div>
            </div>

            <div className="mt-4 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Teacher Name</th>
                    <th className="px-3 py-2 text-left">Employee ID</th>
                    <th className="px-3 py-2 text-left">Subjects Specialized</th>
                    <th className="px-3 py-2 text-left">Classes Assigned</th>
                    <th className="px-3 py-2 text-left">Sections Assigned</th>
                    <th className="px-3 py-2 text-left">Workload</th>
                    <th className="px-3 py-2 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {teachersQuery.isLoading && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-slate-500">Loading teachers...</td>
                    </tr>
                  )}
                  {!teachersQuery.isLoading && rows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-3 py-6 text-slate-500">No teachers found.</td>
                    </tr>
                  )}
                  {rows.map((teacher) => {
                    const classNames = [...new Set((teacher.teacherAssignments || []).map((item) => item.class.className))];
                    const sectionNames = [...new Set((teacher.teacherAssignments || []).map((item) => `${item.class.className}-${item.section.sectionName}`))];

                    return (
                      <tr key={teacher.id} className="border-b border-slate-100 align-top">
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-900">{teacher.teacherName}</p>
                          <p className="text-xs text-slate-500">{teacher.email}</p>
                        </td>
                        <td className="px-3 py-2">{teacher.employeeId}</td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap gap-1">
                            {(teacher.subjectsHandled || []).map((subject) => (
                              <span key={subject} className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                                {subject}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-slate-700">{classNames.length > 0 ? classNames.join(', ') : 'None'}</td>
                        <td className="px-3 py-2 text-slate-700">{sectionNames.length > 0 ? sectionNames.join(', ') : 'None'}</td>
                        <td className="px-3 py-2">
                          <p className="text-slate-700">{teacher.workload?.assignedSectionCount || 0} sections</p>
                          {teacher.workload?.isOverloaded && (
                            <p className="text-xs text-amber-700 font-semibold">Overload warning</p>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex gap-2">
                            <Button variant="secondary" className="h-8 px-3" onClick={() => openEdit(teacher)}>
                              Edit
                            </Button>
                            <Button
                              variant="danger"
                              className="h-8 px-3"
                              onClick={() => {
                                if (window.confirm(`Delete ${teacher.teacherName}?`)) {
                                  deleteMutation.mutate(teacher.id);
                                }
                              }}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <p className="text-sm text-slate-600">Page {pagination.page} of {pagination.totalPages || 1}</p>
              <div className="flex gap-2">
                <Button variant="secondary" className="h-8 px-3" disabled={page <= 1} onClick={() => setPage((prev) => prev - 1)}>
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  className="h-8 px-3"
                  disabled={page >= (pagination.totalPages || 1)}
                  onClick={() => setPage((prev) => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center">
          <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              {editingTeacher ? 'Edit Teacher' : 'Add Teacher'}
            </h3>
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-2" onSubmit={submitTeacher}>
              <Input required placeholder="Teacher Name" value={form.teacherName} onChange={(event) => setForm((prev) => ({ ...prev, teacherName: event.target.value }))} />
              <Input required placeholder="Email" type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
              <Input required placeholder="Phone" value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
              <Input required placeholder="Employee ID" value={form.employeeId} onChange={(event) => setForm((prev) => ({ ...prev, employeeId: event.target.value }))} />
              <Input required placeholder="Qualification" value={form.qualification} onChange={(event) => setForm((prev) => ({ ...prev, qualification: event.target.value }))} />
              <Input required placeholder="Specialization" value={form.specialization} onChange={(event) => setForm((prev) => ({ ...prev, specialization: event.target.value }))} />
              <div className="sm:col-span-2">
                <Input
                  placeholder="Subjects handled (comma separated)"
                  value={form.subjectsHandled}
                  onChange={(event) => setForm((prev) => ({ ...prev, subjectsHandled: event.target.value }))}
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowForm(false);
                    setEditingTeacher(null);
                    setForm(emptyForm);
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {createMutation.isPending || updateMutation.isPending ? 'Saving...' : 'Save Teacher'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
