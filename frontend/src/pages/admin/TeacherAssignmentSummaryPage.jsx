import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { teacherService } from '../../services/managementService';
import { useAcademicStructure } from '../../hooks/useAcademicStructure';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { authService } from '../../services/authService';
import { API_BASE_URL } from '../../services/api';
import { useSearchParams } from 'react-router-dom';

export default function TeacherAssignmentSummaryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [teacherId, setTeacherId] = useState(() => searchParams.get('teacherId') || '');
  const [subjectId, setSubjectId] = useState(() => searchParams.get('subjectId') || '');
  const academicStructure = useAcademicStructure();

  const teachersQuery = useQuery({ queryKey: ['teachers', 'lookup'], queryFn: () => teacherService.list({ page: 1, limit: 1000 }) });

  const summaryQuery = useQuery({
    queryKey: ['teacher-assignment-summary', classId, sectionId, teacherId, subjectId],
    queryFn: () => teacherService.summary({ classId, sectionId, teacherId, subjectId }),
  });

  const rows = summaryQuery.data?.data || [];
  const classes = academicStructure.classes;
  const sections = academicStructure.getSections(classId);
  const teachers = teachersQuery.data?.data || [];
  const subjects = academicStructure.subjects;

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    if (sectionId) params.append('sectionId', sectionId);
    if (teacherId) params.append('teacherId', teacherId);
    if (subjectId) params.append('subjectId', subjectId);
    params.append('exportFormat', 'csv');
    return `${API_BASE_URL}/teachers/assignments/summary?${params.toString()}`;
  }, [classId, sectionId, teacherId, subjectId]);

  const exportCsv = async () => {
    const token = authService.getToken();
    const response = await fetch(exportUrl, {
      headers: {
        Authorization: token ? `Bearer ${token}` : '',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to export CSV');
    }

    const blob = await response.blob();
    const objectUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = objectUrl;
    link.download = 'teacher-assignment-summary.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  };

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Teacher Assignment Summary</CardTitle>
              <Button
                variant="outline"
                onClick={async () => {
                  try {
                    await exportCsv();
                    toast.success('CSV export started');
                  } catch (error) {
                    toast.error('CSV export failed. Please try again.');
                  }
                }}
              >
                Export CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={classId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  setSectionId('');
                }}
              >
                <option value="">Filter by class</option>
                {classes.map((row) => (
                  <option key={row.id} value={row.id}>{row.className}</option>
                ))}
              </select>

              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={sectionId}
                onChange={(event) => setSectionId(event.target.value)}
                disabled={!classId}
              >
                <option value="">Filter by section</option>
                {sections.map((row) => (
                  <option key={row.id} value={row.id}>{row.sectionName}</option>
                ))}
              </select>

              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={teacherId}
                onChange={(event) => {
                  const value = event.target.value;
                  setTeacherId(value);
                  const next = new URLSearchParams(searchParams);
                  if (value) next.set('teacherId', value); else next.delete('teacherId');
                  setSearchParams(next, { replace: true });
                }}
              >
                <option value="">Filter by teacher</option>
                {teachers.map((row) => (
                  <option key={row.id} value={row.id}>{row.teacherName}</option>
                ))}
              </select>

              <select
                className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
                value={subjectId}
                onChange={(event) => {
                  const value = event.target.value;
                  setSubjectId(value);
                  const next = new URLSearchParams(searchParams);
                  if (value) next.set('subjectId', value); else next.delete('subjectId');
                  setSearchParams(next, { replace: true });
                }}
              >
                <option value="">Filter by subject</option>
                {subjects.map((row) => (
                  <option key={row.id} value={row.id}>{row.subjectName} ({row.subjectCode})</option>
                ))}
              </select>
            </div>

            <div className="mt-4 overflow-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 text-left">Class</th>
                    <th className="px-3 py-2 text-left">Section</th>
                    <th className="px-3 py-2 text-left">Subject</th>
                    <th className="px-3 py-2 text-left">Teacher</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryQuery.isLoading && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-slate-500">Loading summary...</td>
                    </tr>
                  )}
                  {!summaryQuery.isLoading && rows.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-slate-500">No assignment records found.</td>
                    </tr>
                  )}
                  {rows.map((row) => (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="px-3 py-2">{row.class.className}</td>
                      <td className="px-3 py-2">{row.section.sectionName}</td>
                      <td className="px-3 py-2">{row.subject.subjectName} ({row.subject.subjectCode})</td>
                      <td className="px-3 py-2">{row.teacher.teacherName} ({row.teacher.employeeId})</td>
                    </tr>
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
