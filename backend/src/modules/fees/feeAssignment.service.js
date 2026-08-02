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

export const installmentsForStudent = (component, structure, student) => {
  const rows = buildComponentInstallments(component, { academicSession: structure.academicSession, startMonth: 4 });
  const sessionStart = new Date(Date.UTC(Number(structure.academicSession.slice(0, 4)), 3, 1));
  const admissionDate = student.admissionDate ? new Date(student.admissionDate) : null;
  if (component.applicability?.newAdmissionsOnly && (!admissionDate || admissionDate < sessionStart)) return [];
  if (!component.applicability?.fromAdmissionMonth || !admissionDate) return rows;
  const admissionMonth = new Date(Date.UTC(admissionDate.getUTCFullYear(), admissionDate.getUTCMonth(), 1));
  return rows.filter((row) => row.dueDate >= admissionMonth);
};

const expectedForStudent = (components, structure, student) => components.reduce(
  (total, component) => total + installmentsForStudent(component, structure, student).reduce((sum, row) => sum + row.amountMinor, 0n), 0n,
);

export const previewAssignment = async (user, data) => {
  const schoolId = schoolIdOf(user);
  const normalized = await normalizeAssignmentTarget(prisma, schoolId, data);
  const structure = await prisma.feeStructure.findFirst({
    where: { id: data.feeStructureId, schoolId },
    include: { components: true },
  });
  if (!structure)
    throw Object.assign(new Error("Fee structure not found"), { status: 404 });
  const students = await prisma.student.findMany({
    where: { schoolId, isActive: true, session: structure.academicSession },
  });
  const affected = students.filter((student) =>
    assignmentMatches(
      { ...normalized, priority: priority[normalized.targetType] },
      student,
    ),
  );
  const activeComponents = structure.components.filter((c) => c.active);
  const perStudent = activeComponents.reduce(
    (sum, component) => sum + annualComponentTotal(component, { academicSession: structure.academicSession }), 0n,
  );
  const classImpact = Object.values(
    affected.reduce((map, student) => {
      const key = `${student.className}${student.section ? ` / ${student.section}` : ""}`;
      map[key] ||= { classSection: key, students: 0, expectedMinor: 0n };
      map[key].students += 1;
      map[key].expectedMinor += expectedForStudent(activeComponents, structure, student);
      return map;
    }, {}),
  );
  const existing = await prisma.feeAssignment.findMany({
    where: {
      schoolId,
      academicSession: structure.academicSession,
      active: true,
    },
    include: { feeStructure: { select: { name: true } } },
  });
  const conflicts = affected.flatMap((student) =>
    existing
      .filter(
        (a) =>
          assignmentMatches(a, student) &&
          (a.priority || priority[a.targetType]) >= priority[normalized.targetType],
      )
      .map((a) => ({
        studentId: student.id,
        admissionNo: student.admissionNo,
        existingStructure: a.feeStructure.name,
        existingPriority: a.priority,
      })),
  );
  return safe({
    affectedStudents: affected.length,
    projectedRevenueMinor: affected.reduce((total, student) => total + expectedForStudent(activeComponents, structure, student), 0n),
    perStudentMinor: perStudent,
    classImpact,
    conflicts,
    students: affected.map((s) => ({
      id: s.id,
      name: `${s.studentFirstName} ${s.studentLastName || ""}`.trim(),
      admissionNo: s.admissionNo,
      className: s.className,
      section: s.section,
    })),
  });
};

