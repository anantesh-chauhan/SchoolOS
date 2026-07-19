const enums = {
  category: ['TEACHING','NON_TEACHING','SUPPORT','ADMINISTRATION','TRANSPORT','LIBRARY','LABORATORY','IT','OTHER'],
  employmentType: ['PERMANENT','CONTRACT','GUEST_FACULTY','VISITING_FACULTY','PART_TIME'],
  status: ['ACTIVE','ON_LEAVE','SUSPENDED','RESIGNED','RETIRED'],
  attendance: ['PRESENT','ABSENT','HALF_DAY','PAID_LEAVE','CASUAL_LEAVE','MEDICAL_LEAVE','EARNED_LEAVE','MATERNITY_LEAVE','PATERNITY_LEAVE','HOLIDAY','WORK_FROM_HOME','OFFICIAL_DUTY','LATE','EARLY_EXIT'],
  source: ['MANUAL','BULK','IMPORT','BIOMETRIC','RFID','FACE_RECOGNITION','GPS'],
  leaveType: ['PAID','CASUAL','MEDICAL','EARNED','MATERNITY','PATERNITY','UNPAID','OTHER'],
};

export class HrValidationError extends Error { constructor(message) { super(message); this.statusCode = 400; } }
const clean = (value, name, max = 200, required = true) => { const result = typeof value === 'string' ? value.trim() : ''; if (required && !result) throw new HrValidationError(`${name} is required`); if (result.length > max) throw new HrValidationError(`${name} is too long`); return result || null; };
const date = (value, name, required = true) => { if (!value && !required) return null; const result = new Date(value); if (Number.isNaN(result.getTime())) throw new HrValidationError(`${name} is invalid`); return result; };
const choice = (value, values, name, fallback) => { const result = String(value || fallback || '').toUpperCase(); if (!values.includes(result)) throw new HrValidationError(`${name} is invalid`); return result; };
const money = (value, name) => { const result = Number(value); if (!Number.isFinite(result) || result < 0) throw new HrValidationError(`${name} must be a non-negative number`); return Math.round(result * 100) / 100; };

export const employeeInput = (body, partial = false) => {
  const data = {};
  const set = (key, fn) => { if (!partial || body[key] !== undefined) data[key] = fn(); };
  set('firstName', () => clean(body.firstName, 'firstName', 100));
  set('lastName', () => clean(body.lastName, 'lastName', 100, false));
  set('mobile', () => clean(body.mobile, 'mobile', 30));
  set('email', () => clean(body.email, 'email', 160, false)?.toLowerCase() || null);
  set('department', () => clean(body.department, 'department', 100));
  set('designation', () => clean(body.designation, 'designation', 100));
  set('category', () => choice(body.category, enums.category, 'category', 'OTHER'));
  set('employmentType', () => choice(body.employmentType, enums.employmentType, 'employmentType', 'PERMANENT'));
  set('status', () => choice(body.status, enums.status, 'status', 'ACTIVE'));
  set('joiningDate', () => date(body.joiningDate, 'joiningDate'));
  ['dateOfBirth','exitDate'].forEach((key) => set(key, () => date(body[key], key, false)));
  ['gender','bloodGroup','aadhaarMasked','panMasked','address','bankName','bankAccountMasked','ifsc','profileImageUrl','userId','teacherId'].forEach((key) => set(key, () => clean(body[key], key, key === 'address' ? 1000 : 250, false)));
  ['emergencyContact','qualifications','experience','metadata'].forEach((key) => set(key, () => body[key] || null));
  return data;
};

export const salaryInput = (body) => ({ monthlyGross: money(body.monthlyGross, 'monthlyGross'), basicSalary: money(body.basicSalary ?? body.monthlyGross, 'basicSalary'), components: body.components || null, effectiveFrom: date(body.effectiveFrom || new Date(), 'effectiveFrom'), reason: clean(body.reason, 'reason', 500, false) });
export const attendanceInput = (body) => ({ employeeId: clean(body.employeeId, 'employeeId', 80), attendanceDate: date(body.attendanceDate, 'attendanceDate'), status: choice(body.status, enums.attendance, 'status'), source: choice(body.source, enums.source, 'source', 'MANUAL'), checkIn: date(body.checkIn, 'checkIn', false), checkOut: date(body.checkOut, 'checkOut', false), minutesLate: Math.max(0, Number(body.minutesLate) || 0), minutesEarlyExit: Math.max(0, Number(body.minutesEarlyExit) || 0), remarks: clean(body.remarks, 'remarks', 500, false), sourceReference: clean(body.sourceReference, 'sourceReference', 200, false) });
export const leaveInput = (body) => { const startDate = date(body.startDate, 'startDate'); const endDate = date(body.endDate, 'endDate'); if (endDate < startDate) throw new HrValidationError('endDate must be on or after startDate'); return { employeeId: clean(body.employeeId, 'employeeId', 80), leaveType: choice(body.leaveType, enums.leaveType, 'leaveType'), startDate, endDate, days: money(body.days ?? ((endDate-startDate)/86400000+1), 'days'), reason: clean(body.reason, 'reason', 1000), attachmentUrl: clean(body.attachmentUrl, 'attachmentUrl', 1000, false) }; };
