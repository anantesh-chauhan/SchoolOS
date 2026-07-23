import React from 'react';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { label, statusVariant } from '../constants/analyticsStyles';

export default function PerformanceTrendChart({ trend, attendance }) {
  const data = attendance?.monthly || [];
  return (
    <Card>
      <CardHeader><div><CardTitle>Progress trend</CardTitle><p className="text-xs text-slate-500">Monthly attendance and recent assessment direction</p></div><Badge variant={statusVariant[trend?.trend]}>{label(trend?.trend)}</Badge></CardHeader>
      <CardContent>
        {data.length >= 2 ? (
          <>
            <div className="h-48" aria-hidden="true">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data}><XAxis dataKey="month" tick={{ fontSize: 11 }} /><YAxis domain={[0, 100]} tick={{ fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="value" name="Attendance %" stroke="#4f46e5" strokeWidth={3} dot={{ r: 3 }} /></LineChart>
              </ResponsiveContainer>
            </div>
            <table className="sr-only"><caption>Monthly attendance values</caption><tbody>{data.map((row) => <tr key={row.month}><th>{row.month}</th><td>{row.value}%</td></tr>)}</tbody></table>
          </>
        ) : <div className="grid h-48 place-items-center rounded-xl bg-slate-50 text-center text-sm text-slate-500 dark:bg-slate-950">At least two valid periods are needed for a trend.</div>}
      </CardContent>
    </Card>
  );
}

