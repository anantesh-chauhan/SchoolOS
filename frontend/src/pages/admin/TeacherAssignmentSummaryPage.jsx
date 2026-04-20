import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { classService, sectionService, teacherService } from '../../services/managementService';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { authService } from '../../services/authService';

export default function TeacherAssignmentSummaryPage() {
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [teacherId, setTeacherId] = useState('');

  const classesQuery = useQuery({ queryKey: ['classes'], queryFn: classService.list });
  const sectionsQuery = useQuery({
    queryKey: ['sections', classId],
    queryFn: () => sectionService.list(classId),
    enabled: Boolean(classId),
  });
  const teachersQuery = useQuery({ queryKey: ['teachers', 'lookup'], queryFn: () => teacherService.list({ page: 1, limit: 200 }) });

  const summaryQuery = useQuery({
    queryKey: ['teacher-assignment-summary', classId, sectionId, teacherId],
    queryFn: () => teacherService.summary({ classId, sectionId, teacherId }),
  });

  const rows = summaryQuery.data?.data || [];
  const classes = classesQuery.data?.data || [];
  const sections = sectionsQuery.data?.data || [];
  const teachers = teachersQuery.data?.data || [];

  const exportUrl = useMemo(() => {
    const params = new URLSearchParams();
    if (classId) params.append('classId', classId);
    if (sectionId) params.append('sectionId', sectionId);
    if (teacherId) params.append('teacherId', teacherId);
    params.append('exportFormat', 'csv');
    return `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api'}/teachers/assignments/summary?${params.toString()}`;
  }, [classId, sectionId, teacherId]);

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
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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
                onChange={(event) => setTeacherId(event.target.value)}
              >
                <option value="">Filter by teacher</option>
                {teachers.map((row) => (
                  <option key={row.id} value={row.id}>{row.teacherName}</option>
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
