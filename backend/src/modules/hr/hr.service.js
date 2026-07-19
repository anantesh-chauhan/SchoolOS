import prisma from '../../config/prisma.client.js';

export const monthRange = (month) => { if (!/^\d{4}-\d{2}$/.test(String(month || ''))) throw Object.assign(new Error('month must use YYYY-MM'), { statusCode: 400 }); const [year, value] = month.split('-').map(Number); if (value < 1 || value > 12) throw Object.assign(new Error('month is invalid'), { statusCode: 400 }); return { start: new Date(Date.UTC(year, value - 1, 1)), end: new Date(Date.UTC(year, value, 1)), year, month: value }; };
export const dateOnly = (value) => { const d = new Date(value); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); };
export const audit = (tx, user, req, action, entityType, entityId, oldValue, newValue, reason) => tx.hrAuditLog.create({ data: { schoolId: user.schoolId, actorId: user.id, actorRole: user.role, action, entityType, entityId, oldValue: oldValue || undefined, newValue: newValue || undefined, reason: reason || null, ipAddress: req?.ip, userAgent: req?.get?.('user-agent') } });

export const nextEmployeeId = async (tx, schoolId) => {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`hr-employee:${schoolId}`}))`;
  const school = await tx.school.findUnique({ where: { id: schoolId }, select: { schoolCode: true } });
  const prefix = `${String(school?.schoolCode || 'SCH').toUpperCase()}-EMP-`;
  const latest = await tx.employee.findFirst({ where: { schoolId, employeeId: { startsWith: prefix } }, orderBy: { employeeId: 'desc' }, select: { employeeId: true } });
  const sequence = (Number(latest?.employeeId?.slice(prefix.length)) || 0) + 1;
  return `${prefix}${String(sequence).padStart(4, '0')}`;
};

const paid = new Set(['PRESENT','PAID_LEAVE','CASUAL_LEAVE','MEDICAL_LEAVE','EARNED_LEAVE','MATERNITY_LEAVE','PATERNITY_LEAVE','HOLIDAY','WORK_FROM_HOME','OFFICIAL_DUTY','LATE','EARLY_EXIT']);
export const attendanceSummary = async (tx, schoolId, employee, month) => {
  const range = monthRange(month); const from = employee.joiningDate > range.start ? dateOnly(employee.joiningDate) : range.start;
  const [rows, holidays, policy] = await Promise.all([
    tx.employeeAttendance.findMany({ where: { schoolId, employeeId: employee.id, attendanceDate: { gte: range.start, lt: range.end } } }),
    tx.academicCalendarDay.findMany({ where: { schoolId, calendarDate: { gte: range.start, lt: range.end }, dayType: { in: ['HOLIDAY','WEEKLY_OFF','VACATION'] } }, select: { calendarDate: true } }),
    tx.hrLeavePolicy.findUnique({ where: { schoolId } }),
  ]);
  const holidayKeys = new Set(holidays.map((r) => r.calendarDate.toISOString().slice(0,10))); let workingDays = 0;
  for (let day = new Date(from); day < range.end; day.setUTCDate(day.getUTCDate()+1)) if ((policy?.includeWeeklyOff || ![0,6].includes(day.getUTCDay())) && !holidayKeys.has(day.toISOString().slice(0,10))) workingDays += 1;
  const counts = {}; rows.forEach((r) => { counts[r.status] = (counts[r.status] || 0) + 1; });
  let payableDays = rows.reduce((sum, row) => sum + (paid.has(row.status) ? 1 : row.status === 'HALF_DAY' ? .5 : 0), 0);
  const latePenalty = policy?.lateEntriesPerDay ? Math.floor((counts.LATE || 0) / policy.lateEntriesPerDay) : 0; payableDays = Math.max(0, Math.min(workingDays, payableDays - latePenalty));
  const absentDays = Math.max(0, workingDays - payableDays); return { workingDays, payableDays, absentDays, halfDays: counts.HALF_DAY || 0, paidLeaves: ['PAID_LEAVE','CASUAL_LEAVE','MEDICAL_LEAVE','EARNED_LEAVE','MATERNITY_LEAVE','PATERNITY_LEAVE'].reduce((s,k)=>s+(counts[k]||0),0), lateEntries: counts.LATE || 0, earlyExits: counts.EARLY_EXIT || 0, presentDays: ['PRESENT','LATE','EARLY_EXIT','WORK_FROM_HOME','OFFICIAL_DUTY'].reduce((s,k)=>s+(counts[k]||0),0), attendancePercentage: workingDays ? Math.round((payableDays/workingDays)*1000)/10 : 0, counts };
};

export const generatePayroll = async ({ schoolId, month, employeeIds, user, req }) => prisma.$transaction(async (tx) => {
  const range = monthRange(month); const where = { schoolId, deletedAt: null, status: { in: ['ACTIVE','ON_LEAVE'] }, joiningDate: { lt: range.end }, ...(employeeIds?.length ? { id: { in: employeeIds } } : {}) };
  const employees = await tx.employee.findMany({ where, include: { salaryRevisions: { where: { effectiveFrom: { lt: range.end }, OR: [{ effectiveTo: null }, { effectiveTo: { gte: range.start } }] }, orderBy: { effectiveFrom: 'desc' }, take: 1 } } });
  const results = [];
  for (const employee of employees) {
    const existing = await tx.employeePayroll.findUnique({ where: { schoolId_employeeId_payrollMonth: { schoolId, employeeId: employee.id, payrollMonth: range.start } } }); if (existing) { results.push(existing); continue; }
    const salary = employee.salaryRevisions[0]; if (!salary) continue; const summary = await attendanceSummary(tx, schoolId, employee, month); const gross = Number(salary.monthlyGross); const basePay = summary.workingDays ? Math.round((gross * summary.payableDays / summary.workingDays) * 100) / 100 : 0;
    const components = salary.components && typeof salary.components === 'object' ? salary.components : {}; const allowances = components.allowances || []; const deductions = components.deductions || []; const allowanceTotal = allowances.reduce((s,x)=>s+(Number(x.amount)||0),0); const deductionTotal = deductions.reduce((s,x)=>s+(Number(x.amount)||0),0); const netSalary = Math.max(0, basePay + allowanceTotal - deductionTotal);
    const sequence = (await tx.employeePayroll.count({ where: { schoolId, payrollMonth: range.start } })) + 1; const payslipNumber = `PAY-${month.replace('-','')}-${String(sequence).padStart(4,'0')}`;
    const payroll = await tx.employeePayroll.create({ data: { schoolId, employeeId: employee.id, payrollMonth: range.start, workingDays: summary.workingDays, payableDays: summary.payableDays, attendanceSummary: summary, monthlyGross: gross, basePay, allowances, allowanceTotal, deductions, deductionTotal, netSalary, status: 'PROCESSED', lockedAt: new Date(), generatedById: user.id, payslipNumber } });
    await audit(tx, user, req, 'PAYROLL_GENERATED', 'EMPLOYEE_PAYROLL', payroll.id, null, { employeeId: employee.employeeId, month, netSalary }); results.push(payroll);
  }
  return results;
}, { timeout: 30000 });
