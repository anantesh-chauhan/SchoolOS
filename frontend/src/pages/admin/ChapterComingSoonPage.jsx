import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import DashboardLayout from '../../layouts/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { subjectDetailsDataService } from '../../features/classes/services/subjectDetailsData';

const typeStyles = {
  PDF: 'bg-rose-50 text-rose-700 border-rose-100',
  LINK: 'bg-blue-50 text-blue-700 border-blue-100',
  VIDEO: 'bg-purple-50 text-purple-700 border-purple-100',
  NOTE: 'bg-emerald-50 text-emerald-700 border-emerald-100',
};

function ResourceCard({ resource }) {
  const href = resource.fileUrl || resource.externalUrl;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${typeStyles[resource.resourceType] || 'bg-slate-50 text-slate-700 border-slate-200'}`}>
              {resource.resourceType}
            </span>
            <p className="text-sm font-extrabold text-slate-900">{resource.title}</p>
          </div>
          {resource.description && (
            <p className="mt-2 text-sm text-slate-600">{resource.description}</p>
          )}
        </div>
        {href && (
          <a
            className="inline-flex h-10 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-blue-700 transition hover:bg-blue-50"
            href={href}
            target="_blank"
            rel="noreferrer"
          >
            Open
          </a>
        )}
      </div>
    </div>
  );
}

export default function ChapterComingSoonPage() {
  const { classId, sectionId, subjectId, chapterId } = useParams();
  const [payload, setPayload] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const data = await subjectDetailsDataService.getChapterPayload({ classId, sectionId, subjectId, chapterId });
      setPayload(data);
    } catch (err) {
      setPayload(null);
      setError(err.response?.data?.message || 'Unable to load chapter data from the server.');
      toast.error('Failed to load chapter details');
    } finally {
      setLoading(false);
    }
  }, [classId, sectionId, subjectId, chapterId]);

  useEffect(() => {
    load();
  }, [load]);

  const meta = payload?.meta;
  const subject = payload?.subject;
  const chapter = payload?.chapter;
  const resources = payload?.resources || [];

  return (
    <DashboardLayout role="ADMIN">
      <div className="space-y-6">
        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="h-7 w-64 animate-pulse rounded bg-slate-100" />
            <div className="mt-4 h-24 animate-pulse rounded-xl bg-slate-50" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-amber-900">
            <p className="text-sm font-bold">Chapter data unavailable</p>
            <p className="mt-1 text-sm">{error}</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={load}>Retry</Button>
              <Link className="inline-flex h-10 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700" to={`/dashboard/admin/academic/classes/${classId}/sections/${sectionId}/subjects/${subjectId}`}>
                Back to Subject
              </Link>
            </div>
          </div>
        )}

        {!loading && !error && meta && subject && chapter && (
          <>
            <Card>
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <Link className="font-semibold text-slate-700 hover:text-blue-700" to={`/dashboard/admin/academic/classes/${classId}/sections/${sectionId}/subjects/${subjectId}`}>{subject.name}</Link>
                      <span>/</span>
                      <span>{meta.className}</span>
                      <span>/</span>
                      <span>{meta.sectionName}</span>
                    </div>
                    <CardTitle>{chapter.chapterNumber}. {chapter.chapterName}</CardTitle>
                    <p className="mt-2 text-sm text-slate-600">Session {meta.academicSession} · {chapter.estimatedClasses} estimated classes</p>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                    <p className="text-xs font-bold uppercase text-slate-500">Completion</p>
                    <p className="mt-1 text-2xl font-extrabold text-slate-900">{chapter.completion}%</p>
                    <p className="text-xs font-semibold text-slate-600">{chapter.status}</p>
                  </div>
                </div>
              </CardHeader>
              {(chapter.remarks || chapter.lastUpdatedBy) && (
                <CardContent>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                    {chapter.remarks && <p>{chapter.remarks}</p>}
                    {chapter.lastUpdatedBy && <p className="mt-1 text-xs font-semibold text-slate-500">Updated by {chapter.lastUpdatedBy}</p>}
                  </div>
                </CardContent>
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Resources</CardTitle>
              </CardHeader>
              <CardContent>
                {resources.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                    <p className="text-sm font-semibold text-slate-800">No resources linked yet.</p>
                    <p className="mt-1 text-xs text-slate-500">Run the academic seed to add NCERT, CBSE and DIKSHA links.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {resources.map((resource) => (
                      <ResourceCard key={resource.id} resource={resource} />
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

