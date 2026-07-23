import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { label, statusVariant } from '../constants/analyticsStyles';

export default function InterventionTimeline({ items = [] }) {
  return (
    <Card><CardHeader><CardTitle>Intervention timeline</CardTitle></CardHeader><CardContent>
      <ol className="relative ml-2 border-l border-slate-200 dark:border-slate-700">
        {items.map((item) => <li key={item.id} className="relative mb-6 ml-5 last:mb-0"><span className="absolute -left-[25px] top-1 h-2.5 w-2.5 rounded-full bg-indigo-600 ring-4 ring-white dark:ring-slate-900" /><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{item.title || item.recommendedAction}</p><Badge size="sm" variant={statusVariant[item.status]}>{label(item.status)}</Badge></div><p className="mt-1 text-sm text-slate-500">{item.reason}</p><p className="mt-1 text-xs text-slate-400">{new Date(item.createdAt).toLocaleDateString()}</p></li>)}
      </ol>
      {!items.length && <p className="py-6 text-center text-sm text-slate-500">No interventions have been recorded.</p>}
    </CardContent></Card>
  );
}

