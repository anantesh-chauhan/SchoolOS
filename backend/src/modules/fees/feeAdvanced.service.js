import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import { calculateCharge } from "./feeCalculation.service.js";
import { issuePaymentReceipt } from "./fee.service.js";
import { createSystemNotification } from "../communication/communication.service.js";
import {
  assertTeacherIsClassTeacherForSection,
  getTeacherForUser,
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
const monthsFor = {
  ONE_TIME: 1,
  MONTHLY: 12,
  BI_MONTHLY: 6,
  QUARTERLY: 4,
  FOUR_MONTHLY: 3,
  HALF_YEARLY: 2,
  ANNUAL: 1,
  PER_TERM: 3,
  PER_SEMESTER: 2,
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
  return false;
};

export const previewAssignment = async (user, data) => {
  const schoolId = schoolIdOf(user);
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
      { ...data, priority: priority[data.targetType] },
      student,
    ),
  );
  const perStudent = structure.components
    .filter((c) => c.active)
    .reduce(
      (sum, c) =>
        sum + BigInt(c.amountMinor) * BigInt(monthsFor[c.frequency] || 1),
      0n,
    );
  const classImpact = Object.values(
    affected.reduce((map, student) => {
      const key = `${student.className}${student.section ? ` / ${student.section}` : ""}`;
      map[key] ||= { classSection: key, students: 0, expectedMinor: 0n };
      map[key].students += 1;
      map[key].expectedMinor += perStudent;
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
          (a.priority || priority[a.targetType]) >= priority[data.targetType],
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
    projectedRevenueMinor: perStudent * BigInt(affected.length),
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
      const structure = await tx.feeStructure.findFirst({
        where: { id: data.feeStructureId, schoolId, status: "PUBLISHED" },
        include: { components: { where: { active: true } } },
      });
      if (!structure)
        throw Object.assign(new Error("Published fee structure not found"), {
          status: 404,
        });
      const assignment = await tx.feeAssignment.create({
        data: {
          schoolId,
          academicSession: structure.academicSession,
          feeStructureId: structure.id,
          studentId: data.targetType === "STUDENT" ? data.studentId : null,
          targetType: data.targetType,
          targetValue: data.targetValue,
          priority: priority[data.targetType],
          createdById: req.user.id,
        },
      });
      const students = (
        await tx.student.findMany({
          where: {
            schoolId,
            isActive: true,
            session: structure.academicSession,
          },
        })
      ).filter((student) => assignmentMatches(assignment, student));
      let created = 0;
      for (const student of students) {
        const superior = await tx.feeAssignment.findFirst({
          where: {
            schoolId,
            studentId: student.id,
            active: true,
            priority: { gt: assignment.priority },
          },
        });
        if (superior) continue;
        const account = await tx.studentFeeAccount.upsert({
          where: {
            schoolId_studentId_academicSession: {
              schoolId,
              studentId: student.id,
              academicSession: structure.academicSession,
            },
          },
          create: {
            schoolId,
            studentId: student.id,
            academicSession: structure.academicSession,
          },
          update: {},
        });
        for (const component of structure.components) {
          const count = monthsFor[component.frequency] || 1;
          const interval = Math.max(1, Math.floor(12 / count));
          for (let index = 0; index < count; index += 1) {
            const dueDate = new Date(
              data.scheduleStart ||
                `${structure.academicSession.slice(0, 4)}-04-01T00:00:00.000Z`,
            );
            dueDate.setUTCMonth(dueDate.getUTCMonth() + index * interval);
            if (component.dueDay) dueDate.setUTCDate(component.dueDay);
            const installmentName =
              count === 1
                ? component.name
                : `${component.name} ${index + 1}/${count}`;
            const charge = await tx.studentFeeCharge.upsert({
              where: {
                schoolId_studentId_feeStructureId_feeComponentId_academicSession_installmentName:
                  {
                    schoolId,
                    studentId: student.id,
                    feeStructureId: structure.id,
                    feeComponentId: component.id,
                    academicSession: structure.academicSession,
                    installmentName,
                  },
              },
              create: {
                schoolId,
                studentId: student.id,
                feeAccountId: account.id,
                feeStructureId: structure.id,
                feeComponentId: component.id,
                academicSession: structure.academicSession,
                installmentName,
                dueDate,
                baseAmountMinor: component.amountMinor,
                status: dueDate < new Date() ? "OVERDUE" : "UPCOMING",
                calculationSnapshot: {
                  componentCode: component.code,
                  structureVersion: structure.version,
                },
              },
              update: {},
            });
            if (charge.createdAt.getTime() === charge.updatedAt.getTime()) {
              const last = await tx.feeLedgerEntry.findFirst({
                where: { feeAccountId: account.id },
                orderBy: { createdAt: "desc" },
              });
              await tx.feeLedgerEntry
                .create({
                  data: {
                    schoolId,
                    studentId: student.id,
                    feeAccountId: account.id,
                    academicSession: structure.academicSession,
                    entryType: "CHARGE",
                    referenceType: "StudentFeeCharge",
                    referenceId: charge.id,
                    referenceNumber: component.code,
                    description: installmentName,
                    debitMinor: component.amountMinor,
                    balanceMinor:
                      BigInt(last?.balanceMinor || 0) +
                      BigInt(component.amountMinor),
                    createdById: req.user.id,
                  },
                })
                .catch((e) => {
                  if (e.code !== "P2002") throw e;
                });
              created += 1;
            }
          }
        }
      }
      await recordAudit(
        tx,
        req,
        "FEE_ASSIGNMENT_PUBLISHED",
        "FeeAssignment",
        assignment.id,
        { affectedStudents: students.length, chargesCreated: created },
      );
      return {
        assignment,
        affectedStudents: students.length,
        chargesCreated: created,
      };
    },
    { isolationLevel: "Serializable", timeout: 30000 },
  );

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
      roleType: { in: ["CLASS_TEACHER", "BOTH"] },
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    include: { class: true, section: true },
  });
  return assignments.map((a) => ({
    classId: a.classId,
    sectionId: a.sectionId,
    className: a.class.className,
    sectionName: a.section.sectionName,
  }));
};
export const teacherSectionFees = async (user, sectionId, academicSession) => {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, schoolId: user.schoolId, deletedAt: null },
  });
  if (!section)
    throw Object.assign(new Error("Section not found"), { status: 404 });
  await assertTeacherIsClassTeacherForSection(user, {
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
        include: { charges: true },
        take: 1,
      },
    },
  });
  return safe(
    students.map((s) => {
      const charges = s.feeAccounts[0]?.charges || [];
      const due = charges.reduce(
        (n, c) => n + calculateCharge(c).payableMinor,
        0n,
      );
      const next = charges
        .filter((c) => calculateCharge(c).payableMinor > 0n)
        .sort((a, b) => a.dueDate - b.dueDate)[0];
      return {
        id: s.id,
        name: `${s.studentFirstName} ${s.studentLastName || ""}`.trim(),
        parentName: s.fatherName,
        parentMobile: s.parentMobile,
        admissionNo: s.admissionNo,
        dueMinor: due,
        nextDue: next
          ? {
              installmentName: next.installmentName,
              dueDate: next.dueDate,
              amountMinor: calculateCharge(next).payableMinor,
            }
          : null,
      };
    }),
  );
};
export const teacherSendReminder = async (req, data) => {
  const rows = await teacherSectionFees(
    req.user,
    data.sectionId,
    data.academicSession,
  );
  const selected = data.studentIds?.length
    ? rows.filter((s) => data.studentIds.includes(s.id))
    : rows.filter((s) => s.dueMinor > 0);
  const reminders = selected.map((s) => ({
    schoolId: req.user.schoolId,
    studentId: s.id,
    academicSession: data.academicSession,
    type: "TEACHER_FEE_REMINDER",
    title: data.title || "Fee payment reminder",
    message: `Dear ${s.parentName || "Parent"}, a fee amount of ₹${(Number(s.dueMinor) / 100).toFixed(2)} is pending for ${s.name}${s.admissionNo ? ` (${s.admissionNo})` : ""}.${s.nextDue ? ` Due detail: ${s.nextDue.installmentName}, due ${new Date(s.nextDue.dueDate).toLocaleDateString()}.` : ""}${data.message ? ` ${data.message}` : ""}`,
    channel: "WHATSAPP_PENDING",
    status: "QUEUED_FOR_WHATSAPP",
    sentById: req.user.id,
  }));
  if (reminders.length)
    await prisma.feeReminder.createMany({ data: reminders });
  await Promise.all(reminders.map((row) => createSystemNotification({ schoolId: req.user.schoolId, type: row.type, category: 'FEE', priority: 'HIGH', title: row.title, message: row.message, actionUrl: '/parent/fees', sourceModule: 'FEES', sourceEntityType: 'FEE_REMINDER', sourceEntityId: row.studentId, dedupeKey: `${row.type}:${row.studentId}:${data.academicSession}:${new Date().toISOString().slice(0,10)}`, students: [row.studentId], roles: ['PARENT','STUDENT'], mandatory: true })));
  return {
    queued: reminders.length,
    channel: "WHATSAPP_PENDING",
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
