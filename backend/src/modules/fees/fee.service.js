import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import {
  allocatePayment,
  calculateCharge,
  serializeMoney,
} from "./feeCalculation.service.js";

const adminRoles = new Set(["SCHOOL_OWNER", "ADMIN"]);
const json = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, item) =>
      typeof item === "bigint" ? Number(item) : item,
    ),
  );
const tenant = (user) => {
  if (!user?.schoolId)
    throw Object.assign(new Error("A school tenant is required"), {
      status: 403,
    });
  return user.schoolId;
};
const audit = (tx, req, action, entityType, entityId, newValue, reason) =>
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

export const getSettings = async (user) => {
  const schoolId = tenant(user);
  const setting = await prisma.feeModuleSetting.findUnique({
    where: { schoolId },
  });
  return (
    setting || {
      schoolId,
      enabled: false,
      mode: "SIMPLE",
      currencyCode: "INR",
      currencySymbol: "₹",
      locale: "en-IN",
      decimalPrecision: 2,
      gatewayEnabled: false,
    }
  );
};

export const saveSettings = (req, data) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const result = await tx.feeModuleSetting.upsert({
      where: { schoolId },
      create: { schoolId, createdById: req.user.id, ...data },
      update: data,
    });
    await audit(
      tx,
      req,
      "FEE_SETTINGS_UPDATED",
      "FeeModuleSetting",
      result.id,
      result,
    );
    return result;
  });

export const listStructures = async (user, academicSession) => {
  const structures = await prisma.feeStructure.findMany({
    where: {
      schoolId: tenant(user),
      ...(academicSession ? { academicSession } : {}),
    },
    include: {
      components: { orderBy: { displayOrder: "asc" } },
      _count: { select: { assignments: true, charges: true } },
    },
    orderBy: [{ academicSession: "desc" }, { createdAt: "desc" }],
  });
  const charges = structures.length ? await prisma.studentFeeCharge.findMany({
    where: {
      schoolId: tenant(user),
      feeStructureId: { in: structures.map((structure) => structure.id) },
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    },
    select: {
      feeStructureId: true, baseAmountMinor: true, discountMinor: true, scholarshipMinor: true,
      waiverMinor: true, lateFeeMinor: true, paidMinor: true, refundedMinor: true,
    },
  }) : [];
  const summaryByStructure = charges.reduce((map, charge) => {
    const calculated = calculateCharge(charge);
    const summary = map.get(charge.feeStructureId) || { expectedMinor: 0n, collectedMinor: 0n, pendingMinor: 0n };
    summary.expectedMinor += calculated.netMinor;
    summary.collectedMinor += BigInt(charge.paidMinor) - BigInt(charge.refundedMinor);
    summary.pendingMinor += calculated.payableMinor;
    map.set(charge.feeStructureId, summary);
    return map;
  }, new Map());
  return json(structures.map((structure) => ({
    ...structure,
    financialSummary: summaryByStructure.get(structure.id) || { expectedMinor: 0n, collectedMinor: 0n, pendingMinor: 0n },
  })));
};

export const getStructure = async (user, id) => {
  const schoolId = tenant(user);
  const structure = await prisma.feeStructure.findFirst({
    where: { id, schoolId },
    include: {
      components: { orderBy: { displayOrder: "asc" } },
      assignments: { where: { active: true }, orderBy: { priority: "desc" } },
      _count: { select: { assignments: true, charges: true } },
    },
  });
  if (!structure) throw Object.assign(new Error("Fee structure not found"), { status: 404 });
  if (structure.status !== "DRAFT" || structure.assignments.length) return structure;
  const source = await prisma.feeStructure.findFirst({
    where: { schoolId, academicSession: structure.academicSession, code: structure.code, version: { lt: structure.version } },
    include: { assignments: { where: { active: true }, orderBy: { priority: "desc" }, take: 1 } },
    orderBy: { version: "desc" },
  });
  return { ...structure, sourceAssignment: source?.assignments[0] || null };
};

