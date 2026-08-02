import prisma from '../config/prisma.client.js';
import bcrypt from 'bcrypt';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { randomBytes } from 'crypto';
import { formatParentUserId, formatStudentUserId } from './identity.service.js';
import { PASSWORD_SALT_ROUNDS, trimToNull, trimRequired, firstDefined, normalizeDigits, isTenDigitMobile, createAdmissionNumber, buildStudentUserId, buildParentUserId, buildPlainPasswords, rollNumberValue, resequenceSectionRollNumbers, buildPdfBuffer, validateAdmissionPayload } from './studentAdmission.shared.js';

export const createStudentAdmission = async ({ schoolId, payload }) => {
  const validationErrors = validateAdmissionPayload(payload);
  if (Object.keys(validationErrors).length > 0) {
    const error = new Error('Validation failed');
    error.statusCode = 400;
    error.errors = validationErrors;
    throw error;
  }

  const studentFirstName = firstDefined(payload.studentFirstName, payload.firstName);
  const fatherName = firstDefined(payload.fatherName, payload.father_name, payload.parentName);
  const parentMobile = firstDefined(payload.parentMobile, payload.parent_mobile, payload.mobile);
  const className = firstDefined(payload.currentClass, payload.className, payload.studentClass);
  const session = firstDefined(payload.session, payload.academicSession);
  const admissionDate = firstDefined(payload.admissionDate, payload.admission_date);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(async (tx) => {
        const school = await tx.school.findUnique({
          where: { id: schoolId },
          select: { schoolCode: true },
        });

        if (!school) {
          const error = new Error('School not found');
          error.statusCode = 404;
          throw error;
        }

        const admissionNo = await createAdmissionNumber(tx);
        const studentUserId = buildStudentUserId({ firstName: studentFirstName, session, admissionNo, schoolCode: school.schoolCode });
        const parentUserId = buildParentUserId({ fatherName, studentFirstName, session, admissionNo, schoolCode: school.schoolCode });
        const { studentPassword, parentPassword } = buildPlainPasswords({
          firstName: studentFirstName,
          fatherName,
          admissionNo,
        });

        const [studentPasswordHash, parentPasswordHash] = await Promise.all([
          bcrypt.hash(studentPassword, PASSWORD_SALT_ROUNDS),
          bcrypt.hash(parentPassword, PASSWORD_SALT_ROUNDS),
        ]);

        const student = await tx.student.create({
          data: {
            schoolId,
            admissionNo,
            studentFirstName: trimRequired(studentFirstName),
            studentLastName: trimToNull(payload.studentLastName),
            dob: new Date(payload.dob),
            gender: trimRequired(payload.gender),
            bloodGroup: trimToNull(payload.bloodGroup),
            category: trimToNull(payload.category),
            religion: trimToNull(payload.religion),
            mobile: trimToNull(payload.mobile),
            email: trimToNull(payload.email),
            address: trimToNull(payload.address),
            city: trimToNull(payload.city),
            state: trimToNull(payload.state),
            pincode: trimToNull(payload.pincode),
            fatherName: trimRequired(fatherName),
            motherName: trimToNull(payload.motherName),
            parentMobile: normalizeDigits(parentMobile),
            alternateMobile: trimToNull(payload.alternateMobile),
            parentEmail: trimToNull(payload.parentEmail),
            occupation: trimToNull(payload.occupation),
            className: trimRequired(className),
            section: trimToNull(payload.section),
            rollNumber: trimToNull(payload.rollNumber),
            session: trimRequired(session),
            admissionDate: admissionDate ? new Date(admissionDate) : new Date(),
            studentUserId,
            parentUserId,
            studentPasswordHash,
            parentPasswordHash,
            passwordGenerated: true,
            lastPasswordGeneratedAt: new Date(),
            studentMustChangePassword: true,
            parentMustChangePassword: true,
            isActive: true,
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
          student,
          credentials: {
            admissionNo,
            studentUserId,
            parentUserId,
            studentPassword,
            parentPassword,
          },
        };
      });
    } catch (error) {
      if (error.code === 'P2002' && attempt < 2) {
        continue;
      }

      throw error;
    }
  }
};

export const updateStudentAdmission = async ({ id, schoolId, role, actorStudentId, payload }) => {
  const student = await prisma.student.findUnique({
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

  const editableFieldsByRole = {
    ADMIN: [
      'studentFirstName',
      'studentLastName',
      'dob',
      'gender',
      'bloodGroup',
      'category',
      'religion',
      'mobile',
      'email',
      'address',
      'city',
      'state',
      'pincode',
      'fatherName',
      'motherName',
      'parentMobile',
      'alternateMobile',
      'parentEmail',
      'occupation',
      'className',
      'section',
      'rollNumber',
      'session',
      'isActive',
    ],
    STUDENT: ['address', 'email', 'mobile'],
    PARENT: ['alternateMobile', 'address'],
  };
  editableFieldsByRole.SCHOOL_OWNER = editableFieldsByRole.ADMIN;

  const roleKey = editableFieldsByRole[role] ? role : null;

  if (!roleKey) {
    const error = new Error('Unauthorized');
    error.statusCode = 403;
    throw error;
  }

  if ((role === 'STUDENT' || role === 'PARENT') && actorStudentId && actorStudentId !== id) {
    const error = new Error('Unauthorized access to student');
    error.statusCode = 403;
    throw error;
  }

  const allowedFields = new Set(editableFieldsByRole[roleKey]);
  const updates = {};
  const blockedFields = [];

  for (const [key, value] of Object.entries(payload)) {
    if (value === undefined) {
      continue;
    }

    if (!allowedFields.has(key)) {
      blockedFields.push(key);
      continue;
    }

    if (['studentFirstName', 'studentLastName', 'gender', 'bloodGroup', 'category', 'religion', 'email', 'address', 'city', 'state', 'pincode', 'fatherName', 'motherName', 'alternateMobile', 'parentEmail', 'occupation', 'className', 'section', 'rollNumber', 'session'].includes(key)) {
      updates[key] = trimToNull(value);
      continue;
    }

    if (key === 'dob') {
      updates.dob = new Date(value);
      continue;
    }

    if (key === 'mobile' || key === 'parentMobile') {
      updates[key] = normalizeDigits(value);
      continue;
    }

    if (key === 'isActive') {
      updates.isActive = Boolean(value);
    }
  }

  if (blockedFields.length > 0 && roleKey !== 'ADMIN') {
    const error = new Error(`Restricted fields: ${blockedFields.join(', ')}`);
    error.statusCode = 403;
    throw error;
  }

  if (updates.mobile && !isTenDigitMobile(updates.mobile)) {
    const error = new Error('Mobile must be exactly 10 digits');
    error.statusCode = 400;
    throw error;
  }

  if (updates.parentMobile && !isTenDigitMobile(updates.parentMobile)) {
    const error = new Error('Parent mobile must be exactly 10 digits');
    error.statusCode = 400;
    throw error;
  }

  const updatedStudent = await prisma.student.update({
    where: { id },
    data: updates,
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

  return updatedStudent;
};
