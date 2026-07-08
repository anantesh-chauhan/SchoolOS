import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { classService, sectionService } from '../../services/managementService';
import { invalidateAcademicStructure, useAcademicStructure } from '../../hooks/useAcademicStructure';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Link } from 'react-router-dom';

export default function ClassManagementPage() {
  const [className, setClassName] = useState('');
  const [classOrder, setClassOrder] = useState('');
  const [expandedClassId, setExpandedClassId] = useState('');
  const queryClient = useQueryClient();

  const academicStructure = useAcademicStructure();

  const createMutation = useMutation({
    mutationFn: classService.create,
    onSuccess: () => {
      setClassName('');
      setClassOrder('');
      toast.success('Class created');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      invalidateAcademicStructure(queryClient);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to add class'),
  });

  const deleteMutation = useMutation({
    mutationFn: classService.remove,
    onSuccess: () => {
      toast.success('Class deleted');
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      invalidateAcademicStructure(queryClient);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to delete class'),
  });

  const createSectionMutation = useMutation({
    mutationFn: sectionService.createNext,
    onSuccess: () => {
      toast.success('Section added');
      queryClient.invalidateQueries({ queryKey: ['sections', expandedClassId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      invalidateAcademicStructure(queryClient);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to add section'),
  });

  const deleteSectionMutation = useMutation({
    mutationFn: sectionService.remove,
    onSuccess: () => {
      toast.success('Section deleted');
      queryClient.invalidateQueries({ queryKey: ['sections', expandedClassId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      invalidateAcademicStructure(queryClient);
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to delete section'),
  });

  const rows = academicStructure.classes;

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

  const currentSections = academicStructure.getSections(expandedClassId);

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
            {academicStructure.isLoading && (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="h-4 w-40 rounded bg-slate-100 animate-pulse" />
                    <div className="mt-4 grid grid-cols-3 gap-3">
                      <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
                      <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
                      <div className="h-3 w-full rounded bg-slate-100 animate-pulse" />
                    </div>
                  </div>
                ))}
                <p className="text-sm text-slate-500">Loading classes...</p>
              </div>
            )}

            {!academicStructure.isLoading && rows.length === 0 && (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center">
                <p className="text-sm font-medium text-slate-700">No classes yet.</p>
                <p className="mt-1 text-xs text-slate-500">Add your first class to start building sections and schedules.</p>
              </div>
            )}

            {!academicStructure.isLoading && rows.length > 0 && (
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                {rows.map((row) => {
                  const isExpanded = expandedClassId === row.id;
                  const sectionsCount = row.sections?.length || row._count?.sections || 0;
                  const subjectsCount = row.classSubjects?.length || row._count?.classSubjects || 0;

                  return (
                    <div key={row.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow">
                      <div className="p-5 flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => toggleExpand(row.id)}
                              aria-label={isExpanded ? 'Collapse class details' : 'Expand class details'}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 hover:bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-slate-900 truncate">{row.className}</p>
                              <p className="mt-0.5 text-xs text-slate-500">Class Order: {row.classOrder}</p>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-3 gap-3">
                            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2">
                              <p className="text-[10px] uppercase tracking-wide text-slate-500">Sections</p>
                              <p className="text-sm font-semibold text-slate-900">{sectionsCount}</p>
                            </div>
                            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2 col-span-2">
                              <p className="text-[10px] uppercase tracking-wide text-slate-500">Subjects</p>
                              <p className="text-sm font-semibold text-slate-900">{subjectsCount}</p>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-3">
                          <Button variant="danger" className="h-9 px-4" onClick={() => confirmDeleteClass(row)}>
                            Delete
                          </Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-5 pb-5">
                          <div className="flex items-center justify-between gap-3 mb-3">
                            <p className="text-sm font-semibold text-slate-800">Sections in {row.className}</p>
                            <Button
                              className="h-9 px-4"
                              onClick={() => createSectionMutation.mutate({ classId: row.id })}
                              disabled={createSectionMutation.isPending}
                            >
                              {createSectionMutation.isPending ? 'Adding...' : 'Add Section'}
                            </Button>
                          </div>

                          {academicStructure.isFetching && <p className="text-sm text-slate-500">Refreshing sections...</p>}
                          {!academicStructure.isFetching && currentSections.length === 0 && (
                            <p className="text-sm text-slate-500">No sections yet.</p>
                          )}

                          {currentSections.length > 0 && (
                            <div className="space-y-2 mt-3">
                              {currentSections.map((section) => (
                                <div
                                  key={section.id}
                                  className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-3 flex items-center justify-between gap-3"
                                >
                                  <Link
                                    to={`/dashboard/admin/academic/classes/${row.id}/sections/${section.id}`}
                                    className="min-w-0 flex-1"
                                  >
                                    <p className="text-sm font-medium text-slate-800 truncate">
                                      Section {section.sectionName}
                                    </p>
                                    <p className="text-xs text-slate-500">Open class workspace</p>
                                  </Link>

                                  <Button
                                    variant="danger"
                                    className="h-8 px-3"
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
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
