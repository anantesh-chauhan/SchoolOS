import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import { calculateCharge, calculateLateFee } from "./feeCalculation.service.js";

const tenant = (user) => {
  if (!user?.schoolId)
    throw Object.assign(new Error("A school tenant is required"), {
      status: 403,
    });
  return user.schoolId;
};
const safe = (value) =>
  JSON.parse(
    JSON.stringify(value, (_, item) =>
      typeof item === "bigint" ? Number(item) : item,
    ),
  );
const positiveMinor = (value, field = "amountMinor") => {
  if (!Number.isSafeInteger(value) || value <= 0)
    throw Object.assign(
      new Error(`${field} must be a positive integer in minor currency units`),
      { status: 400 },
    );
  return BigInt(value);
};
const required = (value, field, max = 200) => {
  const clean = typeof value === "string" ? value.trim() : "";
  if (!clean)
    throw Object.assign(new Error(`${field} is required`), { status: 400 });
  if (clean.length > max)
    throw Object.assign(new Error(`${field} is too long`), { status: 400 });
  return clean;
};
const pageArgs = (query = {}) => {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 25));
  return { page, limit, skip: (page - 1) * limit };
};
const audit = (tx, req, action, entityType, entityId, newValue, reason) =>
  tx.feeAuditLog.create({
    data: {
      schoolId: tenant(req.user),
      userId: req.user.id,
      userRole: req.user.role,
      action,
      entityType,
      entityId,
      newValue: newValue ? safe(newValue) : undefined,
      reason,
      ipAddress: req.ip,
      userAgent: req.get?.("user-agent"),
    },
  });

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

const invoiceAccess = async (user, studentId) => {
  const schoolId = tenant(user);
  if (user.role === "STUDENT" && user.studentId !== studentId) return false;
  if (user.role === "PARENT") {
    return Boolean(
      await prisma.feeFamilyLink.findFirst({
        where: {
          schoolId,
          studentId,
          active: true,
          parentUserId: { in: [user.id, user.email].filter(Boolean) },
        },
      }),
    );
  }
  return true;
};

