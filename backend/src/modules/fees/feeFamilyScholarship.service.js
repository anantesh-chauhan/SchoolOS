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
