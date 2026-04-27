import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { classService, sectionService, subjectService, timetableService } from '../../services/managementService';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';

const getClassNumber = (className) => {
  const match = String(className || '').match(/class\s*(\d+)/i);
  return match ? Number(match[1]) : null;
};

export default function WeeklySlotManagementPage() {
  const queryClient = useQueryClient();
  const [selectedClassId, setSelectedClassId] = useState('');
  const [scope, setScope] = useState('CLASS');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [rows, setRows] = useState([]);

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: classService.list });
  const sectionsQuery = useQuery({
    queryKey: ['sections', selectedClassId],
    queryFn: () => sectionService.list(selectedClassId),
    enabled: Boolean(selectedClassId),
  });

  const classSubjectsQuery = useQuery({
    queryKey: ['class-subjects', selectedClassId],
    queryFn: () => subjectService.classSubjects(selectedClassId),
    enabled: Boolean(selectedClassId) && scope === 'CLASS',
  });

  const sectionSubjectsQuery = useQuery({
    queryKey: ['section-subjects', selectedSectionId],
    queryFn: () => subjectService.sectionSubjects(selectedSectionId),
    enabled: Boolean(selectedSectionId) && scope === 'SECTION',
  });

  const requirementsQuery = useQuery({
    queryKey: ['weekly-requirements', selectedClassId, scope, selectedSectionId],
    queryFn: () => timetableService.listWeeklyRequirements({
      classId: selectedClassId,
      ...(scope === 'SECTION' && selectedSectionId ? { sectionId: selectedSectionId } : {}),
    }),
    enabled: Boolean(selectedClassId) && (scope === 'CLASS' || Boolean(selectedSectionId)),
  });

  const saveMutation = useMutation({
    mutationFn: timetableService.saveWeeklyRequirements,
    onSuccess: () => {
      toast.success('Weekly slot requirements saved');
      queryClient.invalidateQueries({ queryKey: ['weekly-requirements', selectedClassId, scope, selectedSectionId] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to save weekly requirements'),
  });

  const propagateMutation = useMutation({
    mutationFn: timetableService.propagateWeeklyRequirements,
    onSuccess: (response) => {
      const classesProcessed = response?.data?.classesProcessed || 0;
      toast.success(`Weekly templates propagated (${classesProcessed} class${classesProcessed === 1 ? '' : 'es'})`);
      queryClient.invalidateQueries({ queryKey: ['weekly-requirements'] });
    },
    onError: (error) => toast.error(error.response?.data?.message || 'Failed to propagate templates'),
  });

  const classes = classesQuery.data?.data || [];
  const sections = sectionsQuery.data?.data || [];
  const sourceSubjects = scope === 'SECTION'
    ? (sectionSubjectsQuery.data?.data || [])
    : (classSubjectsQuery.data?.data || []);
  const existingRequirements = requirementsQuery.data?.data || [];

  const selectedClass = useMemo(
    () => classes.find((row) => row.id === selectedClassId) || null,
    [classes, selectedClassId]
  );
  const classNo = getClassNumber(selectedClass?.className);

  useEffect(() => {
    if (!selectedClassId || (scope === 'SECTION' && !selectedSectionId)) {
      setRows([]);
      return;
    }

    const existingBySubjectId = new Map(existingRequirements.map((row) => [row.subjectId, row]));

    setRows(
      sourceSubjects.map((item) => {
        const existing = existingBySubjectId.get(item.subjectId);
        return {
          subjectId: item.subjectId,
          subjectName: item.subject.subjectName,
          subjectCode: item.subject.subjectCode,
          periodsPerWeek: existing?.periodsPerWeek || 4,
          isMandatory: existing ? existing.isMandatory : true,
          isOptional: existing ? existing.isOptional : false,
        };
      })
    );
  }, [selectedClassId, selectedSectionId, scope, sourceSubjects, existingRequirements]);

  const summary = useMemo(() => {
    let totalPeriods = 0;
    let mandatoryCount = 0;
    let optionalCount = 0;

    rows.forEach((row) => {
      totalPeriods += Number(row.periodsPerWeek || 0);
      if (row.isMandatory) mandatoryCount += 1;
      if (row.isOptional) optionalCount += 1;
    });

    return { totalPeriods, mandatoryCount, optionalCount };
  }, [rows]);

  const updateRow = (subjectId, patch) => {
    setRows((prev) => prev.map((row) => (row.subjectId === subjectId ? { ...row, ...patch } : row)));
  };

  const saveAll = () => {
    if (!selectedClassId || rows.length === 0) {
      toast.error('Select class and valid subject scope first');
      return;
    }

    if (scope === 'SECTION' && !selectedSectionId) {
      toast.error('Select section for section-wise allotment');
      return;
    }

    const payloadRows = rows.map((row) => ({
      subjectId: row.subjectId,
      periodsPerWeek: Number(row.periodsPerWeek),
      isMandatory: Boolean(row.isMandatory),
      isOptional: Boolean(row.isOptional),
    }));

    saveMutation.mutate({
      classId: selectedClassId,
      ...(scope === 'SECTION' ? { sectionId: selectedSectionId } : {}),
      requirements: payloadRows,
    });
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Weekly Subject Slot Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <label className="text-sm font-medium text-slate-700">Class</label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={selectedClassId}
                  onChange={(event) => {
                    setSelectedClassId(event.target.value);
                    setSelectedSectionId('');
                  }}
                >
                  <option value="">Select class</option>
                  {classes.map((row) => (
                    <option key={row.id} value={row.id}>{row.className}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Allotment Scope</label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={scope}
                  onChange={(event) => {
                    setScope(event.target.value);
                    setSelectedSectionId('');
                  }}
                >
                  <option value="CLASS">Whole class (all sections)</option>
                  <option value="SECTION">Per section</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-slate-700">Section</label>
                <select
                  className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  value={selectedSectionId}
                  onChange={(event) => setSelectedSectionId(event.target.value)}
                  disabled={scope !== 'SECTION' || !selectedClassId}
                >
                  <option value="">Select section</option>
                  {sections.map((row) => (
                    <option key={row.id} value={row.id}>{row.sectionName}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p>Total weekly periods configured: {summary.totalPeriods} / 48</p>
              <p>Mandatory subjects: {summary.mandatoryCount}</p>
              <p>Optional subjects: {summary.optionalCount}</p>
              <p className="text-xs mt-1 text-slate-500">Active saved scope: {requirementsQuery.data?.scope || 'N/A'}</p>
              {[9, 10, 11, 12].includes(classNo) && (
                <p className="mt-1 text-xs font-semibold text-amber-700">
                  Class 9-12 rule: exactly 5 mandatory + 1 optional subject.
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                disabled={!selectedClassId || scope !== 'CLASS' || propagateMutation.isPending}
                onClick={() => propagateMutation.mutate({ classId: selectedClassId })}
              >
                Apply This Class Template To All Sections
              </Button>
              <Button
                variant="outline"
                disabled={propagateMutation.isPending}
                onClick={() => propagateMutation.mutate({ applyToAllClasses: true })}
              >
                Apply All Class Templates School-Wide
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Configure Subject Requirements</CardTitle>
          </CardHeader>
          <CardContent>
            {!selectedClassId && <p className="text-sm text-slate-500">Select a class to configure requirements.</p>}
            {scope === 'SECTION' && selectedClassId && !selectedSectionId && (
              <p className="text-sm text-slate-500">Select a section to configure section-wise requirements.</p>
            )}

            {(requirementsQuery.isLoading || classSubjectsQuery.isLoading || sectionSubjectsQuery.isLoading) && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-10 rounded-md bg-slate-100 animate-pulse" />
                ))}
              </div>
            )}

            {!requirementsQuery.isLoading && rows.length > 0 && (
              <div className="overflow-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left">Subject</th>
                      <th className="px-3 py-2 text-left">Periods/Week</th>
                      <th className="px-3 py-2 text-left">Mandatory</th>
                      <th className="px-3 py-2 text-left">Optional</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.subjectId} className="border-b border-slate-100">
                        <td className="px-3 py-2">
                          <p className="font-medium text-slate-900">{row.subjectName}</p>
                          <p className="text-xs text-slate-500">{row.subjectCode}</p>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            max={10}
                            className="h-9 w-24 rounded-md border border-slate-300 px-2"
                            value={row.periodsPerWeek}
                            onChange={(event) => updateRow(row.subjectId, { periodsPerWeek: event.target.value })}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={row.isMandatory}
                            onChange={(event) =>
                              updateRow(row.subjectId, {
                                isMandatory: event.target.checked,
                                isOptional: event.target.checked ? false : row.isOptional,
                              })
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={row.isOptional}
                            onChange={(event) => {
                              if (!event.target.checked) {
                                updateRow(row.subjectId, { isOptional: false });
                                return;
                              }

                              if ([9, 10, 11, 12].includes(classNo)) {
                                setRows((prev) => prev.map((item) => ({
                                  ...item,
                                  isOptional: item.subjectId === row.subjectId,
                                  isMandatory: item.subjectId === row.subjectId ? false : item.isMandatory,
                                })));
                              } else {
                                updateRow(row.subjectId, { isOptional: true, isMandatory: false });
                              }
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!requirementsQuery.isLoading && selectedClassId && rows.length === 0 && (
              <p className="text-sm text-slate-500">No subjects available for selected scope. Assign subjects first.</p>
            )}

            <div className="mt-4 flex justify-end">
              <Button onClick={saveAll} disabled={!selectedClassId || saveMutation.isPending || (scope === 'SECTION' && !selectedSectionId)}>
                {saveMutation.isPending ? 'Saving...' : 'Save Weekly Requirements'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