export const listInvoices = async (user, query = {}) => {
  const schoolId = tenant(user);
  const { page, limit, skip } = pageArgs(query);
  let studentId = query.studentId;
  if (user.role === "STUDENT") studentId = user.studentId;
  if (
    user.role === "PARENT" &&
    studentId &&
    !(await invoiceAccess(user, studentId))
  )
    throw Object.assign(new Error("Invoice not found"), { status: 404 });
  const where = {
    schoolId,
    ...(studentId ? { studentId } : {}),
    ...(query.academicSession
      ? { academicSession: query.academicSession }
      : {}),
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
    where.studentId = { in: links.map((row) => row.studentId) };
  }
  const [items, total] = await Promise.all([
    prisma.feeInvoice.findMany({
      where,
      skip,
      take: limit,
      include: {
        student: {
          select: {
            studentFirstName: true,
            studentLastName: true,
            admissionNo: true,
          },
        },
        items: true,
      },
      orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
    }),
    prisma.feeInvoice.count({ where }),
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

export const generateInvoices = (req, body, idempotencyKey) =>
  prisma.$transaction(
    async (tx) => {
      const schoolId = tenant(req.user);
      const academicSession = required(
        body.academicSession,
        "academicSession",
        20,
      );
      const issueDate = body.issueDate ? new Date(body.issueDate) : new Date();
      const dueDate = body.dueDate ? new Date(body.dueDate) : null;
      if (
        Number.isNaN(issueDate.getTime()) ||
        (dueDate && Number.isNaN(dueDate.getTime()))
      )
        throw Object.assign(
          new Error("Valid issueDate and dueDate are required"),
          { status: 400 },
        );
      const studentWhere = {
        schoolId,
        isActive: true,
        session: academicSession,
        ...(body.studentIds?.length ? { id: { in: body.studentIds } } : {}),
        ...(body.className ? { className: body.className } : {}),
        ...(body.section ? { section: body.section } : {}),
      };
      const students = await tx.student.findMany({
        where: studentWhere,
        select: { id: true, className: true, section: true },
      });
      if (!students.length)
        throw Object.assign(new Error("No eligible students found"), {
          status: 404,
        });
      const charges = await tx.studentFeeCharge.findMany({
        where: {
          schoolId,
          academicSession,
          studentId: { in: students.map((student) => student.id) },
          invoiceItem: null,
          status: { notIn: ["CANCELLED", "WAIVED", "EXEMPTED", "REFUNDED"] },
          ...(body.periodStart || body.periodEnd
            ? {
                dueDate: {
                  ...(body.periodStart
                    ? { gte: new Date(body.periodStart) }
                    : {}),
                  ...(body.periodEnd ? { lte: new Date(body.periodEnd) } : {}),
                },
              }
            : {}),
        },
        include: { feeComponent: { select: { name: true, code: true } } },
        orderBy: { dueDate: "asc" },
      });
      const grouped = Map.groupBy
        ? Map.groupBy(charges, (charge) => charge.studentId)
        : charges.reduce(
            (map, charge) =>
              map.set(charge.studentId, [
                ...(map.get(charge.studentId) || []),
                charge,
              ]),
            new Map(),
          );
      const created = [];
      for (const student of students) {
        const rows = grouped.get(student.id) || [];
        if (!rows.length) continue;
        const key = `${idempotencyKey}:${student.id}`;
        const replay = await tx.feeInvoice.findUnique({
          where: { schoolId_idempotencyKey: { schoolId, idempotencyKey: key } },
        });
        if (replay) {
          created.push(replay);
          continue;
        }
        const totals = rows.reduce(
          (sum, charge) => {
            const value = calculateCharge(charge);
            sum.gross += value.grossMinor;
            sum.discount +=
              BigInt(charge.discountMinor) + BigInt(charge.scholarshipMinor);
            sum.waiver += BigInt(charge.waiverMinor);
            sum.net += value.netMinor;
            sum.paid += BigInt(charge.paidMinor) - BigInt(charge.refundedMinor);
            return sum;
          },
          { gross: 0n, discount: 0n, waiver: 0n, net: 0n, paid: 0n },
        );
        const outstanding =
          totals.net > totals.paid ? totals.net - totals.paid : 0n;
        const invoiceDue =
          dueDate ||
          rows.reduce(
            (latest, row) => (row.dueDate > latest ? row.dueDate : latest),
            rows[0].dueDate,
          );
        const invoice = await tx.feeInvoice.create({
          data: {
            schoolId,
            studentId: student.id,
            academicSession,
            invoiceNumber: `INV-${academicSession}-${crypto.randomBytes(5).toString("hex").toUpperCase()}`,
            billingPeriod:
              body.billingPeriod?.trim() ||
              `${rows[0].dueDate.toISOString().slice(0, 10)} to ${rows.at(-1).dueDate.toISOString().slice(0, 10)}`,
            issueDate,
            dueDate: invoiceDue,
            classSnapshot: student.className,
            sectionSnapshot: student.section,
            grossAmountMinor: totals.gross,
            discountMinor: totals.discount,
            waiverMinor: totals.waiver,
            netPayableMinor: totals.net,
            amountPaidMinor: totals.paid,
            outstandingMinor: outstanding,
            status:
              outstanding === 0n
                ? "PAID"
                : totals.paid > 0n
                  ? "PARTIALLY_PAID"
                  : invoiceDue < new Date()
                    ? "OVERDUE"
                    : "ISSUED",
            idempotencyKey: key,
            issuedById: req.user.id,
            items: {
              create: rows.map((charge) => {
                const value = calculateCharge(charge);
                return {
                  schoolId,
                  studentId: student.id,
                  chargeId: charge.id,
                  componentNameSnapshot:
                    charge.feeComponent?.name || charge.installmentName,
                  componentCodeSnapshot: charge.feeComponent?.code || "CUSTOM",
                  originalAmountMinor: charge.baseAmountMinor,
                  discountMinor:
                    BigInt(charge.discountMinor) +
                    BigInt(charge.scholarshipMinor),
                  waiverMinor: charge.waiverMinor,
                  fineMinor: charge.lateFeeMinor,
                  finalAmountMinor: value.netMinor,
                  paidMinor:
                    BigInt(charge.paidMinor) - BigInt(charge.refundedMinor),
                };
              }),
            },
          },
          include: { items: true },
        });
        await audit(tx, req, "FEE_INVOICE_ISSUED", "FeeInvoice", invoice.id, {
          invoiceNumber: invoice.invoiceNumber,
          netPayableMinor: invoice.netPayableMinor,
        });
        created.push(invoice);
      }
      return safe({ created: created.length, invoices: created });
    },
    { isolationLevel: "Serializable", timeout: 30000 },
  );

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

export const listTransportRoutes = (user) =>
  prisma.transportFeeRoute.findMany({
    where: { schoolId: tenant(user) },
    include: {
      stops: { orderBy: { sequence: "asc" } },
      _count: { select: { assignments: true } },
    },
    orderBy: { name: "asc" },
  });

export const listTransportAssignments = (user, query = {}) =>
  prisma.transportFeeAssignment.findMany({
    where: {
      schoolId: tenant(user),
      ...(query.academicSession ? { academicSession: String(query.academicSession) } : {}),
      ...(query.status ? { status: String(query.status) } : {}),
    },
    include: {
      student: { select: { id: true, studentFirstName: true, studentLastName: true, admissionNo: true, className: true, section: true } },
      route: { select: { id: true, name: true, code: true } },
      pickupStop: { select: { id: true, name: true } },
      dropStop: { select: { id: true, name: true } },
    },
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 250,
  });

export const recalculateLateFees = (req, body) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const academicSession = required(
      body.academicSession,
      "academicSession",
      20,
    );
    const asOf = body.asOf ? new Date(body.asOf) : new Date();
    if (Number.isNaN(asOf.getTime()))
      throw Object.assign(new Error("asOf is invalid"), { status: 400 });
    const charges = await tx.studentFeeCharge.findMany({
      where: {
        schoolId,
        academicSession,
        dueDate: { lt: asOf },
        status: { in: ["DUE", "OVERDUE", "PARTIALLY_PAID"] },
        ...(body.studentIds?.length
          ? { studentId: { in: body.studentIds } }
          : {}),
      },
      include: { feeComponent: true },
    });
    let updated = 0;
    for (const charge of charges) {
      const rule = charge.feeComponent?.lateFeeRule;
      if (!rule) continue;
      const outstanding = calculateCharge({
        ...charge,
        lateFeeMinor: 0,
      }).payableMinor;
      const fine = calculateLateFee({
        outstandingMinor: outstanding,
        dueDate: charge.dueDate,
        gracePeriodDays: charge.feeComponent.gracePeriodDays,
        rule,
        asOf,
      });
      if (fine === BigInt(charge.lateFeeMinor)) continue;
      const snapshot = {
        ...(charge.calculationSnapshot || {}),
        lateFee: { rule, asOf: asOf.toISOString(), amountMinor: Number(fine) },
      };
      await tx.studentFeeCharge.update({
        where: { id: charge.id },
        data: {
          lateFeeMinor: fine,
          status: outstanding > 0n ? "OVERDUE" : charge.status,
          calculationSnapshot: snapshot,
        },
      });
      const net = calculateCharge({ ...charge, lateFeeMinor: fine }).netMinor;
      await tx.feeInvoiceItem.updateMany({
        where: { schoolId, chargeId: charge.id },
        data: { fineMinor: fine, finalAmountMinor: net },
      });
      updated += 1;
    }
    const invoices = await tx.feeInvoice.findMany({
      where: {
        schoolId,
        academicSession,
        items: { some: { chargeId: { in: charges.map((row) => row.id) } } },
      },
      include: { items: true },
    });
    for (const invoice of invoices) {
      const gross = invoice.items.reduce(
        (sum, row) =>
          sum + BigInt(row.originalAmountMinor) + BigInt(row.fineMinor),
        0n,
      );
      const discount = invoice.items.reduce(
        (sum, row) => sum + BigInt(row.discountMinor),
        0n,
      );
      const waiver = invoice.items.reduce(
        (sum, row) => sum + BigInt(row.waiverMinor),
        0n,
      );
      const net = invoice.items.reduce(
        (sum, row) => sum + BigInt(row.finalAmountMinor),
        0n,
      );
      const paid = invoice.items.reduce(
        (sum, row) => sum + BigInt(row.paidMinor),
        0n,
      );
      const outstanding = net > paid ? net - paid : 0n;
      await tx.feeInvoice.update({
        where: { id: invoice.id },
        data: {
          grossAmountMinor: gross,
          discountMinor: discount,
          waiverMinor: waiver,
          fineMinor: invoice.items.reduce(
            (sum, row) => sum + BigInt(row.fineMinor),
            0n,
          ),
          netPayableMinor: net,
          amountPaidMinor: paid,
          outstandingMinor: outstanding,
          status:
            outstanding === 0n
              ? "PAID"
              : paid > 0n
                ? "PARTIALLY_PAID"
                : invoice.dueDate < asOf
                  ? "OVERDUE"
                  : "ISSUED",
        },
      });
    }
    await audit(
      tx,
      req,
      "LATE_FEES_RECALCULATED",
      "StudentFeeCharge",
      academicSession,
      { asOf, updated },
    );
    return { academicSession, asOf, updated };
  });
export const createTransportRoute = (req, body) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const route = await tx.transportFeeRoute.create({
      data: {
        schoolId,
        name: required(body.name, "name"),
        code: required(body.code, "code", 40).toUpperCase(),
        vehicleNumber: body.vehicleNumber?.trim() || null,
        description: body.description?.trim() || null,
        createdById: req.user.id,
        stops: {
          create: (body.stops || []).map((stop, index) => ({
            schoolId,
            name: required(stop.name, `stops[${index}].name`),
            sequence: Number.isInteger(stop.sequence)
              ? stop.sequence
              : index + 1,
            distanceKm: stop.distanceKm ?? null,
            monthlyMinor: positiveMinor(
              stop.monthlyMinor,
              `stops[${index}].monthlyMinor`,
            ),
          })),
        },
      },
      include: { stops: true },
    });
    await audit(
      tx,
      req,
      "TRANSPORT_ROUTE_CREATED",
      "TransportFeeRoute",
      route.id,
      route,
    );
    return route;
  });
