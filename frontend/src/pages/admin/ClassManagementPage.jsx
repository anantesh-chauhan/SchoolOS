import React, { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { classService, sectionService } from '../../services/managementService';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

export default function ClassManagementPage() {
  const [className, setClassName] = useState('');
  const [classOrder, setClassOrder] = useState('');
  const [expandedClassId, setExpandedClassId] = useState('');
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({ queryKey: ['classes'], queryFn: classService.list });
  const sectionsQuery = useQuery({
    queryKey: ['sections', expandedClassId],
    queryFn: () => sectionService.list(expandedClassId),
    enabled: Boolean(expandedClassId),
  });

  const createMutation = useMutation({
    mutationFn: classService.create,
    onSuccess: () => {
      setClassName('');
      setClassOrder('');
      toast.success('Class created');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to add class'),
  });

  const deleteMutation = useMutation({
    mutationFn: classService.remove,
    onSuccess: () => {
      toast.success('Class deleted');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to delete class'),
  });

  const createSectionMutation = useMutation({
    mutationFn: sectionService.createNext,
    onSuccess: () => {
      toast.success('Section added');
      queryClient.invalidateQueries({ queryKey: ['sections', expandedClassId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to add section'),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: sectionService.remove,
    onSuccess: () => {
      toast.success('Section deleted');
      queryClient.invalidateQueries({ queryKey: ['sections', expandedClassId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to delete section'),
  });

  const rows = data?.data || [];

  const submit = (event) => {
    event.preventDefault();
    createMutation.mutate({ className, classOrder: Number(classOrder) });
  };

  const toggleExpand = (classId) => {
    setExpandedClassId((prev) => (prev === classId ? '' : classId));
  };

  const confirmDeleteClass = (row) => {
    if (window.confirm(`Delete ${row.className}?`)) {
      deleteMutation.mutate(row.id);
    }
  };

  const currentSections = sectionsQuery.data?.data || [];

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Class Management</CardTitle>
          </CardHeader>
          <CardContent>
            <form className="grid grid-cols-1 gap-3 sm:grid-cols-4" onSubmit={submit}>
              <Input
                required
                placeholder="Class Name (e.g. Class 6)"
                value={className}
                onChange={(event) => setClassName(event.target.value)}
              />
              <Input
                required
                type="number"
                min="1"
                placeholder="Class Order"
                value={classOrder}
                onChange={(event) => setClassOrder(event.target.value)}
              />
              <div className="sm:col-span-2 flex justify-end">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending ? 'Adding...' : 'Add Class'}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Class List</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Expand</th>
                    <th className="px-4 py-3 text-left font-semibold">Class Name</th>
                    <th className="px-4 py-3 text-left font-semibold">Order</th>
                    <th className="px-4 py-3 text-left font-semibold">Sections</th>
                    <th className="px-4 py-3 text-left font-semibold">Subjects</th>
                    <th className="px-4 py-3 text-left font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-slate-500">
                        Loading classes...
                      </td>
                    </tr>
                  )}
                  {!isLoading && rows.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-6 text-slate-500">
                        No classes yet.
                      </td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <tr className="border-b border-slate-100">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => toggleExpand(row.id)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-200"
                          >
                            {expandedClassId === row.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-medium">{row.className}</td>
                        <td className="px-4 py-3">{row.classOrder}</td>
                        <td className="px-4 py-3">{row._count?.sections || 0}</td>
                        <td className="px-4 py-3">{row._count?.classSubjects || 0}</td>
                        <td className="px-4 py-3">
                          <Button variant="danger" className="h-8 px-3" onClick={() => confirmDeleteClass(row)}>
                            Delete
                          </Button>
                        </td>
                      </tr>

                      {expandedClassId === row.id && (
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <td colSpan={6} className="px-4 py-4">
                            <div className="flex items-center justify-between gap-3 mb-3">
                              <p className="text-sm font-semibold text-slate-800">
                                Sections in {row.className}
                              </p>
                              <Button
                                className="h-8 px-3"
                                onClick={() => createSectionMutation.mutate({ classId: row.id })}
                                disabled={createSectionMutation.isPending}
                              >
                                {createSectionMutation.isPending ? 'Adding...' : 'Add Section'}
                              </Button>
                            </div>

                            {sectionsQuery.isLoading && <p className="text-sm text-slate-500">Loading sections...</p>}
                            {!sectionsQuery.isLoading && currentSections.length === 0 && (
                              <p className="text-sm text-slate-500">No sections yet.</p>
                            )}

                            <div className="space-y-2">
                              {currentSections.map((section) => (
                                <div
                                  key={section.id}
                                  className="rounded-lg bg-white border border-slate-200 px-3 py-2 flex items-center justify-between"
                                >
                                  <p className="text-sm font-medium text-slate-800">Section {section.sectionName}</p>
                                  <Button
                                    variant="danger"
                                    className="h-7 px-2"
                                    onClick={() => {
                                      if (window.confirm(`Delete section ${section.sectionName}?`)) {
                                        deleteSectionMutation.mutate(section.id);
                                      }
                                    }}
                                  >
                                    Delete
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
