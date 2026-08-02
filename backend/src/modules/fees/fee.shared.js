export const adminRoles = new Set(["SCHOOL_OWNER", "ADMIN"]);
export const json = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, item) =>
      typeof item === "bigint" ? Number(item) : item,
    ),
  );
export const tenant = (user) => {
  if (!user?.schoolId)
    throw Object.assign(new Error("A school tenant is required"), {
      status: 403,
    });
  return user.schoolId;
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
      newValue: newValue ? json(newValue) : undefined,
      reason,
      ipAddress: req.ip,
      userAgent: req.get?.("user-agent"),
    },
  });
