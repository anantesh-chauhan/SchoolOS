import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import DashboardLayout from '../../layouts/DashboardLayout';
import { classService, sectionService, timetableService } from '../../services/managementService';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export default function TimetableReconciliationPage() {
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [academicYear, setAcademicYear] = useState('');

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: classService.list });
  const sectionsQuery = useQuery({
    queryKey: ['sections', selectedClassId],
    queryFn: () => sectionService.list(selectedClassId),
    enabled: Boolean(selectedClassId),
  });

  const reportQuery = useQuery({
    queryKey: ['timetable-reconciliation', selectedClassId, selectedSectionId, academicYear],
    queryFn: () => timetableService.reconciliationReport({
      ...(selectedClassId ? { classId: selectedClassId } : {}),
      ...(selectedSectionId ? { sectionId: selectedSectionId } : {}),
      ...(academicYear ? { academicYear } : {}),
    }),
  });

  const classes = classesQuery.data?.data || [];
  const sections = sectionsQuery.data?.data || [];
  const summary = reportQuery.data?.data?.summary;
  const rows = reportQuery.data?.data?.sections || [];

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Timetable Compliance Reconciliation</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
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
                <option value="">All classes</option>
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
                onChange={(event) => setSelectedSectionId(event.target.value)}
                disabled={!selectedClassId}
              >
                <option value="">All sections</option>
                {sections.map((row) => (
                  <option key={row.id} value={row.id}>{row.sectionName}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium text-slate-700">Academic Year (Optional)</label>
              <input
                className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                placeholder="2025-26"
                value={academicYear}
                onChange={(event) => setAcademicYear(event.target.value)}
              />
            </div>

            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <p>Sections checked: {summary?.sectionsChecked || 0}</p>
              <p>Compliant: {summary?.compliantSections || 0}</p>
              <p className="text-amber-700 font-semibold">Issues: {summary?.totalIssues || 0}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Section Compliance Details</CardTitle>
          </CardHeader>
          <CardContent>
            {reportQuery.isLoading && <div className="h-40 rounded bg-slate-100 animate-pulse" />}

            {!reportQuery.isLoading && rows.length === 0 && (
              <p className="text-sm text-slate-500">No section data found for selected filters.</p>
            )}

            {!reportQuery.isLoading && rows.length > 0 && (
              <div className="space-y-3">
                {rows.map((row) => (
                  <div key={`${row.classId}-${row.sectionId}`} className="rounded-lg border border-slate-200 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900">{row.className} - Section {row.sectionName}</p>
                        <p className="text-xs text-slate-500">
                          Subjects: {row.totalSectionSubjects} | Teacher mappings: {row.totalTeacherAssignments} | Requirements: {row.totalRequirements} ({row.requirementScope}) | Timetables: {row.timetableCount}
                        </p>
                      </div>
                      <span className={`px-2 py-1 text-xs rounded ${row.isCompliant ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {row.isCompliant ? 'Compliant' : `Issues: ${row.issues.length}`}
                      </span>
                    </div>

                    {!row.isCompliant && (
                      <div className="mt-3 space-y-2">
                        {row.issues.map((issue, idx) => (
                          <div key={`${issue.type}-${idx}`} className="rounded border border-amber-200 bg-amber-50 p-2 text-amber-800 text-sm">
                            <p className="font-semibold text-xs">{issue.type}</p>
                            <p>{issue.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
