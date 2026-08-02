export const STUDENT_STATUS_DEFAULTS = Object.freeze([
  { code: 'PRESENT', displayName: 'Present', shortLabel: 'P', countsAsPresent: true, attendanceWeight: 1, badgeStyle: 'emerald' },
  { code: 'ABSENT', displayName: 'Absent', shortLabel: 'A', countsAsAbsent: true, attendanceWeight: 0, requiresRemark: true, badgeStyle: 'rose' },
  { code: 'LATE', displayName: 'Late', shortLabel: 'LT', countsAsPresent: true, attendanceWeight: 1, badgeStyle: 'amber' },
  { code: 'HALF_DAY', displayName: 'Half day', shortLabel: 'HD', countsAsPresent: true, attendanceWeight: 0.5, badgeStyle: 'orange' },
  { code: 'APPROVED_LEAVE', displayName: 'Approved leave', shortLabel: 'AL', attendanceWeight: 0, requiresApproval: true, badgeStyle: 'sky' },
  { code: 'UNAPPROVED_LEAVE', displayName: 'Unapproved leave', shortLabel: 'UL', countsAsAbsent: true, attendanceWeight: 0, requiresRemark: true, badgeStyle: 'rose' },
  { code: 'MEDICAL_LEAVE', displayName: 'Medical leave', shortLabel: 'ML', attendanceWeight: 0, requiresApproval: true, badgeStyle: 'cyan' },
  { code: 'OFFICIAL_DUTY', displayName: 'Official duty', shortLabel: 'OD', countsAsPresent: true, attendanceWeight: 1, badgeStyle: 'indigo' },
  { code: 'HOLIDAY', displayName: 'Holiday', shortLabel: 'H', excludedFromWork: true, attendanceWeight: 0, badgeStyle: 'violet' },
  { code: 'WEEKLY_OFF', displayName: 'Weekly off', shortLabel: 'WO', excludedFromWork: true, attendanceWeight: 0, badgeStyle: 'slate' },
  { code: 'NOT_MARKED', displayName: 'Not marked', shortLabel: 'NM', attendanceWeight: 0, badgeStyle: 'slate' },
]);

export const EMPLOYEE_STATUS_DEFAULTS = Object.freeze([
  ...STUDENT_STATUS_DEFAULTS.filter((item) => !['APPROVED_LEAVE', 'UNAPPROVED_LEAVE'].includes(item.code)),
  { code: 'PAID_LEAVE', displayName: 'Paid leave', shortLabel: 'PL', attendanceWeight: 0, requiresApproval: true, badgeStyle: 'sky' },
  { code: 'UNPAID_LEAVE', displayName: 'Unpaid leave', shortLabel: 'UL', attendanceWeight: 0, countsAsAbsent: true, affectsSalary: true, badgeStyle: 'rose' },
  { code: 'WORK_FROM_HOME', displayName: 'Work from home', shortLabel: 'WFH', attendanceWeight: 1, countsAsPresent: true, badgeStyle: 'teal' },
  { code: 'TRAINING', displayName: 'Training', shortLabel: 'TR', attendanceWeight: 1, countsAsPresent: true, badgeStyle: 'indigo' },
  { code: 'ON_DUTY', displayName: 'On duty', shortLabel: 'OD', attendanceWeight: 1, countsAsPresent: true, badgeStyle: 'indigo' },
  { code: 'COMPENSATORY_OFF', displayName: 'Compensatory off', shortLabel: 'CO', attendanceWeight: 0, requiresApproval: true, badgeStyle: 'purple' },
  { code: 'EARLY_EXIT', displayName: 'Early exit', shortLabel: 'EE', attendanceWeight: 1, countsAsPresent: true, badgeStyle: 'amber' },
]);

