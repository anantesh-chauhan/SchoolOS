export const schoolIdOf = (user) => {
  if (!user?.schoolId)
    throw Object.assign(new Error("School tenant required"), { status: 403 });
  return user.schoolId;
};
export const safe = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, item) =>
      typeof item === "bigint" ? Number(item) : item,
    ),
  );
const priority = {
  STUDENT: 100,
  GROUP: 90,
  CATEGORY: 90,
  SECTION: 80,
  CLASS: 70,
  STREAM: 60,
  COURSE: 60,
  BATCH: 60,
  TRANSPORT: 50,
  HOSTEL: 50,
  SCHOOL: 10,
};
export const recordAudit = (tx, req, action, entityType, entityId, details, reason) =>
  tx.feeAuditLog.create({
    data: {
      schoolId: schoolIdOf(req.user),
      userId: req.user.id,
      userRole: req.user.role,
      action,
      entityType,
      entityId,
      newValue: details ? safe(details) : undefined,
      reason,
      ipAddress: req.ip,
      userAgent: req.get?.("user-agent"),
    },
  });
export const ensureUnlocked = async (tx, schoolId, date) => {
  const locked = await tx.feeFinancialPeriod.findFirst({
    where: {
      schoolId,
      lockedAt: { not: null },
      startDate: { lte: date },
      endDate: { gte: date },
    },
  });
  if (locked)
    throw Object.assign(
      new Error(`Financial period ${locked.periodKey} is locked`),
      { status: 409 },
    );
};

export const assignmentMatches = (assignment, student) => {
  if (assignment.targetType === "SCHOOL") return true;
  if (assignment.targetType === "STUDENT")
    return assignment.studentId === student.id;
  if (assignment.targetType === "CLASS")
    return assignment.targetValue === student.className;
  if (assignment.targetType === "SECTION")
    return (
      assignment.targetValue === `${student.className}:${student.section}` ||
      assignment.targetValue === student.section
    );
  if (assignment.targetType === "CATEGORY")
    return assignment.targetValue === student.category;
  if (assignment.targetType === "TRANSPORT")
    return assignment.studentId === student.id;
  return false;
};

export const normalizeAssignmentTarget = async (client, schoolId, data) => {
  if (!priority[data.targetType])
    throw Object.assign(new Error("Unsupported fee assignment target"), { status: 400 });
  if (data.targetType === "SCHOOL") return { ...data, targetValue: null };
  if (data.targetType === "STUDENT") {
    const studentId = data.studentId || data.targetValue;
    const student = await client.student.findFirst({ where: { id: studentId, schoolId, isActive: true } });
    if (!student) throw Object.assign(new Error("Student target not found"), { status: 404 });
    return { ...data, studentId: student.id, targetValue: student.id };
  }
  if (data.targetType === "CLASS") {
    const classRow = await client.class.findFirst({
      where: { schoolId, deletedAt: null, OR: [{ id: data.targetValue }, { className: data.targetValue }] },
    });
    if (!classRow) throw Object.assign(new Error("Class target not found"), { status: 404 });
    return { ...data, targetValue: classRow.className };
  }
  if (data.targetType === "SECTION") {
    const section = await client.section.findFirst({
      where: { schoolId, deletedAt: null, id: data.targetValue }, include: { class: true },
    });
    if (!section) throw Object.assign(new Error("Section target not found"), { status: 404 });
    return { ...data, targetValue: `${section.class.className}:${section.sectionName}` };
  }
  if (!String(data.targetValue || "").trim())
    throw Object.assign(new Error("Assignment target is required"), { status: 400 });
  return data;
};
