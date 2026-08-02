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

const render = (text, values) =>
  text.replace(/{{(\w+)}}/g, (_, key) => values[key] ?? "");
export const saveTemplate = (req, data) =>
  prisma.feeNotificationTemplate.upsert({
    where: {
      schoolId_name: { schoolId: schoolIdOf(req.user), name: data.name },
    },
    create: {
      schoolId: schoolIdOf(req.user),
      createdById: req.user.id,
      ...data,
    },
    update: data,
  });
export const listTemplates = (user) =>
  prisma.feeNotificationTemplate.findMany({
    where: { schoolId: schoolIdOf(user) },
    orderBy: { name: "asc" },
  });
export const sendReminders = async (req, data) => {
  const schoolId = schoolIdOf(req.user);
  const template = await prisma.feeNotificationTemplate.findFirst({
    where: { id: data.templateId, schoolId, active: true },
  });
  if (!template)
    throw Object.assign(new Error("Template not found"), { status: 404 });
  const charges = await prisma.studentFeeCharge.findMany({
    where: {
      schoolId,
      academicSession: data.academicSession,
      status: { in: data.statuses || ["OVERDUE", "PARTIALLY_PAID", "DUE"] },
      ...(data.studentIds?.length
        ? { studentId: { in: data.studentIds } }
        : {}),
    },
    include: { student: true },
  });
  const unique = new Map(charges.map((c) => [c.studentId, c]));
  const rows = [...unique.values()].map((c) => ({
    schoolId,
    studentId: c.studentId,
    academicSession: c.academicSession,
    type: template.type,
    title: render(template.title, {
      studentName: c.student.studentFirstName,
      dueAmount: Number(c.baseAmountMinor) / 100,
    }),
    message: render(template.body, {
      studentName: c.student.studentFirstName,
      parentName: c.student.fatherName,
      class: c.student.className,
      section: c.student.section || "",
      dueAmount: (Number(c.baseAmountMinor) / 100).toFixed(2),
      dueDate: c.dueDate.toLocaleDateString(),
      installmentName: c.installmentName,
    }),
    sentById: req.user.id,
  }));
  if (rows.length) await prisma.feeReminder.createMany({ data: rows });
  await Promise.all(rows.map((row) => createSystemNotification({ schoolId, type: row.type, category: 'FEE', priority: 'HIGH', title: row.title, message: row.message, actionUrl: '/parent/fees', sourceModule: 'FEES', sourceEntityType: 'FEE_REMINDER', sourceEntityId: row.studentId, dedupeKey: `${row.type}:${row.studentId}:${data.academicSession}:${new Date().toISOString().slice(0,10)}`, students: [row.studentId], roles: ['PARENT','STUDENT'], mandatory: true })));
  return { sent: rows.length, channel: "IN_APP" };
};