export const createAssignmentAndCharges = (req, data) =>
  prisma.$transaction(
    async (tx) => {
      const schoolId = schoolIdOf(req.user);
      const normalized = await normalizeAssignmentTarget(tx, schoolId, data);
      const structure = await tx.feeStructure.findFirst({
        where: { id: data.feeStructureId, schoolId, status: "PUBLISHED" },
        include: { components: { where: { active: true } } },
      });
      if (!structure)
        throw Object.assign(new Error("Published fee structure not found"), {
          status: 404,
        });
      const assignment = await tx.feeAssignment.findFirst({
        where: {
          schoolId,
          academicSession: structure.academicSession,
          feeStructureId: structure.id,
          targetType: normalized.targetType,
          targetValue: normalized.targetValue,
          studentId: normalized.targetType === "STUDENT" ? normalized.studentId : null,
          active: true,
        },
      }) || await tx.feeAssignment.create({ data: {
          schoolId,
          academicSession: structure.academicSession,
          feeStructureId: structure.id,
          studentId: normalized.targetType === "STUDENT" ? normalized.studentId : null,
          targetType: normalized.targetType,
          targetValue: normalized.targetValue,
          priority: priority[normalized.targetType],
          createdById: req.user.id,
        } });
      const students = (
        await tx.student.findMany({
          where: {
            schoolId,
            isActive: true,
            session: structure.academicSession,
          },
        })
      ).filter((student) => assignmentMatches(assignment, student));
      const higherPriorityAssignments = await tx.feeAssignment.findMany({
        where: {
          schoolId,
          academicSession: structure.academicSession,
          active: true,
          priority: { gt: assignment.priority },
        },
        include: { feeStructure: { include: { components: { select: { feeType: true, code: true } } } } },
      });
      const academicOverrides = higherPriorityAssignments.filter((candidate) =>
        !candidate.feeStructure.components.length || candidate.feeStructure.components.some((component) => component.feeType !== "TRANSPORT" && component.code !== "TRANSPORT"),
      );
      const previousStructures = await tx.feeStructure.findMany({
        where: {
          schoolId,
          academicSession: structure.academicSession,
          code: structure.code,
          version: { lt: structure.version },
        },
        select: { id: true },
      });
      const previousStructureIds = previousStructures.map((row) => row.id);
      const previousCharges = previousStructureIds.length && students.length ? await tx.studentFeeCharge.findMany({
        where: { schoolId, studentId: { in: students.map((student) => student.id) }, feeStructureId: { in: previousStructureIds } },
        include: { feeComponent: { select: { code: true } } },
        orderBy: [{ studentId: "asc" }, { dueDate: "asc" }],
      }) : [];
      const protectedPriorCharges = new Set(previousCharges.filter((charge) => BigInt(charge.paidMinor) > 0n).map((charge) =>
        `${charge.studentId}:${charge.feeComponent?.code || ""}:${charge.dueDate.getUTCMonth() + 1}`,
      ));
      // Allocation used to perform three or four remote queries per installment.
      // A normal class plan could therefore exceed Prisma's interactive transaction
      // lifetime and leave a published structure without an assignment. Build the
      // complete allocation in memory and persist it in bounded bulk operations.
      const eligibleStudents = students.filter((student) =>
        !academicOverrides.some((candidate) => assignmentMatches(candidate, student)),
      );
      const eligibleStudentIds = eligibleStudents.map((student) => student.id);

      if (eligibleStudents.length) {
        await tx.studentFeeAccount.createMany({
          data: eligibleStudents.map((student) => ({
            schoolId,
            studentId: student.id,
            academicSession: structure.academicSession,
          })),
          skipDuplicates: true,
        });
      }
      const accounts = eligibleStudents.length ? await tx.studentFeeAccount.findMany({
        where: {
          schoolId,
          academicSession: structure.academicSession,
          studentId: { in: eligibleStudentIds },
        },
        select: { id: true, studentId: true },
      }) : [];
      const accountByStudent = new Map(accounts.map((account) => [account.studentId, account]));

      const cancellable = previousCharges.filter((charge) =>
        accountByStudent.has(charge.studentId) &&
        BigInt(charge.paidMinor) === 0n &&
        !["CANCELLED", "WAIVED", "REFUNDED"].includes(charge.status),
      );
      if (cancellable.length) {
        await tx.studentFeeCharge.updateMany({
          where: { id: { in: cancellable.map((charge) => charge.id) } },
          data: { status: "CANCELLED" },
        });
      }

      const chargeRows = [];
      for (const student of eligibleStudents) {
        const account = accountByStudent.get(student.id);
        for (const component of structure.components) {
          for (const installment of installmentsForStudent(component, structure, student)) {
            const priorKey = `${student.id}:${component.code}:${installment.month}`;
            if (protectedPriorCharges.has(priorKey)) continue;
            chargeRows.push({
              schoolId,
              studentId: student.id,
              feeAccountId: account.id,
              feeStructureId: structure.id,
              feeComponentId: component.id,
              academicSession: structure.academicSession,
              installmentName: installment.installmentName,
              dueDate: installment.dueDate,
              baseAmountMinor: installment.amountMinor,
              status: installment.dueDate < new Date() ? "OVERDUE" : "UPCOMING",
              calculationSnapshot: {
                componentCode: component.code,
                structureVersion: structure.version,
                scheduleMonth: installment.month,
              },
            });
          }
        }
      }
      const createdResult = chargeRows.length ? await tx.studentFeeCharge.createMany({
        data: chargeRows,
        skipDuplicates: true,
      }) : { count: 0 };
      const created = createdResult.count;

      const allocatedCharges = eligibleStudents.length ? await tx.studentFeeCharge.findMany({
        where: {
          schoolId,
          feeStructureId: structure.id,
          studentId: { in: eligibleStudentIds },
        },
        select: {
          id: true,
          studentId: true,
          feeAccountId: true,
          installmentName: true,
          baseAmountMinor: true,
          dueDate: true,
          feeComponent: { select: { code: true } },
        },
        orderBy: [{ studentId: "asc" }, { dueDate: "asc" }, { id: "asc" }],
      }) : [];
      const referenceIds = [
        ...cancellable.map((charge) => charge.id),
        ...allocatedCharges.map((charge) => charge.id),
      ];
      const existingLedgerReferences = referenceIds.length ? await tx.feeLedgerEntry.findMany({
        where: {
          schoolId,
          referenceId: { in: referenceIds },
          entryType: { in: ["CHARGE", "CREDIT_NOTE"] },
        },
        select: { referenceType: true, referenceId: true },
      }) : [];
      const ledgerKey = (referenceType, referenceId) => `${referenceType}:${referenceId}`;
      const existingLedgerKeys = new Set(existingLedgerReferences.map((entry) => ledgerKey(entry.referenceType, entry.referenceId)));
      const balanceRows = accounts.length ? await tx.feeLedgerEntry.groupBy({
        by: ["feeAccountId"],
        where: { feeAccountId: { in: accounts.map((account) => account.id) } },
        _sum: { debitMinor: true, creditMinor: true },
      }) : [];
      const runningBalance = new Map(accounts.map((account) => [account.id, 0n]));
      for (const row of balanceRows) {
        runningBalance.set(
          row.feeAccountId,
          BigInt(row._sum.debitMinor || 0) - BigInt(row._sum.creditMinor || 0),
        );
      }
      const ledgerRows = [];
      for (const oldCharge of cancellable) {
        const creditMinor = calculateCharge(oldCharge).payableMinor;
        const account = accountByStudent.get(oldCharge.studentId);
        const key = ledgerKey("FeeRevisionCancellation", oldCharge.id);
        if (!account || creditMinor <= 0n || existingLedgerKeys.has(key)) continue;
        const balanceMinor = (runningBalance.get(account.id) || 0n) - creditMinor;
        runningBalance.set(account.id, balanceMinor);
        ledgerRows.push({
          schoolId,
          studentId: oldCharge.studentId,
          feeAccountId: account.id,
          academicSession: structure.academicSession,
          entryType: "CREDIT_NOTE",
          referenceType: "FeeRevisionCancellation",
          referenceId: oldCharge.id,
          referenceNumber: structure.code,
          description: `Revision cancelled: ${oldCharge.installmentName}`,
          creditMinor,
          balanceMinor,
          createdById: req.user.id,
        });
      }
      for (const charge of allocatedCharges) {
        const key = ledgerKey("StudentFeeCharge", charge.id);
        if (existingLedgerKeys.has(key)) continue;
        const balanceMinor = (runningBalance.get(charge.feeAccountId) || 0n) + BigInt(charge.baseAmountMinor);
        runningBalance.set(charge.feeAccountId, balanceMinor);
        ledgerRows.push({
          schoolId,
          studentId: charge.studentId,
          feeAccountId: charge.feeAccountId,
          academicSession: structure.academicSession,
          entryType: "CHARGE",
          referenceType: "StudentFeeCharge",
          referenceId: charge.id,
          referenceNumber: charge.feeComponent?.code,
          description: charge.installmentName,
          debitMinor: charge.baseAmountMinor,
          balanceMinor,
          createdById: req.user.id,
        });
      }
      if (ledgerRows.length) {
        await tx.feeLedgerEntry.createMany({ data: ledgerRows, skipDuplicates: true });
      }
      await recordAudit(
        tx,
        req,
        "FEE_ASSIGNMENT_PUBLISHED",
        "FeeAssignment",
        assignment.id,
        { affectedStudents: students.length, chargesCreated: created },
      );
      if (previousStructureIds.length) {
        await tx.feeStructure.updateMany({
          where: { id: { in: previousStructureIds }, schoolId, status: "PUBLISHED" },
          data: { status: "ARCHIVED" },
        });
        await tx.feeAssignment.updateMany({
          where: {
            schoolId,
            academicSession: structure.academicSession,
            feeStructureId: { in: previousStructureIds },
            targetType: assignment.targetType,
            targetValue: assignment.targetValue,
            active: true,
          },
          data: { active: false, effectiveTo: new Date() },
        });
      }
      return {
        assignment,
        affectedStudents: students.length,
        chargesCreated: created,
      };
    },
    { isolationLevel: "Serializable", maxWait: 10000, timeout: 120000 },
  );

export const syncNewStudentFeeAssignments = async (req, student) => {
  const schoolId = schoolIdOf(req.user);
  if (!student || student.schoolId !== schoolId) throw Object.assign(new Error("Student tenant mismatch"), { status: 403 });
  const assignments = await prisma.feeAssignment.findMany({
    where: {
      schoolId,
      academicSession: student.session,
      active: true,
      feeStructure: { status: "PUBLISHED" },
    },
    orderBy: { priority: "desc" },
  });
  const applicable = assignments.filter((assignment) => assignmentMatches(assignment, student));
  if (!applicable.length) return { assignments: 0, chargesCreated: 0 };
  const highestPriority = applicable[0].priority;
  const selected = applicable.filter((assignment) => assignment.priority === highestPriority);
  let chargesCreated = 0;
  for (const assignment of selected) {
    const result = await createAssignmentAndCharges(req, {
      feeStructureId: assignment.feeStructureId,
      targetType: assignment.targetType,
      targetValue: assignment.targetValue,
      studentId: assignment.studentId,
    });
    chargesCreated += result.chargesCreated;
  }
  return { assignments: selected.length, chargesCreated };
};
