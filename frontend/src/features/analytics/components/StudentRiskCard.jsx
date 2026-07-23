import React from 'react';
import { AlertTriangle, CheckCircle2, ShieldQuestion } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { label, riskVariant } from '../constants/analyticsStyles';

export default function StudentRiskCard({ risk }) {
  const Icon = risk?.riskLevel === 'LOW' ? CheckCircle2 : risk?.riskLevel === 'INSUFFICIENT_DATA' ? ShieldQuestion : AlertTriangle;
  return (
    <Card>
      <CardContent>
        <div className="flex items-start justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-widest text-slate-500">Support indicator</p><h2 className="mt-1 text-lg font-bold">Current risk review</h2></div>
          <Badge variant={riskVariant[risk?.riskLevel]} icon={Icon}>{label(risk?.riskLevel)}</Badge>
        </div>
        {risk?.wording && <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{risk.wording}</p>}
        <div className="mt-4 space-y-2">
          {(risk?.reasons || []).length ? risk.reasons.map((item) => (
            <div key={item.code} className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-semibold">{label(item.code)}</p><Badge size="sm" variant={riskVariant[item.severity]}>{label(item.severity)}</Badge></div>
              <p className="mt-1 text-xs leading-5 text-slate-500">{item.message}</p>
            </div>
          )) : <p className="text-sm text-slate-500">No active risk reasons were detected from the available data.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

