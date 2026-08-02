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
