import React from 'react';
import { Activity, ChevronDown } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import AnalyticsDataCoverage from './AnalyticsDataCoverage';

export default function AcademicHealthCard({ health }) {
  const [open, setOpen] = React.useState(false);
  const score = health?.score;
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center">
          <div className="relative grid h-28 w-28 shrink-0 place-items-center rounded-full bg-slate-100 dark:bg-slate-800" style={{ background: score === null ? undefined : `conic-gradient(var(--school-primary) ${score * 3.6}deg, rgb(226 232 240) 0deg)` }}>
            <div className="grid h-24 w-24 place-items-center rounded-full bg-white text-center dark:bg-slate-900">
              <div><p className="text-3xl font-bold">{score === null ? '—' : Math.round(score)}</p><p className="text-[10px] uppercase tracking-wider text-slate-500">out of 100</p></div>
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-indigo-600"><Activity size={15} /> Academic health</p>
            <h2 className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{score === null ? 'More data is needed' : score >= 70 ? 'Progress is on track' : score >= 50 ? 'Some areas need attention' : 'Support is recommended'}</h2>
            <p className="mt-1 text-sm text-slate-500">A normalized view of all available academic signals.</p>
            <button onClick={() => setOpen((value) => !value)} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 dark:text-indigo-300" aria-expanded={open}>
              How this was calculated <ChevronDown size={14} className={open ? 'rotate-180 transition-transform' : 'transition-transform'} />
            </button>
          </div>
          <AnalyticsDataCoverage value={health?.dataCoverage || 0} />
        </div>
        {open && (
          <div className="border-t bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950/60">
            <div className="grid gap-2 md:grid-cols-2">
              {(health?.components || []).map((component) => (
                <div key={component.name} className="flex items-center justify-between rounded-lg border bg-white px-3 py-2 text-xs dark:border-slate-800 dark:bg-slate-900">
                  <span><strong>{component.name}</strong><span className="ml-1 text-slate-500">{component.rawScore}% × {component.effectiveWeight}%</span></span>
                  <span className="font-bold">{component.contribution}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

