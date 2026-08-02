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
