import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ClipboardCheck, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { teacherService } from '../../services/managementService';
import { useAcademicStructure } from '../../hooks/useAcademicStructure';

export default function ClassTeacherAssignmentPage() {
  const queryClient = useQueryClient();
  const academicStructure = useAcademicStructure();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [search, setSearch] = useState('');
  const [teacherBySection, setTeacherBySection] = useState({});

  const teachersQuery = useQuery({
    queryKey: ['teachers', 'all'],
    queryFn: () => teacherService.listAll(),
  });

  const assignmentsQuery = useQuery({
    queryKey: ['class-teacher-assignments', selectedClassId],
    queryFn: () => teacherService.classTeacherAssignments(selectedClassId ? { classId: selectedClassId } : {}),
  });

  const saveMutation = useMutation({
    mutationFn: teacherService.saveClassTeacherAssignment,
    onSuccess: () => {
      toast.success('Class teacher updated');
      queryClient.invalidateQueries({ queryKey: ['class-teacher-assignments'] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to save class teacher'),
  });

  const teachers = teachersQuery.data?.data || [];
  const rows = assignmentsQuery.data?.data || [];
  const stats = assignmentsQuery.data?.stats || { totalSections: 0, assignedSections: 0, unassignedSections: 0 };

  const filteredTeachers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return teachers;
    return teachers.filter((teacher) => (
      teacher.teacherName.toLowerCase().includes(q)
      || teacher.employeeId.toLowerCase().includes(q)
      || teacher.email.toLowerCase().includes(q)
      || String(teacher.specialization || '').toLowerCase().includes(q)
    ));
  }, [teachers, search]);

  const saveSection = (row) => {
    const teacherId = teacherBySection[row.sectionId] || row.teacher?.id || '';
    if (!teacherId) {
      toast.error('Select a teacher first');
      return;
    }

    saveMutation.mutate({
      classId: row.classId,
      sectionId: row.sectionId,
      teacherId,
    });
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">Academic setup</p>
            <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Class Teacher Assignment</h1>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-md border border-slate-200 bg-white px-4 py-2 dark:border-slate-800 dark:bg-slate-900">
              <p className="font-bold text-slate-950 dark:text-white">{stats.totalSections}</p>
              <p className="text-xs text-slate-500">Sections</p>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-2 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
              <p className="font-bold">{stats.assignedSections}</p>
              <p className="text-xs">Assigned</p>
            </div>
            <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <p className="font-bold">{stats.unassignedSections}</p>
              <p className="text-xs">Open</p>
            </div>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Sections</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[260px_1fr]">
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                value={selectedClassId}
                onChange={(event) => {
                  setSelectedClassId(event.target.value);
                  setTeacherBySection({});
                }}
              >
                <option value="">All classes</option>
                {academicStructure.classes.map((row) => (
                  <option key={row.id} value={row.id}>{row.className}</option>
                ))}
              </select>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  className="pl-9"
                  placeholder="Search teacher by name, employee ID, email, specialization"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
            </div>

            {assignmentsQuery.isLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 8 }).map((_, index) => (
                  <div key={index} className="h-12 rounded-md bg-slate-100 animate-pulse dark:bg-slate-800" />
                ))}
              </div>
            ) : (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                    <tr>
                      <th className="px-3 py-2 text-left">Class</th>
                      <th className="px-3 py-2 text-left">Section</th>
                      <th className="px-3 py-2 text-left">Current</th>
                      <th className="px-3 py-2 text-left">Assign Teacher</th>
                      <th className="px-3 py-2 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => {
                      const selectedTeacherId = teacherBySection[row.sectionId] || row.teacher?.id || '';
                      return (
                        <tr key={row.sectionId} className="border-b border-slate-100 dark:border-slate-800">
                          <td className="px-3 py-2 font-semibold text-slate-900 dark:text-slate-100">{row.className}</td>
                          <td className="px-3 py-2">Section {row.sectionName}</td>
                          <td className="px-3 py-2">
                            {row.teacher ? (
                              <div>
                                <p className="font-medium text-slate-800 dark:text-slate-100">{row.teacher.teacherName}</p>
                                <p className="text-xs text-slate-500">{row.teacher.employeeId}</p>
                              </div>
                            ) : (
                              <span className="font-semibold text-amber-700 dark:text-amber-300">Unassigned</span>
                            )}
                          </td>
                          <td className="px-3 py-2">
                            <select
                              className="h-9 w-full min-w-56 rounded-md border border-slate-300 bg-white px-2 text-sm dark:border-slate-700 dark:bg-slate-950"
                              value={selectedTeacherId}
                              onChange={(event) => setTeacherBySection((prev) => ({ ...prev, [row.sectionId]: event.target.value }))}
                            >
                              <option value="">Select teacher</option>
                              {filteredTeachers.map((teacher) => (
                                <option key={teacher.id} value={teacher.id}>
                                  {teacher.teacherName} ({teacher.employeeId})
                                </option>
                              ))}
                            </select>
                          </td>
                          <td className="px-3 py-2 text-right">
                            <Button
                              size="sm"
                              leftIcon={ClipboardCheck}
                              onClick={() => saveSection(row)}
                              loading={saveMutation.isPending}
                            >
                              Save
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
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
