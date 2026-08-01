const VALID_MODES = new Set(['STRICT', 'PRINCIPAL_APPROVAL', 'AUDIT_WARNING']);

export const validateSeparationPolicy = (policy = {}) => {
  const mode = String(policy.mode || 'STRICT').toUpperCase();
  if (!VALID_MODES.has(mode)) throw new Error('Invalid separation-of-duties mode');
  return { mode, principalApprovalRequired: mode === 'PRINCIPAL_APPROVAL' || Boolean(policy.principalApprovalRequired) };
};

// Call this at the final approval boundary of marks, fees, attendance and payroll.
// Holding another role never bypasses the identity conflict.
export const enforceSeparationOfDuties = ({
  actorUserId,
  makerUserId,
  policy,
  reason,
  principalApprovalId,
}) => {
  if (!makerUserId || makerUserId !== actorUserId) return { allowed: true, exception: false };
  const normalized = validateSeparationPolicy(policy);
  if (normalized.mode === 'STRICT') {
    return { allowed: false, exception: false, code: 'SELF_APPROVAL_BLOCKED', message: 'You cannot approve work you created.' };
  }
  if (!String(reason || '').trim()) {
    return { allowed: false, exception: true, code: 'EXCEPTION_REASON_REQUIRED', message: 'Record a reason to continue.' };
  }
  if (normalized.principalApprovalRequired && !principalApprovalId) {
    return { allowed: false, exception: true, code: 'PRINCIPAL_APPROVAL_REQUIRED', message: 'Principal approval is required.' };
  }
  return { allowed: true, exception: true, warning: 'This action overrides separation of duties and will be audited.' };
};
