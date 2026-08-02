import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import { calculateCharge, calculateLateFee } from "./feeCalculation.service.js";
import { tenant, safe, positiveMinor, required, pageArgs, audit } from "./feeWorkflow.shared.js";

export const listRefunds = async (user, query = {}) => {
  const schoolId = tenant(user);
  const { page, limit, skip } = pageArgs(query);
  let studentId = query.studentId;
  if (user.role === "STUDENT") studentId = user.studentId;
  if (
    user.role === "PARENT" &&
    studentId &&
    !(await invoiceAccess(user, studentId))
  )
    throw Object.assign(new Error("Refund not found"), { status: 404 });
  const where = {
    schoolId,
    ...(studentId ? { studentId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };
  if (user.role === "PARENT" && !studentId) {
    const links = await prisma.feeFamilyLink.findMany({
      where: {
        schoolId,
        active: true,
        parentUserId: { in: [user.id, user.email].filter(Boolean) },
      },
      select: { studentId: true },
    });
    where.studentId = { in: links.map((x) => x.studentId) };
  }
  const [items, total] = await Promise.all([
    prisma.feeRefund.findMany({
      where,
      skip,
      take: limit,
      include: {
        payment: { select: { paymentNumber: true, amountMinor: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.feeRefund.count({ where }),
  ]);
  return safe({
    items,
    pagination: {
      page,
      limit,
      total,
      pages: Math.max(1, Math.ceil(total / limit)),
    },
  });
};

export const processRefund = (req, body, idempotencyKey) =>
  prisma.$transaction(
    async (tx) => {
      const schoolId = tenant(req.user);
      const amount = positiveMinor(body.amountMinor);
      const reason = required(body.reason, "reason", 1000);
      const replay = await tx.feeRefund.findUnique({
        where: { schoolId_idempotencyKey: { schoolId, idempotencyKey } },
      });
      if (replay) return safe({ ...replay, idempotentReplay: true });
      const payment = await tx.feePayment.findFirst({
        where: {
          id: body.paymentId,
          schoolId,
          status: { in: ["COMPLETED", "CLEARED", "PARTIALLY_REFUNDED"] },
        },
        include: { allocations: true, receipt: true, feeAccount: true },
      });
      if (!payment)
        throw Object.assign(new Error("Refundable payment not found"), {
          status: 404,
        });
      const prior = await tx.feeRefund.aggregate({
        where: { schoolId, paymentId: payment.id, status: "PROCESSED" },
        _sum: { amountMinor: true },
      });
      const already = BigInt(prior._sum.amountMinor || 0);
      if (already + amount > BigInt(payment.amountMinor))
        throw Object.assign(
          new Error("Refund exceeds the unrefunded payment amount"),
          { status: 409 },
        );
      const refund = await tx.feeRefund.create({
        data: {
          schoolId,
          studentId: payment.studentId,
          paymentId: payment.id,
          receiptId: payment.receipt?.id,
          refundNumber: `RF-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`,
          amountMinor: amount,
          method: body.method || payment.method,
          status: "PROCESSED",
          reason,
          referenceNumber: body.referenceNumber?.trim() || null,
          requestedById: req.user.id,
          approvedById: req.user.id,
          processedById: req.user.id,
          approvedAt: new Date(),
          processedAt: new Date(),
          idempotencyKey,
        },
      });
      const priorAllocations = await tx.feeRefundAllocation.groupBy({
        by: ["chargeId", "source"],
        where: {
          schoolId,
          refund: {
            paymentId: payment.id,
            status: "PROCESSED",
            id: { not: refund.id },
          },
        },
        _sum: { amountMinor: true },
      });
      const priorFor = (chargeId, source) =>
        BigInt(
          priorAllocations.find(
            (row) => row.chargeId === chargeId && row.source === source,
          )?._sum.amountMinor || 0,
        );
      let remaining = amount;
      const advanceAvailable =
        BigInt(payment.unappliedMinor) > priorFor(null, "ADVANCE")
          ? BigInt(payment.unappliedMinor) - priorFor(null, "ADVANCE")
          : 0n;
      const advanceRefund = [
        remaining,
        advanceAvailable,
        BigInt(payment.feeAccount.advanceBalanceMinor),
      ].reduce((min, value) => (value < min ? value : min), remaining);
      if (advanceRefund > 0n) {
        await tx.studentFeeAccount.update({
          where: { id: payment.feeAccountId },
          data: { advanceBalanceMinor: { decrement: advanceRefund } },
        });
        await tx.feeRefundAllocation.create({
          data: {
            schoolId,
            refundId: refund.id,
            amountMinor: advanceRefund,
            source: "ADVANCE",
          },
        });
        remaining -= advanceRefund;
      }
      for (const allocation of [...payment.allocations].reverse()) {
        if (remaining === 0n) break;
        const previouslyRefunded = priorFor(allocation.chargeId, "ALLOCATION");
        const available =
          BigInt(allocation.amountMinor) > previouslyRefunded
            ? BigInt(allocation.amountMinor) - previouslyRefunded
            : 0n;
        const refundPart = available < remaining ? available : remaining;
        if (refundPart === 0n) continue;
        const charge = await tx.studentFeeCharge.findFirst({
          where: {
            id: allocation.chargeId,
            schoolId,
            studentId: payment.studentId,
          },
        });
        if (!charge)
          throw Object.assign(new Error("Payment allocation is invalid"), {
            status: 409,
          });
        const refunded = BigInt(charge.refundedMinor) + refundPart;
        const state = calculateCharge({ ...charge, refundedMinor: refunded });
        await tx.studentFeeCharge.update({
          where: { id: charge.id },
          data: {
            refundedMinor: refunded,
            status:
              state.payableMinor > 0n
                ? charge.dueDate < new Date()
                  ? "OVERDUE"
                  : "PARTIALLY_PAID"
                : "PAID",
          },
        });
        await tx.feeInvoiceItem.updateMany({
          where: { chargeId: charge.id, schoolId },
          data: { paidMinor: { decrement: refundPart } },
        });
        await tx.feeRefundAllocation.create({
          data: {
            schoolId,
            refundId: refund.id,
            chargeId: charge.id,
            amountMinor: refundPart,
            source: "ALLOCATION",
          },
        });
        remaining -= refundPart;
      }
      if (remaining > 0n)
        throw Object.assign(new Error("Refund cannot be allocated safely"), {
          status: 409,
        });
      const totalRefunded = already + amount;
      const paymentStatus =
        totalRefunded === BigInt(payment.amountMinor)
          ? "REFUNDED"
          : "PARTIALLY_REFUNDED";
      await tx.feePayment.update({
        where: { id: payment.id },
        data: { status: paymentStatus },
      });
      if (payment.receipt && paymentStatus === "REFUNDED")
        await tx.feeReceipt.update({
          where: { id: payment.receipt.id },
          data: { status: "REFUNDED" },
        });
      const last = await tx.feeLedgerEntry.findFirst({
        where: { feeAccountId: payment.feeAccountId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      });
      await tx.feeLedgerEntry.create({
        data: {
          schoolId,
          studentId: payment.studentId,
          feeAccountId: payment.feeAccountId,
          academicSession: payment.academicSession,
          entryType: "REFUND",
          referenceType: "FeeRefund",
          referenceId: refund.id,
          referenceNumber: refund.refundNumber,
          description: reason,
          debitMinor: amount,
          balanceMinor: BigInt(last?.balanceMinor || 0) + amount,
          createdById: req.user.id,
        },
      });
      const affectedInvoices = await tx.feeInvoice.findMany({
        where: {
          schoolId,
          items: {
            some: {
              chargeId: { in: payment.allocations.map((x) => x.chargeId) },
            },
          },
        },
        include: { items: true },
      });
      for (const invoice of affectedInvoices) {
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
      await audit(
        tx,
        req,
        "FEE_REFUND_PROCESSED",
        "FeeRefund",
        refund.id,
        { paymentId: payment.id, amountMinor: amount },
        reason,
      );
      return safe({ ...refund, paymentStatus, idempotentReplay: false });
    },
    { isolationLevel: "Serializable" },
  );
