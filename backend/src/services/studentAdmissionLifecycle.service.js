import prisma from '../config/prisma.client.js';
import bcrypt from 'bcrypt';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { randomBytes } from 'crypto';
import { formatParentUserId, formatStudentUserId } from './identity.service.js';
import { PASSWORD_SALT_ROUNDS, trimToNull, trimRequired, firstDefined, normalizeDigits, isTenDigitMobile, createAdmissionNumber, buildStudentUserId, buildParentUserId, buildPlainPasswords, rollNumberValue, resequenceSectionRollNumbers, buildPdfBuffer, validateAdmissionPayload } from './studentAdmission.shared.js';

export const promoteStudentAdmission = async ({ id, schoolId, payload }) => {
  return await prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({
      where: { id },
    });

    if (!student) {
      const error = new Error('Student not found');
      error.statusCode = 404;
      throw error;
    }

    if (student.schoolId !== schoolId) {
      const error = new Error('Unauthorized access to student');
      error.statusCode = 403;
      throw error;
    }

    await tx.studentAcademicHistory.create({
      data: {
        studentId: student.id,
        className: student.className,
        section: student.section,
        session: student.session,
        rollNumber: student.rollNumber,
      },
    });

    const updated = await tx.student.update({
      where: { id },
      data: {
        className: trimRequired(payload.className || payload.currentClass || student.className),
        section: trimToNull(payload.section),
        session: trimRequired(payload.session || student.session),
        rollNumber: trimToNull(payload.rollNumber),
      },
      include: {
        school: {
          select: {
            id: true,
            schoolName: true,
            schoolCode: true,
          },
        },
      },
    });

    return updated;
  });
};

export const softDeleteStudentAdmission = async ({ id, schoolId }) => {
  return prisma.$transaction(async (tx) => {
    const student = await tx.student.findUnique({ where: { id } });

    if (!student) {
      const error = new Error('Student not found');
      error.statusCode = 404;
      throw error;
    }

    if (student.schoolId !== schoolId) {
      const error = new Error('Unauthorized access to student');
      error.statusCode = 403;
      throw error;
    }

    const deactivated = await tx.student.update({
      where: { id },
      data: { isActive: false, rollNumber: null },
    });

    await resequenceSectionRollNumbers(tx, student);
    return deactivated;
  });
};

export const allocateStudentAdmission = async ({ id, schoolId, classId, sectionId, session }) => {
  return prisma.$transaction(async (tx) => {
    const [student, classRow, sectionRow] = await Promise.all([
      tx.student.findFirst({ where: { id, schoolId, isActive: true } }),
      tx.class.findFirst({ where: { id: classId, schoolId, deletedAt: null } }),
      tx.section.findFirst({ where: { id: sectionId, schoolId, classId, deletedAt: null } }),
    ]);

    if (!student) {
      const error = new Error('Active student not found');
      error.statusCode = 404;
      throw error;
    }
    if (!classRow || !sectionRow) {
      const error = new Error('The selected class and section are not valid for this school');
      error.statusCode = 400;
      throw error;
    }

    const oldCohort = {
      schoolId,
      className: student.className,
      section: student.section,
      session: student.session,
    };
    const nextSession = trimRequired(session || student.session);
    const sameCohort = student.className === classRow.className
      && student.section === sectionRow.sectionName
      && student.session === nextSession;

    if (!sameCohort) {
      await tx.student.update({
        where: { id },
        data: {
          className: classRow.className,
          section: sectionRow.sectionName,
          session: nextSession,
          rollNumber: null,
        },
      });
      await resequenceSectionRollNumbers(tx, oldCohort);
    }

    await resequenceSectionRollNumbers(tx, {
      schoolId,
      className: classRow.className,
      section: sectionRow.sectionName,
      session: nextSession,
    });

    return tx.student.findUnique({
      where: { id },
      select: {
        id: true,
        admissionNo: true,
        studentFirstName: true,
        studentLastName: true,
        studentUserId: true,
        parentUserId: true,
        className: true,
        section: true,
        session: true,
        rollNumber: true,
      },
    });
  });
};
