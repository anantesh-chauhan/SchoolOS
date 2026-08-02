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
