import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import { calculateCharge } from "./feeCalculation.service.js";
import { getStudentFees, issuePaymentReceipt } from "./fee.service.js";
import { createSystemNotification } from "../communication/communication.service.js";
import { annualComponentTotal, buildComponentInstallments } from "./feeSchedule.service.js";
import {
  assertTeacherIsClassTeacherForSection,
  getTeacherForUser,
  requireSchoolAdminOrAssignedTeacherForSection,
} from "../../utils/teacherAuthorization.util.js";

const schoolIdOf = (user) => {
  if (!user?.schoolId)
    throw Object.assign(new Error("School tenant required"), { status: 403 });
  return user.schoolId;
};
const safe = (value) =>
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
const recordAudit = (tx, req, action, entityType, entityId, details, reason) =>
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
const ensureUnlocked = async (tx, schoolId, date) => {
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

const assignmentMatches = (assignment, student) => {
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

const normalizeAssignmentTarget = async (client, schoolId, data) => {
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

export const installmentsForStudent = (component, structure, student) => {
  const rows = buildComponentInstallments(component, { academicSession: structure.academicSession, startMonth: 4 });
  const sessionStart = new Date(Date.UTC(Number(structure.academicSession.slice(0, 4)), 3, 1));
  const admissionDate = student.admissionDate ? new Date(student.admissionDate) : null;
  if (component.applicability?.newAdmissionsOnly && (!admissionDate || admissionDate < sessionStart)) return [];
  if (!component.applicability?.fromAdmissionMonth || !admissionDate) return rows;
  const admissionMonth = new Date(Date.UTC(admissionDate.getUTCFullYear(), admissionDate.getUTCMonth(), 1));
  return rows.filter((row) => row.dueDate >= admissionMonth);
};

const expectedForStudent = (components, structure, student) => components.reduce(
  (total, component) => total + installmentsForStudent(component, structure, student).reduce((sum, row) => sum + row.amountMinor, 0n), 0n,
);

export const previewAssignment = async (user, data) => {
  const schoolId = schoolIdOf(user);
  const normalized = await normalizeAssignmentTarget(prisma, schoolId, data);
  const structure = await prisma.feeStructure.findFirst({
    where: { id: data.feeStructureId, schoolId },
    include: { components: true },
  });
  if (!structure)
    throw Object.assign(new Error("Fee structure not found"), { status: 404 });
  const students = await prisma.student.findMany({
    where: { schoolId, isActive: true, session: structure.academicSession },
  });
  const affected = students.filter((student) =>
    assignmentMatches(
      { ...normalized, priority: priority[normalized.targetType] },
      student,
    ),
  );
  const activeComponents = structure.components.filter((c) => c.active);
  const perStudent = activeComponents.reduce(
    (sum, component) => sum + annualComponentTotal(component, { academicSession: structure.academicSession }), 0n,
  );
  const classImpact = Object.values(
    affected.reduce((map, student) => {
      const key = `${student.className}${student.section ? ` / ${student.section}` : ""}`;
      map[key] ||= { classSection: key, students: 0, expectedMinor: 0n };
      map[key].students += 1;
      map[key].expectedMinor += expectedForStudent(activeComponents, structure, student);
      return map;
    }, {}),
  );
  const existing = await prisma.feeAssignment.findMany({
    where: {
      schoolId,
      academicSession: structure.academicSession,
      active: true,
    },
    include: { feeStructure: { select: { name: true } } },
  });
  const conflicts = affected.flatMap((student) =>
    existing
      .filter(
        (a) =>
          assignmentMatches(a, student) &&
          (a.priority || priority[a.targetType]) >= priority[normalized.targetType],
      )
      .map((a) => ({
        studentId: student.id,
        admissionNo: student.admissionNo,
        existingStructure: a.feeStructure.name,
        existingPriority: a.priority,
      })),
  );
  return safe({
    affectedStudents: affected.length,
    projectedRevenueMinor: affected.reduce((total, student) => total + expectedForStudent(activeComponents, structure, student), 0n),
    perStudentMinor: perStudent,
    classImpact,
    conflicts,
    students: affected.map((s) => ({
      id: s.id,
      name: `${s.studentFirstName} ${s.studentLastName || ""}`.trim(),
      admissionNo: s.admissionNo,
      className: s.className,
      section: s.section,
    })),
  });
};

export const createAssignmentAndCharges = (req, data) =>
  prisma.$transaction(
    async (tx) => {
      const schoolId = schoolIdOf(req.user);
      const normalized = await normalizeAssignmentTarget(tx, schoolId, data);
      const structure = await tx.feeStructure.findFirst({
        where: { id: data.feeStructureId, schoolId, status: "PUBLISHED" },
        include: { components: { where: { active: true } } },
      });
      if (!structure)
        throw Object.assign(new Error("Published fee structure not found"), {
          status: 404,
        });
      const assignment = await tx.feeAssignment.findFirst({
        where: {
          schoolId,
          academicSession: structure.academicSession,
          feeStructureId: structure.id,
          targetType: normalized.targetType,
          targetValue: normalized.targetValue,
          studentId: normalized.targetType === "STUDENT" ? normalized.studentId : null,
          active: true,
        },
      }) || await tx.feeAssignment.create({ data: {
          schoolId,
          academicSession: structure.academicSession,
          feeStructureId: structure.id,
          studentId: normalized.targetType === "STUDENT" ? normalized.studentId : null,
          targetType: normalized.targetType,
          targetValue: normalized.targetValue,
          priority: priority[normalized.targetType],
          createdById: req.user.id,
        } });
      const students = (
        await tx.student.findMany({
          where: {
            schoolId,
            isActive: true,
            session: structure.academicSession,
          },
        })
      ).filter((student) => assignmentMatches(assignment, student));
      const higherPriorityAssignments = await tx.feeAssignment.findMany({
        where: {
          schoolId,
          academicSession: structure.academicSession,
          active: true,
          priority: { gt: assignment.priority },
        },
        include: { feeStructure: { include: { components: { select: { feeType: true, code: true } } } } },
      });
      const academicOverrides = higherPriorityAssignments.filter((candidate) =>
        !candidate.feeStructure.components.length || candidate.feeStructure.components.some((component) => component.feeType !== "TRANSPORT" && component.code !== "TRANSPORT"),
      );
      const previousStructures = await tx.feeStructure.findMany({
        where: {
          schoolId,
          academicSession: structure.academicSession,
          code: structure.code,
          version: { lt: structure.version },
        },
        select: { id: true },
      });
      const previousStructureIds = previousStructures.map((row) => row.id);
      const previousCharges = previousStructureIds.length && students.length ? await tx.studentFeeCharge.findMany({
        where: { schoolId, studentId: { in: students.map((student) => student.id) }, feeStructureId: { in: previousStructureIds } },
        include: { feeComponent: { select: { code: true } } },
        orderBy: [{ studentId: "asc" }, { dueDate: "asc" }],
      }) : [];
      const protectedPriorCharges = new Set(previousCharges.filter((charge) => BigInt(charge.paidMinor) > 0n).map((charge) =>
        `${charge.studentId}:${charge.feeComponent?.code || ""}:${charge.dueDate.getUTCMonth() + 1}`,
      ));
      // Allocation used to perform three or four remote queries per installment.
      // A normal class plan could therefore exceed Prisma's interactive transaction
      // lifetime and leave a published structure without an assignment. Build the
      // complete allocation in memory and persist it in bounded bulk operations.
      const eligibleStudents = students.filter((student) =>
        !academicOverrides.some((candidate) => assignmentMatches(candidate, student)),
      );
      const eligibleStudentIds = eligibleStudents.map((student) => student.id);

      if (eligibleStudents.length) {
        await tx.studentFeeAccount.createMany({
          data: eligibleStudents.map((student) => ({
            schoolId,
            studentId: student.id,
            academicSession: structure.academicSession,
          })),
          skipDuplicates: true,
        });
      }
      const accounts = eligibleStudents.length ? await tx.studentFeeAccount.findMany({
        where: {
          schoolId,
          academicSession: structure.academicSession,
          studentId: { in: eligibleStudentIds },
        },
        select: { id: true, studentId: true },
      }) : [];
      const accountByStudent = new Map(accounts.map((account) => [account.studentId, account]));

      const cancellable = previousCharges.filter((charge) =>
        accountByStudent.has(charge.studentId) &&
        BigInt(charge.paidMinor) === 0n &&
        !["CANCELLED", "WAIVED", "REFUNDED"].includes(charge.status),
      );
      if (cancellable.length) {
        await tx.studentFeeCharge.updateMany({
          where: { id: { in: cancellable.map((charge) => charge.id) } },
          data: { status: "CANCELLED" },
        });
      }

      const chargeRows = [];
      for (const student of eligibleStudents) {
        const account = accountByStudent.get(student.id);
        for (const component of structure.components) {
          for (const installment of installmentsForStudent(component, structure, student)) {
            const priorKey = `${student.id}:${component.code}:${installment.month}`;
            if (protectedPriorCharges.has(priorKey)) continue;
            chargeRows.push({
              schoolId,
              studentId: student.id,
              feeAccountId: account.id,
              feeStructureId: structure.id,
              feeComponentId: component.id,
              academicSession: structure.academicSession,
              installmentName: installment.installmentName,
              dueDate: installment.dueDate,
              baseAmountMinor: installment.amountMinor,
              status: installment.dueDate < new Date() ? "OVERDUE" : "UPCOMING",
              calculationSnapshot: {
                componentCode: component.code,
                structureVersion: structure.version,
                scheduleMonth: installment.month,
              },
            });
          }
        }
      }
      const createdResult = chargeRows.length ? await tx.studentFeeCharge.createMany({
        data: chargeRows,
        skipDuplicates: true,
      }) : { count: 0 };
      const created = createdResult.count;

      const allocatedCharges = eligibleStudents.length ? await tx.studentFeeCharge.findMany({
        where: {
          schoolId,
          feeStructureId: structure.id,
          studentId: { in: eligibleStudentIds },
        },
        select: {
          id: true,
          studentId: true,
          feeAccountId: true,
          installmentName: true,
          baseAmountMinor: true,
          dueDate: true,
          feeComponent: { select: { code: true } },
        },
        orderBy: [{ studentId: "asc" }, { dueDate: "asc" }, { id: "asc" }],
      }) : [];
      const referenceIds = [
        ...cancellable.map((charge) => charge.id),
        ...allocatedCharges.map((charge) => charge.id),
      ];
      const existingLedgerReferences = referenceIds.length ? await tx.feeLedgerEntry.findMany({
        where: {
          schoolId,
          referenceId: { in: referenceIds },
          entryType: { in: ["CHARGE", "CREDIT_NOTE"] },
        },
        select: { referenceType: true, referenceId: true },
      }) : [];
      const ledgerKey = (referenceType, referenceId) => `${referenceType}:${referenceId}`;
      const existingLedgerKeys = new Set(existingLedgerReferences.map((entry) => ledgerKey(entry.referenceType, entry.referenceId)));
      const balanceRows = accounts.length ? await tx.feeLedgerEntry.groupBy({
        by: ["feeAccountId"],
        where: { feeAccountId: { in: accounts.map((account) => account.id) } },
        _sum: { debitMinor: true, creditMinor: true },
      }) : [];
      const runningBalance = new Map(accounts.map((account) => [account.id, 0n]));
      for (const row of balanceRows) {
        runningBalance.set(
          row.feeAccountId,
          BigInt(row._sum.debitMinor || 0) - BigInt(row._sum.creditMinor || 0),
        );
      }
      const ledgerRows = [];
      for (const oldCharge of cancellable) {
        const creditMinor = calculateCharge(oldCharge).payableMinor;
        const account = accountByStudent.get(oldCharge.studentId);
        const key = ledgerKey("FeeRevisionCancellation", oldCharge.id);
        if (!account || creditMinor <= 0n || existingLedgerKeys.has(key)) continue;
        const balanceMinor = (runningBalance.get(account.id) || 0n) - creditMinor;
        runningBalance.set(account.id, balanceMinor);
        ledgerRows.push({
          schoolId,
          studentId: oldCharge.studentId,
          feeAccountId: account.id,
          academicSession: structure.academicSession,
          entryType: "CREDIT_NOTE",
          referenceType: "FeeRevisionCancellation",
          referenceId: oldCharge.id,
          referenceNumber: structure.code,
          description: `Revision cancelled: ${oldCharge.installmentName}`,
          creditMinor,
          balanceMinor,
          createdById: req.user.id,
        });
      }
      for (const charge of allocatedCharges) {
        const key = ledgerKey("StudentFeeCharge", charge.id);
        if (existingLedgerKeys.has(key)) continue;
        const balanceMinor = (runningBalance.get(charge.feeAccountId) || 0n) + BigInt(charge.baseAmountMinor);
        runningBalance.set(charge.feeAccountId, balanceMinor);
        ledgerRows.push({
          schoolId,
          studentId: charge.studentId,
          feeAccountId: charge.feeAccountId,
          academicSession: structure.academicSession,
          entryType: "CHARGE",
          referenceType: "StudentFeeCharge",
          referenceId: charge.id,
          referenceNumber: charge.feeComponent?.code,
          description: charge.installmentName,
          debitMinor: charge.baseAmountMinor,
          balanceMinor,
          createdById: req.user.id,
        });
      }
      if (ledgerRows.length) {
        await tx.feeLedgerEntry.createMany({ data: ledgerRows, skipDuplicates: true });
      }
      await recordAudit(
        tx,
        req,
        "FEE_ASSIGNMENT_PUBLISHED",
        "FeeAssignment",
        assignment.id,
        { affectedStudents: students.length, chargesCreated: created },
      );
      if (previousStructureIds.length) {
        await tx.feeStructure.updateMany({
          where: { id: { in: previousStructureIds }, schoolId, status: "PUBLISHED" },
          data: { status: "ARCHIVED" },
        });
        await tx.feeAssignment.updateMany({
          where: {
            schoolId,
            academicSession: structure.academicSession,
            feeStructureId: { in: previousStructureIds },
            targetType: assignment.targetType,
            targetValue: assignment.targetValue,
            active: true,
          },
          data: { active: false, effectiveTo: new Date() },
        });
      }
      return {
        assignment,
        affectedStudents: students.length,
        chargesCreated: created,
      };
    },
    { isolationLevel: "Serializable", maxWait: 10000, timeout: 120000 },
  );

export const syncNewStudentFeeAssignments = async (req, student) => {
  const schoolId = schoolIdOf(req.user);
  if (!student || student.schoolId !== schoolId) throw Object.assign(new Error("Student tenant mismatch"), { status: 403 });
  const assignments = await prisma.feeAssignment.findMany({
    where: {
      schoolId,
      academicSession: student.session,
      active: true,
      feeStructure: { status: "PUBLISHED" },
    },
    orderBy: { priority: "desc" },
  });
  const applicable = assignments.filter((assignment) => assignmentMatches(assignment, student));
  if (!applicable.length) return { assignments: 0, chargesCreated: 0 };
  const highestPriority = applicable[0].priority;
  const selected = applicable.filter((assignment) => assignment.priority === highestPriority);
  let chargesCreated = 0;
  for (const assignment of selected) {
    const result = await createAssignmentAndCharges(req, {
      feeStructureId: assignment.feeStructureId,
      targetType: assignment.targetType,
      targetValue: assignment.targetValue,
      studentId: assignment.studentId,
    });
    chargesCreated += result.chargesCreated;
  }
  return { assignments: selected.length, chargesCreated };
};

export const changeChequeStatus = (req, paymentId, nextStatus, reason) =>
  prisma.$transaction(async (tx) => {
    const schoolId = schoolIdOf(req.user);
    const payment = await tx.feePayment.findFirst({
      where: { id: paymentId, schoolId, method: "CHEQUE" },
      include: {
        allocations: true,
        receipt: true,
        feeAccount: true,
        student: true,
      },
    });
    if (!payment)
      throw Object.assign(new Error("Cheque payment not found"), {
        status: 404,
      });
    await ensureUnlocked(tx, schoolId, new Date());
    const allowed = {
      PENDING_CLEARANCE: ["CLEARED", "BOUNCED", "CANCELLED"],
      CLEARED: ["BOUNCED"],
      BOUNCED: ["PENDING_CLEARANCE"],
    };
    if (!allowed[payment.status]?.includes(nextStatus))
      throw Object.assign(
        new Error(
          `Cannot change cheque from ${payment.status} to ${nextStatus}`,
        ),
        { status: 409 },
      );
    await tx.feePayment.update({
      where: { id: payment.id },
      data: {
        status: nextStatus,
        metadata: {
          ...(payment.metadata || {}),
          statusReason: reason,
          statusChangedAt: new Date().toISOString(),
        },
      },
    });
    if (nextStatus === "CLEARED")
      for (const a of payment.allocations) {
        const charge = await tx.studentFeeCharge.findFirst({
          where: { id: a.chargeId, schoolId, studentId: payment.studentId },
        });
        if (!charge)
          throw Object.assign(new Error("Cheque allocation is invalid"), {
            status: 409,
          });
        const paid = BigInt(charge.paidMinor) + BigInt(a.amountMinor);
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
          data: { paidMinor: { increment: a.amountMinor } },
        });
      }
    if (nextStatus === "CLEARED" && payment.unappliedMinor > 0n)
      await tx.studentFeeAccount.update({
        where: { id: payment.feeAccountId },
        data: { advanceBalanceMinor: { increment: payment.unappliedMinor } },
      });
    if (nextStatus === "BOUNCED" && payment.status === "CLEARED")
      for (const a of payment.allocations) {
        const charge = await tx.studentFeeCharge.findFirst({
          where: { id: a.chargeId, schoolId, studentId: payment.studentId },
        });
        if (!charge)
          throw Object.assign(new Error("Cheque allocation is invalid"), {
            status: 409,
          });
        const paid =
          BigInt(charge.paidMinor) >= BigInt(a.amountMinor)
            ? BigInt(charge.paidMinor) - BigInt(a.amountMinor)
            : 0n;
        await tx.studentFeeCharge.update({
          where: { id: charge.id },
          data: {
            paidMinor: paid,
            status:
              paid > 0n
                ? "PARTIALLY_PAID"
                : charge.dueDate < new Date()
                  ? "OVERDUE"
                  : "DUE",
          },
        });
        await tx.feeInvoiceItem.updateMany({
          where: { schoolId, chargeId: charge.id },
          data: { paidMinor: { decrement: a.amountMinor } },
        });
      }
    if (
      nextStatus === "BOUNCED" &&
      payment.status === "CLEARED" &&
      payment.unappliedMinor > 0n
    )
      await tx.studentFeeAccount.update({
        where: { id: payment.feeAccountId },
        data: { advanceBalanceMinor: { decrement: payment.unappliedMinor } },
      });
    if (nextStatus === "BOUNCED" && payment.receipt)
      await tx.feeReceipt.update({
        where: { id: payment.receipt.id },
        data: { status: "CANCELLED" },
      });
    let receipt = payment.receipt;
    if (nextStatus === "CLEARED")
      receipt = await issuePaymentReceipt(tx, {
        schoolId,
        payment: { ...payment, status: "CLEARED" },
        student: payment.student,
        allocations: payment.allocations,
        status: "CLEARED",
      });
    if (
      ["CLEARED", "BOUNCED"].includes(nextStatus) &&
      payment.allocations.length
    ) {
      const invoices = await tx.feeInvoice.findMany({
        where: {
          schoolId,
          items: {
            some: {
              chargeId: { in: payment.allocations.map((a) => a.chargeId) },
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
    const last = await tx.feeLedgerEntry.findFirst({
      where: { feeAccountId: payment.feeAccountId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const creditMinor = nextStatus === "CLEARED" ? BigInt(payment.amountMinor) : 0n;
    const debitMinor = nextStatus === "BOUNCED" && payment.status === "CLEARED" ? BigInt(payment.amountMinor) : 0n;
    await tx.feeLedgerEntry.create({
      data: {
        schoolId,
        studentId: payment.studentId,
        feeAccountId: payment.feeAccountId,
        academicSession: payment.academicSession,
        entryType: nextStatus === "CLEARED" ? "PAYMENT" : "REVERSAL",
        referenceType: "ChequeStatus",
        referenceId: `${payment.id}:${nextStatus}`,
        referenceNumber: payment.paymentNumber,
        description: `Cheque ${nextStatus.toLowerCase().replace("_", " ")}: ${reason}`,
        debitMinor,
        creditMinor,
        balanceMinor: BigInt(last?.balanceMinor || 0) + debitMinor - creditMinor,
        createdById: req.user.id,
      },
    });
    await recordAudit(
      tx,
      req,
      `CHEQUE_${nextStatus}`,
      "FeePayment",
      payment.id,
      {
        previousStatus: payment.status,
        nextStatus,
        receiptNumber: receipt?.receiptNumber,
      },
      reason,
    );
    return { paymentId, status: nextStatus, receipt };
  });

export const reviewAdjustment = (req, id, decision, comment) =>
  prisma.$transaction(async (tx) => {
    const schoolId = schoolIdOf(req.user);
    const adjustment = await tx.feeAdjustment.findFirst({
      where: { id, schoolId, status: "PENDING" },
    });
    if (!adjustment)
      throw Object.assign(new Error("Pending adjustment not found"), {
        status: 404,
      });
    if (adjustment.requestedById === req.user.id)
      throw Object.assign(new Error("You cannot approve your own request"), {
        status: 409,
      });
    const status = decision === "APPROVE" ? "APPROVED" : "REJECTED";
    const result = await tx.feeAdjustment.update({
      where: { id },
      data: {
        status,
        approvedById: req.user.id,
        approvedAt: new Date(),
        metadata: { ...(adjustment.metadata || {}), reviewComment: comment },
      },
    });
    await recordAudit(
      tx,
      req,
      `FEE_ADJUSTMENT_${status}`,
      "FeeAdjustment",
      id,
      { amountMinor: adjustment.amountMinor },
      comment,
    );
    return result;
  });

export const processAdjustment = (req, id) =>
  prisma.$transaction(async (tx) => {
    const schoolId = schoolIdOf(req.user);
    const adjustment = await tx.feeAdjustment.findFirst({
      where: { id, schoolId, status: "APPROVED" },
    });
    if (!adjustment)
      throw Object.assign(new Error("Approved adjustment not found"), {
        status: 404,
      });
    const account = await tx.studentFeeAccount.findUnique({
      where: {
        schoolId_studentId_academicSession: {
          schoolId,
          studentId: adjustment.studentId,
          academicSession: adjustment.academicSession,
        },
      },
    });
    if (!account) throw new Error("Student fee account not found");
    await ensureUnlocked(tx, schoolId, new Date());
    if (adjustment.type === "REFUND")
      throw Object.assign(
        new Error(
          "Refund adjustments are obsolete; process a refund against the original payment",
        ),
        { status: 409 },
      );
    const last = await tx.feeLedgerEntry.findFirst({
      where: { feeAccountId: account.id },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    const creditTypes = new Set([
      "DISCOUNT",
      "SCHOLARSHIP",
      "WAIVER",
      "LATE_FEE_WAIVER",
      "CREDIT_NOTE",
      "BALANCE_CORRECTION",
    ]);
    if (
      ["DISCOUNT", "SCHOLARSHIP", "WAIVER", "LATE_FEE_WAIVER"].includes(
        adjustment.type,
      )
    ) {
      const charges = await tx.studentFeeCharge.findMany({
        where: {
          schoolId,
          studentId: adjustment.studentId,
          academicSession: adjustment.academicSession,
          status: { notIn: ["CANCELLED", "WAIVED", "EXEMPTED", "REFUNDED"] },
          ...(adjustment.metadata?.chargeId
            ? { id: adjustment.metadata.chargeId }
            : {}),
        },
        orderBy: { dueDate: "asc" },
      });
      let remaining = BigInt(adjustment.amountMinor);
      const touched = [];
      for (const charge of charges) {
        if (remaining === 0n) break;
        let capacity;
        let data;
        if (adjustment.type === "LATE_FEE_WAIVER") {
          capacity = BigInt(charge.lateFeeMinor);
          const applied = capacity < remaining ? capacity : remaining;
          if (!applied) continue;
          data = { lateFeeMinor: capacity - applied };
          remaining -= applied;
        } else {
          const reductions =
            BigInt(charge.discountMinor) +
            BigInt(charge.scholarshipMinor) +
            BigInt(charge.waiverMinor);
          capacity =
            BigInt(charge.baseAmountMinor) > reductions
              ? BigInt(charge.baseAmountMinor) - reductions
              : 0n;
          const applied = capacity < remaining ? capacity : remaining;
          if (!applied) continue;
          const field =
            adjustment.type === "DISCOUNT"
              ? "discountMinor"
              : adjustment.type === "SCHOLARSHIP"
                ? "scholarshipMinor"
                : "waiverMinor";
          data = { [field]: { increment: applied } };
          remaining -= applied;
        }
        const updated = await tx.studentFeeCharge.update({
          where: { id: charge.id },
          data,
        });
        const net = calculateCharge(updated).netMinor;
        await tx.feeInvoiceItem.updateMany({
          where: { schoolId, chargeId: charge.id },
          data: {
            discountMinor:
              BigInt(updated.discountMinor) + BigInt(updated.scholarshipMinor),
            waiverMinor: updated.waiverMinor,
            fineMinor: updated.lateFeeMinor,
            finalAmountMinor: net,
          },
        });
        touched.push(charge.id);
      }
      if (remaining > 0n)
        throw Object.assign(
          new Error("Adjustment exceeds the eligible outstanding fee"),
          { status: 409 },
        );
      const invoices = await tx.feeInvoice.findMany({
        where: { schoolId, items: { some: { chargeId: { in: touched } } } },
        include: { items: true },
      });
      for (const invoice of invoices) {
        const gross = invoice.items.reduce(
          (sum, row) =>
            sum + BigInt(row.originalAmountMinor) + BigInt(row.fineMinor),
          0n,
        );
        const discount = invoice.items.reduce(
          (sum, row) => sum + BigInt(row.discountMinor),
          0n,
        );
        const waiver = invoice.items.reduce(
          (sum, row) => sum + BigInt(row.waiverMinor),
          0n,
        );
        const net = invoice.items.reduce(
          (sum, row) => sum + BigInt(row.finalAmountMinor),
          0n,
        );
        const paid = invoice.items.reduce(
          (sum, row) => sum + BigInt(row.paidMinor),
          0n,
        );
        const outstanding = net > paid ? net - paid : 0n;
        await tx.feeInvoice.update({
          where: { id: invoice.id },
          data: {
            grossAmountMinor: gross,
            discountMinor: discount,
            waiverMinor: waiver,
            fineMinor: invoice.items.reduce(
              (sum, row) => sum + BigInt(row.fineMinor),
              0n,
            ),
            netPayableMinor: net,
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
    const ledgerType = [
      "DISCOUNT",
      "SCHOLARSHIP",
      "WAIVER",
      "LATE_FEE_WAIVER",
      "REFUND",
      "REVERSAL",
      "CREDIT_NOTE",
      "DEBIT_NOTE",
      "CARRY_FORWARD",
    ].includes(adjustment.type)
      ? adjustment.type === "LATE_FEE_WAIVER"
        ? "WAIVER"
        : adjustment.type
      : "CREDIT_NOTE";
    const isCredit = creditTypes.has(adjustment.type);
    await tx.feeLedgerEntry.create({
      data: {
        schoolId,
        studentId: adjustment.studentId,
        feeAccountId: account.id,
        academicSession: adjustment.academicSession,
        entryType: ledgerType,
        referenceType: "FeeAdjustment",
        referenceId: adjustment.id,
        description: adjustment.reason,
        debitMinor: isCredit ? 0 : adjustment.amountMinor,
        creditMinor: isCredit ? adjustment.amountMinor : 0,
        balanceMinor:
          BigInt(last?.balanceMinor || 0) +
          (isCredit
            ? -BigInt(adjustment.amountMinor)
            : BigInt(adjustment.amountMinor)),
        createdById: req.user.id,
      },
    });
    const result = await tx.feeAdjustment.update({
      where: { id },
      data: { status: "PROCESSED", processedAt: new Date() },
    });
    await recordAudit(
      tx,
      req,
      "FEE_ADJUSTMENT_PROCESSED",
      "FeeAdjustment",
      id,
      result,
    );
    return result;
  });

export const cancelReceipt = (req, id, reason, approvalRequestId) =>
  prisma.$transaction(async (tx) => {
    const schoolId = schoolIdOf(req.user);
    const receipt = await tx.feeReceipt.findFirst({
      where: { id, schoolId, status: "VALID" },
      include: {
        payment: { include: { allocations: true, feeAccount: true } },
      },
    });
    if (!receipt)
      throw Object.assign(new Error("Valid receipt not found"), {
        status: 404,
      });
    if (!approvalRequestId) {
      const request = await tx.feeApprovalRequest.create({
        data: {
          schoolId,
          academicSession: receipt.academicSession,
          actionType: "PAYMENT_REVERSAL",
          entityType: "FeeReceipt",
          entityId: id,
          amountMinor: receipt.payment.amountMinor,
          reason,
          requestedById: req.user.id,
        },
      });
      await recordAudit(
        tx,
        req,
        "PAYMENT_REVERSAL_REQUESTED",
        "FeeReceipt",
        id,
        { approvalId: request.id },
        reason,
      );
      return { id, status: "PENDING_APPROVAL", approvalRequestId: request.id };
    }
    if (req.user.role === "FEE_MANAGER")
      throw Object.assign(
        new Error("Fee managers cannot approve payment reversals"),
        { status: 403 },
      );
    const approval = await tx.feeApprovalRequest.findFirst({
      where: {
        id: approvalRequestId,
        schoolId,
        entityId: id,
        actionType: { in: ["PAYMENT_REVERSAL", "RECEIPT_CANCELLATION"] },
        status: "PENDING",
      },
    });
    if (!approval)
      throw Object.assign(new Error("Pending reversal approval not found"), {
        status: 404,
      });
    if (approval.requestedById === req.user.id)
      throw Object.assign(
        new Error("You cannot approve your own reversal request"),
        { status: 409 },
      );
    if (!["COMPLETED", "CLEARED"].includes(receipt.payment.status))
      throw Object.assign(new Error("Payment is no longer reversible"), {
        status: 409,
      });
    await ensureUnlocked(tx, schoolId, new Date());
    for (const allocation of receipt.payment.allocations) {
      const charge = await tx.studentFeeCharge.findFirst({
        where: {
          id: allocation.chargeId,
          schoolId,
          studentId: receipt.payment.studentId,
        },
      });
      if (!charge || BigInt(charge.paidMinor) < BigInt(allocation.amountMinor))
        throw Object.assign(
          new Error("Payment allocations cannot be reversed safely"),
          { status: 409 },
        );
      const paid = BigInt(charge.paidMinor) - BigInt(allocation.amountMinor);
      await tx.studentFeeCharge.update({
        where: { id: charge.id },
        data: {
          paidMinor: paid,
          status:
            paid > 0n
              ? "PARTIALLY_PAID"
              : charge.dueDate < new Date()
                ? "OVERDUE"
                : "DUE",
        },
      });
      await tx.feeInvoiceItem.updateMany({
        where: { schoolId, chargeId: charge.id },
        data: { paidMinor: { decrement: allocation.amountMinor } },
      });
    }
    if (BigInt(receipt.payment.unappliedMinor) > 0n) {
      if (
        BigInt(receipt.payment.feeAccount.advanceBalanceMinor) <
        BigInt(receipt.payment.unappliedMinor)
      )
        throw Object.assign(
          new Error(
            "Advance credit has already been consumed; use an adjustment workflow",
          ),
          { status: 409 },
        );
      await tx.studentFeeAccount.update({
        where: { id: receipt.payment.feeAccountId },
        data: {
          advanceBalanceMinor: { decrement: receipt.payment.unappliedMinor },
        },
      });
    }
    await tx.feePayment.update({
      where: { id: receipt.payment.id },
      data: { status: "REVERSED" },
    });
    await tx.feeReceipt.update({
      where: { id },
      data: { status: "CANCELLED" },
    });
    await tx.feeApprovalRequest.update({
      where: { id: approval.id },
      data: {
        status: "APPROVED",
        reviewedById: req.user.id,
        reviewedAt: new Date(),
      },
    });
    const last = await tx.feeLedgerEntry.findFirst({
      where: { feeAccountId: receipt.payment.feeAccountId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    });
    await tx.feeLedgerEntry.create({
      data: {
        schoolId,
        studentId: receipt.payment.studentId,
        feeAccountId: receipt.payment.feeAccountId,
        academicSession: receipt.academicSession,
        entryType: "REVERSAL",
        referenceType: "FeePayment",
        referenceId: `${receipt.payment.id}:REVERSAL`,
        referenceNumber: receipt.payment.paymentNumber,
        description: reason,
        debitMinor: receipt.payment.amountMinor,
        balanceMinor:
          BigInt(last?.balanceMinor || 0) + BigInt(receipt.payment.amountMinor),
        createdById: req.user.id,
      },
    });
    const invoices = await tx.feeInvoice.findMany({
      where: {
        schoolId,
        items: {
          some: {
            chargeId: {
              in: receipt.payment.allocations.map((item) => item.chargeId),
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
    await recordAudit(
      tx,
      req,
      "PAYMENT_REVERSED",
      "FeePayment",
      receipt.payment.id,
      { approvalId: approval.id, receiptId: id },
      reason,
    );
    return { id, paymentId: receipt.payment.id, status: "REVERSED" };
  });

const render = (text, values) =>
  text.replace(/{{(\w+)}}/g, (_, key) => values[key] ?? "");
export const saveTemplate = (req, data) =>
  prisma.feeNotificationTemplate.upsert({
    where: {
      schoolId_name: { schoolId: schoolIdOf(req.user), name: data.name },
    },
    create: {
      schoolId: schoolIdOf(req.user),
      createdById: req.user.id,
      ...data,
    },
    update: data,
  });
export const listTemplates = (user) =>
  prisma.feeNotificationTemplate.findMany({
    where: { schoolId: schoolIdOf(user) },
    orderBy: { name: "asc" },
  });
export const sendReminders = async (req, data) => {
  const schoolId = schoolIdOf(req.user);
  const template = await prisma.feeNotificationTemplate.findFirst({
    where: { id: data.templateId, schoolId, active: true },
  });
  if (!template)
    throw Object.assign(new Error("Template not found"), { status: 404 });
  const charges = await prisma.studentFeeCharge.findMany({
    where: {
      schoolId,
      academicSession: data.academicSession,
      status: { in: data.statuses || ["OVERDUE", "PARTIALLY_PAID", "DUE"] },
      ...(data.studentIds?.length
        ? { studentId: { in: data.studentIds } }
        : {}),
    },
    include: { student: true },
  });
  const unique = new Map(charges.map((c) => [c.studentId, c]));
  const rows = [...unique.values()].map((c) => ({
    schoolId,
    studentId: c.studentId,
    academicSession: c.academicSession,
    type: template.type,
    title: render(template.title, {
      studentName: c.student.studentFirstName,
      dueAmount: Number(c.baseAmountMinor) / 100,
    }),
    message: render(template.body, {
      studentName: c.student.studentFirstName,
      parentName: c.student.fatherName,
      class: c.student.className,
      section: c.student.section || "",
      dueAmount: (Number(c.baseAmountMinor) / 100).toFixed(2),
      dueDate: c.dueDate.toLocaleDateString(),
      installmentName: c.installmentName,
    }),
    sentById: req.user.id,
  }));
  if (rows.length) await prisma.feeReminder.createMany({ data: rows });
  await Promise.all(rows.map((row) => createSystemNotification({ schoolId, type: row.type, category: 'FEE', priority: 'HIGH', title: row.title, message: row.message, actionUrl: '/parent/fees', sourceModule: 'FEES', sourceEntityType: 'FEE_REMINDER', sourceEntityId: row.studentId, dedupeKey: `${row.type}:${row.studentId}:${data.academicSession}:${new Date().toISOString().slice(0,10)}`, students: [row.studentId], roles: ['PARENT','STUDENT'], mandatory: true })));
  return { sent: rows.length, channel: "IN_APP" };
};

export const teacherSections = async (user) => {
  const teacher = await getTeacherForUser(user);
  if (!teacher)
    throw Object.assign(new Error("Teacher profile not found"), {
      status: 403,
    });
  const assignments = await prisma.teacherAssignment.findMany({
    where: {
      schoolId: user.schoolId,
      teacherId: teacher.id,
      isActive: true,
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    include: { class: true, section: true },
    orderBy: [{ class: { classOrder: "asc" } }, { section: { sectionOrder: "asc" } }],
  });
  const sections = new Map();
  for (const assignment of assignments) {
    const current = sections.get(assignment.sectionId);
    sections.set(assignment.sectionId, {
      classId: assignment.classId,
      sectionId: assignment.sectionId,
      className: assignment.class.className,
      sectionName: assignment.section.sectionName,
      canSendReminders: Boolean(current?.canSendReminders || ["CLASS_TEACHER", "BOTH"].includes(assignment.roleType)),
      assignmentRoles: [...new Set([...(current?.assignmentRoles || []), assignment.roleType])],
    });
  }
  return [...sections.values()];
};
export const teacherSectionFees = async (user, sectionId, academicSession) => {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, schoolId: user.schoolId, deletedAt: null },
  });
  if (!section)
    throw Object.assign(new Error("Section not found"), { status: 404 });
  await requireSchoolAdminOrAssignedTeacherForSection(user, {
    schoolId: user.schoolId,
    classId: section.classId,
    sectionId,
  });
  const classRow = await prisma.class.findUnique({
    where: { id: section.classId },
  });
  const students = await prisma.student.findMany({
    where: {
      schoolId: user.schoolId,
      className: classRow.className,
      section: section.sectionName,
      isActive: true,
      ...(academicSession ? { session: academicSession } : {}),
    },
    include: {
      feeAccounts: {
        where: academicSession ? { academicSession } : undefined,
        include: { charges: { include: { feeComponent: { select: { name: true, code: true } } } } },
        take: 1,
      },
    },
    orderBy: [{ rollNumber: "asc" }, { studentFirstName: "asc" }],
  });
  const rows = students.map((s) => {
      const charges = s.feeAccounts[0]?.charges || [];
      const activeCharges = charges.filter((charge) => !["CANCELLED", "REFUNDED"].includes(charge.status));
      const totals = activeCharges.reduce((sum, charge) => {
        const calculated = calculateCharge(charge);
        sum.expectedMinor += calculated.netMinor;
        sum.paidMinor += BigInt(charge.paidMinor);
        sum.dueMinor += calculated.payableMinor;
        if (calculated.payableMinor > 0n && charge.dueDate < new Date()) sum.overdueMinor += calculated.payableMinor;
        return sum;
      }, { expectedMinor: 0n, paidMinor: 0n, dueMinor: 0n, overdueMinor: 0n });
      const next = activeCharges
        .filter((c) => calculateCharge(c).payableMinor > 0n)
        .sort((a, b) => a.dueDate - b.dueDate)[0];
      return {
        id: s.id,
        name: `${s.studentFirstName} ${s.studentLastName || ""}`.trim(),
        parentName: s.fatherName,
        parentMobile: s.parentMobile,
        admissionNo: s.admissionNo,
        rollNumber: s.rollNumber,
        ...totals,
        feeStatus: totals.expectedMinor === 0n ? "NOT_ASSIGNED" : totals.dueMinor === 0n ? "PAID" : totals.paidMinor > 0n ? "PARTIALLY_PAID" : totals.overdueMinor > 0n ? "OVERDUE" : "PENDING",
        nextDue: next
          ? {
              installmentName: next.installmentName,
              dueDate: next.dueDate,
              amountMinor: calculateCharge(next).payableMinor,
            }
          : null,
      };
    });
  const summary = rows.reduce((sum, row) => ({
    expectedMinor: sum.expectedMinor + row.expectedMinor,
    paidMinor: sum.paidMinor + row.paidMinor,
    dueMinor: sum.dueMinor + row.dueMinor,
    overdueMinor: sum.overdueMinor + row.overdueMinor,
    students: sum.students + 1,
    paidStudents: sum.paidStudents + (row.feeStatus === "PAID" ? 1 : 0),
    studentsWithDues: sum.studentsWithDues + (row.dueMinor > 0n ? 1 : 0),
  }), { expectedMinor: 0n, paidMinor: 0n, dueMinor: 0n, overdueMinor: 0n, students: 0, paidStudents: 0, studentsWithDues: 0 });
  const assignmentRows = await prisma.feeAssignment.findMany({
    where: {
      schoolId: user.schoolId,
      academicSession,
      active: true,
      feeStructure: { status: "PUBLISHED" },
      OR: [
        { targetType: "SCHOOL" },
        { targetType: "CLASS", targetValue: classRow.className },
        { targetType: "SECTION", targetValue: { in: [section.sectionName, `${classRow.className}:${section.sectionName}`] } },
      ],
    },
    include: { feeStructure: { include: { components: { where: { active: true }, orderBy: { displayOrder: "asc" } } } } },
    orderBy: { priority: "desc" },
  });
  return safe({
    section: { id: section.id, classId: classRow.id, className: classRow.className, sectionName: section.sectionName, academicSession },
    summary,
    structures: assignmentRows.map((assignment) => ({
      ...assignment.feeStructure,
      assignment: { id: assignment.id, targetType: assignment.targetType, targetValue: assignment.targetValue },
    })),
    students: rows,
  });
};

export const teacherStudentFees = async (user, studentId, academicSession) => {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: user.schoolId, isActive: true },
    select: { id: true, className: true, section: true, session: true },
  });
  if (!student) throw Object.assign(new Error("Student not found"), { status: 404 });
  const classRow = await prisma.class.findFirst({ where: { schoolId: user.schoolId, className: student.className, deletedAt: null } });
  const section = await prisma.section.findFirst({ where: { schoolId: user.schoolId, classId: classRow?.id, sectionName: student.section, deletedAt: null } });
  if (!classRow || !section) throw Object.assign(new Error("Student section is not configured"), { status: 404 });
  await requireSchoolAdminOrAssignedTeacherForSection(user, {
    schoolId: user.schoolId,
    classId: classRow.id,
    sectionId: section.id,
  });
  return getStudentFees(user, student.id, academicSession || student.session);
};
export const teacherSendReminder = async (req, data) => {
  const section = await prisma.section.findFirst({ where: { id: data.sectionId, schoolId: req.user.schoolId, deletedAt: null } });
  if (!section) throw Object.assign(new Error("Section not found"), { status: 404 });
  await assertTeacherIsClassTeacherForSection(req.user, { schoolId: req.user.schoolId, classId: section.classId, sectionId: section.id });
  const overview = await teacherSectionFees(
    req.user,
    data.sectionId,
    data.academicSession,
  );
  const rows = overview.students;
  const selected = data.studentIds?.length
    ? rows.filter((s) => data.studentIds.includes(s.id) && s.dueMinor > 0)
    : rows.filter((s) => s.dueMinor > 0);
  const reminders = selected.map((s) => ({
    schoolId: req.user.schoolId,
    studentId: s.id,
    academicSession: data.academicSession,
    type: "TEACHER_FEE_REMINDER",
    title: data.title || "Fee payment reminder",
    message: `Dear ${s.parentName || "Parent"}, a fee amount of ₹${(Number(s.dueMinor) / 100).toFixed(2)} is pending for ${s.name}${s.admissionNo ? ` (${s.admissionNo})` : ""}.${s.nextDue ? ` Due detail: ${s.nextDue.installmentName}, due ${new Date(s.nextDue.dueDate).toLocaleDateString()}.` : ""}${data.message ? ` ${data.message}` : ""}`,
    channel: "IN_APP",
    status: "SENT",
    sentById: req.user.id,
  }));
  if (reminders.length)
    await prisma.feeReminder.createMany({ data: reminders });
  await Promise.all(reminders.map((row) => createSystemNotification({ schoolId: req.user.schoolId, type: row.type, category: 'FEE', priority: 'HIGH', title: row.title, message: row.message, actionUrl: '/parent/fees', sourceModule: 'FEES', sourceEntityType: 'FEE_REMINDER', sourceEntityId: row.studentId, dedupeKey: `${row.type}:${row.studentId}:${data.academicSession}:${new Date().toISOString().slice(0,10)}`, students: [row.studentId], roles: ['PARENT','STUDENT'], mandatory: true })));
  return {
    sent: reminders.length,
    channel: "IN_APP",
    recipients: selected.map((s) => ({
      studentId: s.id,
      parentMobile: s.parentMobile,
    })),
  };
};

export const submitClosing = async (req, data) => {
  const schoolId = schoolIdOf(req.user);
  const start = new Date(data.closingDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  const payments = await prisma.feePayment.findMany({
    where: {
      schoolId,
      collectedById: req.user.id,
      paymentDate: { gte: start, lt: end },
      status: { in: ["COMPLETED", "CLEARED"] },
    },
  });
  const cash = payments
    .filter((p) => p.method === "CASH")
    .reduce((s, p) => s + BigInt(p.amountMinor), 0n);
  const nonCash = payments
    .filter((p) => p.method !== "CASH")
    .reduce((s, p) => s + BigInt(p.amountMinor), 0n);
  const opening = BigInt(data.openingCashMinor || 0);
  const actual = BigInt(data.actualClosingMinor);
  const expected = opening + cash;
  return prisma.feeDailyCashClosing.upsert({
    where: {
      schoolId_closingDate_feeManagerId: {
        schoolId,
        closingDate: start,
        feeManagerId: req.user.id,
      },
    },
    create: {
      schoolId,
      closingDate: start,
      feeManagerId: req.user.id,
      openingCashMinor: opening,
      cashCollectedMinor: cash,
      nonCashCollectedMinor: nonCash,
      expectedClosingMinor: expected,
      actualClosingMinor: actual,
      differenceMinor: actual - expected,
      notes: data.notes,
    },
    update: {
      openingCashMinor: opening,
      cashCollectedMinor: cash,
      nonCashCollectedMinor: nonCash,
      expectedClosingMinor: expected,
      actualClosingMinor: actual,
      differenceMinor: actual - expected,
      notes: data.notes,
      status: "PENDING",
    },
  });
};
export const reviewClosing = (req, id, status, comment) =>
  prisma.feeDailyCashClosing.updateMany({
    where: { id, schoolId: schoolIdOf(req.user), status: "PENDING" },
    data: {
      status,
      reviewedById: req.user.id,
      reviewComment: comment,
      reviewedAt: new Date(),
    },
  });
export const listClosings = (user) =>
  prisma.feeDailyCashClosing.findMany({
    where: {
      schoolId: schoolIdOf(user),
      ...(user.role === "FEE_MANAGER" ? { feeManagerId: user.id } : {}),
    },
    orderBy: { closingDate: "desc" },
  });

export const setPeriodLock = (req, data) =>
  prisma.$transaction(async (tx) => {
    const schoolId = schoolIdOf(req.user);
    const period = await tx.feeFinancialPeriod.upsert({
      where: {
        schoolId_academicSession_periodKey: {
          schoolId,
          academicSession: data.academicSession,
          periodKey: data.periodKey,
        },
      },
      create: {
        schoolId,
        academicSession: data.academicSession,
        periodKey: data.periodKey,
        startDate: new Date(data.startDate),
        endDate: new Date(data.endDate),
        lockedAt: data.lock ? new Date() : null,
        lockedById: data.lock ? req.user.id : null,
        reopenedAt: data.lock ? null : new Date(),
        reopenedById: data.lock ? null : req.user.id,
        reopenReason: data.reason,
      },
      update: data.lock
        ? { lockedAt: new Date(), lockedById: req.user.id }
        : {
            lockedAt: null,
            reopenedAt: new Date(),
            reopenedById: req.user.id,
            reopenReason: data.reason,
          },
    });
    await recordAudit(
      tx,
      req,
      data.lock ? "PERIOD_LOCKED" : "PERIOD_REOPENED",
      "FeeFinancialPeriod",
      period.id,
      period,
      data.reason,
    );
    return period;
  });

export const rollover = (req, data) =>
  prisma.$transaction(async (tx) => {
    const schoolId = schoolIdOf(req.user);
    const accounts = await tx.studentFeeAccount.findMany({
      where: { schoolId, academicSession: data.fromSession },
      include: { ledgerEntries: { orderBy: { createdAt: "desc" }, take: 1 } },
    });
    let carried = 0;
    for (const old of accounts) {
      const balance = BigInt(old.ledgerEntries[0]?.balanceMinor || 0);
      if (balance <= 0n) continue;
      const account = await tx.studentFeeAccount.upsert({
        where: {
          schoolId_studentId_academicSession: {
            schoolId,
            studentId: old.studentId,
            academicSession: data.toSession,
          },
        },
        create: {
          schoolId,
          studentId: old.studentId,
          academicSession: data.toSession,
          carriedForwardMinor: balance,
        },
        update: { carriedForwardMinor: { increment: balance } },
      });
      await tx.feeLedgerEntry
        .create({
          data: {
            schoolId,
            studentId: old.studentId,
            feeAccountId: account.id,
            academicSession: data.toSession,
            entryType: "CARRY_FORWARD",
            referenceType: "SessionRollover",
            referenceId: `${old.id}:${data.toSession}`,
            description: `Outstanding dues carried from ${data.fromSession}`,
            debitMinor: balance,
            balanceMinor: balance,
            createdById: req.user.id,
          },
        })
        .catch((e) => {
          if (e.code !== "P2002") throw e;
        });
      carried += 1;
    }
    await recordAudit(
      tx,
      req,
      "SESSION_DUES_ROLLED_OVER",
      "StudentFeeAccount",
      data.toSession,
      { from: data.fromSession, accounts: carried },
      data.reason,
    );
    return { accountsCarried: carried };
  });

export const createScholarship = (req, data) =>
  prisma.feeScholarship.create({
    data: {
      schoolId: schoolIdOf(req.user),
      createdById: req.user.id,
      ...data,
      valueMinor: data.valueMinor == null ? null : BigInt(data.valueMinor),
      maximumMinor:
        data.maximumMinor == null ? null : BigInt(data.maximumMinor),
    },
  });
export const assignScholarship = (req, data) =>
  prisma.studentFeeScholarship.create({
    data: {
      schoolId: schoolIdOf(req.user),
      studentId: data.studentId,
      scholarshipId: data.scholarshipId,
      chargeId: data.chargeId,
      academicSession: data.academicSession,
      amountMinor: BigInt(data.amountMinor),
      reason: data.reason,
      requestedById: req.user.id,
      status: req.user.role === "FEE_MANAGER" ? "PENDING" : "APPROVED",
      approvedById: req.user.role === "FEE_MANAGER" ? null : req.user.id,
      approvedAt: req.user.role === "FEE_MANAGER" ? null : new Date(),
    },
  });

export const familyOverview = async (user) => {
  const schoolId = schoolIdOf(user);
  const links = await prisma.feeFamilyLink.findMany({
    where: {
      schoolId,
      parentUserId: { in: [user.id, user.email].filter(Boolean) },
      active: true,
    },
    include: { student: true },
  });
  const fallback = links.length
    ? links
    : await prisma.student
        .findMany({ where: { id: user.studentId, schoolId } })
        .then((students) => students.map((student) => ({ student })));
  const children = [];
  for (const { student } of fallback) {
    const account = await prisma.studentFeeAccount.findUnique({
      where: {
        schoolId_studentId_academicSession: {
          schoolId,
          studentId: student.id,
          academicSession: student.session,
        },
      },
      include: {
        charges: true,
        payments: {
          include: { receipt: true },
          orderBy: { paymentDate: "desc" },
          take: 5,
        },
      },
    });
    const pending = (account?.charges || []).reduce(
      (sum, c) => sum + calculateCharge(c).payableMinor,
      0n,
    );
    children.push({
      student: {
        id: student.id,
        name: `${student.studentFirstName} ${student.studentLastName || ""}`.trim(),
        className: student.className,
        section: student.section,
      },
      account: safe(account),
      pendingMinor: Number(pending),
    });
  }
  return {
    children,
    combinedPendingMinor: children.reduce((s, c) => s + c.pendingMinor, 0),
  };
};
export const linkFamily = (req, data) =>
  prisma.feeFamilyLink.create({
    data: {
      schoolId: schoolIdOf(req.user),
      parentUserId: data.parentUserId,
      studentId: data.studentId,
      relationship: data.relationship || "PARENT",
    },
  });

export const report = async (user, filters) => {
  const schoolId = schoolIdOf(user);
  const from = filters.from ? new Date(filters.from) : null;
  const to = filters.to ? new Date(filters.to) : null;
  if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime())) || (from && to && from > to)) throw Object.assign(new Error("Invalid report date range"), { status: 400 });
  if (to && !String(filters.to).includes("T")) to.setHours(23, 59, 59, 999);
  const where = {
    schoolId,
    ...(filters.academicSession
      ? { academicSession: filters.academicSession }
      : {}),
    ...(from || to
      ? {
          paymentDate: {
            ...(from ? { gte: from } : {}),
            ...(to ? { lte: to } : {}),
          },
        }
      : {}),
    ...(filters.method ? { method: filters.method } : {}),
    ...(filters.status ? { status: filters.status } : { status: { in: ["COMPLETED", "CLEARED", "PARTIALLY_REFUNDED", "REFUNDED"] } }),
    ...(filters.className || filters.section ? { student: { ...(filters.className ? { className: filters.className } : {}), ...(filters.section ? { section: filters.section } : {}) } } : {}),
  };
  const page = Math.max(1, Number(filters.page) || 1); const limit = ["csv", "pdf"].includes(filters.format) ? 10000 : Math.min(100, Math.max(1, Number(filters.limit) || 25));
  const [rows, total, aggregate] = await Promise.all([
    prisma.feePayment.findMany({
      where,
      include: {
        student: {
          select: {
            studentFirstName: true,
            studentLastName: true,
            admissionNo: true,
            className: true,
            section: true,
          },
        },
        receipt: true,
      },
      orderBy: { paymentDate: "desc" }, skip: ["csv", "pdf"].includes(filters.format) ? 0 : (page - 1) * limit, take: limit,
    }),
    prisma.feePayment.count({ where }),
    prisma.feePayment.aggregate({ where, _sum: { amountMinor: true } }),
  ]);
  return safe({
    rows,
    totalMinor: aggregate._sum.amountMinor || 0,
    pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    filters,
  });
};
export const platformAnalytics = async (user) => {
  if (user.role !== "PLATFORM_OWNER")
    throw Object.assign(new Error("Forbidden"), { status: 403 });
  const settings = await prisma.feeModuleSetting.findMany({
    include: { school: { select: { schoolName: true, schoolCode: true } } },
  });
  const summaries = await Promise.all(
    settings.map(async (setting) => {
      const payments = setting.allowPlatformSummary
        ? await prisma.feePayment.aggregate({
            where: {
              schoolId: setting.schoolId,
              status: { in: ["COMPLETED", "CLEARED"] },
            },
            _sum: { amountMinor: true },
            _count: true,
          })
        : null;
      return {
        school: setting.school,
        enabled: setting.enabled,
        mode: setting.mode,
        allowPlatformSummary: setting.allowPlatformSummary,
        collection: payments ? safe(payments) : null,
      };
    }),
  );
  return {
    enabledSchools: settings.filter((s) => s.enabled).length,
    configuredSchools: settings.length,
    schools: summaries,
  };
};
export const auditLogs = (user, query) =>
  prisma.feeAuditLog.findMany({
    where: {
      schoolId: schoolIdOf(user),
      ...(query.action ? { action: query.action } : {}),
      ...(query.entityType ? { entityType: query.entityType } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(Number(query.limit) || 100, 500),
  });
export const attachDocument = async (req, data) => {
  const schoolId = schoolIdOf(req.user);
  if (!/^https:\/\//i.test(data.url))
    throw new Error("Document URL must use HTTPS");
  const entityExists =
    data.entityType === "StudentFeeScholarship"
      ? await prisma.studentFeeScholarship.findFirst({
          where: { id: data.entityId, schoolId },
        })
      : data.entityType === "FeeAdjustment"
        ? await prisma.feeAdjustment.findFirst({
            where: { id: data.entityId, schoolId },
          })
        : null;
  if (!entityExists)
    throw Object.assign(new Error("Document entity not found"), {
      status: 404,
    });
  return prisma.feeDocument.create({
    data: {
      schoolId,
      entityType: data.entityType,
      entityId: data.entityId,
      name: data.name,
      url: data.url,
      mimeType: data.mimeType,
      uploadedById: req.user.id,
    },
  });
};
