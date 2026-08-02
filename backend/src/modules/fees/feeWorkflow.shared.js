export const tenant = (user) => {
  if (!user?.schoolId)
    throw Object.assign(new Error("A school tenant is required"), {
      status: 403,
    });
  return user.schoolId;
};
export const safe = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, item) =>
      typeof item === "bigint" ? Number(item) : item,
    ),
  );
export const positiveMinor = (value, field = "amountMinor") => {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw Object.assign(
      new Error(`${field} must be a positive integer in minor currency units`),
      { status: 400 },
    );
  return BigInt(value);
};
export const required = (value, field, max = 200) => {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean)
    throw Object.assign(new Error(`${field} is required`), { status: 400 });
  if (clean.length > max)
    throw Object.assign(new Error(`${field} is too long`), { status: 400 });
  return clean;
};
export const pageArgs = (query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  return { page, limit, skip: (page - 1) * limit };
};
export const audit = (tx, req, action, entityType, entityId, newValue, reason) =>
  tx.feeAuditLog.create({
    data: {
      schoolId: tenant(req.user),
      userId: req.user.id,
      userRole: req.user.role,
      action,
      entityType,
      entityId,
      newValue: newValue ? safe(newValue) : undefined,
      reason,
      ipAddress: req.ip,
      userAgent: req.get?.("user-agent"),
    },
  });
