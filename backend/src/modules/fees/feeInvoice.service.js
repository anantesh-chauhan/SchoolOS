import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import { calculateCharge, calculateLateFee } from "./feeCalculation.service.js";
import { tenant, safe, positiveMinor, required, pageArgs, audit } from "./feeWorkflow.shared.js";

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
