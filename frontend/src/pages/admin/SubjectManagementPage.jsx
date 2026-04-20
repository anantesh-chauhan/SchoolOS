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
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left">Subject Name</th>
                    <th className="px-4 py-3 text-left">Subject Code</th>
                    <th className="px-4 py-3 text-left">Assigned Classes</th>
                    <th className="px-4 py-3 text-left">Assigned Sections</th>
                    <th className="px-4 py-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {subjectsQuery.isLoading && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-slate-500">Loading subjects...</td>
                    </tr>
                  )}

                  {!subjectsQuery.isLoading && pagedRows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-6 text-slate-500">No subjects found.</td>
                    </tr>
                  )}

                  {pagedRows.map((row) => {
                    const classNames = (row.classSubjects || []).map((item) => item.class.className);
                    const sectionNames = (row.sectionSubjects || []).map(
                      (item) => `${item.section.class.className}-${item.section.sectionName}`
                    );

                    return (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="px-4 py-3 font-medium text-slate-900">{row.subjectName}</td>
                        <td className="px-4 py-3 text-slate-600">{row.subjectCode}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {classNames.length > 0 ? classNames.join(', ') : 'None'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {sectionNames.length > 0 ? sectionNames.join(', ') : 'None'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" className="h-8 px-3" onClick={() => openEdit(row)}>
                              Edit Subject
                            </Button>
                            <Button variant="secondary" className="h-8 px-3" onClick={() => toast.success('Use Subject Assignment page for mapping details')}>
                              View Assignment
                            </Button>
                            <Button variant="danger" className="h-8 px-3" onClick={() => confirmDelete(row)}>
                              Delete Subject
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
              <p>
                Page {currentPage} of {maxPage}
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" className="h-8 px-3" disabled={currentPage === 1} onClick={() => setCurrentPage((prev) => prev - 1)}>
                  Prev
                </Button>
                <Button variant="secondary" className="h-8 px-3" disabled={currentPage === maxPage} onClick={() => setCurrentPage((prev) => prev + 1)}>
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
