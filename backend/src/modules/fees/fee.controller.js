import * as service from './fee.service.js';
import { validatePayment, validateSettings, validateStructure } from './fee.validation.js';
import { createSystemNotification } from '../communication/communication.service.js';

const safe = (value) => JSON.parse(JSON.stringify(value, (_, item) => typeof item === 'bigint' ? Number(item) : item));
const send = (res, data, status = 200) => res.status(status).json({ success: true, data: safe(data) });
const handler = (fn) => async (req, res) => { try { await fn(req, res); } catch (error) { res.status(error.status || 400).json({ success: false, message: error.message }); } };

export const getSettings = handler(async (req, res) => send(res, await service.getSettings(req.user)));
export const saveSettings = handler(async (req, res) => send(res, await service.saveSettings(req, validateSettings(req.body))));
export const structures = handler(async (req, res) => send(res, await service.listStructures(req.user, req.query.academicSession)));
export const structure = handler(async (req, res) => send(res, await service.getStructure(req.user, req.params.id)));
export const createStructure = handler(async (req, res) => send(res, await service.createStructure(req, validateStructure(req.body)), 201));
export const updateStructure = handler(async (req, res) => send(res, await service.updateDraftStructure(req, req.params.id, validateStructure(req.body))));
export const reviseStructure = handler(async (req, res) => send(res, await service.reviseStructure(req, req.params.id, req.body.reason), 201));
export const publishStructure = handler(async (req, res) => send(res, await service.publishStructure(req, req.params.id)));
export const students = handler(async (req, res) => send(res, await service.searchStudents(req.user, String(req.query.q || '').trim())));
export const hierarchy = handler(async (req, res) => send(res, await service.getFeeHierarchy(req.user, req.query.academicSession)));
export const studentFees = handler(async (req, res) => send(res, await service.getStudentFees(req.user, req.params.studentId, req.query.academicSession)));
export const myFees = handler(async (req, res) => {
  // For STUDENT: use token studentId.
  // For PARENT: allow choosing a child via query param; ownership is enforced in service.
  const studentId = req.query.studentId ? String(req.query.studentId) : req.user.studentId;
  return send(res, await service.getStudentFees(req.user, studentId, req.query.academicSession));
});

export const collect = handler(async (req, res) => {
  const key = req.get('idempotency-key'); if (!key || key.length < 8 || key.length > 100) throw new Error('A valid Idempotency-Key header is required');
  const input = validatePayment(req.body); const result = await service.collectPayment(req, input, key);
  if (!result.idempotentReplay && result.payment?.status === 'COMPLETED') await createSystemNotification({ schoolId: req.user.schoolId, type: 'PAYMENT_RECEIVED', category: 'FEE', title: 'Payment received', message: `Payment ${result.payment.paymentNumber} was received successfully${result.receipt?.receiptNumber ? `. Receipt ${result.receipt.receiptNumber} is available.` : '.'}`, actionUrl: '/parent/fees', sourceModule: 'FEES', sourceEntityType: 'FEE_PAYMENT', sourceEntityId: result.payment.id, dedupeKey: `PAYMENT_RECEIVED:${result.payment.id}`, students: [input.studentId], roles: ['STUDENT','PARENT'], mandatory: true });
  send(res, result, 201);
});
export const dashboard = handler(async (req, res) => send(res, await service.dashboard(req.user, req.query.academicSession)));
export const requestAdjustment = handler(async (req, res) => send(res, await service.requestAdjustment(req, req.body), 201));
export const approvals = handler(async (req, res) => send(res, await service.listApprovals(req.user)));
export const verify = handler(async (req, res) => { const result = await service.verifyReceipt(req.params.code); return result ? send(res, result) : res.status(404).json({ success: false, message: 'Invalid receipt' }); });