export const createStructure = (req, data) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const latest = await tx.feeStructure.findFirst({
      where: {
        schoolId,
        academicSession: data.academicSession,
        code: data.code,
      },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const structure = await tx.feeStructure.create({
      data: {
        schoolId,
        academicSession: data.academicSession,
        name: data.name,
        code: data.code,
        description: data.description,
        mode: data.mode,
        version: (latest?.version || 0) + 1,
        createdById: req.user.id,
        changeReason: data.changeReason,
        components: {
          create: data.components.map((component) => ({
            ...component,
            schoolId,
            academicSession: data.academicSession,
            createdById: req.user.id,
          })),
        },
      },
      include: { components: true },
    });
    await audit(
      tx,
      req,
      "FEE_STRUCTURE_CREATED",
      "FeeStructure",
      structure.id,
      structure,
      data.changeReason,
    );
    return structure;
  });

export const updateDraftStructure = (req, id, data) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const existing = await tx.feeStructure.findFirst({
      where: { id, schoolId, status: "DRAFT" },
      include: { components: true },
    });
    if (!existing) throw Object.assign(new Error("Only a draft fee structure can be edited"), { status: 409 });
    if (existing.academicSession !== data.academicSession || existing.code !== data.code)
      throw Object.assign(new Error("A revision cannot change the academic session or plan code"), { status: 400 });
    await tx.feeComponent.deleteMany({ where: { schoolId, feeStructureId: id } });
    const result = await tx.feeStructure.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        mode: data.mode,
        changeReason: data.changeReason || existing.changeReason,
        components: {
          create: data.components.map((component) => ({
            ...component,
            schoolId,
            academicSession: data.academicSession,
            createdById: req.user.id,
          })),
        },
      },
      include: { components: { orderBy: { displayOrder: "asc" } } },
    });
    await audit(tx, req, "FEE_STRUCTURE_DRAFT_UPDATED", "FeeStructure", id, result, data.changeReason);
    return result;
  });

export const reviseStructure = (req, id, reason) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const source = await tx.feeStructure.findFirst({
      where: { id, schoolId, status: { in: ["PUBLISHED", "ARCHIVED"] } },
      include: { components: { orderBy: { displayOrder: "asc" } }, assignments: { where: { active: true }, orderBy: { priority: "desc" } } },
    });
    if (!source) throw Object.assign(new Error("Published fee structure not found"), { status: 404 });
    const existingDraft = await tx.feeStructure.findFirst({
      where: { schoolId, academicSession: source.academicSession, code: source.code, status: "DRAFT" },
      include: { components: { orderBy: { displayOrder: "asc" } }, assignments: true },
      orderBy: { version: "desc" },
    });
    if (existingDraft) return { ...existingDraft, sourceAssignment: source.assignments[0] || null };
    const latest = await tx.feeStructure.findFirst({
      where: { schoolId, academicSession: source.academicSession, code: source.code },
      orderBy: { version: "desc" }, select: { version: true },
    });
    const draft = await tx.feeStructure.create({
      data: {
        schoolId,
        academicSession: source.academicSession,
        name: source.name,
        code: source.code,
        description: source.description,
        mode: source.mode,
        version: (latest?.version || source.version) + 1,
        status: "DRAFT",
        changeReason: String(reason || "Fee structure revision").trim(),
        createdById: req.user.id,
        components: {
          create: source.components.map(({ name, code, description, amountMinor, frequency, dueDay, gracePeriodDays, lateFeeRule, taxable, refundable, mandatory, displayOrder, active, effectiveFrom, effectiveTo, applicability, categoryId, feeType }) => ({
            schoolId, academicSession: source.academicSession, name, code, description, amountMinor, frequency, dueDay,
            gracePeriodDays, lateFeeRule, taxable, refundable, mandatory, displayOrder, active, effectiveFrom, effectiveTo,
            applicability, categoryId, feeType, createdById: req.user.id,
          })),
        },
      },
      include: { components: { orderBy: { displayOrder: "asc" } } },
    });
    await audit(tx, req, "FEE_STRUCTURE_REVISION_CREATED", "FeeStructure", draft.id, { sourceId: source.id, version: draft.version }, reason);
    return { ...draft, sourceAssignment: source.assignments[0] || null };
  });

