import React from 'react';
import { useParams } from 'react-router-dom';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';

export default function ChapterComingSoonPage() {
  const { chapterId } = useParams();

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Chapter Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-slate-700">
              <div className="text-lg font-semibold text-slate-900">Topics, Notes, Homework, Assignments and Resources will be available here.</div>
              <div className="mt-2 text-sm text-slate-600">Chapter: <span className="font-semibold">{chapterId || 'N/A'}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

