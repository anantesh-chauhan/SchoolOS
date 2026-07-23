import React from 'react';
import { CalendarClock, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { label, riskVariant } from '../constants/analyticsStyles';

export default function RecommendationList({ items = [], role }) {
  const visible = items.filter((item) => !role || item.recommendedRole === role || ['ADMIN', 'SCHOOL_OWNER', 'CURRICULUM_MANAGER', 'TEACHER'].includes(role));
  return (
    <Card>
      <CardHeader><CardTitle>Recommended next steps</CardTitle><CheckCircle2 size={18} className="text-indigo-600" /></CardHeader>
      <CardContent className="space-y-3">
        {visible.map((item, index) => <div key={`${item.sourceCode}-${item.recommendedRole}-${index}`} className="rounded-xl border p-4 dark:border-slate-800"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{item.title}</p><p className="mt-1 text-sm leading-5 text-slate-500">{item.explanation}</p></div><Badge variant={riskVariant[item.priority]}>{label(item.priority)}</Badge></div><p className="mt-3 flex items-center gap-1 text-xs text-slate-500"><CalendarClock size={13} /> Suggested by {new Date(item.suggestedDeadline).toLocaleDateString()} · For {label(item.recommendedRole)}</p></div>)}
        {!visible.length && <p className="py-6 text-center text-sm text-slate-500">No recommendations are active from the available evidence.</p>}
      </CardContent>
    </Card>
  );
}

