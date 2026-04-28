import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';

export default function WidgetCard({ title, description, badge, actions, children }) {
  return (
    <Card className="overflow-hidden border-slate-200 bg-white shadow-sm">
      <CardHeader className="flex items-start justify-between gap-4">
        <div>
          <CardTitle className="text-base text-slate-900">{title}</CardTitle>
          {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {actions}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}
