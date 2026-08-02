import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import { calculateCharge, calculateLateFee } from "./feeCalculation.service.js";
import { tenant, safe, positiveMinor, required, pageArgs, audit } from "./feeWorkflow.shared.js";

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