export const teacherSections = async (user) => {
  const teacher = await getTeacherForUser(user);
  if (!teacher)
    throw Object.assign(new Error("Teacher profile not found"), {
      status: 403,
    });
  const assignments = await prisma.teacherAssignment.findMany({
    where: {
      schoolId: user.schoolId,
      teacherId: teacher.id,
      isActive: true,
      OR: [{ effectiveTo: null }, { effectiveTo: { gte: new Date() } }],
    },
    include: { class: true, section: true },
    orderBy: [{ class: { classOrder: "asc" } }, { section: { sectionOrder: "asc" } }],
  });
  const sections = new Map();
  for (const assignment of assignments) {
    const current = sections.get(assignment.sectionId);
    sections.set(assignment.sectionId, {
      classId: assignment.classId,
      sectionId: assignment.sectionId,
      className: assignment.class.className,
      sectionName: assignment.section.sectionName,
      canSendReminders: Boolean(current?.canSendReminders || ["CLASS_TEACHER", "BOTH"].includes(assignment.roleType)),
      assignmentRoles: [...new Set([...(current?.assignmentRoles || []), assignment.roleType])],
    });
  }
  return [...sections.values()];
};
export const teacherSectionFees = async (user, sectionId, academicSession) => {
  const section = await prisma.section.findFirst({
    where: { id: sectionId, schoolId: user.schoolId, deletedAt: null },
  });
  if (!section)
    throw Object.assign(new Error("Section not found"), { status: 404 });
  await requireSchoolAdminOrAssignedTeacherForSection(user, {
    schoolId: user.schoolId,
    classId: section.classId,
    sectionId,
  });
  const classRow = await prisma.class.findUnique({
    where: { id: section.classId },
  });
  const students = await prisma.student.findMany({
    where: {
      schoolId: user.schoolId,
      className: classRow.className,
      section: section.sectionName,
      isActive: true,
      ...(academicSession ? { session: academicSession } : {}),
    },
    include: {
      feeAccounts: {
        where: academicSession ? { academicSession } : undefined,
        include: { charges: { include: { feeComponent: { select: { name: true, code: true } } } } },
        take: 1,
      },
    },
    orderBy: [{ rollNumber: "asc" }, { studentFirstName: "asc" }],
  });
  const rows = students.map((s) => {
      const charges = s.feeAccounts[0]?.charges || [];
      const activeCharges = charges.filter((charge) => !["CANCELLED", "REFUNDED"].includes(charge.status));
      const totals = activeCharges.reduce((sum, charge) => {
        const calculated = calculateCharge(charge);
        sum.expectedMinor += calculated.netMinor;
        sum.paidMinor += BigInt(charge.paidMinor);
        sum.dueMinor += calculated.payableMinor;
        if (calculated.payableMinor > 0n && charge.dueDate < new Date()) sum.overdueMinor += calculated.payableMinor;
        return sum;
      }, { expectedMinor: 0n, paidMinor: 0n, dueMinor: 0n, overdueMinor: 0n });
      const next = activeCharges
        .filter((c) => calculateCharge(c).payableMinor > 0n)
        .sort((a, b) => a.dueDate - b.dueDate)[0];
      return {
        id: s.id,
        name: `${s.studentFirstName} ${s.studentLastName || ""}`.trim(),
        parentName: s.fatherName,
        parentMobile: s.parentMobile,
        admissionNo: s.admissionNo,
        rollNumber: s.rollNumber,
        ...totals,
        feeStatus: totals.expectedMinor === 0n ? "NOT_ASSIGNED" : totals.dueMinor === 0n ? "PAID" : totals.paidMinor > 0n ? "PARTIALLY_PAID" : totals.overdueMinor > 0n ? "OVERDUE" : "PENDING",
        nextDue: next
          ? {
              installmentName: next.installmentName,
              dueDate: next.dueDate,
              amountMinor: calculateCharge(next).payableMinor,
            }
          : null,
      };
    });
  const summary = rows.reduce((sum, row) => ({
    expectedMinor: sum.expectedMinor + row.expectedMinor,
    paidMinor: sum.paidMinor + row.paidMinor,
    dueMinor: sum.dueMinor + row.dueMinor,
    overdueMinor: sum.overdueMinor + row.overdueMinor,
    students: sum.students + 1,
    paidStudents: sum.paidStudents + (row.feeStatus === "PAID" ? 1 : 0),
    studentsWithDues: sum.studentsWithDues + (row.dueMinor > 0n ? 1 : 0),
  }), { expectedMinor: 0n, paidMinor: 0n, dueMinor: 0n, overdueMinor: 0n, students: 0, paidStudents: 0, studentsWithDues: 0 });
  const assignmentRows = await prisma.feeAssignment.findMany({
    where: {
      schoolId: user.schoolId,
      academicSession,
      active: true,
      feeStructure: { status: "PUBLISHED" },
      OR: [
        { targetType: "SCHOOL" },
        { targetType: "CLASS", targetValue: classRow.className },
        { targetType: "SECTION", targetValue: { in: [section.sectionName, `${classRow.className}:${section.sectionName}`] } },
      ],
    },
    include: { feeStructure: { include: { components: { where: { active: true }, orderBy: { displayOrder: "asc" } } } } },
    orderBy: { priority: "desc" },
  });
  return safe({
    section: { id: section.id, classId: classRow.id, className: classRow.className, sectionName: section.sectionName, academicSession },
    summary,
    structures: assignmentRows.map((assignment) => ({
      ...assignment.feeStructure,
      assignment: { id: assignment.id, targetType: assignment.targetType, targetValue: assignment.targetValue },
    })),
    students: rows,
  });
};

