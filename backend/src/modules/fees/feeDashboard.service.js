import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import {
  allocatePayment,
  calculateCharge,
  serializeMoney,
} from "./feeCalculation.service.js";
import { adminRoles, json, tenant, audit } from "./fee.shared.js";

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
