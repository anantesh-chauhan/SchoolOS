import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { formatParentUserId, formatStudentUserId } from './identity.service.js';

const prisma = new PrismaClient();

const PASSWORD_SALT_ROUNDS = 10;

const trimToNull = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

const trimRequired = (value) => String(value ?? '').trim();

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

const normalizeDigits = (value) => String(value ?? '').replace(/\D/g, '');

const isTenDigitMobile = (value) => /^\d{10}$/.test(normalizeDigits(value));

const createAdmissionNumber = async (tx) => {
  await tx.$executeRawUnsafe(`
    ALTER TABLE "Student"
    ADD COLUMN IF NOT EXISTS "admissionNo" TEXT;
  `);

  await tx.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Student_admissionNo_key" ON "Student"("admissionNo");
  `);

  await tx.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Student_studentUserId_key" ON "Student"("studentUserId");
  `);

  await tx.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS "Student_parentUserId_key" ON "Student"("parentUserId");
  `);

  await tx.$executeRawUnsafe(`
    CREATE SEQUENCE IF NOT EXISTS admission_seq
      START WITH 1
      INCREMENT BY 1
      NO MINVALUE
      NO MAXVALUE
      CACHE 1;
  `);

  const syncRows = await tx.$queryRaw`
    SELECT COALESCE(MAX(CAST(NULLIF(regexp_replace("admissionNo", '\\D', '', 'g'), '') AS BIGINT)), 0) AS "maxNo"
    FROM "Student"
  `;
  const maxNo = Number(syncRows?.[0]?.maxNo || 0);

  if (maxNo > 0) {
    await tx.$executeRawUnsafe(`SELECT setval('admission_seq', ${maxNo}, true);`);
  }

  const rows = await tx.$queryRaw`SELECT nextval('admission_seq') AS "sequenceNo"`;
  const sequenceNo = Number(rows?.[0]?.sequenceNo || 0);
  const admissionNo = `SCH${new Date().getFullYear()}${String(sequenceNo).padStart(5, '0')}`;

  if (!admissionNo) {
    throw new Error('Failed to generate admission number');
  }

  return admissionNo;
};

const buildStudentUserId = ({ firstName, session, admissionNo, schoolCode }) => {
  return formatStudentUserId({ firstName, session, admissionNo, schoolCode });
};

const buildParentUserId = ({ fatherName, studentFirstName, session, admissionNo, schoolCode }) => {
  return formatParentUserId({ fatherName, studentFirstName, session, admissionNo, schoolCode });
};

const buildPlainPasswords = ({ firstName, fatherName, admissionNo }) => {
  const last4 = admissionNo.slice(-4);
  return {
    studentPassword: `${trimRequired(firstName)}@${last4}`,
    parentPassword: `${trimRequired(fatherName)}@${last4}`,
  };
};

const buildPdfBuffer = async ({ student, includePasswords = false, studentPassword, parentPassword }) => {
  return await new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 48 });
    const stream = new PassThrough();
    const chunks = [];

    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);

    doc.on('error', reject);
    doc.pipe(stream);

    doc.fontSize(20).text(student.school?.schoolName || 'School Admission Slip', { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(12).text(`Admission No: ${student.admissionNo || 'N/A'}`);
    doc.text(`Student User ID: ${student.studentUserId || 'N/A'}`);
    doc.text(`Parent User ID: ${student.parentUserId || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(14).text('Student Information', { underline: true });
    doc.fontSize(11);
    doc.text(`Name: ${student.studentFirstName} ${student.studentLastName || ''}`.trim());
    doc.text(`DOB: ${student.dob ? new Date(student.dob).toLocaleDateString('en-GB') : 'N/A'}`);
    doc.text(`Gender: ${student.gender || 'N/A'}`);
    doc.text(`Blood Group: ${student.bloodGroup || 'N/A'}`);
    doc.text(`Category: ${student.category || 'N/A'}`);
    doc.text(`Religion: ${student.religion || 'N/A'}`);
    doc.text(`Mobile: ${student.mobile || 'N/A'}`);
    doc.text(`Email: ${student.email || 'N/A'}`);
    doc.text(`Address: ${student.address || 'N/A'}`);
    doc.text(`City: ${student.city || 'N/A'}`);
    doc.text(`State: ${student.state || 'N/A'}`);
    doc.text(`Pincode: ${student.pincode || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(14).text('Parent Information', { underline: true });
    doc.fontSize(11);
    doc.text(`Father: ${student.fatherName}`);
    doc.text(`Mother: ${student.motherName || 'N/A'}`);
    doc.text(`Parent Mobile: ${student.parentMobile}`);
    doc.text(`Alternate Mobile: ${student.alternateMobile || 'N/A'}`);
    doc.text(`Parent Email: ${student.parentEmail || 'N/A'}`);
    doc.text(`Occupation: ${student.occupation || 'N/A'}`);
    doc.moveDown();

    doc.fontSize(14).text('Academic Information', { underline: true });
    doc.fontSize(11);
    doc.text(`Class: ${student.className}`);
    doc.text(`Section: ${student.section || 'N/A'}`);
    doc.text(`Roll Number: ${student.rollNumber || 'N/A'}`);
    doc.text(`Session: ${student.session}`);
    doc.text(`Admission Date: ${student.admissionDate ? new Date(student.admissionDate).toLocaleDateString('en-GB') : 'N/A'}`);
    doc.text(`Active: ${student.isActive ? 'Yes' : 'No'}`);
    doc.moveDown();

    doc.fontSize(14).text('Credentials', { underline: true });
    doc.fontSize(11);
    if (includePasswords && studentPassword && parentPassword) {
      doc.text(`Student Password: ${studentPassword}`);
      doc.text(`Parent Password: ${parentPassword}`);
    } else {
      doc.text('Passwords are issued only once during admission processing.');
    }

    doc.end();
  });
};

export const validateAdmissionPayload = (payload) => {
  const errors = {};

  const studentFirstName = firstDefined(payload.studentFirstName, payload.firstName);
  const classValue = firstDefined(payload.currentClass, payload.className, payload.studentClass);
  const fatherName = firstDefined(payload.fatherName, payload.father_name, payload.parentName);
  const parentMobile = firstDefined(payload.parentMobile, payload.parent_mobile, payload.mobile);
  const session = firstDefined(payload.session, payload.academicSession);

  if (!trimRequired(studentFirstName)) errors.studentFirstName = 'Student first name is required';
  if (!trimRequired(payload.dob)) errors.dob = 'Date of birth is required';
  if (!trimRequired(payload.gender)) errors.gender = 'Gender is required';
  if (!trimRequired(fatherName)) errors.fatherName = 'Father name is required';
  if (!trimRequired(parentMobile)) {
    errors.parentMobile = 'Parent mobile is required';
  } else if (!isTenDigitMobile(parentMobile)) {
    errors.parentMobile = 'Parent mobile must be exactly 10 digits';
  }
  if (!trimRequired(classValue)) errors.currentClass = 'Current class is required';
  if (!trimRequired(session)) errors.session = 'Session is required';

  if (payload.mobile && !isTenDigitMobile(payload.mobile)) {
    errors.mobile = 'Mobile must be exactly 10 digits';
  }
  if (payload.alternateMobile && !isTenDigitMobile(payload.alternateMobile)) {
    errors.alternateMobile = 'Alternate mobile must be exactly 10 digits';
  }

  return errors;
};

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
    admissionNo: student.admissionNo,
  });

  const nextParentUserId = student.parentUserId || buildParentUserId({
    fatherName: student.fatherName,
    admissionNo: student.admissionNo,
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

  return await prisma.student.update({
    where: { id },
    data: {
      isActive: false,
    },
  });
};
