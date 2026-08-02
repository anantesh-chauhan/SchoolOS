import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import {
  allocatePayment,
  calculateCharge,
  serializeMoney,
} from "./feeCalculation.service.js";
import { adminRoles, json, tenant, audit } from "./fee.shared.js";

export const getSettings = async (user) => {
  const schoolId = tenant(user);
  const setting = await prisma.feeModuleSetting.findUnique({
    where: { schoolId },
  });
  return (
    setting || {
      schoolId,
      enabled: false,
      mode: "SIMPLE",
      currencyCode: "INR",
      currencySymbol: "₹",
      locale: "en-IN",
      decimalPrecision: 2,
      gatewayEnabled: false,
    }
  );
};

export const saveSettings = (req, data) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const result = await tx.feeModuleSetting.upsert({
      where: { schoolId },
      create: { schoolId, createdById: req.user.id, ...data },
      update: data,
    });
    await audit(
      tx,
      req,
      "FEE_SETTINGS_UPDATED",
      "FeeModuleSetting",
      result.id,
      result,
    );
    return result;
  });

export const listStructures = async (user, academicSession) => {
  const structures = await prisma.feeStructure.findMany({
    where: {
      schoolId: tenant(user),
      ...(academicSession ? { academicSession } : {}),
    },
    include: {
      components: { orderBy: { displayOrder: "asc" } },
      _count: { select: { assignments: true, charges: true } },
    },
    orderBy: [{ academicSession: "desc" }, { createdAt: "desc" }],
  });
  const charges = structures.length ? await prisma.studentFeeCharge.findMany({
    where: {
      schoolId: tenant(user),
      feeStructureId: { in: structures.map((structure) => structure.id) },
      status: { notIn: ["CANCELLED", "REFUNDED"] },
    },
    select: {
      feeStructureId: true, baseAmountMinor: true, discountMinor: true, scholarshipMinor: true,
      waiverMinor: true, lateFeeMinor: true, paidMinor: true, refundedMinor: true,
    },
  }) : [];
  const summaryByStructure = charges.reduce((map, charge) => {
    const calculated = calculateCharge(charge);
    const summary = map.get(charge.feeStructureId) || { expectedMinor: 0n, collectedMinor: 0n, pendingMinor: 0n };
    summary.expectedMinor += calculated.netMinor;
    summary.collectedMinor += BigInt(charge.paidMinor) - BigInt(charge.refundedMinor);
    summary.pendingMinor += calculated.payableMinor;
    map.set(charge.feeStructureId, summary);
    return map;
  }, new Map());
  return json(structures.map((structure) => ({
    ...structure,
    financialSummary: summaryByStructure.get(structure.id) || { expectedMinor: 0n, collectedMinor: 0n, pendingMinor: 0n },
  })));
};

export const getStructure = async (user, id) => {
  const schoolId = tenant(user);
  const structure = await prisma.feeStructure.findFirst({
    where: { id, schoolId },
    include: {
      components: { orderBy: { displayOrder: "asc" } },
      assignments: { where: { active: true }, orderBy: { priority: "desc" } },
      _count: { select: { assignments: true, charges: true } },
    },
  });
  if (!structure) throw Object.assign(new Error("Fee structure not found"), { status: 404 });
  if (structure.status !== "DRAFT" || structure.assignments.length) return structure;
  const source = await prisma.feeStructure.findFirst({
    where: { schoolId, academicSession: structure.academicSession, code: structure.code, version: { lt: structure.version } },
    include: { assignments: { where: { active: true }, orderBy: { priority: "desc" }, take: 1 } },
    orderBy: { version: "desc" },
  });
  return { ...structure, sourceAssignment: source?.assignments[0] || null };
};

export const createStructure = (req, data) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const latest = await tx.feeStructure.findFirst({
      where: {
        schoolId,
        academicSession: data.academicSession,
        code: data.code,
      },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const structure = await tx.feeStructure.create({
      data: {
        schoolId,
        academicSession: data.academicSession,
        name: data.name,
        code: data.code,
        description: data.description,
        mode: data.mode,
        version: (latest?.version || 0) + 1,
        createdById: req.user.id,
        changeReason: data.changeReason,
        components: {
          create: data.components.map((component) => ({
            ...component,
            schoolId,
            academicSession: data.academicSession,
            createdById: req.user.id,
          })),
        },
      },
      include: { components: true },
    });
    await audit(
      tx,
      req,
      "FEE_STRUCTURE_CREATED",
      "FeeStructure",
      structure.id,
      structure,
      data.changeReason,
    );
    return structure;
  });

