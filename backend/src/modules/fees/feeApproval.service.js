import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import {
  allocatePayment,
  calculateCharge,
  serializeMoney,
} from "./feeCalculation.service.js";
import { adminRoles, json, tenant, audit } from "./fee.shared.js";

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
