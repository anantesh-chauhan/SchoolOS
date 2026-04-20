import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { classService, sectionService, subjectService } from '../../services/managementService';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

export default function SubjectAssignmentPage() {
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [searchText, setSearchText] = useState('');
  const [selectedSubjectIds, setSelectedSubjectIds] = useState([]);

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: classService.list });
  const sectionsQuery = useQuery({
    queryKey: ['sections', selectedClassId],
    queryFn: () => sectionService.list(selectedClassId),
    enabled: Boolean(selectedClassId),
  });
  const subjectsQuery = useQuery({ queryKey: ['subjects'], queryFn: subjectService.list });

  const classAssignmentsQuery = useQuery({
    queryKey: ['class-subjects', selectedClassId],
    queryFn: () => subjectService.classSubjects(selectedClassId),
    enabled: Boolean(selectedClassId),
  });

  const sectionAssignmentsQuery = useQuery({
    queryKey: ['section-subjects', selectedSectionId],
    queryFn: () => subjectService.sectionSubjects(selectedSectionId),
    enabled: Boolean(selectedSectionId),
  });

  const activeAssignments = selectedSectionId
    ? sectionAssignmentsQuery.data?.data || []
    : classAssignmentsQuery.data?.data || [];

  const assignmentMutation = useMutation({
    mutationFn: async ({ checked, subjectId }) => {
      if (selectedSectionId) {
        if (checked) {
          return subjectService.assignToSection({ sectionId: selectedSectionId, subjectId });
        }
        return subjectService.unassignFromSection({ sectionId: selectedSectionId, subjectId });
      }

      if (!selectedClassId) {
        throw new Error('Select class before assignment');
      }

      if (checked) {
        return subjectService.assignToClass({ classId: selectedClassId, subjectId });
      }

      return subjectService.unassignFromClass({ classId: selectedClassId, subjectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['class-subjects', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['section-subjects', selectedSectionId] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      toast.success('Assignment updated');
    },
    onError: (error) => toast.error(error.response?.data?.message || error.message || 'Assignment failed'),
  });

  const bulkAssignMutation = useMutation({
    mutationFn: () => subjectService.bulkAssignToClass({ classId: selectedClassId, subjectIds: selectedSubjectIds }),
    onSuccess: () => {
      toast.success('Bulk assignment saved');
      queryClient.invalidateQueries({ queryKey: ['class-subjects', selectedClassId] });
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Bulk assignment failed'),
  });

  const assignedSubjectIds = useMemo(
    () => new Set(activeAssignments.map((item) => item.subjectId)),
    [activeAssignments]
  );

  const subjects = subjectsQuery.data?.data || [];
  const filteredSubjects = subjects.filter((subject) => {
    const query = searchText.trim().toLowerCase();
    if (!query) return true;
    return (
      subject.subjectName.toLowerCase().includes(query)
      || subject.subjectCode.toLowerCase().includes(query)
    );
  });

  const classes = classesQuery.data?.data || [];
  const sections = sectionsQuery.data?.data || [];

  const toggleBulkSelection = (subjectId) => {
    setSelectedSubjectIds((prev) => {
      if (prev.includes(subjectId)) {
        return prev.filter((id) => id !== subjectId);
      }
      return [...prev, subjectId];
    });
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Assignment Scope</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Class</label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={selectedClassId}
                onChange={(event) => {
                  setSelectedClassId(event.target.value);
                  setSelectedSectionId('');
                  setSelectedSubjectIds([]);
                }}
              >
                <option value="">Select class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.className}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Section (Optional)</label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={selectedSectionId}
                onChange={(event) => setSelectedSectionId(event.target.value)}
                disabled={!selectedClassId}
              >
                <option value="">All sections in class (class-level)</option>
                {sections.map((item) => (
                  <option key={item.id} value={item.id}>
                    Section {item.sectionName}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
              Use section selection for stream/elective combinations (for example Class 11 Science vs Commerce).
            </div>

            <div className="space-y-2">
              <Button
                className="w-full"
                onClick={() => bulkAssignMutation.mutate()}
                disabled={!selectedClassId || selectedSectionId || bulkAssignMutation.isPending}
              >
                {bulkAssignMutation.isPending ? 'Saving...' : 'Bulk Assign to Class'}
              </Button>
              <p className="text-xs text-slate-500">
                Bulk assign applies only to class-level mapping. Select subjects on the right and save.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Subject Assignment Table</CardTitle>
              <Input
                placeholder="Search by subject name or code"
                className="sm:w-72"
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Subject Name</th>
                    <th className="px-3 py-2 text-left">Subject Code</th>
                    <th className="px-3 py-2 text-left">Assigned</th>
                    <th className="px-3 py-2 text-left">Edit</th>
                    <th className="px-3 py-2 text-left">Remove</th>
                    <th className="px-3 py-2 text-left">Bulk Pick</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubjects.map((subject) => {
                    const isAssigned = assignedSubjectIds.has(subject.id);
                    const isBulkPicked = selectedSubjectIds.includes(subject.id);

                    return (
                      <tr key={subject.id} className="border-b border-slate-100">
                        <td className="px-3 py-2 font-medium text-slate-900">{subject.subjectName}</td>
                        <td className="px-3 py-2 text-slate-600">{subject.subjectCode}</td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            disabled={!selectedClassId || assignmentMutation.isPending}
                            onChange={(event) =>
                              assignmentMutation.mutate({ checked: event.target.checked, subjectId: subject.id })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <Link to="/dashboard/admin/subjects" className="text-blue-600 hover:text-blue-700">
                            Edit
                          </Link>
                        </td>
                        <td className="px-3 py-2">
                          <Button
                            variant="danger"
                            className="h-8 px-2"
                            disabled={!isAssigned || !selectedClassId || assignmentMutation.isPending}
                            onClick={() => assignmentMutation.mutate({ checked: false, subjectId: subject.id })}
                          >
                            Remove
                          </Button>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={isBulkPicked}
                            disabled={!selectedClassId || Boolean(selectedSectionId)}
                            onChange={() => toggleBulkSelection(subject.id)}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {filteredSubjects.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-6 text-center text-slate-500">
                        No subjects found for current search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