export const DEFAULT_RULES = Object.freeze({
  timezone: 'Asia/Kolkata', weeklyOffDays: [0], correctionWindowHours: 48,
  attendanceOpenTime: '07:30', classTeacherDeadline: '09:30', adminAlertTime: '09:45',
  finalSubmissionTime: '12:00', autoLockTime: '23:59', allowBackdatedAttendance: false,
  maximumBackdatedDays: 7, prohibitFutureAttendance: true, allowDraft: true,
  defaultAttendanceStatus: 'NOT_MARKED', requireAdminOverrideReason: true,
  notifyClassTeacherOnCorrection: true,
  studentMinimumPercentage: 75, employeeMinimumPercentage: 85,
  halfDayWeight: 0.5, lateWeight: 1, approvedLeaveWeight: 0, medicalLeaveWeight: 0,
  consecutiveAbsenceAlertDays: 3, requiresFinalSubmission: true,
});

export const utcDate = (value) => {
  const source = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(source.getTime())) return null;
  return new Date(Date.UTC(source.getUTCFullYear(), source.getUTCMonth(), source.getUTCDate()));
};

export const dateInTimezone = (value = new Date(), timezone = DEFAULT_RULES.timezone) => {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(value);
  const read = (type) => Number(parts.find((part) => part.type === type)?.value);
  return new Date(Date.UTC(read('year'), read('month') - 1, read('day')));
};

export const parseMonth = (value) => {
  const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const monthIndex = Number(match[2]) - 1;
  if (monthIndex < 0 || monthIndex > 11) return null;
  return { start: new Date(Date.UTC(year, monthIndex, 1)), end: new Date(Date.UTC(year, monthIndex + 1, 1)), year, monthIndex };
};

export const percentage = (attendanceUnits, eligibleWorkingDays) => eligibleWorkingDays > 0
  ? Math.round((Number(attendanceUnits) / Number(eligibleWorkingDays)) * 1000) / 10
  : null;

export const statusWeight = (code, rules = DEFAULT_RULES, definitions = []) => {
  const configured = definitions.find((item) => item.code === code);
  if (configured) return Number(configured.attendanceWeight);
  if (code === 'HALF_DAY') return Number(rules.halfDayWeight ?? 0.5);
  if (code === 'LATE') return Number(rules.lateWeight ?? 1);
  if (['APPROVED_LEAVE', 'LEAVE', 'PAID_LEAVE'].includes(code)) return Number(rules.approvedLeaveWeight ?? 0);
  if (code === 'MEDICAL_LEAVE') return Number(rules.medicalLeaveWeight ?? 0);
  return ['PRESENT', 'OFFICIAL_DUTY', 'ON_DUTY', 'WORK_FROM_HOME', 'TRAINING', 'EARLY_EXIT'].includes(code) ? 1 : 0;
};

export const isEnrollmentEligible = (date, enrollment) => {
  const day = utcDate(date);
  const from = utcDate(enrollment?.effectiveFrom || enrollment?.admissionDate);
  const to = utcDate(enrollment?.effectiveTo || enrollment?.exitDate);
  return Boolean(day && (!from || day >= from) && (!to || day <= to));
};

export const buildWorkingDays = ({ start, end, weeklyOffDays = [0], calendarDays = [], overrides = [] }) => {
  const calendar = new Map(calendarDays.map((item) => [utcDate(item.calendarDate).toISOString().slice(0, 10), item]));
  const explicit = new Map(overrides.map((item) => [utcDate(item.calendarDate).toISOString().slice(0, 10), item]));
  const days = [];
  for (let cursor = utcDate(start); cursor && cursor < end; cursor = new Date(cursor.getTime() + 86400000)) {
    const key = cursor.toISOString().slice(0, 10);
    const override = explicit.get(key);
    const event = calendar.get(key);
    const excludedEvent = ['HOLIDAY', 'WEEKLY_OFF', 'VACATION'].includes(event?.dayType);
    const working = override ? override.isWorkingDay : !weeklyOffDays.includes(cursor.getUTCDay()) && !excludedEvent;
    days.push({ date: key, isWorkingDay: Boolean(working), weight: working ? Number(override?.eligibleDayWeight ?? (event?.isFullDay === false ? 0.5 : 1)) : 0, dayType: event?.dayType || (working ? 'WORKING_DAY' : 'WEEKLY_OFF'), title: event?.title || override?.reason || null });
  }
  return days;
};