export const assignTransport = (req, body) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const academicSession = required(body.academicSession, "academicSession", 20);
    const startDate = new Date(body.startDate);
    const endDate = body.endDate ? new Date(body.endDate) : null;
    if (Number.isNaN(startDate.getTime()) || (endDate && (Number.isNaN(endDate.getTime()) || endDate < startDate))) throw Object.assign(new Error("Valid transport start and end dates are required"), { status: 400 });
    const monthlyMinor = positiveMinor(body.monthlyMinor);
    const student = await tx.student.findFirst({
      where: { id: body.studentId, schoolId, isActive: true },
    });
    const route = await tx.transportFeeRoute.findFirst({
      where: { id: body.routeId, schoolId, active: true },
      include: { stops: true },
    });
    if (!student || !route)
      throw Object.assign(new Error("Student or transport route not found"), {
        status: 404,
      });
    for (const stopId of [body.pickupStopId, body.dropStopId].filter(Boolean))
      if (!route.stops.some((stop) => stop.id === stopId))
        throw Object.assign(
          new Error("Transport stop does not belong to the selected route"),
          { status: 400 },
        );
    await tx.transportFeeAssignment.updateMany({
      where: {
        schoolId,
        studentId: student.id,
        academicSession,
        status: "ACTIVE",
      },
      data: { status: "COMPLETED", endDate: startDate },
    });
    const obsoleteCharges = await tx.studentFeeCharge.findMany({ where: { schoolId, studentId: student.id, academicSession, dueDate: { gte: startDate }, paidMinor: 0, status: { in: ["UPCOMING", "DUE", "OVERDUE"] }, feeComponent: { feeType: "TRANSPORT" } } });
    let ledger = await tx.feeLedgerEntry.findFirst({ where: { schoolId, studentId: student.id, academicSession }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] }); let runningBalance = BigInt(ledger?.balanceMinor || 0);
    for (const charge of obsoleteCharges) { const credit = calculateCharge(charge).payableMinor; await tx.studentFeeCharge.update({ where: { id: charge.id }, data: { status: "CANCELLED" } }); runningBalance -= credit; await tx.feeLedgerEntry.create({ data: { schoolId, studentId: student.id, feeAccountId: charge.feeAccountId, academicSession, entryType: "CREDIT_NOTE", referenceType: "TransportRouteChange", referenceId: charge.id, description: `Cancelled transport charge: ${charge.installmentName}`, creditMinor: credit, balanceMinor: runningBalance, createdById: req.user.id } }).catch((error) => { if (error.code !== "P2002") throw error; }); }
    const assignment = await tx.transportFeeAssignment.create({
      data: {
        schoolId,
        studentId: student.id,
        academicSession,
        routeId: route.id,
        pickupStopId: body.pickupStopId || null,
        dropStopId: body.dropStopId || null,
        tripType: body.tripType || "TWO_WAY",
        monthlyMinor,
        startDate,
        endDate,
        prorationRule: body.prorationRule || "DAILY",
        createdById: req.user.id,
      },
    });
    const structureCode = `TR-${student.id.slice(-8)}-${Date.now().toString(36)}`.toUpperCase();
    const category = await tx.feeCategory.findFirst({ where: { schoolId, code: "TRANSPORT", active: true } });
    const structure = await tx.feeStructure.create({ data: { schoolId, academicSession, name: `${route.name} · ${student.studentFirstName}`, code: structureCode, mode: "COMPONENT_BASED", status: "PUBLISHED", version: 1, publishedAt: new Date(), createdById: req.user.id, approvedById: req.user.id, changeReason: "Effective-dated student transport assignment", components: { create: { schoolId, academicSession, categoryId: category?.id, name: "Transport Fee", code: "TRANSPORT", feeType: "TRANSPORT", amountMinor: monthlyMinor, frequency: "MONTHLY", dueDay: 7, mandatory: false, createdById: req.user.id } } }, include: { components: true } });
    await tx.feeAssignment.create({ data: { schoolId, academicSession, feeStructureId: structure.id, studentId: student.id, targetType: "TRANSPORT", targetValue: route.id, priority: 50, effectiveFrom: startDate, effectiveTo: endDate, createdById: req.user.id } });
    const account = await tx.studentFeeAccount.upsert({ where: { schoolId_studentId_academicSession: { schoolId, studentId: student.id, academicSession } }, create: { schoolId, studentId: student.id, academicSession }, update: {} });
    const sessionStartYear = Number(academicSession.slice(0, 4)); const sessionEnd = Number.isInteger(sessionStartYear) ? new Date(Date.UTC(sessionStartYear + 1, 2, 31)) : new Date(Date.UTC(startDate.getUTCFullYear() + 1, 2, 31)); const billingEnd = endDate && endDate < sessionEnd ? endDate : sessionEnd; const component = structure.components[0]; let cursor = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1)); let installments = 0;
    while (cursor <= billingEnd) { const monthEnd = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 0)); const effectiveStart = cursor < startDate ? startDate : cursor; const effectiveEnd = monthEnd > billingEnd ? billingEnd : monthEnd; const totalDays = monthEnd.getUTCDate(); const activeDays = Math.max(0, Math.floor((effectiveEnd - effectiveStart) / 86400000) + 1); const amount = body.prorationRule === "NONE" ? monthlyMinor : (monthlyMinor * BigInt(activeDays)) / BigInt(totalDays); if (amount > 0n) { const dueDate = new Date(effectiveStart); dueDate.setUTCHours(0, 0, 0, 0); const installmentName = `${cursor.toLocaleString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" })} Transport`; const charge = await tx.studentFeeCharge.create({ data: { schoolId, studentId: student.id, feeAccountId: account.id, feeStructureId: structure.id, feeComponentId: component.id, academicSession, installmentName, dueDate, baseAmountMinor: amount, status: dueDate < new Date() ? "OVERDUE" : "UPCOMING", calculationSnapshot: { routeId: route.id, routeCode: route.code, pickupStopId: body.pickupStopId || null, dropStopId: body.dropStopId || null, tripType: body.tripType || "TWO_WAY", prorationRule: body.prorationRule || "DAILY", activeDays, totalDays } } }); runningBalance += amount; await tx.feeLedgerEntry.create({ data: { schoolId, studentId: student.id, feeAccountId: account.id, academicSession, entryType: "CHARGE", referenceType: "StudentFeeCharge", referenceId: charge.id, referenceNumber: component.code, description: installmentName, debitMinor: amount, balanceMinor: runningBalance, createdById: req.user.id } }); installments += 1; } cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1)); }
    await audit(
      tx,
      req,
      "TRANSPORT_ASSIGNED",
      "TransportFeeAssignment",
      assignment.id,
      { ...assignment, installmentsGenerated: installments },
    );
    return { assignment, installmentsGenerated: installments };
  }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 120000 });

