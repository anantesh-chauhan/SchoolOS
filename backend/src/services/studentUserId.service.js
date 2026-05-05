/**
 * Student User ID Service
 * Generates and manages student user IDs based on student details
 * Format: firstname.sessionShort.last4Admission@schoolcode.schoolos
 * Example: rahul.2627.0123@dpslko.schoolos
 */

import { PrismaClient } from '@prisma/client';
import { formatStudentUserId } from './identity.service.js';

const prisma = new PrismaClient();

/**
 * Generate studentUserId for a student
 * Format: firstname.C{class}.S{serial}.{sessionShort}@{schoolCode}.schoolos.edu
 * 
 * @param {string} studentId - The ID of the student
 * @param {string} schoolId - The ID of the school (for authorization)
 * @returns {Promise<{studentId: string, studentUserId: string, studentFirstName: string, className: string, serialNo: number, session: string, schoolCode: string}>}
 * @throws {Error} If student not found, serial not set, or other validation fails
 */
export const generateStudentUserId = async (studentId, schoolId) => {
  try {
    // Get student details with school code
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        schoolId: true,
        studentFirstName: true,
        className: true,
        serialNo: true,
        session: true,
        admissionNo: true,
        studentUserId: true,
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Check school authorization
    if (student.schoolId !== schoolId) {
      throw new Error('Unauthorized - student belongs to different school');
    }

    // Ensure serial number is set
    if (student.serialNo === null) {
      const error = new Error('Student serial number must be generated first');
      error.statusCode = 400;
      throw error;
    }

    // Check if studentUserId already exists
    if (student.studentUserId !== null) {
      const error = new Error('Student user ID already generated');
      error.statusCode = 400;
      error.existingUserId = student.studentUserId;
      throw error;
    }

    // Generate the user ID
    const school = await prisma.school.findUnique({
      where: { id: student.schoolId },
      select: { schoolCode: true },
    });

    const generatedUserId = formatStudentUserId({
      firstName: student.studentFirstName,
      session: student.session,
      admissionNo: student.admissionNo,
      schoolCode: school.schoolCode,
    });

    // Update student record with studentUserId
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { studentUserId: generatedUserId },
      select: {
        id: true,
        studentFirstName: true,
        className: true,
        serialNo: true,
        session: true,
        admissionNo: true,
        studentUserId: true,
      },
    });

    return {
      studentId: updatedStudent.id,
      studentUserId: updatedStudent.studentUserId,
      studentFirstName: updatedStudent.studentFirstName,
      className: updatedStudent.className,
      serialNo: updatedStudent.serialNo,
      session: updatedStudent.session,
      admissionNo: updatedStudent.admissionNo,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Check if a student already has a user ID
 * 
 * @param {string} studentId - The student ID
 * @returns {Promise<{has: boolean, studentUserId: string|null}>}
 */
export const hasStudentUserId = async (studentId) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { studentUserId: true },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    return {
      has: student.studentUserId !== null,
      studentUserId: student.studentUserId,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Reset/clear student user ID
 * Use with caution - this clears the studentUserId field
 * 
 * @param {string} studentId - The student ID
 * @param {string} schoolId - The school ID (for authorization)
 * @returns {Promise<void>}
 */
export const resetStudentUserId = async (studentId, schoolId) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { schoolId: true },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    if (student.schoolId !== schoolId) {
      throw new Error('Unauthorized');
    }

    await prisma.student.update({
      where: { id: studentId },
      data: { studentUserId: null },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Get student user ID without generating it
 * Returns null if not yet generated
 * 
 * @param {string} studentId - The student ID
 * @returns {Promise<string|null>} The student user ID or null
 */
export const getStudentUserId = async (studentId) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { studentUserId: true },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    return student.studentUserId;
  } catch (error) {
    throw error;
  }
};

/**
 * Validate student user ID format
 * 
 * @param {string} userId - The user ID to validate
 * @returns {boolean} True if format is valid
 */
export const isValidUserIdFormat = (userId) => {
  // Expected format: firstname.C{class}.S{serial}.{year}@{schoolCode}.schoolos.edu
  const pattern = /^[a-z]+\.C[a-zA-Z0-9]+\.S\d+\.\d{2}@[a-z]+\.schoolos\.edu$/;
  return pattern.test(userId);
};

export const generateUserIdFormat = (firstName, session, admissionNo, schoolCode) => {
  return formatStudentUserId({ firstName, session, admissionNo, schoolCode });
};

export const extractClassNumber = (className) => {
  if (!className) return '';
  return String(className).replace(/^Class\s+/i, '').toLowerCase();
};

export const extractSessionYear = (session) => String(session ?? '').replace(/-/g, '').slice(-4);

export default {
  generateStudentUserId,
  generateUserIdFormat,
  extractClassNumber,
  extractSessionYear,
  hasStudentUserId,
  resetStudentUserId,
  getStudentUserId,
  isValidUserIdFormat,
};