export const summarizeAttendance = ({ rows = [], workingDays = [], enrollment = {}, rules = DEFAULT_RULES, definitions = [] }) => {
  const counts = {};
  const byDate = new Map(rows.map((row) => [utcDate(row.attendanceDate).toISOString().slice(0, 10), row]));
  let eligibleWorkingDays = 0;
  let attendanceUnits = 0;
  let missingDays = 0;
  for (const day of workingDays) {
    if (!day.isWorkingDay || !isEnrollmentEligible(day.date, enrollment)) continue;
    eligibleWorkingDays += day.weight;
    const row = byDate.get(day.date);
    const status = row?.status || 'NOT_MARKED';
    counts[status] = (counts[status] || 0) + 1;
    if (status === 'NOT_MARKED') missingDays += 1;
    attendanceUnits += row?.attendanceUnits === undefined || row?.attendanceUnits === null
      ? statusWeight(status, rules, definitions)
      : Number(row.attendanceUnits);
  }
  return { counts, eligibleWorkingDays, attendanceUnits, missingDays, percentage: percentage(attendanceUnits, eligibleWorkingDays) };
};

export const attendancePermission = (role, action) => {
  const attendanceAdmin = role === 'ADMIN';
  const ownerOrAdmin = ['SCHOOL_OWNER', 'ADMIN'].includes(role);
  if (action === 'configure') return ownerOrAdmin;
  if (action === 'lock' || action === 'approve') return attendanceAdmin || role === 'HR';
  if (action === 'audit' || action === 'export') return ownerOrAdmin || role === 'HR';
  if (action === 'markEmployee') return attendanceAdmin || role === 'HR';
  if (action === 'markStudent') return attendanceAdmin || ['TEACHER', 'CLASS_TEACHER'].includes(role);
  if (action === 'viewOwn') return ['STUDENT', 'PARENT', 'TEACHER', 'CLASS_TEACHER', 'STAFF', 'HR'].includes(role) || ownerOrAdmin;
  return false;
};

export const ATTENDANCE_SESSION_STATES = Object.freeze([
  'NOT_STARTED', 'DRAFT', 'SUBMITTED', 'LOCKED', 'CORRECTED', 'CANCELLED', 'NOT_APPLICABLE',
]);

const STATE_TRANSITIONS = Object.freeze({
  NOT_STARTED: ['DRAFT', 'SUBMITTED', 'LOCKED', 'NOT_APPLICABLE'],
  DRAFT: ['DRAFT', 'SUBMITTED', 'LOCKED', 'NOT_APPLICABLE'],
  SUBMITTED: ['LOCKED'], LOCKED: ['CORRECTED', 'CANCELLED'],
  CORRECTED: ['CORRECTED', 'CANCELLED'], CANCELLED: [], NOT_APPLICABLE: [],
});

export const canTransitionAttendance = (from, to) => (STATE_TRANSITIONS[from || 'NOT_STARTED'] || []).includes(to);

export const assertAttendanceTransition = (from, to) => {
  if (!canTransitionAttendance(from, to)) throw Object.assign(new Error(`Attendance cannot transition from ${from || 'NOT_STARTED'} to ${to}`), { statusCode: 409 });
  return true;
};

export const ADMIN_OVERRIDE_REASON_CODES = Object.freeze([
  'CLASS_TEACHER_ABSENT', 'CLASS_TEACHER_APPROVED_LEAVE', 'CLASS_TEACHER_UNAVAILABLE',
  'ATTENDANCE_DEADLINE_MISSED', 'CLASS_TEACHER_TECHNICAL_ISSUE', 'CLASS_TEACHER_ASSIGNMENT_VACANT',
  'EMERGENCY_ADMIN_ACTION', 'PHYSICAL_REGISTER_ENTRY', 'OTHER',
]);