export const publishStructure = (req, id) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const existing = await tx.feeStructure.findFirst({
      where: { id, schoolId },
      include: { components: true },
    });
    if (!existing)
      throw Object.assign(new Error("Fee structure not found"), {
        status: 404,
      });
    if (existing.status === "PUBLISHED") return existing;
    if (existing.status !== "DRAFT")
      throw Object.assign(new Error("Only a draft fee structure can be published"), { status: 409 });
    if (!existing.components.length)
      throw Object.assign(new Error("At least one fee component is required"), {
        status: 400,
      });
    const result = await tx.feeStructure.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        approvedById: req.user.id,
      },
    });
    await audit(tx, req, "FEE_STRUCTURE_PUBLISHED", "FeeStructure", id, result);
    return result;
  });

export const searchStudents = (user, query = "") =>
  prisma.student.findMany({
    where: {
      schoolId: tenant(user),
      isActive: true,
      ...(query
        ? {
            OR: [
              { studentFirstName: { contains: query, mode: "insensitive" } },
              { studentLastName: { contains: query, mode: "insensitive" } },
              { admissionNo: { contains: query, mode: "insensitive" } },
              { studentUserId: { contains: query, mode: "insensitive" } },
              { parentMobile: { contains: query } },
              { rollNumber: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      studentFirstName: true,
      studentLastName: true,
      admissionNo: true,
      studentUserId: true,
      className: true,
      section: true,
      rollNumber: true,
      fatherName: true,
      parentMobile: true,
      session: true,
    },
    take: 30,
  });

export const getStudentFees = async (
  user,
  requestedStudentId,
  academicSession,
) => {
  const schoolId = tenant(user);

  let studentId = requestedStudentId;
  if (["STUDENT", "PARENT"].includes(user.role)) {
    // STUDENT: can only view their own fees.
    if (user.role === "STUDENT") {
      studentId = user.studentId;
    }

    // PARENT: can choose a linked child; ownership is enforced below.
    if (user.role === "PARENT") {
      studentId = requestedStudentId;
      if (!studentId)
        throw Object.assign(new Error("studentId is required"), {
          status: 400,
        });
      const familyLink = await prisma.feeFamilyLink.findFirst({
        where: {
          schoolId,
          parentUserId: { in: [user.id, user.email].filter(Boolean) },
          studentId,
          active: true,
        },
        select: { id: true },
      });
      if (!familyLink) {
        throw Object.assign(new Error("Student not found"), { status: 404 });
      }
    }
  }

  if (!studentId)
    throw Object.assign(new Error("studentId is required"), { status: 400 });

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId, isActive: true },
    select: {
      id: true,
      studentFirstName: true,
      studentLastName: true,
      admissionNo: true,
      studentUserId: true,
      className: true,
      section: true,
      fatherName: true,
      parentMobile: true,
      session: true,
    },
  });

  if (!student)
    throw Object.assign(new Error("Student not found"), { status: 404 });
  const session = academicSession || student.session;
  const account = await prisma.studentFeeAccount.findUnique({
    where: {
      schoolId_studentId_academicSession: {
        schoolId,
        studentId,
        academicSession: session,
      },
    },
    include: {
      charges: {
        orderBy: { dueDate: "asc" },
        include: { feeComponent: { select: { name: true, code: true } } },
      },
      payments: {
        orderBy: { paymentDate: "desc" },
        include: {
          receipt: { select: { id: true, receiptNumber: true, status: true } },
          allocations: true,
        },
      },
      ledgerEntries: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  const assignments = await prisma.feeAssignment.findMany({
    where: {
      schoolId,
      academicSession: session,
      active: true,
      feeStructure: { status: "PUBLISHED" },
      OR: [
        { studentId },
        { targetType: "SCHOOL" },
        { targetType: "CLASS", targetValue: student.className },
        {
          targetType: "SECTION",
          targetValue: {
            in: [
              student.section || "",
              `${student.className}:${student.section || ""}`,
            ],
          },
        },
      ],
    },
    include: {
      feeStructure: {
        include: {
          components: {
            where: { active: true },
            orderBy: { displayOrder: "asc" },
          },
        },
      },
    },
    orderBy: { priority: "desc" },
  });
  const [invoices, refunds, transportAssignments] = await Promise.all([
    prisma.feeInvoice.findMany({
      where: { schoolId, studentId, academicSession: session },
      include: { items: true },
      orderBy: { dueDate: "desc" },
      take: 100,
    }),
    prisma.feeRefund.findMany({
      where: { schoolId, studentId, payment: { academicSession: session } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.transportFeeAssignment.findMany({
      where: { schoolId, studentId, academicSession: session },
      include: {
        route: { select: { name: true, code: true, vehicleNumber: true } },
        pickupStop: { select: { name: true } },
        dropStop: { select: { name: true } },
      },
      orderBy: { startDate: "desc" },
    }),
  ]);
  const activeCharges = (account?.charges || []).filter((charge) => !["CANCELLED", "REFUNDED"].includes(charge.status));
  const totals = activeCharges.reduce(
    (sum, charge) => {
      const breakdown = calculateCharge(charge);
      sum.expected += breakdown.netMinor;
      sum.paid += BigInt(charge.paidMinor);
      sum.pending += breakdown.payableMinor;
      return sum;
    },
    { expected: 0n, paid: 0n, pending: 0n },
  );
  return json({
    student,
    account,
    totals,
    invoices,
    refunds,
    transportAssignments,
    assignedStructures: assignments.map((row) => ({ ...row.feeStructure, assignment: { id: row.id, targetType: row.targetType, effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo } })),
    assignedStructure: assignments.find((row) => !row.feeStructure.components.every((component) => component.feeType === "TRANSPORT" || component.code === "TRANSPORT"))?.feeStructure || assignments[0]?.feeStructure || null,
    assignment: assignments[0] || null,
    onlinePayment: { enabled: false, label: "Coming Soon" },
  });
};

export const getFeeHierarchy = async (user, academicSession) => {
  const schoolId = tenant(user);
  const [classes, students] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId, deletedAt: null },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { sectionOrder: "asc" },
        },
      },
      orderBy: { classOrder: "asc" },
    }),
    prisma.student.findMany({
      where: {
        schoolId,
        isActive: true,
        ...(academicSession ? { session: academicSession } : {}),
      },
      include: {
        feeAccounts: {
          where: academicSession ? { academicSession } : undefined,
          include: { charges: true },
          take: 1,
        },
      },
      orderBy: [
        { className: "asc" },
        { section: "asc" },
        { rollNumber: "asc" },
        { studentFirstName: "asc" },
      ],
    }),
  ]);
  const summarize = (student) => {
    const account = student.feeAccounts[0];
    const totals = (account?.charges || []).reduce(
      (sum, charge) => {
        const c = calculateCharge(charge);
        sum.expected += c.netMinor;
        sum.paid += BigInt(charge.paidMinor);
        sum.pending += c.payableMinor;
        if (charge.status === "OVERDUE") sum.overdue += c.payableMinor;
        return sum;
      },
      { expected: 0n, paid: 0n, pending: 0n, overdue: 0n },
    );
    return {
      id: student.id,
      name: `${student.studentFirstName} ${student.studentLastName || ""}`.trim(),
      admissionNo: student.admissionNo,
      studentUserId: student.studentUserId,
      rollNumber: student.rollNumber,
      parentName: student.fatherName,
      parentMobile: student.parentMobile,
      className: student.className,
      section: student.section,
      session: student.session,
      feeStatus:
        totals.expected === 0n
          ? "NOT_ASSIGNED"
          : totals.pending === 0n
            ? "PAID"
            : totals.paid > 0n
              ? "PARTIALLY_PAID"
              : totals.overdue > 0n
                ? "OVERDUE"
                : "PENDING",
      totals,
    };
  };
  const addTotals = (rows) =>
    rows.reduce(
      (sum, row) => ({
        expected: sum.expected + row.totals.expected,
        paid: sum.paid + row.totals.paid,
        pending: sum.pending + row.totals.pending,
        overdue: sum.overdue + row.totals.overdue,
      }),
      { expected: 0n, paid: 0n, pending: 0n, overdue: 0n },
    );
  const hierarchy = classes.map((classRow) => {
    const sections = classRow.sections.map((section) => {
      const sectionStudents = students
        .filter(
          (student) =>
            student.className === classRow.className &&
            student.section === section.sectionName,
        )
        .map(summarize);
      return {
        id: section.id,
        sectionName: section.sectionName,
        students: sectionStudents,
        totals: addTotals(sectionStudents),
      };
    });
    return {
      id: classRow.id,
      className: classRow.className,
      sections,
      totals: addTotals(sections),
    };
  });
  const unplaced = students
    .filter(
      (student) =>
        !classes.some(
          (classRow) =>
            classRow.className === student.className &&
            classRow.sections.some(
              (section) => section.sectionName === student.section,
            ),
        ),
    )
    .map(summarize);
  return json({
    academicSession,
    classes: hierarchy,
    unplaced,
    totals: {
      classes: hierarchy.length,
      sections: hierarchy.reduce(
        (count, row) => count + row.sections.length,
        0,
      ),
      students: students.length,
    },
  });
};

