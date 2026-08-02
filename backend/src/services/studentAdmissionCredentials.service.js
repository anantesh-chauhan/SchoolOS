import prisma from '../config/prisma.client.js';
import bcrypt from 'bcrypt';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { randomBytes } from 'crypto';
import { formatParentUserId, formatStudentUserId } from './identity.service.js';
import { PASSWORD_SALT_ROUNDS, trimToNull, trimRequired, firstDefined, normalizeDigits, isTenDigitMobile, createAdmissionNumber, buildStudentUserId, buildParentUserId, buildPlainPasswords, rollNumberValue, resequenceSectionRollNumbers, buildPdfBuffer, validateAdmissionPayload } from './studentAdmission.shared.js';

export const generateStudentCredentials = async ({ id, schoolId, forceRegenerate = false }) => {
  const student = await prisma.student.findUnique({
    where: { id },
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

  if (!student.admissionNo) {
    const error = new Error('Admission number is required before generating credentials');
    error.statusCode = 400;
    throw error;
  }

  if (!forceRegenerate && student.studentPasswordHash && student.parentPasswordHash) {
    return {
      student,
      credentials: {
        admissionNo: student.admissionNo,
        studentUserId: student.studentUserId,
        parentUserId: student.parentUserId,
        studentPassword: null,
        parentPassword: null,
        alreadyGenerated: true,
      },
    };
  }

  const nextStudentUserId = student.studentUserId || buildStudentUserId({
    firstName: student.studentFirstName,
    session: student.session,
    admissionNo: student.admissionNo,
    schoolCode: student.school.schoolCode,
  });

  const nextParentUserId = student.parentUserId || buildParentUserId({
    fatherName: student.fatherName,
    studentFirstName: student.studentFirstName,
    session: student.session,
    admissionNo: student.admissionNo,
    schoolCode: student.school.schoolCode,
  });

  const plainPasswords = buildPlainPasswords({
    firstName: student.studentFirstName,
    fatherName: student.fatherName,
    admissionNo: student.admissionNo,
  });

  const [studentPasswordHash, parentPasswordHash] = await Promise.all([
    bcrypt.hash(plainPasswords.studentPassword, PASSWORD_SALT_ROUNDS),
    bcrypt.hash(plainPasswords.parentPassword, PASSWORD_SALT_ROUNDS),
  ]);

  const updatedStudent = await prisma.student.update({
    where: { id },
    data: {
      studentUserId: nextStudentUserId,
      parentUserId: nextParentUserId,
      studentPasswordHash,
      parentPasswordHash,
      passwordGenerated: true,
      lastPasswordGeneratedAt: new Date(),
      studentMustChangePassword: true,
      parentMustChangePassword: true,
      sessionVersion: { increment: 1 },
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

  return {
    student: updatedStudent,
    credentials: {
      admissionNo: updatedStudent.admissionNo,
      studentUserId: nextStudentUserId,
      parentUserId: nextParentUserId,
      studentPassword: plainPasswords.studentPassword,
      parentPassword: plainPasswords.parentPassword,
      alreadyGenerated: false,
    },
  };
};

export const generateStudentAdmissionPdf = async ({ id, schoolId, includePasswords = false, credentials = null }) => {
  const student = await prisma.student.findUnique({
    where: { id },
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

  return await buildPdfBuffer({
    student,
    includePasswords,
    studentPassword: credentials?.studentPassword,
    parentPassword: credentials?.parentPassword,
  });
};
