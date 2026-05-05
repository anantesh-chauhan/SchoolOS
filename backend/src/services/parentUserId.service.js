/**
 * Parent User ID Generator Service
 * Generates unique formatted email addresses for parents
 * Format: father.student.sessionShortlast4Admission@schoolcode.schoolos
 * Example: mohan.rahul.26270123@dpslko.schoolos
 */

import { PrismaClient } from '@prisma/client';
import { formatParentUserId } from './identity.service.js';

const prisma = new PrismaClient();

/**
 * Generate Parent User ID for a student's parent
 * Prerequisites: Student must exist and have serialNo set
 *
 * @param {string} studentId - The student ID
 * @param {string} schoolId - The school ID for authorization
 * @returns {Promise<Object>} Generated parent user ID and details
 * @throws {Error} If student not found, serial not generated, or already exists
 */
export async function generateParentUserId(studentId, schoolId) {
  try {
    // Validate input
    if (!studentId || typeof studentId !== 'string') {
      throw new Error('Student ID is required and must be a string');
    }

    // Fetch student with school details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        school: {
          select: { id: true, schoolCode: true }
        }
      }
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Verify authorization - user must own this school
    if (student.schoolId !== schoolId) {
      throw new Error('Unauthorized access to student');
    }

    // Check if serial number exists (prerequisite)
    if (student.serialNo === null) {
      throw new Error('Student serial number must be generated first');
    }

    // Check if parent user ID already exists (idempotency)
    if (student.parentUserId) {
      throw new Error('Parent user ID already generated');
    }

    // Generate parent user ID format
    const parentUserId = formatParentUserId({
      fatherName: student.fatherName,
      studentFirstName: student.studentFirstName,
      session: student.session,
      admissionNo: student.admissionNo,
      schoolCode: student.school.schoolCode,
    });

    // Update student record with parent user ID
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { parentUserId },
      select: {
        id: true,
        studentFirstName: true,
        fatherName: true,
        className: true,
        serialNo: true,
        session: true,
        admissionNo: true,
        parentUserId: true,
        schoolId: true
      }
    });

    return {
      studentId: updatedStudent.id,
      parentUserId: updatedStudent.parentUserId,
      studentFirstName: updatedStudent.studentFirstName,
      fatherName: updatedStudent.fatherName,
      className: updatedStudent.className,
      serialNo: updatedStudent.serialNo,
      session: updatedStudent.session,
      admissionNo: updatedStudent.admissionNo,
      schoolCode: student.school.schoolCode
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Generate formatted parent user ID
 * Format: father.student.c{class}.{serial}.{year}@{school}.schoolos.edu
 *
 * @param {string} fatherName - Father's name
 * @param {string} studentName - Student's first name
 * @param {string} className - Class name (e.g., "Class 9", "LKG")
 * @param {number} serialNo - Serial number
 * @param {string} session - Academic session (e.g., "2026-27")
 * @param {string} schoolCode - School code
 * @returns {string} Formatted parent user ID
 */
export function generateParentUserIdFormat(fatherName, studentName, session, admissionNo, schoolCode) {
  return formatParentUserId({
    fatherName,
    studentFirstName: studentName,
    session,
    admissionNo,
    schoolCode,
  });
}

/**
 * Check if student has parent user ID
 *
 * @param {string} studentId - Student ID
 * @returns {Promise<boolean>} True if parent user ID exists
 */
export async function hasParentUserId(studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { parentUserId: true }
  });

  return student?.parentUserId !== null;
}

/**
 * Get parent user ID for a student
 *
 * @param {string} studentId - Student ID
 * @returns {Promise<string|null>} Parent user ID or null
 */
export async function getParentUserId(studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { parentUserId: true }
  });

  return student?.parentUserId || null;
}

/**
 * Validate parent user ID format
 * Pattern: name.name.c{number}.{number}.{digits}@{code}.schoolos.edu
 *
 * @param {string} userId - User ID to validate
 * @returns {boolean} True if format is valid
 */
export function isValidParentUserIdFormat(userId) {
  const pattern = /^[a-z0-9]+\.[a-z0-9]+\.c[a-z0-9]+\.\d+\.\d+@[a-z0-9]+\.schoolos\.edu$/;
  return pattern.test(userId);
}

export function extractClassNumber(className) {
  if (!className) return '';
  return String(className).replace(/^Class\s+/i, '').toLowerCase();
}

export function extractSessionYear(session) {
  return String(session ?? '').replace(/-/g, '').slice(-4);
}

/**
 * Reset parent user ID (admin function)
 * Clears the parent user ID if corrections are needed
 *
 * @param {string} studentId - Student ID
 * @param {string} schoolId - School ID for authorization
 * @returns {Promise<Object>} Updated student record
 */
export async function resetParentUserId(studentId, schoolId) {
  // Verify student belongs to school
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { schoolId: true }
  });

  if (!student || student.schoolId !== schoolId) {
    throw new Error('Unauthorized');
  }

  // Reset parent user ID
  const updated = await prisma.student.update({
    where: { id: studentId },
    data: { parentUserId: null },
    select: {
      id: true,
      studentFirstName: true,
      fatherName: true,
      parentUserId: true
    }
  });

  return updated;
}

export default {
  generateParentUserId,
  generateParentUserIdFormat,
  extractClassNumber,
  extractSessionYear,
  hasParentUserId,
  getParentUserId,
  isValidParentUserIdFormat,
  resetParentUserId
};