const receiptNumber = async (tx, schoolId, session) => {
  const setting = await tx.feeModuleSetting.upsert({
    where: { schoolId },
    create: { schoolId },
    update: { nextReceiptSequence: { increment: 1 } },
  });
  const sequence = setting.nextReceiptSequence;
  const school = await tx.school.findUnique({
    where: { id: schoolId },
    select: { schoolCode: true },
  });
  return setting.receiptFormat
    .replace("{SCHOOL}", school.schoolCode)
    .replace("{SESSION}", session)
    .replace("{SEQ}", String(sequence).padStart(6, "0"));
};

export const issuePaymentReceipt = async (
  tx,
  { schoolId, payment, student, allocations, status = payment.status },
) => {
  const existing = await tx.feeReceipt.findUnique({
    where: { paymentId: payment.id },
  });
  if (existing) return existing;
  if (!["COMPLETED", "CLEARED"].includes(status))
    throw Object.assign(
      new Error("A receipt can only be finalized for a successful payment"),
      { status: 409 },
    );
  const number = await receiptNumber(tx, schoolId, payment.academicSession);
  return tx.feeReceipt.create({
    data: {
      schoolId,
      academicSession: payment.academicSession,
      paymentId: payment.id,
      receiptNumber: number,
      verificationCode: crypto.randomBytes(16).toString("hex"),
      snapshot: json({
        student: {
          name: `${student.studentFirstName} ${student.studentLastName || ""}`.trim(),
          admissionNo: student.admissionNo,
          className: student.className,
          section: student.section,
          parentName: student.fatherName,
        },
        payment: {
          ...payment,
          amountMinor: serializeMoney(payment.amountMinor),
        },
        allocations,
        status,
      }),
    },
  });
};