export const updateDraftStructure = (req, id, data) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const existing = await tx.feeStructure.findFirst({
      where: { id, schoolId, status: "DRAFT" },
      include: { components: true },
    });
    if (!existing) throw Object.assign(new Error("Only a draft fee structure can be edited"), { status: 409 });
    if (existing.academicSession !== data.academicSession || existing.code !== data.code)
      throw Object.assign(new Error("A revision cannot change the academic session or plan code"), { status: 400 });
    await tx.feeComponent.deleteMany({ where: { schoolId, feeStructureId: id } });
    const result = await tx.feeStructure.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
        mode: data.mode,
        changeReason: data.changeReason || existing.changeReason,
        components: {
          create: data.components.map((component) => ({
            ...component,
            schoolId,
            academicSession: data.academicSession,
            createdById: req.user.id,
          })),
        },
      },
      include: { components: { orderBy: { displayOrder: "asc" } } },
    });
    await audit(tx, req, "FEE_STRUCTURE_DRAFT_UPDATED", "FeeStructure", id, result, data.changeReason);
    return result;
  });

export const reviseStructure = (req, id, reason) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const source = await tx.feeStructure.findFirst({
      where: { id, schoolId, status: { in: ["PUBLISHED", "ARCHIVED"] } },
      include: { components: { orderBy: { displayOrder: "asc" } }, assignments: { where: { active: true }, orderBy: { priority: "desc" } } },
    });
    if (!source) throw Object.assign(new Error("Published fee structure not found"), { status: 404 });
    const existingDraft = await tx.feeStructure.findFirst({
      where: { schoolId, academicSession: source.academicSession, code: source.code, status: "DRAFT" },
      include: { components: { orderBy: { displayOrder: "asc" } }, assignments: true },
      orderBy: { version: "desc" },
    });
    if (existingDraft) return { ...existingDraft, sourceAssignment: source.assignments[0] || null };
    const latest = await tx.feeStructure.findFirst({
      where: { schoolId, academicSession: source.academicSession, code: source.code },
      orderBy: { version: "desc" }, select: { version: true },
    });
    const draft = await tx.feeStructure.create({
      data: {
        schoolId,
        academicSession: source.academicSession,
        name: source.name,
        code: source.code,
        description: source.description,
        mode: source.mode,
        version: (latest?.version || source.version) + 1,
        status: "DRAFT",
        changeReason: String(reason || "Fee structure revision").trim(),
        createdById: req.user.id,
        components: {
          create: source.components.map(({ name, code, description, amountMinor, frequency, dueDay, gracePeriodDays, lateFeeRule, taxable, refundable, mandatory, displayOrder, active, effectiveFrom, effectiveTo, applicability, categoryId, feeType }) => ({
            schoolId, academicSession: source.academicSession, name, code, description, amountMinor, frequency, dueDay,
            gracePeriodDays, lateFeeRule, taxable, refundable, mandatory, displayOrder, active, effectiveFrom, effectiveTo,
            applicability, categoryId, feeType, createdById: req.user.id,
          })),
        },
      },
      include: { components: { orderBy: { displayOrder: "asc" } } },
    });
    await audit(tx, req, "FEE_STRUCTURE_REVISION_CREATED", "FeeStructure", draft.id, { sourceId: source.id, version: draft.version }, reason);
    return { ...draft, sourceAssignment: source.assignments[0] || null };
  });

export const publishStructure = (req, id) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const existing = await tx.feeStructure.findFirst({
      where: { id, schoolId },
      include: { components: true },
    });
    if (!existing)
      throw Object.assign(new Error("Fee structure not found"), {
        status: 404,
      });
    if (existing.status === "PUBLISHED") return existing;
    if (existing.status !== "DRAFT")
      throw Object.assign(new Error("Only a draft fee structure can be published"), { status: 409 });
    if (!existing.components.length)
      throw Object.assign(new Error("At least one fee component is required"), {
        status: 400,
      });
    const result = await tx.feeStructure.update({
      where: { id },
      data: {
        status: "PUBLISHED",
        publishedAt: new Date(),
        approvedById: req.user.id,
      },
    });
    await audit(tx, req, "FEE_STRUCTURE_PUBLISHED", "FeeStructure", id, result);
    return result;
  });
