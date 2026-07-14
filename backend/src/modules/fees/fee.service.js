import crypto from 'node:crypto';
import prisma from '../../config/prisma.client.js';
import { allocatePayment, calculateCharge, serializeMoney } from './feeCalculation.service.js';

const adminRoles = new Set(['SCHOOL_OWNER', 'ADMIN']);
const json = (value) => JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? Number(item) : item));
const tenant = (user) => {
  if (!user?.schoolId) throw Object.assign(new Error('A school tenant is required'), { status: 403 });
  return user.schoolId;
};
const audit = (tx, req, action, entityType, entityId, newValue, reason) => tx.feeAuditLog.create({ data: {
  schoolId: tenant(req.user), userId: req.user.id, userRole: req.user.role, action, entityType, entityId,
  newValue: newValue ? json(newValue) : undefined, reason, ipAddress: req.ip, userAgent: req.get?.('user-agent'),
} });

export const getSettings = async (user) => {
  const schoolId = tenant(user);
  const setting = await prisma.feeModuleSetting.findUnique({ where: { schoolId } });
  return setting || { schoolId, enabled: false, mode: 'SIMPLE', currencyCode: 'INR', currencySymbol: '₹', locale: 'en-IN', decimalPrecision: 2, gatewayEnabled: false };
};

export const saveSettings = (req, data) => prisma.$transaction(async (tx) => {
  const schoolId = tenant(req.user);
  const result = await tx.feeModuleSetting.upsert({ where: { schoolId }, create: { schoolId, createdById: req.user.id, ...data }, update: data });
  await audit(tx, req, 'FEE_SETTINGS_UPDATED', 'FeeModuleSetting', result.id, result);
  return result;
});

export const listStructures = (user, academicSession) => prisma.feeStructure.findMany({
  where: { schoolId: tenant(user), ...(academicSession ? { academicSession } : {}) }, include: { components: { orderBy: { displayOrder: 'asc' } }, _count: { select: { assignments: true, charges: true } } }, orderBy: [{ academicSession: 'desc' }, { createdAt: 'desc' }],
});

export const createStructure = (req, data) => prisma.$transaction(async (tx) => {
  const schoolId = tenant(req.user);
  const latest = await tx.feeStructure.findFirst({ where: { schoolId, academicSession: data.academicSession, code: data.code }, orderBy: { version: 'desc' }, select: { version: true } });
  const structure = await tx.feeStructure.create({ data: {
    schoolId, academicSession: data.academicSession, name: data.name, code: data.code, description: data.description, mode: data.mode,
    version: (latest?.version || 0) + 1, createdById: req.user.id, changeReason: data.changeReason,
    components: { create: data.components.map((component) => ({ ...component, schoolId, academicSession: data.academicSession, createdById: req.user.id })) },
  }, include: { components: true } });
  await audit(tx, req, 'FEE_STRUCTURE_CREATED', 'FeeStructure', structure.id, structure, data.changeReason);
  return structure;
});

export const publishStructure = (req, id) => prisma.$transaction(async (tx) => {
  const schoolId = tenant(req.user);
  const existing = await tx.feeStructure.findFirst({ where: { id, schoolId, status: 'DRAFT' }, include: { components: true } });
  if (!existing) throw Object.assign(new Error('Draft fee structure not found'), { status: 404 });
  if (!existing.components.length) throw Object.assign(new Error('At least one fee component is required'), { status: 400 });
  await tx.feeStructure.updateMany({ where: { schoolId, academicSession: existing.academicSession, code: existing.code, status: 'PUBLISHED' }, data: { status: 'ARCHIVED' } });
  const result = await tx.feeStructure.update({ where: { id }, data: { status: 'PUBLISHED', publishedAt: new Date(), approvedById: req.user.id } });
  await audit(tx, req, 'FEE_STRUCTURE_PUBLISHED', 'FeeStructure', id, result);
  return result;
});

export const searchStudents = (user, query = '') => prisma.student.findMany({
  where: { schoolId: tenant(user), isActive: true, ...(query ? { OR: [
    { studentFirstName: { contains: query, mode: 'insensitive' } }, { studentLastName: { contains: query, mode: 'insensitive' } },
    { admissionNo: { contains: query, mode: 'insensitive' } }, { studentUserId: { contains: query, mode: 'insensitive' } },
    { parentMobile: { contains: query } }, { rollNumber: { contains: query, mode: 'insensitive' } },
  ] } : {}) }, select: { id: true, studentFirstName: true, studentLastName: true, admissionNo: true, studentUserId: true, className: true, section: true, rollNumber: true, fatherName: true, parentMobile: true, session: true }, take: 30,
});