export const collectPayment = (req, data, idempotencyKey) =>
  prisma.$transaction(
    async (tx) => {
      const schoolId = tenant(req.user);
      const duplicate = await tx.feePayment.findUnique({
        where: { schoolId_idempotencyKey: { schoolId, idempotencyKey } },
        include: { receipt: true, allocations: true },
      });
      if (duplicate) return { ...json(duplicate), idempotentReplay: true };
      const student = await tx.student.findFirst({
        where: { id: data.studentId, schoolId, isActive: true },
      });
      if (!student)
        throw Object.assign(new Error("Student not found"), { status: 404 });
      let account = await tx.studentFeeAccount.findUnique({
        where: {
          schoolId_studentId_academicSession: {
            schoolId,
            studentId: student.id,
            academicSession: data.academicSession,
          },
        },
      });
      if (!account)
        account = await tx.studentFeeAccount.create({
          data: {
            schoolId,
            studentId: student.id,
            academicSession: data.academicSession,
          },
        });
      if (account.lockedAt)
        throw Object.assign(new Error("This financial period is locked"), {
          status: 409,
        });
      if (data.allocations.length && data.chargeIds.length)
        throw Object.assign(
          new Error(
            "Use either manual allocations or selected charge IDs, not both",
          ),
          { status: 400 },
        );
      const selectedIds = data.allocations.length
        ? data.allocations.map((item) => item.chargeId)
        : data.chargeIds;
      const charges = await tx.studentFeeCharge.findMany({
        where: {
          schoolId,
          studentId: student.id,
          academicSession: data.academicSession,
          status: { notIn: ["CANCELLED", "WAIVED", "EXEMPTED", "REFUNDED"] },
          ...(selectedIds.length ? { id: { in: selectedIds } } : {}),
        },
      });
      let allocation;
      if (data.allocations.length) {
        if (charges.length !== data.allocations.length)
          throw Object.assign(
            new Error("One or more manual allocation charges are invalid"),
            { status: 409 },
          );
        let allocated = 0n;
        for (const item of data.allocations) {
          const charge = charges.find((row) => row.id === item.chargeId);
          if (item.amountMinor > calculateCharge(charge).payableMinor)
            throw Object.assign(
              new Error(
                `Allocation exceeds the outstanding amount for ${charge.installmentName}`,
              ),
              { status: 409 },
            );
          allocated += item.amountMinor;
        }
        if (allocated > data.amountMinor)
          throw Object.assign(
            new Error("Total allocation exceeds the payment amount"),
            { status: 409 },
          );
        allocation = {
          allocations: data.allocations,
          unappliedMinor: data.amountMinor - allocated,
        };
      } else allocation = allocatePayment(data.amountMinor, charges);
      const paymentNo = `PAY-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const status =
        data.method === "CHEQUE" ? "PENDING_CLEARANCE" : "COMPLETED";
      const payment = await tx.feePayment.create({
        data: {
          schoolId,
          studentId: student.id,
          feeAccountId: account.id,
          academicSession: data.academicSession,
          idempotencyKey,
          paymentNumber: paymentNo,
          amountMinor: data.amountMinor,
          unappliedMinor: allocation.unappliedMinor,
          method: data.method,
          status,
          paymentDate: data.paymentDate,
          payerName: data.payerName,
          payerRelation: data.payerRelation,
          bankName: data.bankName,
          instrumentNumber: data.instrumentNumber,
          instrumentDate: data.instrumentDate,
          transactionReference: data.transactionReference,
          remarks: data.remarks,
          collectedById: req.user.id,
          allocations: {
            create: allocation.allocations.map((item) => ({
              ...item,
              schoolId,
            })),
          },
        },
        include: { allocations: true },
      });
      if (status === "COMPLETED")
        for (const item of allocation.allocations) {
          const charge = charges.find((entry) => entry.id === item.chargeId);
          const paid = BigInt(charge.paidMinor) + item.amountMinor;
          const payable = calculateCharge({
            ...charge,
            paidMinor: paid,
          }).payableMinor;
          await tx.studentFeeCharge.update({
            where: { id: charge.id },
            data: {
              paidMinor: paid,
              status: payable === 0n ? "PAID" : "PARTIALLY_PAID",
            },
          });
          await tx.feeInvoiceItem.updateMany({
            where: { schoolId, chargeId: charge.id },
            data: { paidMinor: { increment: item.amountMinor } },
          });
        }
      if (status === "COMPLETED" && allocation.allocations.length) {
        const invoices = await tx.feeInvoice.findMany({
          where: {
            schoolId,
            items: {
              some: {
                chargeId: {
                  in: allocation.allocations.map((item) => item.chargeId),
                },
              },
            },
          },
          include: { items: true },
        });
        for (const invoice of invoices) {
          const paid = invoice.items.reduce(
            (sum, item) => sum + BigInt(item.paidMinor),
            0n,
          );
          const outstanding =
            BigInt(invoice.netPayableMinor) > paid
              ? BigInt(invoice.netPayableMinor) - paid
              : 0n;
          await tx.feeInvoice.update({
            where: { id: invoice.id },
            data: {
              amountPaidMinor: paid,
              outstandingMinor: outstanding,
              status:
                outstanding === 0n
                  ? "PAID"
                  : paid > 0n
                    ? "PARTIALLY_PAID"
                    : invoice.dueDate < new Date()
                      ? "OVERDUE"
                      : "ISSUED",
            },
          });
        }
      }
      if (allocation.unappliedMinor > 0n && status === "COMPLETED")
        await tx.studentFeeAccount.update({
          where: { id: account.id },
          data: {
            advanceBalanceMinor: { increment: allocation.unappliedMinor },
          },
        });
      const latest = await tx.feeLedgerEntry.findFirst({
        where: { schoolId, studentId: student.id, feeAccountId: account.id },
        orderBy: { createdAt: "desc" },
      });
      const balance =
        BigInt(latest?.balanceMinor || 0) -
        (status === "COMPLETED" ? data.amountMinor : 0n);
      await tx.feeLedgerEntry.create({
        data: {
          schoolId,
          studentId: student.id,
          feeAccountId: account.id,
          academicSession: data.academicSession,
          entryType: "PAYMENT",
          referenceType: "FeePayment",
          referenceId: payment.id,
          referenceNumber: paymentNo,
          description:
            status === "COMPLETED"
              ? `Payment received by ${data.method}`
              : "Cheque received; pending clearance",
          creditMinor: status === "COMPLETED" ? data.amountMinor : 0n,
          balanceMinor: balance,
          createdById: req.user.id,
        },
      });
      const receipt =
        status === "COMPLETED"
          ? await issuePaymentReceipt(tx, {
              schoolId,
              payment,
              student,
              allocations: allocation.allocations,
              status,
            })
          : null;
      await audit(tx, req, "FEE_PAYMENT_COLLECTED", "FeePayment", payment.id, {
        paymentNo,
        amountMinor: data.amountMinor,
        receiptNumber: receipt?.receiptNumber,
        status,
      });
      return json({
        payment,
        receipt,
        allocations: allocation.allocations,
        idempotentReplay: false,
      });
    },
    { isolationLevel: "Serializable" },
  );

export const dashboard = async (user, session) => {
  const schoolId = tenant(user);
  const where = { schoolId, ...(session ? { academicSession: session } : {}) };
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);
  const startMonth = new Date(
    startToday.getFullYear(),
    startToday.getMonth(),
    1,
  );
  const [charges, payments, recent, refunds, accounts, today, month] =
    await Promise.all([
      prisma.studentFeeCharge.findMany({
        where,
        select: {
          studentId: true,
          baseAmountMinor: true,
          discountMinor: true,
          scholarshipMinor: true,
          waiverMinor: true,
          lateFeeMinor: true,
          paidMinor: true,
          refundedMinor: true,
          status: true,
        },
      }),
      prisma.feePayment.groupBy({
        by: ["method"],
        where: { ...where, status: { in: ["COMPLETED", "CLEARED"] } },
        _sum: { amountMinor: true },
        _count: true,
      }),
      prisma.feePayment.findMany({
        where,
        orderBy: { paymentDate: "desc" },
        take: 8,
        include: {
          student: {
            select: {
              studentFirstName: true,
              studentLastName: true,
              admissionNo: true,
            },
          },
          receipt: true,
        },
      }),
      prisma.feeRefund.aggregate({
        where: {
          schoolId,
          status: "PROCESSED",
          ...(session ? { payment: { academicSession: session } } : {}),
        },
        _sum: { amountMinor: true },
      }),
      prisma.studentFeeAccount.aggregate({
        where: { schoolId, ...(session ? { academicSession: session } : {}) },
        _sum: { advanceBalanceMinor: true },
      }),
      prisma.feePayment.aggregate({
        where: {
          ...where,
          status: { in: ["COMPLETED", "CLEARED"] },
          paymentDate: { gte: startToday },
        },
        _sum: { amountMinor: true },
        _count: true,
      }),
      prisma.feePayment.aggregate({
        where: {
          ...where,
          status: { in: ["COMPLETED", "CLEARED"] },
          paymentDate: { gte: startMonth },
        },
        _sum: { amountMinor: true },
        _count: true,
      }),
    ]);
  const students = new Map();
  const totals = charges.reduce(
    (sum, charge) => {
      const c = calculateCharge(charge);
      sum.gross += c.grossMinor;
      sum.expected += c.netMinor;
      sum.collected += BigInt(charge.paidMinor) - BigInt(charge.refundedMinor);
      sum.pending += c.payableMinor;
      sum.discounts +=
        BigInt(charge.discountMinor) + BigInt(charge.scholarshipMinor);
      sum.waivers += BigInt(charge.waiverMinor);
      sum.fines += BigInt(charge.lateFeeMinor);
      if (charge.status === "OVERDUE") sum.overdue += c.payableMinor;
      const state = students.get(charge.studentId) || { paid: 0n, due: 0n };
      state.paid += BigInt(charge.paidMinor) - BigInt(charge.refundedMinor);
      state.due += c.payableMinor;
      students.set(charge.studentId, state);
      return sum;
    },
    {
      gross: 0n,
      expected: 0n,
      collected: 0n,
      pending: 0n,
      overdue: 0n,
      discounts: 0n,
      waivers: 0n,
      fines: 0n,
    },
  );
  const studentStates = [...students.values()];
  totals.refunds = BigInt(refunds._sum.amountMinor || 0);
  totals.advance = BigInt(accounts._sum.advanceBalanceMinor || 0);
  totals.collectionPercentage =
    totals.expected > 0n
      ? Number((totals.collected * 10000n) / totals.expected) / 100
      : 0;
  totals.studentsWithDues = studentStates.filter((row) => row.due > 0n).length;
  totals.fullyPaidStudents = studentStates.filter(
    (row) => row.due === 0n && row.paid > 0n,
  ).length;
  totals.partiallyPaidStudents = studentStates.filter(
    (row) => row.due > 0n && row.paid > 0n,
  ).length;
  totals.unpaidStudents = studentStates.filter(
    (row) => row.due > 0n && row.paid === 0n,
  ).length;
  return json({
    totals,
    today: { amountMinor: today._sum.amountMinor || 0, payments: today._count },
    month: { amountMinor: month._sum.amountMinor || 0, payments: month._count },
    byMethod: payments,
    recent,
  });
};

export const requestAdjustment = async (req, data) => {
  const schoolId = tenant(req.user);
  const amountMinor =
    Number.isSafeInteger(data.amountMinor) && data.amountMinor > 0
      ? BigInt(data.amountMinor)
      : null;
  if (!amountMinor)
    throw Object.assign(new Error("amountMinor must be a positive integer"), {
      status: 400,
    });
  if (
    ![
      "DISCOUNT",
      "SCHOLARSHIP",
      "WAIVER",
      "LATE_FEE_WAIVER",
      "CREDIT_NOTE",
      "DEBIT_NOTE",
      "BALANCE_CORRECTION",
      "CARRY_FORWARD",
    ].includes(data.type)
  )
    throw Object.assign(new Error("Unsupported adjustment type"), {
      status: 400,
    });
  if (!String(data.reason || "").trim())
    throw Object.assign(new Error("reason is required"), { status: 400 });
  const student = await prisma.student.findFirst({
    where: { id: data.studentId, schoolId, isActive: true },
    select: { id: true },
  });
  if (!student)
    throw Object.assign(new Error("Student not found"), { status: 404 });
  return prisma.feeAdjustment.create({
    data: {
      schoolId,
      studentId: student.id,
      academicSession: String(data.academicSession || "").trim(),
      type: data.type,
      amountMinor,
      reason: String(data.reason).trim(),
      requestedById: req.user.id,
      metadata: data.chargeId ? { chargeId: data.chargeId } : undefined,
    },
  });
};

export const listApprovals = (user) =>
  prisma.feeAdjustment.findMany({
    where: { schoolId: tenant(user), status: "PENDING" },
    include: {
      student: {
        select: {
          studentFirstName: true,
          studentLastName: true,
          admissionNo: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

export const verifyReceipt = async (code) => {
  const receipt = await prisma.feeReceipt.findUnique({
    where: { verificationCode: code },
    include: {
      school: { select: { schoolName: true } },
      payment: {
        select: {
          amountMinor: true,
          paymentDate: true,
          student: {
            select: { studentFirstName: true, studentLastName: true },
          },
        },
      },
    },
  });
  if (!receipt) return null;
  const name =
    `${receipt.payment.student.studentFirstName} ${receipt.payment.student.studentLastName || ""}`.trim();
  return {
    schoolName: receipt.school.schoolName,
    receiptNumber: receipt.receiptNumber,
    studentName: `${name[0] || ""}${"*".repeat(Math.max(2, name.length - 1))}`,
    paymentDate: receipt.payment.paymentDate,
    amountMinor: Number(receipt.payment.amountMinor),
    status: receipt.status,
    valid: receipt.status === "VALID",
  };
};
