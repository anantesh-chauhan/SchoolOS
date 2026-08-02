import prisma from '../config/prisma.client.js';
import bcrypt from 'bcrypt';
import PDFDocument from 'pdfkit';
import { PassThrough } from 'stream';
import { randomBytes } from 'crypto';
import { formatParentUserId, formatStudentUserId } from './identity.service.js';

export const PASSWORD_SALT_ROUNDS = 10;

export const trimToNull = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const text = String(value).trim();
  return text.length > 0 ? text : null;
};

export const trimRequired = (value) => String(value ?? '').trim();

export const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null && String(value).trim() !== '');

export const normalizeDigits = (value) => String(value ?? '').replace(/\D/g, '');

export const isTenDigitMobile = (value) => /^\d{10}$/.test(normalizeDigits(value));

export const createAdmissionNumber = async (tx) => {
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
    SELECT COALESCE(MAX(CAST(NULLIF(RIGHT(regexp_replace("admissionNo", '\\D', '', 'g'), 5), '') AS BIGINT)), 0) AS "maxNo"
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

export const buildStudentUserId = ({ firstName, session, admissionNo, schoolCode }) => {
  return formatStudentUserId({ firstName, session, admissionNo, schoolCode });
};

export const buildParentUserId = ({ fatherName, studentFirstName, session, admissionNo, schoolCode }) => {
  return formatParentUserId({ fatherName, studentFirstName, session, admissionNo, schoolCode });
};

export const buildPlainPasswords = () => {
  const generate = () => `${randomBytes(7).toString('base64url')}!aA7`;
  return {
    studentPassword: generate(),
    parentPassword: generate(),
  };
};

export const rollNumberValue = (value) => {
  const parsed = Number.parseInt(String(value ?? '').replace(/\D/g, ''), 10);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
};

export const resequenceSectionRollNumbers = async (tx, { schoolId, className, section, session }) => {
  if (!className || !section || !session) return 0;

  const students = await tx.student.findMany({
    where: { schoolId, className, section, session, isActive: true },
    select: { id: true, rollNumber: true, createdAt: true },
  });

  students.sort((left, right) => {
    const byRoll = rollNumberValue(left.rollNumber) - rollNumberValue(right.rollNumber);
    if (byRoll !== 0) return byRoll;
    return left.createdAt.getTime() - right.createdAt.getTime();
  });

  await Promise.all(students.map((student, index) => tx.student.update({
    where: { id: student.id },
    data: { rollNumber: String(index + 1) },
  })));

  return students.length;
};

export const buildPdfBuffer = async ({ student, includePasswords = false, studentPassword, parentPassword }) => {
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
