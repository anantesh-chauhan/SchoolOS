import React from 'react';
import { getCalendarEventStyle } from '../../lib/calendarEventStyles';

const tones = {
  PRESENT: 'bg-emerald-100 text-emerald-800', ABSENT: 'bg-rose-100 text-rose-800', LATE: 'bg-amber-100 text-amber-800',
  HALF_DAY: 'bg-orange-100 text-orange-800', LEAVE: 'bg-sky-100 text-sky-800', HOLIDAY: 'bg-purple-100 text-purple-800',
  WEEKLY_OFF: 'bg-slate-100 text-slate-500', EXAM: 'bg-indigo-100 text-indigo-800', EVENT: 'bg-pink-100 text-pink-800', VACATION: 'bg-cyan-100 text-cyan-800',
};

export default function AttendanceCalendar({ month, days = [], personalRecords = [], onSelectDay }) {
  const [year, monthNumber] = month.split('-').map(Number);
  const leading = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const records = new Map(personalRecords.map((row) => [row.date, row]));
  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return (
    <div className="overflow-x-auto pb-1">
      <div className="min-w-[700px]">
        <div className="mb-2 grid grid-cols-7 text-center text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day} className="py-2">{day}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {Array.from({ length: leading }).map((_, index) => <div key={`empty-${index}`} className="min-h-28 rounded-2xl bg-[var(--surface-muted)] opacity-60" />)}
        {days.map((day) => {
          const record = records.get(day.date);
          const label = record?.status || day.dayType;
          const eventStyle = getCalendarEventStyle(day.eventType || day.dayType);
          const isToday = day.date === today;
          return (
            <button key={day.date} type="button" onClick={() => onSelectDay?.(day)} className={`group min-h-28 rounded-2xl border border-[var(--border-soft)] bg-[var(--surface-base)] p-2.5 text-left transition-all hover:-translate-y-0.5 hover:bg-[var(--surface-elevated)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--school-primary)] ${eventStyle.cell} ${isToday ? 'ring-2 ring-[var(--school-primary)] ring-offset-2 ring-offset-[var(--background)]' : ''}`}>
              <div className="flex items-start justify-between gap-1"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-black ${isToday ? 'bg-[var(--school-primary)] text-[var(--on-primary)]' : 'text-[var(--text-primary)]'}`}>{Number(day.date.slice(-2))}</span><span className={`max-w-[78px] truncate rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${tones[label] || eventStyle.badge}`}>{label.replace(/_/g, ' ')}</span></div>
              {record ? <p className="mt-3 text-xs text-slate-500">{record.remarks || 'Attendance recorded'}</p> : day.counts ? <div className="mt-3 space-y-0.5 text-[11px]"><p className="font-semibold text-emerald-700">P {day.counts.PRESENT}</p><p className="font-semibold text-rose-700">A {day.counts.ABSENT}</p><p className="text-slate-500">Marked {day.counts.marked}/{day.counts.total}</p></div> : null}
              {day.title && <p className="mt-3 line-clamp-2 text-[11px] font-semibold leading-4 text-slate-700 dark:text-slate-200">{day.title}</p>}
            </button>
          );
        })}
        </div>
      </div>
    </div>
  );
}