export const cancelTransport = (req, id, body = {}) =>
  prisma.$transaction(async (tx) => {
    const schoolId = tenant(req.user);
    const reason = required(body.reason, "reason", 500);
    const effectiveDate = body.effectiveDate ? new Date(body.effectiveDate) : new Date();
    if (Number.isNaN(effectiveDate.getTime())) throw Object.assign(new Error("effectiveDate is invalid"), { status: 400 });
    const assignment = await tx.transportFeeAssignment.findFirst({ where: { id, schoolId, status: "ACTIVE" } });
    if (!assignment) throw Object.assign(new Error("Active transport assignment not found"), { status: 404 });
    const feeAssignments = await tx.feeAssignment.findMany({
      where: { schoolId, studentId: assignment.studentId, academicSession: assignment.academicSession, targetType: "TRANSPORT", targetValue: assignment.routeId, active: true },
      select: { id: true, feeStructureId: true },
    });
    const structureIds = feeAssignments.map((row) => row.feeStructureId);
    const charges = structureIds.length ? await tx.studentFeeCharge.findMany({
      where: { schoolId, studentId: assignment.studentId, academicSession: assignment.academicSession, feeStructureId: { in: structureIds }, dueDate: { gte: effectiveDate }, paidMinor: 0, status: { in: ["UPCOMING", "DUE", "OVERDUE"] } },
      orderBy: { dueDate: "asc" },
    }) : [];
    let cancelledCharges = 0;
    for (const charge of charges) {
      const creditMinor = calculateCharge(charge).payableMinor;
      await tx.studentFeeCharge.update({ where: { id: charge.id }, data: { status: "CANCELLED" } });
      if (creditMinor > 0n) {
        const last = await tx.feeLedgerEntry.findFirst({ where: { feeAccountId: charge.feeAccountId }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
        await tx.feeLedgerEntry.create({ data: { schoolId, studentId: assignment.studentId, feeAccountId: charge.feeAccountId, academicSession: assignment.academicSession, entryType: "CREDIT_NOTE", referenceType: "TransportCancellation", referenceId: charge.id, description: `Transport cancelled: ${charge.installmentName}`, creditMinor, balanceMinor: BigInt(last?.balanceMinor || 0) - creditMinor, createdById: req.user.id } });
      }
      cancelledCharges += 1;
    }
    await tx.feeAssignment.updateMany({ where: { id: { in: feeAssignments.map((row) => row.id) } }, data: { active: false, effectiveTo: effectiveDate } });
    const result = await tx.transportFeeAssignment.update({ where: { id }, data: { status: "CANCELLED", endDate: effectiveDate, cancelledById: req.user.id, cancellationReason: reason } });
    await audit(tx, req, "TRANSPORT_CANCELLED", "TransportFeeAssignment", id, { cancelledCharges, effectiveDate }, reason);
    return { assignment: result, cancelledCharges };
  }, { isolationLevel: "Serializable", maxWait: 10000, timeout: 120000 });
