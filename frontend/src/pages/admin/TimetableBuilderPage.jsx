import React, { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import {
  classService,
  sectionService,
  teacherService,
  timetableService,
} from '../../services/managementService';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

const DEFAULT_ACADEMIC_YEAR = '2025-26';

export default function TimetableBuilderPage() {
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [academicYear, setAcademicYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [selectedTimetableId, setSelectedTimetableId] = useState('');
  const [editorBySlot, setEditorBySlot] = useState({});

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: classService.list });
  const sectionsQuery = useQuery({
    queryKey: ['sections', selectedClassId],
    queryFn: () => sectionService.list(selectedClassId),
    enabled: Boolean(selectedClassId),
  });
  const teachersQuery = useQuery({
    queryKey: ['teachers', 'all'],
    queryFn: () => teacherService.list({ page: 1, limit: 300 }),
  });

  const timetablesQuery = useQuery({
    queryKey: ['timetables', selectedClassId, selectedSectionId, academicYear],
    queryFn: () => timetableService.list({ classId: selectedClassId, sectionId: selectedSectionId, academicYear }),
    enabled: Boolean(selectedClassId && selectedSectionId),
  });

  const timetableBodyQuery = useQuery({
    queryKey: ['timetable-body', selectedTimetableId],
    queryFn: () => timetableService.getBody(selectedTimetableId),
    enabled: Boolean(selectedTimetableId),
  });

  const createMutation = useMutation({
    mutationFn: timetableService.create,
    onSuccess: (response) => {
      toast.success('Timetable body created');
      const id = response?.data?.id;
      if (id) {
        setSelectedTimetableId(id);
      }
      queryClient.invalidateQueries({ queryKey: ['timetables', selectedClassId, selectedSectionId, academicYear] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to create timetable body'),
  });

  const assignMutation = useMutation({
    mutationFn: ({ slotId, payload }) => timetableService.assignSlot(slotId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-body', selectedTimetableId] });
      queryClient.invalidateQueries({ queryKey: ['teacher-assignment-table', selectedClassId, selectedSectionId] });
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      toast.success('Slot assigned and teacher mapping synced');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to assign slot'),
  });

  const resetMutation = useMutation({
    mutationFn: (slotId) => timetableService.resetSlot(slotId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['timetable-body', selectedTimetableId] });
      toast.success('Slot reset');
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to reset slot'),
  });

  const validateMutation = useMutation({
    mutationFn: timetableService.validate,
    onError: (error) => toast.error(error.response?.data?.message || 'Validation failed'),
  });

  const classes = classesQuery.data?.data || [];
  const sections = sectionsQuery.data?.data || [];
  const timetables = timetablesQuery.data?.data || [];

  const timetable = timetableBodyQuery.data?.data?.timetable;
  const dayOrder = timetableBodyQuery.data?.data?.dayOrder || [];
  const requirementProgress = timetableBodyQuery.data?.data?.requirementProgress || [];
  const availableSubjects = timetableBodyQuery.data?.data?.availableSubjects || [];
  const availableTeachers = timetableBodyQuery.data?.data?.availableTeachers || teachersQuery.data?.data || [];
  const sectionTeacherAssignments = timetableBodyQuery.data?.data?.sectionTeacherAssignments || [];

  const assignmentTeacherBySubjectId = useMemo(() => {
    const map = new Map();
    sectionTeacherAssignments.forEach((row) => {
      map.set(row.subjectId, row.teacherId);
    });
    return map;
  }, [sectionTeacherAssignments]);

  const selectedTimetable = useMemo(() => {
    return timetables.find((item) => item.id === selectedTimetableId) || null;
  }, [timetables, selectedTimetableId]);

  const slotByKey = useMemo(() => {
    const map = new Map();
    const slots = timetable?.slots || [];
    slots.forEach((slot) => {
      map.set(`${slot.dayOfWeek}-${slot.sequenceOrder}`, slot);
    });
    return map;
  }, [timetable]);

  const rowBlueprint = useMemo(() => {
    const slots = timetable?.slots || [];
    return slots
      .filter((slot) => slot.dayOfWeek === 'MONDAY')
      .sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  }, [timetable]);

  const getTeachersForSubject = (subjectName) => {
    const needle = String(subjectName || '').toLowerCase();
    const compatible = [];
    const others = [];

    availableTeachers.forEach((teacher) => {
      const specialization = String(teacher.specialization || '').toLowerCase();
      const handles = (teacher.subjectsHandled || []).some((item) => String(item).toLowerCase().includes(needle));
      if (specialization.includes(needle) || handles) {
        compatible.push(teacher);
      } else {
        others.push(teacher);
      }
    });

    return [...compatible, ...others];
  };

  const createBody = () => {
    if (!selectedClassId || !selectedSectionId || !academicYear) {
      toast.error('Select class, section and academic year first');
      return;
    }

    createMutation.mutate({
      classId: selectedClassId,
      sectionId: selectedSectionId,
      academicYear,
    });
  };

  const assignCell = (slot) => {
    const editor = editorBySlot[slot.id] || {};
    if (!editor.subjectId) {
      toast.error('Select subject');
      return;
    }

    assignMutation.mutate({
      slotId: slot.id,
      payload: {
        subjectId: editor.subjectId,
        ...(editor.teacherId ? { teacherId: editor.teacherId } : {}),
      },
    });
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Timetable Body Builder (Manual Assignment)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700">Class</label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={selectedClassId}
                onChange={(event) => {
                  setSelectedClassId(event.target.value);
                  setSelectedSectionId('');
                  setSelectedTimetableId('');
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
                  setSelectedTimetableId('');
                }}
                disabled={!selectedClassId}
              >
                <option value="">Select section</option>
                {sections.map((row) => (
                  <option key={row.id} value={row.id}>{row.sectionName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Academic Year</label>
              <input
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
                placeholder="2025-26"
              />
            </div>

            <div className="md:col-span-2 flex items-end gap-2">
              <Button onClick={createBody} disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Creating...' : 'Create Timetable Body'}
              </Button>
              <Button
                variant="outline"
                onClick={() => validateMutation.mutate(selectedTimetableId)}
                disabled={!selectedTimetableId || validateMutation.isPending}
              >
                {validateMutation.isPending ? 'Validating...' : 'Validate Weekly Slots'}
              </Button>
            </div>

            <div className="md:col-span-5">
              <label className="text-sm font-medium text-slate-700">Existing Timetable</label>
              <select
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={selectedTimetableId}
                onChange={(event) => setSelectedTimetableId(event.target.value)}
                disabled={!timetables.length}
              >
                <option value="">Select timetable</option>
                {timetables.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.class.className} - Section {row.section.sectionName} ({row.academicYear})
                  </option>
                ))}
              </select>
            </div>
          </CardContent>
        </Card>

        {selectedTimetable && (
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedTimetable.class.className} - Section {selectedTimetable.section.sectionName} ({selectedTimetable.academicYear})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              {timetableBodyQuery.isLoading ? (
                <div className="h-56 rounded-md bg-slate-100 animate-pulse" />
              ) : (
                <table className="min-w-[1080px] w-full text-xs">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-2 py-2 text-left min-w-28">Slot</th>
                      {dayOrder.map((day) => (
                        <th key={day} className="px-2 py-2 text-left">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rowBlueprint.map((blueprintSlot) => (
                      <tr key={blueprintSlot.id} className="border-b border-slate-100 align-top">
                        <td className="px-2 py-2 font-semibold text-slate-800">
                          <p>{blueprintSlot.slotLabel}</p>
                          <p className="text-[10px] text-slate-500">{blueprintSlot.startTime} - {blueprintSlot.endTime}</p>
                        </td>

                        {dayOrder.map((day) => {
                          const slot = slotByKey.get(`${day}-${blueprintSlot.sequenceOrder}`);
                          if (!slot) {
                            return <td key={day} className="px-2 py-2" />;
                          }

                          if (slot.slotType === 'FIXED') {
                            return (
                              <td key={day} className="px-2 py-2">
                                <div className="rounded border border-slate-200 bg-slate-50 p-2">
                                  <p className="font-medium text-slate-700">{slot.slotLabel}</p>
                                  <p className="text-[10px] text-slate-500">Fixed block</p>
                                </div>
                              </td>
                            );
                          }

                          const editor = editorBySlot[slot.id] || {
                            subjectId: slot.subjectId || '',
                            teacherId: slot.teacherId || assignmentTeacherBySubjectId.get(slot.subjectId) || '',
                          };
                          const activeSubject = availableSubjects.find((item) => item.id === editor.subjectId);
                          const matchingTeachers = activeSubject ? getTeachersForSubject(activeSubject.subjectName) : availableTeachers;

                          return (
                            <td key={day} className="px-2 py-2">
                              <div className="rounded border border-slate-200 p-2 space-y-2">
                                <p className="font-semibold text-slate-900">{slot.subject?.subjectCode || 'Unassigned'}</p>
                                <p className="text-[10px] text-slate-600">{slot.teacher?.teacherName || 'No teacher'}</p>

                                <select
                                  className="h-8 w-full rounded border border-slate-300 bg-white px-2"
                                  value={editor.subjectId}
                                  onChange={(event) =>
                                    setEditorBySlot((prev) => ({
                                      ...prev,
                                      [slot.id]: {
                                        ...editor,
                                        subjectId: event.target.value,
                                        teacherId: assignmentTeacherBySubjectId.get(event.target.value) || '',
                                      },
                                    }))
                                  }
                                >
                                  <option value="">Subject</option>
                                  {availableSubjects.map((row) => (
                                    <option key={row.id} value={row.id}>
                                      {row.subjectName}
                                    </option>
                                  ))}
                                </select>

                                <select
                                  className="h-8 w-full rounded border border-slate-300 bg-white px-2"
                                  value={editor.teacherId}
                                  onChange={(event) =>
                                    setEditorBySlot((prev) => ({
                                      ...prev,
                                      [slot.id]: {
                                        ...editor,
                                        teacherId: event.target.value,
                                      },
                                    }))
                                  }
                                >
                                  <option value="">Teacher</option>
                                  {matchingTeachers.map((teacher) => (
                                    <option key={teacher.id} value={teacher.id}>
                                      {teacher.teacherName} ({teacher.employeeId})
                                    </option>
                                  ))}
                                </select>

                                <div className="flex gap-1">
                                  <button
                                    type="button"
                                    className="h-7 px-2 rounded bg-blue-600 text-white"
                                    onClick={() => assignCell(slot)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="h-7 px-2 rounded bg-slate-200 text-slate-700"
                                    onClick={() => resetMutation.mutate(slot.id)}
                                  >
                                    Reset
                                  </button>
                                </div>
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        )}

        {selectedTimetableId && (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Requirement Progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {requirementProgress.map((row) => (
                  <div key={row.subjectId} className="rounded border border-slate-200 p-2 flex items-center justify-between">
                    <div>
                      <p className="font-medium text-slate-900">{row.subjectName}</p>
                      <p className="text-xs text-slate-500">{row.subjectCode}</p>
                    </div>
                    <p className={`font-semibold ${row.assigned < row.required ? 'text-amber-700' : 'text-emerald-700'}`}>
                      {row.assigned}/{row.required}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Validation</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {!validateMutation.data?.data?.issues?.length && <p className="text-slate-500">Run validation to check constraints.</p>}
                {(validateMutation.data?.data?.issues || []).map((issue, index) => (
                  <div key={`${issue.type}-${index}`} className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-800">
                    <p className="font-semibold text-xs">{issue.type}</p>
                    <p>{issue.message}</p>
                  </div>
                ))}
                {validateMutation.data?.data?.isValid && (
                  <p className="rounded border border-emerald-200 bg-emerald-50 p-2 text-emerald-800 font-semibold">
                    Timetable is valid.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
