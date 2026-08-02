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
