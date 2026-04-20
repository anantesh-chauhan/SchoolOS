import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { classService, sectionService } from '../../services/managementService';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export default function SectionManagementPage() {
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState('');

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: classService.list });

  const sectionsQuery = useQuery({
    queryKey: ['sections', selectedClassId],
    queryFn: () => sectionService.list(selectedClassId),
    enabled: Boolean(selectedClassId),
  });

  const createMutation = useMutation({
    mutationFn: sectionService.createNext,
    onSuccess: () => {
      toast.success('Next section added');
      queryClient.invalidateQueries({ queryKey: ['sections', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to create section'),
  });

  const deleteMutation = useMutation({
    mutationFn: sectionService.remove,
    onSuccess: () => {
      toast.success('Section deleted');
      queryClient.invalidateQueries({ queryKey: ['sections', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
    },
  });

  const classes = classesQuery.data?.data || [];
  const sections = sectionsQuery.data?.data || [];

  const selectedClass = useMemo(
    () => classes.find((row) => row.id === selectedClassId),
    [classes, selectedClassId]
  );

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Section Management</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="w-full sm:max-w-xs">
                <label htmlFor="class-select" className="mb-1 block text-sm font-medium text-slate-700">
                  Select Class
                </label>
                <select
                  id="class-select"
                  className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={selectedClassId}
                  onChange={(event) => setSelectedClassId(event.target.value)}
                >
                  <option value="">Choose class</option>
                  {classes.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.className}
                    </option>
                  ))}
                </select>
              </div>
              <Button
                disabled={!selectedClassId || createMutation.isPending}
                onClick={() => createMutation.mutate({ classId: selectedClassId })}
              >
                {createMutation.isPending ? 'Adding...' : 'Add Next Section'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              Existing Sections {selectedClass ? `for ${selectedClass.className}` : ''}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedClassId && <p className="text-sm text-slate-500">Select a class to view sections.</p>}
            {selectedClassId && sections.length === 0 && (
              <p className="text-sm text-slate-500">No sections yet. Add the first section and it will start from A.</p>
            )}
            {selectedClassId && sections.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-4 py-3 text-left">Section</th>
                      <th className="px-4 py-3 text-left">Order</th>
                      <th className="px-4 py-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sections.map((row) => (
                      <tr key={row.id} className="border-b border-slate-100">
                        <td className="px-4 py-3 font-medium">{row.sectionName}</td>
                        <td className="px-4 py-3">{row.sectionOrder}</td>
                        <td className="px-4 py-3">
                          <Button variant="danger" className="h-8 px-3" onClick={() => deleteMutation.mutate(row.id)}>
                            Delete
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
