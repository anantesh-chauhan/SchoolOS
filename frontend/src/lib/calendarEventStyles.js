export const CALENDAR_EVENT_TYPES = ['HOLIDAY', 'WORKING_DAY', 'WEEKLY_OFF', 'EXAM', 'EVENT', 'VACATION'];

export const CALENDAR_EVENT_STYLES = {
  HOLIDAY: {
    label: 'Holiday',
    badge: 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300',
    cell: 'border-rose-200 bg-rose-50/70 hover:border-rose-400 dark:border-rose-900/70 dark:bg-rose-950/20',
    dot: 'bg-rose-500',
    accent: 'border-l-rose-500',
  },
  WORKING_DAY: {
    label: 'Working day',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300',
    cell: 'border-slate-200 bg-white hover:border-emerald-400 dark:border-slate-700 dark:bg-slate-900',
    dot: 'bg-emerald-500',
    accent: 'border-l-emerald-500',
  },
  WEEKLY_OFF: {
    label: 'Weekly off',
    badge: 'bg-slate-200 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
    cell: 'border-slate-200 bg-slate-50 hover:border-slate-400 dark:border-slate-800 dark:bg-slate-900/60',
    dot: 'bg-slate-500',
    accent: 'border-l-slate-500',
  },
  EXAM: {
    label: 'Examination',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300',
    cell: 'border-violet-200 bg-violet-50/70 hover:border-violet-400 dark:border-violet-900/70 dark:bg-violet-950/20',
    dot: 'bg-violet-500',
    accent: 'border-l-violet-500',
  },
  EVENT: {
    label: 'School event',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300',
    cell: 'border-blue-200 bg-blue-50/70 hover:border-blue-400 dark:border-blue-900/70 dark:bg-blue-950/20',
    dot: 'bg-blue-500',
    accent: 'border-l-blue-500',
  },
  VACATION: {
    label: 'Vacation',
    badge: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300',
    cell: 'border-amber-200 bg-amber-50/70 hover:border-amber-400 dark:border-amber-900/70 dark:bg-amber-950/20',
    dot: 'bg-amber-500',
    accent: 'border-l-amber-500',
  },
};

export function getCalendarEventStyle(type) {
  return CALENDAR_EVENT_STYLES[type] || CALENDAR_EVENT_STYLES.WORKING_DAY;
}
