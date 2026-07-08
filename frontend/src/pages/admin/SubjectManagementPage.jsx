import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { subjectService } from '../../services/managementService';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

const PAGE_SIZE = 10;

export default function SubjectManagementPage() {
  const queryClient = useQueryClient();
  const [subjectName, setSubjectName] = useState('');
  const [subjectCode, setSubjectCode] = useState('');
  const [searchText, setSearchText] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingSubject, setEditingSubject] = useState(null);
  const [editForm, setEditForm] = useState({ subjectName: '', subjectCode: '' });

  const subjectsQuery = useQuery({ queryKey: ['subject-mappings'], queryFn: subjectService.mappings });

  const createMutation = useMutation({
    mutationFn: subjectService.create,
    onSuccess: () => {
      setSubjectName('');
      setSubjectCode('');
      toast.success('Subject created');
      queryClient.invalidateQueries({ queryKey: ['subject-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to create subject'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => subjectService.update(id, payload),
    onSuccess: () => {
      toast.success('Subject updated');
      setEditingSubject(null);
      queryClient.invalidateQueries({ queryKey: ['subject-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to update subject'),
  });

  const deleteMutation = useMutation({
    mutationFn: subjectService.remove,
    onSuccess: () => {
      toast.success('Subject deleted');
      queryClient.invalidateQueries({ queryKey: ['subject-mappings'] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to delete subject'),
  });

  const rows = subjectsQuery.data?.data || [];

  const filteredRows = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) => (
      row.subjectName.toLowerCase().includes(query)
      || row.subjectCode.toLowerCase().includes(query)
    ));
  }, [rows, searchText]);

  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const maxPage = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const submitCreate = (event) => {
    event.preventDefault();

    if (!subjectName.trim() || !subjectCode.trim()) {
      toast.error('Subject name and code are required');
      return;
    }

    createMutation.mutate({
      subjectName: subjectName.trim(),
      subjectCode: subjectCode.trim().toUpperCase(),
    });
  };

  const openEdit = (row) => {
    setEditingSubject(row);
    setEditForm({
      subjectName: row.subjectName,
      subjectCode: row.subjectCode,
    });
  };

  const submitEdit = (event) => {
    event.preventDefault();

    if (!editForm.subjectName.trim() || !editForm.subjectCode.trim()) {
      toast.error('Subject name and code are required');
      return;
    }

    updateMutation.mutate({
      id: editingSubject.id,
      payload: {
        subjectName: editForm.subjectName.trim(),
        subjectCode: editForm.subjectCode.trim().toUpperCase(),
      },
    });
  };

  const confirmDelete = (row) => {
    const hasAssignments = (row.classSubjects?.length || 0) + (row.sectionSubjects?.length || 0) > 0;
    if (hasAssignments) {
      toast.error('Cannot delete assigned subject. Remove assignments first.');
      return;
    }

    if (window.confirm(`Delete subject ${row.subjectName}?`)) {
      deleteMutation.mutate(row.id);
    }
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Subject Management</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" onSubmit={submitCreate}>
              <Input
                required
                placeholder="Subject Name"
                value={subjectName}
                onChange={(event) => setSubjectName(event.target.value)}
              />
              <Input
                required
                placeholder="Subject Code"
                value={subjectCode}
                onChange={(event) => setSubjectCode(event.target.value.toUpperCase())}
              />
              <Input
                placeholder="Search subject"
                value={searchText}
                onChange={(event) => {
                  setSearchText(event.target.value);
                  setCurrentPage(1);
                }}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Saving...' : 'Add Subject'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subject List</CardTitle>
          </CardHeader>
          <CardContent>
            {subjectsQuery.isLoading && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="h-4 w-48 rounded bg-slate-100 animate-pulse" />
                    <div className="mt-3 grid grid-cols-2 gap-3">
                      <div className="h-3 rounded bg-slate-100 animate-pulse" />
                      <div className="h-3 rounded bg-slate-100 animate-pulse" />
                    </div>
                    <div className="mt-4 flex gap-2">
                      <div className="h-9 w-24 rounded-xl bg-slate-100 animate-pulse" />
                      <div className="h-9 w-28 rounded-xl bg-slate-100 animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!subjectsQuery.isLoading && pagedRows.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <p className="text-sm font-medium text-slate-700">No subjects found.</p>
                <p className="mt-1 text-xs text-slate-500">Add subjects to start mapping them to classes and sections.</p>
              </div>
            )}

            {!subjectsQuery.isLoading && pagedRows.length > 0 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {pagedRows.map((row) => {
                  const classNames = (row.classSubjects || []).map((item) => item.class.className);
                  const sectionNames = (row.sectionSubjects || []).map(
                    (item) => `${item.section.class.className}-${item.section.sectionName}`
                  );

                  return (
                    <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">{row.subjectName}</p>
                          <p className="mt-1 text-xs text-slate-500">Code: <span className="font-medium text-slate-700">{row.subjectCode}</span></p>
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <div className="text-[10px] uppercase tracking-wide text-slate-500">Mapped</div>
                          <div className="inline-flex items-center gap-2">
                            <span className="inline-flex items-center justify-center h-6 px-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700">
                              {classNames.length + (sectionNames.length > 0 ? 0 : 0)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Assigned Classes</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                            {classNames.length > 0 ? classNames.join(', ') : 'None'}
                          </p>
                        </div>
                        <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                          <p className="text-[10px] uppercase tracking-wide text-slate-500">Assigned Sections</p>
                          <p className="mt-1 text-sm font-semibold text-slate-900 truncate">
                            {sectionNames.length > 0 ? sectionNames.join(', ') : 'None'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-2">
                        <Button variant="secondary" className="h-9 px-3" onClick={() => openEdit(row)}>
                          Edit Subject
                        </Button>
                        <Button
                          variant="secondary"
                          className="h-9 px-3"
                          onClick={() => toast.success('Use Subject Assignment page for mapping details')}
                        >
                          View Assignment
                        </Button>
                        <Button variant="danger" className="h-9 px-3" onClick={() => confirmDelete(row)}>
                          Delete Subject
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-6 flex items-center justify-between text-sm text-slate-600">
              <p>
                Page {currentPage} of {maxPage}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  className="h-9 px-3"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((prev) => prev - 1)}
                >
                  Prev
                </Button>
                <Button
                  variant="secondary"
                  className="h-9 px-3"
                  disabled={currentPage === maxPage}
                  onClick={() => setCurrentPage((prev) => prev + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {editingSubject && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-slate-900">Edit Subject</h3>
            <form className="mt-4 space-y-3" onSubmit={submitEdit}>
              <Input
                required
                placeholder="Subject Name"
                value={editForm.subjectName}
                onChange={(event) => setEditForm((prev) => ({ ...prev, subjectName: event.target.value }))}
              />
              <Input
                required
                placeholder="Subject Code"
                value={editForm.subjectCode}
                onChange={(event) => setEditForm((prev) => ({ ...prev, subjectCode: event.target.value.toUpperCase() }))}
              />
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="secondary" onClick={() => setEditingSubject(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
