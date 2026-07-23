import React from 'react';
import { Link } from 'react-router-dom';
import { Badge } from '../../../components/ui/badge';
import { label, statusVariant } from '../constants/analyticsStyles';

export default function ChapterHealthTable({ chapters = [], studentId, subjectId }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wider text-slate-500 dark:bg-slate-950"><tr>{['Chapter', 'Health', 'Homework', 'Quiz', 'Coverage', 'Status', ''].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead>
          <tbody>{chapters.map((chapter) => (
            <tr key={chapter.id} className="border-t dark:border-slate-800">
              <td className="px-4 py-4"><p className="font-semibold">{chapter.sequence}. {chapter.title}</p><p className="text-xs text-slate-500">{label(chapter.teachingStatus)}</p></td>
              <td className="px-4 font-bold">{chapter.health.score === null ? '—' : `${Math.round(chapter.health.score)}%`}</td>
              <td className="px-4">{chapter.homeworkCompletion === null ? '—' : `${chapter.homeworkCompletion}%`}</td>
              <td className="px-4">{chapter.quizAverage === null ? '—' : `${chapter.quizAverage}%`}</td>
              <td className="px-4">{Math.round(chapter.health.dataCoverage)}%</td>
              <td className="px-4"><Badge variant={statusVariant[chapter.health.chapterStatus]}>{label(chapter.health.chapterStatus)}</Badge></td>
              <td className="px-4"><Link className="font-semibold text-indigo-600 dark:text-indigo-300" to={`/analytics/students/${studentId}/subjects/${subjectId || chapter.subjectId}/chapters/${chapter.id}`}>View</Link></td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {!chapters.length && <div className="p-10 text-center text-sm text-slate-500">No chapters match this filter.</div>}
    </div>
  );
}