export const teacherStudentFees = async (user, studentId, academicSession) => {
  const student = await prisma.student.findFirst({
    where: { id: studentId, schoolId: user.schoolId, isActive: true },
    select: { id: true, className: true, section: true, session: true },
  });
  if (!student) throw Object.assign(new Error("Student not found"), { status: 404 });
  const classRow = await prisma.class.findFirst({ where: { schoolId: user.schoolId, className: student.className, deletedAt: null } });
  const section = await prisma.section.findFirst({ where: { schoolId: user.schoolId, classId: classRow?.id, sectionName: student.section, deletedAt: null } });
  if (!classRow || !section) throw Object.assign(new Error("Student section is not configured"), { status: 404 });
  await requireSchoolAdminOrAssignedTeacherForSection(user, {
    schoolId: user.schoolId,
    classId: classRow.id,
    sectionId: section.id,
  });
  return getStudentFees(user, student.id, academicSession || student.session);
};
export const teacherSendReminder = async (req, data) => {
  const section = await prisma.section.findFirst({ where: { id: data.sectionId, schoolId: req.user.schoolId, deletedAt: null } });
  if (!section) throw Object.assign(new Error("Section not found"), { status: 404 });
  await assertTeacherIsClassTeacherForSection(req.user, { schoolId: req.user.schoolId, classId: section.classId, sectionId: section.id });
  const overview = await teacherSectionFees(
    req.user,
    data.sectionId,
    data.academicSession,
  );
  const rows = overview.students;
  const selected = data.studentIds?.length
    ? rows.filter((s) => data.studentIds.includes(s.id) && s.dueMinor > 0)
    : rows.filter((s) => s.dueMinor > 0);
  const reminders = selected.map((s) => ({
    schoolId: req.user.schoolId,
    studentId: s.id,
    academicSession: data.academicSession,
    type: "TEACHER_FEE_REMINDER",
    title: data.title || "Fee payment reminder",
    message: `Dear ${s.parentName || "Parent"}, a fee amount of ₹${(Number(s.dueMinor) / 100).toFixed(2)} is pending for ${s.name}${s.admissionNo ? ` (${s.admissionNo})` : ""}.${s.nextDue ? ` Due detail: ${s.nextDue.installmentName}, due ${new Date(s.nextDue.dueDate).toLocaleDateString()}.` : ""}${data.message ? ` ${data.message}` : ""}`,
    channel: "IN_APP",
    status: "SENT",
    sentById: req.user.id,
  }));
  if (reminders.length)
    await prisma.feeReminder.createMany({ data: reminders });
  await Promise.all(reminders.map((row) => createSystemNotification({ schoolId: req.user.schoolId, type: row.type, category: 'FEE', priority: 'HIGH', title: row.title, message: row.message, actionUrl: '/parent/fees', sourceModule: 'FEES', sourceEntityType: 'FEE_REMINDER', sourceEntityId: row.studentId, dedupeKey: `${row.type}:${row.studentId}:${data.academicSession}:${new Date().toISOString().slice(0,10)}`, students: [row.studentId], roles: ['PARENT','STUDENT'], mandatory: true })));
  return {
    sent: reminders.length,
    channel: "IN_APP",
    recipients: selected.map((s) => ({
      studentId: s.id,
      parentMobile: s.parentMobile,
    })),
  };
};
