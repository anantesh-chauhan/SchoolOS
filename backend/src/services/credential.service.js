/**
 * Credential Service
 * Generates and orchestrates complete student credentials
 * Combines serial, student ID, parent ID, and passwords into a single operation
 */

import { PrismaClient } from '@prisma/client';
import { generateStudentPassword, generateParentPassword, hashPassword } from './password.service.js';
import { formatParentUserId, formatStudentUserId } from './identity.service.js';

const prisma = new PrismaClient();

/**
 * Generate complete credentials for a student
 * Orchestrates: Serial → Student ID → Parent ID → Passwords → PDF
 * @param {string} studentId - Student ID
 * @param {string} schoolId - School ID for authorization
 * @returns {object} Complete credentials with PDF URL
 */
export async function generateAllCredentials(studentId, schoolId) {
  try {
    // 1. Fetch student with all details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
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
      throw new Error('Student not found');
    }

    // Verify authorization
    if (student.schoolId !== schoolId) {
      throw new Error('Unauthorized access to student');
    }

    let serialNo = student.serialNo;
    let studentUserId = student.studentUserId;
    let parentUserId = student.parentUserId;

    // 2. Generate serial if not exists
    if (!serialNo) {
      const lastStudent = await prisma.student.findFirst({
        where: {
          schoolId,
          className: student.className,
          session: student.session,
          serialNo: { not: null },
        },
        select: { serialNo: true },
        orderBy: { serialNo: 'desc' },
      });

      serialNo = lastStudent ? lastStudent.serialNo + 1 : 1;

      // Update student with serial
      await prisma.student.update({
        where: { id: studentId },
        data: { serialNo },
      });
    }

    // 3. Generate student user ID if not exists
    if (!studentUserId) {
      studentUserId = formatStudentUserId({
        firstName: student.studentFirstName,
        session: student.session,
        admissionNo: student.admissionNo,
        schoolCode: student.school.schoolCode,
      });

      await prisma.student.update({
        where: { id: studentId },
        data: { studentUserId },
      });
    }

    // 4. Generate parent user ID if not exists
    if (!parentUserId) {
      parentUserId = formatParentUserId({
        fatherName: student.fatherName,
        studentFirstName: student.studentFirstName,
        session: student.session,
        admissionNo: student.admissionNo,
        schoolCode: student.school.schoolCode,
      });

      await prisma.student.update({
        where: { id: studentId },
        data: { parentUserId },
      });
    }

    // 5. Generate passwords if not exists
    let studentPassword = null;
    let parentPassword = null;
    let passwordsGenerated = student.passwordGenerated;

    if (!passwordsGenerated) {
      const studentPwd = generateStudentPassword(
        student.studentFirstName,
        serialNo,
        student.admissionDate || student.dob
      );
      const parentPwd = generateParentPassword(
        student.fatherName,
        serialNo,
        student.dob
      );

      studentPassword = studentPwd;
      parentPassword = parentPwd;

      // Hash and store passwords
      const studentPasswordHash = await hashPassword(studentPwd);
      const parentPasswordHash = await hashPassword(parentPwd);

      await prisma.student.update({
        where: { id: studentId },
        data: {
          studentPasswordHash,
          parentPasswordHash,
          passwordGenerated: true,
          lastPasswordGeneratedAt: new Date(),
        },
      });

      passwordsGenerated = true;
    }

    // 6. Generate PDF credential slip (for now, just return a placeholder URL)
    const pdfUrl = `/credentials/${studentId}-${Date.now()}.pdf`;

    return {
      serialNo,
      studentUserId,
      parentUserId,
      studentPassword,
      parentPassword,
      pdfUrl,
      credentialsMessage: 'All credentials generated successfully. Store passwords securely!',
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Generate PDF credential slip
 * TODO: Implement PDF generation with pdfkit
 */
// async function generateCredentialPDF(credentials) {
//   return new Promise((resolve, reject) => {

/**
 * Helper: Format date to readable format
 */
function formatDate(date) {
  if (!date) return 'N/A';
  const d = new Date(date);
  return d.toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
}