export const getStudentFees = async (user, requestedStudentId, academicSession) => {
  const schoolId = tenant(user);
  const studentId = ['STUDENT', 'PARENT'].includes(user.role) ? user.studentId : requestedStudentId;
  if (!studentId) throw Object.assign(new Error('studentId is required'), { status: 400 });
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId, isActive: true }, select: { id: true, studentFirstName: true, studentLastName: true, admissionNo: true, studentUserId: true, className: true, section: true, fatherName: true, parentMobile: true, session: true } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  const session = academicSession || student.session;
  const account = await prisma.studentFeeAccount.findUnique({ where: { schoolId_studentId_academicSession: { schoolId, studentId, academicSession: session } }, include: {
    charges: { orderBy: { dueDate: 'asc' }, include: { feeComponent: { select: { name: true, code: true } } } },
    payments: { orderBy: { paymentDate: 'desc' }, include: { receipt: { select: { id: true, receiptNumber: true, status: true } }, allocations: true } },
    ledgerEntries: { orderBy: { createdAt: 'desc' }, take: 100 },
  } });
  const totals = (account?.charges || []).reduce((sum, charge) => {
    const breakdown = calculateCharge(charge); sum.expected += breakdown.netMinor; sum.paid += BigInt(charge.paidMinor); sum.pending += breakdown.payableMinor; return sum;
  }, { expected: 0n, paid: 0n, pending: 0n });
  return json({ student, account, totals, onlinePayment: { enabled: false, label: 'Coming Soon' } });
};

const receiptNumber = async (tx, schoolId, session) => {
  const setting = await tx.feeModuleSetting.upsert({ where: { schoolId }, create: { schoolId }, update: { nextReceiptSequence: { increment: 1 } } });
  const sequence = setting.nextReceiptSequence;
  const school = await tx.school.findUnique({ where: { id: schoolId }, select: { schoolCode: true } });
  return setting.receiptFormat.replace('{SCHOOL}', school.schoolCode).replace('{SESSION}', session).replace('{SEQ}', String(sequence).padStart(6, '0'));
};

