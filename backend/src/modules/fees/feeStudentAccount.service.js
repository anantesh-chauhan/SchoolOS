import crypto from "node:crypto";
import prisma from "../../config/prisma.client.js";
import {
  allocatePayment,
  calculateCharge,
  serializeMoney,
} from "./feeCalculation.service.js";
import { adminRoles, json, tenant, audit } from "./fee.shared.js";

export const searchStudents = (user, query = "") =>
  prisma.student.findMany({
    where: {
      schoolId: tenant(user),
      isActive: true,
      ...(query
        ? {
            OR: [
              { studentFirstName: { contains: query, mode: "insensitive" } },
              { studentLastName: { contains: query, mode: "insensitive" } },
              { admissionNo: { contains: query, mode: "insensitive" } },
              { studentUserId: { contains: query, mode: "insensitive" } },
              { parentMobile: { contains: query } },
              { rollNumber: { contains: query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      studentFirstName: true,
      studentLastName: true,
      admissionNo: true,
      studentUserId: true,
      className: true,
      section: true,
      rollNumber: true,
      fatherName: true,
      parentMobile: true,
      session: true,
    },
    take: 30,
  });

export const getStudentFees = async (
  user,
  requestedStudentId,
  academicSession,
) => {
  const schoolId = tenant(user);

  let studentId = requestedStudentId;
  if (["STUDENT", "PARENT"].includes(user.role)) {
    // STUDENT: can only view their own fees.
    if (user.role === "STUDENT") {
      studentId = user.studentId;
    }

    // PARENT: can choose a linked child; ownership is enforced below.
    if (user.role === "PARENT") {
      studentId = requestedStudentId;
      if (!studentId)
        throw Object.assign(new Error("studentId is required"), {
          status: 400,
        });
      const familyLink = await prisma.feeFamilyLink.findFirst({
        where: {
          schoolId,
          parentUserId: { in: [user.id, user.email].filter(Boolean) },
          studentId,
          active: true,
        },
        select: { id: true },
      });
      if (!familyLink) {
        throw Object.assign(new Error("Student not found"), { status: 404 });
      }
    }
  }

  if (!studentId)
    throw Object.assign(new Error("studentId is required"), { status: 400 });

  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId, isActive: true },
    select: {
      id: true,
      studentFirstName: true,
      studentLastName: true,
      admissionNo: true,
      studentUserId: true,
      className: true,
      section: true,
      fatherName: true,
      parentMobile: true,
      session: true,
    },
  });

  if (!student)
    throw Object.assign(new Error("Student not found"), { status: 404 });
  const session = academicSession || student.session;
  const account = await prisma.studentFeeAccount.findUnique({
    where: {
      schoolId_studentId_academicSession: {
        schoolId,
        studentId,
        academicSession: session,
      },
    },
    include: {
      charges: {
        orderBy: { dueDate: "asc" },
        include: { feeComponent: { select: { name: true, code: true } } },
      },
      payments: {
        orderBy: { paymentDate: "desc" },
        include: {
          receipt: { select: { id: true, receiptNumber: true, status: true } },
          allocations: true,
        },
      },
      ledgerEntries: { orderBy: { createdAt: "desc" }, take: 100 },
    },
  });
  const assignments = await prisma.feeAssignment.findMany({
    where: {
      schoolId,
      academicSession: session,
      active: true,
      feeStructure: { status: "PUBLISHED" },
      OR: [
        { studentId },
        { targetType: "SCHOOL" },
        { targetType: "CLASS", targetValue: student.className },
        {
          targetType: "SECTION",
          targetValue: {
            in: [
              student.section || "",
              `${student.className}:${student.section || ""}`,
            ],
          },
        },
      ],
    },
    include: {
      feeStructure: {
        include: {
          components: {
            where: { active: true },
            orderBy: { displayOrder: "asc" },
          },
        },
      },
    },
    orderBy: { priority: "desc" },
  });
  const [invoices, refunds, transportAssignments] = await Promise.all([
    prisma.feeInvoice.findMany({
      where: { schoolId, studentId, academicSession: session },
      include: { items: true },
      orderBy: { dueDate: "desc" },
      take: 100,
    }),
    prisma.feeRefund.findMany({
      where: { schoolId, studentId, payment: { academicSession: session } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.transportFeeAssignment.findMany({
      where: { schoolId, studentId, academicSession: session },
      include: {
        route: { select: { name: true, code: true, vehicleNumber: true } },
        pickupStop: { select: { name: true } },
        dropStop: { select: { name: true } },
      },
      orderBy: { startDate: "desc" },
    }),
  ]);
  const activeCharges = (account?.charges || []).filter((charge) => !["CANCELLED", "REFUNDED"].includes(charge.status));
  const totals = activeCharges.reduce(
    (sum, charge) => {
      const breakdown = calculateCharge(charge);
      sum.expected += breakdown.netMinor;
      sum.paid += BigInt(charge.paidMinor);
      sum.pending += breakdown.payableMinor;
      return sum;
    },
    { expected: 0n, paid: 0n, pending: 0n },
  );
  return json({
    student,
    account,
    totals,
    invoices,
    refunds,
    transportAssignments,
    assignedStructures: assignments.map((row) => ({ ...row.feeStructure, assignment: { id: row.id, targetType: row.targetType, effectiveFrom: row.effectiveFrom, effectiveTo: row.effectiveTo } })),
    assignedStructure: assignments.find((row) => !row.feeStructure.components.every((component) => component.feeType === "TRANSPORT" || component.code === "TRANSPORT"))?.feeStructure || assignments[0]?.feeStructure || null,
    assignment: assignments[0] || null,
    onlinePayment: { enabled: false, label: "Coming Soon" },
  });
};

export const getFeeHierarchy = async (user, academicSession) => {
  const schoolId = tenant(user);
  const [classes, students] = await Promise.all([
    prisma.class.findMany({
      where: { schoolId, deletedAt: null },
      include: {
        sections: {
          where: { deletedAt: null },
          orderBy: { sectionOrder: "asc" },
        },
      },
      orderBy: { classOrder: "asc" },
    }),
    prisma.student.findMany({
      where: {
        schoolId,
        isActive: true,
        ...(academicSession ? { session: academicSession } : {}),
      },
      include: {
        feeAccounts: {
          where: academicSession ? { academicSession } : undefined,
          include: { charges: true },
          take: 1,
        },
      },
      orderBy: [
        { className: "asc" },
        { section: "asc" },
        { rollNumber: "asc" },
        { studentFirstName: "asc" },
      ],
    }),
  ]);
  const summarize = (student) => {
    const account = student.feeAccounts[0];
    const totals = (account?.charges || []).reduce(
      (sum, charge) => {
        const c = calculateCharge(charge);
        sum.expected += c.netMinor;
        sum.paid += BigInt(charge.paidMinor);
        sum.pending += c.payableMinor;
        if (charge.status === "OVERDUE") sum.overdue += c.payableMinor;
        return sum;
      },
      { expected: 0n, paid: 0n, pending: 0n, overdue: 0n },
    );
    return {
      id: student.id,
      name: `${student.studentFirstName} ${student.studentLastName || ""}`.trim(),
      admissionNo: student.admissionNo,
      studentUserId: student.studentUserId,
      rollNumber: student.rollNumber,
      parentName: student.fatherName,
      parentMobile: student.parentMobile,
      className: student.className,
      section: student.section,
      session: student.session,
      feeStatus:
        totals.expected === 0n
          ? "NOT_ASSIGNED"
          : totals.pending === 0n
            ? "PAID"
            : totals.paid > 0n
              ? "PARTIALLY_PAID"
              : totals.overdue > 0n
                ? "OVERDUE"
                : "PENDING",
      totals,
    };
  };
  const addTotals = (rows) =>
    rows.reduce(
      (sum, row) => ({
        expected: sum.expected + row.totals.expected,
        paid: sum.paid + row.totals.paid,
        pending: sum.pending + row.totals.pending,
        overdue: sum.overdue + row.totals.overdue,
      }),
      { expected: 0n, paid: 0n, pending: 0n, overdue: 0n },
    );
  const hierarchy = classes.map((classRow) => {
    const sections = classRow.sections.map((section) => {
      const sectionStudents = students
        .filter(
          (student) =>
            student.className === classRow.className &&
            student.section === section.sectionName,
        )
        .map(summarize);
      return {
        id: section.id,
        sectionName: section.sectionName,
        students: sectionStudents,
        totals: addTotals(sectionStudents),
      };
    });
    return {
      id: classRow.id,
      className: classRow.className,
      sections,
      totals: addTotals(sections),
    };
  });
  const unplaced = students
    .filter(
      (student) =>
        !classes.some(
          (classRow) =>
            classRow.className === student.className &&
            classRow.sections.some(
              (section) => section.sectionName === student.section,
            ),
        ),
    )
    .map(summarize);
  return json({
    academicSession,
    classes: hierarchy,
    unplaced,
    totals: {
      classes: hierarchy.length,
      sections: hierarchy.reduce(
        (count, row) => count + row.sections.length,
        0,
      ),
      students: students.length,
    },
  });
};
