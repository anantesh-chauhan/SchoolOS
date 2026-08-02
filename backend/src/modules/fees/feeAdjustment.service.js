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
import { schoolIdOf, safe, recordAudit, ensureUnlocked, assignmentMatches, normalizeAssignmentTarget } from "./feeAdvanced.shared.js";

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