export const collectPayment = (req, data, idempotencyKey) => prisma.$transaction(async (tx) => {
  const schoolId = tenant(req.user);
  const duplicate = await tx.feePayment.findUnique({ where: { schoolId_idempotencyKey: { schoolId, idempotencyKey } }, include: { receipt: true, allocations: true } });
  if (duplicate) return { ...json(duplicate), idempotentReplay: true };
  const student = await tx.student.findFirst({ where: { id: data.studentId, schoolId, isActive: true } });
  if (!student) throw Object.assign(new Error('Student not found'), { status: 404 });
  let account = await tx.studentFeeAccount.findUnique({ where: { schoolId_studentId_academicSession: { schoolId, studentId: student.id, academicSession: data.academicSession } } });
  if (!account) account = await tx.studentFeeAccount.create({ data: { schoolId, studentId: student.id, academicSession: data.academicSession } });
  if (account.lockedAt) throw Object.assign(new Error('This financial period is locked'), { status: 409 });
  const charges = await tx.studentFeeCharge.findMany({ where: { schoolId, studentId: student.id, academicSession: data.academicSession, status: { notIn: ['CANCELLED', 'WAIVED', 'EXEMPTED', 'REFUNDED'] }, ...(data.chargeIds.length ? { id: { in: data.chargeIds } } : {}) } });
  const allocation = allocatePayment(data.amountMinor, charges);
  const paymentNo = `PAY-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  const status = data.method === 'CHEQUE' ? 'PENDING_CLEARANCE' : 'COMPLETED';
  const payment = await tx.feePayment.create({ data: { schoolId, studentId: student.id, feeAccountId: account.id, academicSession: data.academicSession, idempotencyKey, paymentNumber: paymentNo, amountMinor: data.amountMinor, unappliedMinor: allocation.unappliedMinor, method: data.method, status, paymentDate: data.paymentDate, bankName: data.bankName, instrumentNumber: data.instrumentNumber, transactionReference: data.transactionReference, remarks: data.remarks, collectedById: req.user.id, allocations: { create: allocation.allocations.map((item) => ({ ...item, schoolId })) } } });
  if (status === 'COMPLETED') for (const item of allocation.allocations) {
    const charge = charges.find((entry) => entry.id === item.chargeId); const paid = BigInt(charge.paidMinor) + item.amountMinor;
    const payable = calculateCharge({ ...charge, paidMinor: paid }).payableMinor;
    await tx.studentFeeCharge.update({ where: { id: charge.id }, data: { paidMinor: paid, status: payable === 0n ? 'PAID' : 'PARTIALLY_PAID' } });
  }
  if (allocation.unappliedMinor > 0n && status === 'COMPLETED') await tx.studentFeeAccount.update({ where: { id: account.id }, data: { advanceBalanceMinor: { increment: allocation.unappliedMinor } } });
  const latest = await tx.feeLedgerEntry.findFirst({ where: { schoolId, studentId: student.id, feeAccountId: account.id }, orderBy: { createdAt: 'desc' } });
  const balance = BigInt(latest?.balanceMinor || 0) - (status === 'COMPLETED' ? data.amountMinor : 0n);
  await tx.feeLedgerEntry.create({ data: { schoolId, studentId: student.id, feeAccountId: account.id, academicSession: data.academicSession, entryType: 'PAYMENT', referenceType: 'FeePayment', referenceId: payment.id, referenceNumber: paymentNo, description: status === 'COMPLETED' ? `Payment received by ${data.method}` : 'Cheque received; pending clearance', creditMinor: status === 'COMPLETED' ? data.amountMinor : 0n, balanceMinor: balance, createdById: req.user.id } });
  const number = await receiptNumber(tx, schoolId, data.academicSession);
  const verificationCode = crypto.randomBytes(16).toString('hex');
  const receipt = await tx.feeReceipt.create({ data: { schoolId, academicSession: data.academicSession, paymentId: payment.id, receiptNumber: number, verificationCode, snapshot: json({ student: { name: `${student.studentFirstName} ${student.studentLastName || ''}`.trim(), admissionNo: student.admissionNo, className: student.className, section: student.section, parentName: student.fatherName }, payment: { ...payment, amountMinor: serializeMoney(payment.amountMinor) }, allocations: allocation.allocations, status }) } });
  await audit(tx, req, 'FEE_PAYMENT_COLLECTED', 'FeePayment', payment.id, { paymentNo, amountMinor: data.amountMinor, receiptNumber: number });
  return json({ payment, receipt, allocations: allocation.allocations, idempotentReplay: false });
}, { isolationLevel: 'Serializable' });

export const dashboard = async (user, session) => {
  const schoolId = tenant(user); const where = { schoolId, ...(session ? { academicSession: session } : {}) };
  const [charges, payments, recent] = await Promise.all([
    prisma.studentFeeCharge.findMany({ where, select: { baseAmountMinor: true, discountMinor: true, scholarshipMinor: true, lateFeeMinor: true, paidMinor: true, refundedMinor: true, status: true } }),
    prisma.feePayment.groupBy({ by: ['method'], where: { ...where, status: { in: ['COMPLETED', 'CLEARED'] } }, _sum: { amountMinor: true }, _count: true }),
    prisma.feePayment.findMany({ where, orderBy: { paymentDate: 'desc' }, take: 8, include: { student: { select: { studentFirstName: true, studentLastName: true, admissionNo: true } }, receipt: true } }),
  ]);
  const totals = charges.reduce((sum, charge) => { const c = calculateCharge(charge); sum.expected += c.netMinor; sum.collected += BigInt(charge.paidMinor); sum.pending += c.payableMinor; if (charge.status === 'OVERDUE') sum.overdue += c.payableMinor; return sum; }, { expected: 0n, collected: 0n, pending: 0n, overdue: 0n });
  return json({ totals, byMethod: payments, recent });
};

export const requestAdjustment = (req, data) => {
  const schoolId = tenant(req.user);
  return prisma.feeAdjustment.create({ data: { schoolId, studentId: data.studentId, academicSession: data.academicSession, type: data.type, amountMinor: BigInt(data.amountMinor), reason: data.reason, requestedById: req.user.id } });
};

export const listApprovals = (user) => prisma.feeAdjustment.findMany({ where: { schoolId: tenant(user), status: 'PENDING' }, include: { student: { select: { studentFirstName: true, studentLastName: true, admissionNo: true } } }, orderBy: { createdAt: 'asc' } });

export const verifyReceipt = async (code) => {
  const receipt = await prisma.feeReceipt.findUnique({ where: { verificationCode: code }, include: { school: { select: { schoolName: true } }, payment: { select: { amountMinor: true, paymentDate: true, student: { select: { studentFirstName: true, studentLastName: true } } } } } });
  if (!receipt) return null;
  const name = `${receipt.payment.student.studentFirstName} ${receipt.payment.student.studentLastName || ''}`.trim();
  return { schoolName: receipt.school.schoolName, receiptNumber: receipt.receiptNumber, studentName: `${name[0] || ''}${'*'.repeat(Math.max(2, name.length - 1))}`, paymentDate: receipt.payment.paymentDate, amountMinor: Number(receipt.payment.amountMinor), status: receipt.status, valid: receipt.status === 'VALID' };
};
