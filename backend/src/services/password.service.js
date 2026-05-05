/**
 * Password Generation Service
 * Generates secure passwords for students and parents
 * Handles hashing and storage
 */

import bcrypt from 'bcrypt';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Format name: lowercase + remove spaces
 * @param {string} name - Full name
 * @returns {string} Formatted name
 */
export function formatName(name) {
  if (!name) return '';
  return name.toLowerCase().replace(/\s+/g, '');
}

/**
 * Extract admission year (last 2 digits from DOB year or admission date)
 * Format YY (e.g., 2024 → 24)
 * @param {Date|string} dateInput - Date of birth or admission date
 * @returns {string} Last 2 digits of year
 */
export function extractAdmissionYear(dateInput) {
  try {
    const date = new Date(dateInput);
    const year = date.getFullYear();
    return year.toString().slice(-2);
  } catch (error) {
    return new Date().getFullYear().toString().slice(-2);
  }
}

/**
 * Extract day from date (01-31)
 * @param {Date|string} dateInput - Date input
 * @returns {string} Day with leading zero (01-31)
 */
export function extractDayFromDate(dateInput) {
  try {
    const date = new Date(dateInput);
    const day = date.getDate();
    return day.toString().padStart(2, '0');
  } catch (error) {
    return '01';
  }
}

/**
 * Generate student password
 * Format: firstname@serial@YY
 * Example: rahul@112@24
 *
 * @param {string} firstName - Student's first name
 * @param {number} serialNo - Student serial number
 * @param {Date|string} admissionDate - Admission date (for year extraction)
 * @returns {string} Plain text student password
 */
export function generateStudentPassword(firstName, serialNo, admissionDate) {
  if (!firstName || !serialNo) {
    throw new Error('firstName and serialNo are required');
  }

  const formattedName = formatName(firstName);
  const year = extractAdmissionYear(admissionDate);

  // Format: firstname@serial@YY
  return `${formattedName}@${serialNo}@${year}`;
}

/**
 * Generate parent password
 * Format: fathername#serial#dobDay
 * Example: mohan#112#15
 *
 * @param {string} fatherName - Father's name
 * @param {number} serialNo - Student serial number
 * @param {Date|string} dob - Date of birth of student
 * @returns {string} Plain text parent password
 */
export function generateParentPassword(fatherName, serialNo, dob) {
  if (!fatherName || !serialNo || !dob) {
    throw new Error('fatherName, serialNo, and dob are required');
  }

  const formattedFatherName = formatName(fatherName);
  const day = extractDayFromDate(dob);

  // Format: fathername#serial#dobDay
  return `${formattedFatherName}#${serialNo}#${day}`;
}

/**
 * Hash password using bcrypt
 * @param {string} plainPassword - Plain text password
 * @param {number} saltRounds - bcrypt salt rounds (default: 10)
 * @returns {Promise<string>} Hashed password
 */
export async function hashPassword(plainPassword, saltRounds = 10) {
  if (!plainPassword) {
    throw new Error('plainPassword is required');
  }

  try {
    const hash = await bcrypt.hash(plainPassword, saltRounds);
    return hash;
  } catch (error) {
    throw new Error(`Password hashing failed: ${error.message}`);
  }
}

/**
 * Verify password against hash
 * @param {string} plainPassword - Plain text password to verify
 * @param {string} hash - Stored password hash
 * @returns {Promise<boolean>} True if password matches
 */
export async function verifyPassword(plainPassword, hash) {
  try {
    return await bcrypt.compare(plainPassword, hash);
  } catch (error) {
    return false;
  }
}

/**
 * Generate and hash both student and parent passwords
 * Returns only plain text (secure one-time distribution)
 *
 * @param {Object} params - Parameters
 * @param {string} params.firstName - Student first name
 * @param {string} params.fatherName - Father name
 * @param {number} params.serialNo - Student serial number
 * @param {Date} params.dob - Date of birth
 * @param {Date} params.admissionDate - Admission date
 * @returns {Promise<Object>} {
 *   studentPassword: "plain",
 *   studentPasswordHash: "hashed",
 *   parentPassword: "plain",
 *   parentPasswordHash: "hashed"
 * }
 */
