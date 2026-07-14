const text = (value, name, max = 200, required = true) => {
  const clean = typeof value === 'string' ? value.trim() : '';
  if (required && !clean) throw new Error(`${name} is required`);
  if (clean.length > max) throw new Error(`${name} is too long`);
  return clean || undefined;
};
const minor = (value, name = 'amountMinor') => {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${name} must be a positive integer in minor currency units`);
  return BigInt(value);
};

export const validateSettings = (body = {}) => ({
  enabled: body.enabled === true,
  mode: ['SIMPLE', 'COMPONENT_BASED'].includes(body.mode) ? body.mode : 'SIMPLE',
  currencyCode: text(body.currencyCode || 'INR', 'currencyCode', 3),
  currencySymbol: text(body.currencySymbol || '₹', 'currencySymbol', 8),
  locale: text(body.locale || 'en-IN', 'locale', 20),
  decimalPrecision: Number.isInteger(body.decimalPrecision) && body.decimalPrecision >= 0 && body.decimalPrecision <= 4 ? body.decimalPrecision : 2,
  receiptFormat: text(body.receiptFormat || '{SCHOOL}/{SESSION}/FEE/{SEQ}', 'receiptFormat', 100),
  approvalThresholdMinor: BigInt(Number.isSafeInteger(body.approvalThresholdMinor) ? body.approvalThresholdMinor : 50000),
});

export const validateStructure = (body = {}) => ({
  academicSession: text(body.academicSession, 'academicSession', 20), name: text(body.name, 'name'), code: text(body.code, 'code', 40).toUpperCase(),
  description: text(body.description, 'description', 2000, false), mode: ['SIMPLE', 'COMPONENT_BASED'].includes(body.mode) ? body.mode : 'SIMPLE',
  changeReason: text(body.changeReason, 'changeReason', 500, false),
  components: (body.components || []).map((component, index) => ({
    name: text(component.name, `components[${index}].name`), code: text(component.code, `components[${index}].code`, 40).toUpperCase(),
    description: text(component.description, 'description', 1000, false), amountMinor: minor(component.amountMinor),
    frequency: component.frequency || 'ONE_TIME', dueDay: component.dueDay || null, gracePeriodDays: component.gracePeriodDays || 0,
    lateFeeRule: component.lateFeeRule || undefined, refundable: component.refundable === true, mandatory: component.mandatory !== false,
    displayOrder: component.displayOrder ?? index, applicability: component.applicability || undefined,
  })),
});

export const validatePayment = (body = {}) => ({
  studentId: text(body.studentId, 'studentId', 80), academicSession: text(body.academicSession, 'academicSession', 20),
  amountMinor: minor(body.amountMinor), method: text(body.method, 'method', 30), paymentDate: body.paymentDate ? new Date(body.paymentDate) : new Date(),
  chargeIds: Array.isArray(body.chargeIds) ? body.chargeIds.filter((id) => typeof id === 'string') : [],
  bankName: text(body.bankName, 'bankName', 120, false), instrumentNumber: text(body.instrumentNumber, 'instrumentNumber', 120, false),
  transactionReference: text(body.transactionReference, 'transactionReference', 160, false), remarks: text(body.remarks, 'remarks', 1000, false),
});
