import React from 'react';

const tones = {
  PRESENT: 'bg-emerald-100 text-emerald-800', ABSENT: 'bg-rose-100 text-rose-800', LATE: 'bg-amber-100 text-amber-800',
  HALF_DAY: 'bg-orange-100 text-orange-800', LEAVE: 'bg-sky-100 text-sky-800', HOLIDAY: 'bg-purple-100 text-purple-800',
  WEEKLY_OFF: 'bg-slate-100 text-slate-500', EXAM: 'bg-indigo-100 text-indigo-800', EVENT: 'bg-pink-100 text-pink-800', VACATION: 'bg-cyan-100 text-cyan-800',
};

export default function AttendanceCalendar({ month, days = [], personalRecords = [], onSelectDay }) {
  const [year, monthNumber] = month.split('-').map(Number);
  const leading = new Date(Date.UTC(year, monthNumber - 1, 1)).getUTCDay();
  const records = new Map(personalRecords.map((row) => [row.date, row]));
  return (
    <div>
      <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold uppercase text-slate-500">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <div key={day}>{day}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: leading }).map((_, index) => <div key={`empty-${index}`} />)}
        {days.map((day) => {
          const record = records.get(day.date);
          const label = record?.status || day.dayType;
          return (
            <button key={day.date} type="button" onClick={() => onSelectDay?.(day)} className="min-h-24 rounded-xl border border-slate-200 bg-white p-2 text-left transition hover:border-blue-400 dark:border-slate-700 dark:bg-slate-900">
              <div className="flex items-start justify-between gap-1"><span className="font-bold">{Number(day.date.slice(-2))}</span><span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold ${tones[label] || 'bg-slate-100 text-slate-600'}`}>{label.replace(/_/g, ' ')}</span></div>
              {record ? <p className="mt-3 text-xs text-slate-500">{record.remarks || 'Attendance recorded'}</p> : day.counts ? <div className="mt-3 space-y-0.5 text-[11px]"><p className="font-semibold text-emerald-700">P {day.counts.PRESENT}</p><p className="font-semibold text-rose-700">A {day.counts.ABSENT}</p><p className="text-slate-500">Marked {day.counts.marked}/{day.counts.total}</p></div> : null}
              {day.title && <p className="mt-1 truncate text-[10px] text-slate-500">{day.title}</p>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