export async function generateAndHashPasswords({
  firstName,
  fatherName,
  serialNo,
  dob,
  admissionDate
}) {
  try {
    // Validate inputs
    if (!firstName || !fatherName || !serialNo || !dob) {
      throw new Error('All parameters are required');
    }

    // Generate plain text passwords
    const studentPassword = generateStudentPassword(firstName, serialNo, admissionDate);
    const parentPassword = generateParentPassword(fatherName, serialNo, dob);

    // Hash passwords
    const studentPasswordHash = await hashPassword(studentPassword);
    const parentPasswordHash = await hashPassword(parentPassword);

    return {
      studentPassword,      // Return plain for one-time display
      studentPasswordHash,  // Store this in DB
      parentPassword,       // Return plain for one-time display
      parentPasswordHash    // Store this in DB
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Generate passwords for a student
 * Main function that handles DB updates
 *
 * @param {string} studentId - Student ID
 * @param {string} schoolId - School ID for authorization
 * @param {boolean} forceRegenerate - Force regeneration if already exists
 * @returns {Promise<Object>} { success, studentPassword, parentPassword }
 */
export async function generatePasswordsForStudent(studentId, schoolId, forceRegenerate = false) {
  try {
    // Validate input
    if (!studentId || typeof studentId !== 'string') {
      throw new Error('Student ID is required and must be a string');
    }

    // Fetch student
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        schoolId: true,
        studentFirstName: true,
        fatherName: true,
        dob: true,
        admissionDate: true,
        serialNo: true,
        passwordGenerated: true
      }
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Verify authorization
    if (student.schoolId !== schoolId) {
      throw new Error('Unauthorized access to student');
    }

    // Check serial number exists
    if (student.serialNo === null) {
      throw new Error('Student serial number must be generated first');
    }

    // Check if already generated
    if (student.passwordGenerated && !forceRegenerate) {
      throw new Error('Passwords already generated for this student');
    }

    // Generate passwords
    const passwordData = await generateAndHashPasswords({
      firstName: student.studentFirstName,
      fatherName: student.fatherName,
      serialNo: student.serialNo,
      dob: student.dob,
      admissionDate: student.admissionDate || new Date()
    });

    // Update student with hashed passwords
    await prisma.student.update({
      where: { id: studentId },
      data: {
        studentPasswordHash: passwordData.studentPasswordHash,
        parentPasswordHash: passwordData.parentPasswordHash,
        passwordGenerated: true,
        lastPasswordGeneratedAt: new Date()
      }
    });

    // Return plain text passwords (only once)
    return {
      success: true,
      studentPassword: passwordData.studentPassword,
      parentPassword: passwordData.parentPassword,
      message: 'Passwords generated successfully. Store them securely!'
    };
  } catch (error) {
    throw error;
  }
}

/**
 * Bulk generate passwords for multiple students
 * @param {string[]} studentIds - Array of student IDs
 * @param {string} schoolId - School ID for authorization
 * @returns {Promise<Array>} Array of { studentId, success, studentPassword, parentPassword, error }
 */
export async function bulkGeneratePasswords(studentIds, schoolId) {
  const results = [];

  for (const studentId of studentIds) {
    try {
      const result = await generatePasswordsForStudent(studentId, schoolId, false);
      results.push({
        studentId,
        success: true,
        ...result
      });
    } catch (error) {
      results.push({
        studentId,
        success: false,
        error: error.message
      });
    }
  }

  return results;
}

/**
 * Check if student has passwords generated
 * @param {string} studentId - Student ID
 * @returns {Promise<boolean>} True if passwords exist
 */
export async function hasPasswordsGenerated(studentId) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: { passwordGenerated: true }
  });

  return student?.passwordGenerated || false;
}

export default {
  formatName,
  extractAdmissionYear,
  extractDayFromDate,
  generateStudentPassword,
  generateParentPassword,
  hashPassword,
  verifyPassword,
  generateAndHashPasswords,
  generatePasswordsForStudent,
  bulkGeneratePasswords,
  hasPasswordsGenerated
};
