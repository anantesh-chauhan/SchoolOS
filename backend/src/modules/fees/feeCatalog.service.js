import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import { calculateCharge, calculateLateFee } from "./feeCalculation.service.js";
import { tenant, safe, positiveMinor, required, pageArgs, audit } from "./feeWorkflow.shared.js";

export const listCategories = (user, query = {}) =>
  prisma.feeCategory.findMany({
    where: {
      schoolId: tenant(user),
      ...(query.includeInactive === "true" ? {} : { active: true }),
    },
    include: { _count: { select: { components: true } } },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

export const createCategory = (req, body) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const category = await tx.feeCategory.create({
      data: {
        schoolId,
        name: required(body.name, "name"),
        code: required(body.code, "code", 40).toUpperCase(),
        description: body.description?.trim() || null,
        displayOrder: Number.isInteger(body.displayOrder)
          ? body.displayOrder
          : 0,
        createdById: req.user.id,
        updatedById: req.user.id,
      },
    });
    await audit(
      tx,
      req,
      "FEE_CATEGORY_CREATED",
      "FeeCategory",
      category.id,
      category,
    );
    return category;
  });

export const updateCategory = (req, id, body) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const current = await tx.feeCategory.findFirst({ where: { id, schoolId } });
    if (!current)
      throw Object.assign(new Error("Fee category not found"), { status: 404 });
    const category = await tx.feeCategory.update({
      where: { id },
      data: {
        ...(body.name !== undefined
          ? { name: required(body.name, "name") }
          : {}),
        ...(body.description !== undefined
          ? { description: body.description?.trim() || null }
          : {}),
        ...(body.displayOrder !== undefined &&
        Number.isInteger(body.displayOrder)
          ? { displayOrder: body.displayOrder }
          : {}),
        ...(body.active !== undefined ? { active: body.active === true } : {}),
        updatedById: req.user.id,
      },
    });
    await audit(
      tx,
      req,
      "FEE_CATEGORY_UPDATED",
      "FeeCategory",
      id,
      category,
      body.reason,
    );
    return category;
  });

export const listMasterComponents = (user, query = {}) =>
  prisma.feeComponent.findMany({
    where: {
      schoolId: tenant(user),
      feeStructureId: null,
      ...(query.includeInactive === "true" ? {} : { active: true }),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    },
    include: { category: true },
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
  });

export const createMasterComponent = (req, body) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    if (
      body.categoryId &&
      !(await tx.feeCategory.findFirst({
        where: { id: body.categoryId, schoolId, active: true },
      }))
    )
      throw Object.assign(new Error("Fee category not found"), { status: 404 });
    const component = await tx.feeComponent.create({
      data: {
        schoolId,
        feeStructureId: null,
        academicSession: null,
        categoryId: body.categoryId || null,
        name: required(body.name, "name"),
        code: required(body.code, "code", 40).toUpperCase(),
        description: body.description?.trim() || null,
        feeType: body.feeType?.trim() || null,
        amountMinor:
          body.defaultAmountMinor == null
            ? 0n
            : positiveMinor(body.defaultAmountMinor, "defaultAmountMinor"),
        frequency: body.frequency || "ONE_TIME",
        refundable: body.refundable === true,
        mandatory: body.mandatory !== false,
        active: body.active !== false,
        displayOrder: Number.isInteger(body.displayOrder)
          ? body.displayOrder
          : 0,
        createdById: req.user.id,
      },
      include: { category: true },
    });
    await audit(
      tx,
      req,
      "FEE_COMPONENT_CREATED",
      "FeeComponent",
      component.id,
      component,
    );
    return component;
  });
