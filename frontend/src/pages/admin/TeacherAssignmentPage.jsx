import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { classService, sectionService, teacherService } from '../../services/managementService';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';

export default function TeacherAssignmentPage() {
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [teacherSearch, setTeacherSearch] = useState('');
  const [selectedTeachersBySubject, setSelectedTeachersBySubject] = useState({});

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: classService.list });
  const sectionsQuery = useQuery({
    queryKey: ['sections', selectedClassId],
    queryFn: () => sectionService.list(selectedClassId),
    enabled: Boolean(selectedClassId),
  });
  const teachersQuery = useQuery({
    queryKey: ['teachers', 'all'],
    queryFn: () => teacherService.list({ page: 1, limit: 200 }),
  });

  const assignmentTableQuery = useQuery({
    queryKey: ['teacher-assignment-table', selectedClassId, selectedSectionId],
    queryFn: () => teacherService.sectionAssignmentTable({ classId: selectedClassId, sectionId: selectedSectionId }),
    enabled: Boolean(selectedClassId && selectedSectionId),
  });

  const saveMutation = useMutation({
    mutationFn: teacherService.bulkSaveAssignments,
    onSuccess: () => {
      toast.success('Teacher assignments saved');
      queryClient.invalidateQueries({ queryKey: ['teacher-assignment-table', selectedClassId, selectedSectionId] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to save assignments'),
  });

  const classes = classesQuery.data?.data || [];
  const sections = sectionsQuery.data?.data || [];
  const teachers = teachersQuery.data?.data || [];
  const tableRows = assignmentTableQuery.data?.data?.table || [];
  const stats = assignmentTableQuery.data?.data?.stats || { totalSubjects: 0, assignedSubjects: 0, unassignedSubjects: 0 };

  const selectedClassName = useMemo(
    () => classes.find((row) => row.id === selectedClassId)?.className || '',
    [classes, selectedClassId]
  );

  const selectedSectionName = useMemo(
    () => sections.find((row) => row.id === selectedSectionId)?.sectionName || '',
    [sections, selectedSectionId]
  );

  const getFilteredTeachers = (subjectName, subjectCode) => {
    const query = teacherSearch.trim().toLowerCase();

    return teachers.filter((teacher) => {
      const matchesQuery = !query
        || teacher.teacherName.toLowerCase().includes(query)
        || teacher.employeeId.toLowerCase().includes(query)
        || teacher.email.toLowerCase().includes(query);

      const specialization = String(teacher.specialization || '').toLowerCase();
      const handledSubjects = (teacher.subjectsHandled || []).map((item) => String(item).toLowerCase());
      const matchingSpecialization = specialization.includes(subjectName.toLowerCase())
        || specialization.includes(subjectCode.toLowerCase())
        || handledSubjects.some(
          (item) => item.includes(subjectName.toLowerCase()) || item.includes(subjectCode.toLowerCase())
        );

      return matchesQuery && matchingSpecialization;
    });
  };

  const resolvedTeacherBySubject = useMemo(() => {
    const map = {};
    tableRows.forEach((row) => {
      map[row.subjectId] = selectedTeachersBySubject[row.subjectId] || row.assignment?.teacherId || '';
    });
    return map;
  }, [tableRows, selectedTeachersBySubject]);

  const summary = useMemo(() => {
    const total = tableRows.length;
    let assigned = 0;

    tableRows.forEach((row) => {
      if (resolvedTeacherBySubject[row.subjectId]) {
        assigned += 1;
      }
    });

    return { total, assigned, unassigned: total - assigned };
  }, [tableRows, resolvedTeacherBySubject]);

  const saveAll = () => {
    if (!selectedClassId || !selectedSectionId) {
      toast.error('Select class and section first');
      return;
    }

    const payloadAssignments = tableRows.map((row) => ({
      subjectId: row.subjectId,
      teacherId: resolvedTeacherBySubject[row.subjectId],
    }));

    if (payloadAssignments.some((item) => !item.teacherId)) {
      toast.error('No subject can be left unassigned');
      return;
    }

    saveMutation.mutate({
      classId: selectedClassId,
      sectionId: selectedSectionId,
      assignments: payloadAssignments,
    });
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="grid grid-cols-1 xl:grid-cols-[320px_1fr] gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Teacher Assignment</CardTitle>
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
                  setSelectedTeachersBySubject({});
                }}
              >
                <option value="">Select class</option>
                {classes.map((row) => (
                  <option key={row.id} value={row.id}>{row.className}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Section</label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={selectedSectionId}
                onChange={(event) => {
                  setSelectedSectionId(event.target.value);
                  setSelectedTeachersBySubject({});
                }}
                disabled={!selectedClassId}
              >
                <option value="">Select section</option>
                {sections.map((row) => (
                  <option key={row.id} value={row.id}>{row.sectionName}</option>
                ))}
              </select>
            </div>

            <Input
              placeholder="Search teacher"
              value={teacherSearch}
              onChange={(event) => setTeacherSearch(event.target.value)}
            />

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700 space-y-1">
              <p>Total subjects: {summary.total}</p>
              <p>Assigned: {summary.assigned}</p>
              <p className={summary.unassigned > 0 ? 'text-amber-700 font-semibold' : ''}>Unassigned: {summary.unassigned}</p>
              <p className="text-xs text-slate-500 mt-2">Selected: {selectedClassName} {selectedSectionName ? `- Section ${selectedSectionName}` : ''}</p>
            </div>

            <Button className="w-full" onClick={saveAll} disabled={saveMutation.isPending || !selectedSectionId}>
              {saveMutation.isPending ? 'Saving...' : 'Bulk Save Assignments'}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Subject-wise Teacher Assignment</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedSectionId && (
              <p className="text-sm text-slate-500">Select class and section to assign teachers per subject.</p>
            )}

            {selectedSectionId && assignmentTableQuery.isLoading && (
              <div className="space-y-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-11 rounded-md bg-slate-100 animate-pulse" />
                ))}
              </div>
            )}

            {selectedSectionId && !assignmentTableQuery.isLoading && (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Subject Name</th>
                      <th className="px-3 py-2 text-left">Assigned Teacher</th>
                      <th className="px-3 py-2 text-left">Availability</th>
                      <th className="px-3 py-2 text-left">Save Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tableRows.map((row) => {
                      const filteredTeachers = getFilteredTeachers(row.subjectName, row.subjectCode);
                      const selectedTeacherId = resolvedTeacherBySubject[row.subjectId] || '';
                      const selectedTeacher = teachers.find((teacher) => teacher.id === selectedTeacherId);

                      return (
                        <tr
                          key={row.subjectId}
                          className={`border-b border-slate-100 ${!selectedTeacherId ? 'bg-amber-50' : ''}`}
                        >
                          <td className="px-3 py-2">
                            <p className="font-medium text-slate-900">{row.subjectName}</p>
                            <p className="text-xs text-slate-500">{row.subjectCode}</p>
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className="h-9 w-full rounded-md border border-slate-300 bg-white px-2 text-sm"
                              value={selectedTeacherId}
                              onChange={(event) =>
                                setSelectedTeachersBySubject((prev) => ({
                                  ...prev,
                                  [row.subjectId]: event.target.value,
                                }))
                              }
                            >
                              <option value="">Select teacher</option>
                              {filteredTeachers.map((teacher) => (
                                <option key={teacher.id} value={teacher.id}>
                                  {teacher.teacherName} ({teacher.employeeId})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2">
                            {selectedTeacher ? (
                              <div>
                                <p className="text-slate-700 text-xs">
                                  {selectedTeacher.workload?.assignedSectionCount || 0} sections
                                </p>
                                {(selectedTeacher.workload?.isOverloaded) ? (
                                  <p className="text-xs font-semibold text-amber-700">Overload warning</p>
                                ) : (
                                  <p className="text-xs font-semibold text-emerald-700">Available</p>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-amber-700 font-semibold">Unassigned</p>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <p className="text-xs text-slate-600">
                              {row.assignment ? 'Existing assignment' : 'New assignment'}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {selectedSectionId && !assignmentTableQuery.isLoading && stats.unassignedSubjects > 0 && (
              <p className="mt-3 text-xs font-semibold text-amber-700">
                Warning: {stats.unassignedSubjects} subjects are currently unassigned.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
