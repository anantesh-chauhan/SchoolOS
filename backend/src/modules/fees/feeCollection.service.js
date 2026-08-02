import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import {
  allocatePayment,
  calculateCharge,
  serializeMoney,
} from "./feeCalculation.service.js";
import { adminRoles, json, tenant, audit } from "./fee.shared.js";

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
