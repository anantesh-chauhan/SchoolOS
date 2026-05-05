/**
 * Student Serial Number Service
 * Handles generation and management of student serial numbers
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate a serial number for a student
 * Serial numbers are unique per className + session + schoolId
 * 
 * @param {string} studentId - The ID of the student
 * @param {string} schoolId - The ID of the school (for authorization)
 * @returns {Promise<{studentId: string, serialNo: number, className: string, session: string}>}
 * @throws {Error} If student not found or already has a serial number
 */
export const generateSerialForStudent = async (studentId, schoolId) => {
  try {
    // Get student details
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        schoolId: true,
        className: true,
        session: true,
        serialNo: true,
      },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    // Check school authorization
    if (student.schoolId !== schoolId) {
      throw new Error('Unauthorized - student belongs to different school');
    }

    // Check if serial already exists
    if (student.serialNo !== null) {
      const error = new Error('Serial already generated');
      error.statusCode = 400;
      error.existingSerial = student.serialNo;
      throw error;
    }

    // Find the last serial number for this class and session
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

    // Calculate new serial number
    const newSerial = lastStudent ? lastStudent.serialNo + 1 : 1;

    // Update student with new serial number
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { serialNo: newSerial },
      select: {
        id: true,
        serialNo: true,
        className: true,
        session: true,
      },
    });

    return {
      studentId: updatedStudent.id,
      serialNo: updatedStudent.serialNo,
      className: updatedStudent.className,
      session: updatedStudent.session,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get the next serial number for a class and session
 * Useful for predicting what the next serial will be
 * 
 * @param {string} className - The class name
 * @param {string} session - The session
 * @param {string} schoolId - The school ID
 * @returns {Promise<number>} The next available serial number
 */
export const getNextSerialNumber = async (className, session, schoolId) => {
  try {
    const lastStudent = await prisma.student.findFirst({
      where: {
        schoolId,
        className,
        session,
        serialNo: { not: null },
      },
      select: { serialNo: true },
      orderBy: { serialNo: 'desc' },
    });

    return lastStudent ? lastStudent.serialNo + 1 : 1;
  } catch (error) {
    throw error;
  }
};

/**
 * Get all students with serials for a specific class and session
 * 
 * @param {string} className - The class name
 * @param {string} session - The session
 * @param {string} schoolId - The school ID
 * @returns {Promise<Array>} List of students with their serials
 */
export const getStudentsByClassAndSession = async (className, session, schoolId) => {
  try {
    const students = await prisma.student.findMany({
      where: {
        schoolId,
        className,
        session,
        serialNo: { not: null },
      },
      select: {
        id: true,
        studentFirstName: true,
        studentLastName: true,
        serialNo: true,
        className: true,
        session: true,
      },
      orderBy: { serialNo: 'asc' },
    });

    return students;
  } catch (error) {
    throw error;
  }
};

/**
 * Check if a student already has a serial number
 * 
 * @param {string} studentId - The student ID
 * @returns {Promise<{has: boolean, serialNo: number|null}>}
 */
export const hasSerialNumber = async (studentId) => {
  try {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: { serialNo: true },
    });

    if (!student) {
      throw new Error('Student not found');
    }

    return {
      has: student.serialNo !== null,
      serialNo: student.serialNo,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Regenerate/Reset serial number for a student
 * Use with caution - this allows reassigning serial numbers
 * WARNING: This can create gaps in serial sequences
 * 
 * @param {string} studentId - The student ID
 * @param {string} schoolId - The school ID (for authorization)
 * @returns {Promise<void>}
 */
export const resetSerialNumber = async (studentId, schoolId) => {
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
      data: { serialNo: null },
    });
  } catch (error) {
    throw error;
  }
};

/**
 * Get serial number statistics for a class-session combination
 * 
 * @param {string} className - The class name
 * @param {string} session - The session
 * @param {string} schoolId - The school ID
 * @returns {Promise<{total: number, withSerial: number, withoutSerial: number, nextSerial: number}>}
 */
export const getSerialStatistics = async (className, session, schoolId) => {
  try {
    const total = await prisma.student.count({
      where: { schoolId, className, session },
    });

    const withSerial = await prisma.student.count({
      where: { schoolId, className, session, serialNo: { not: null } },
    });

    const withoutSerial = total - withSerial;
    const nextSerial = await getNextSerialNumber(className, session, schoolId);

    return {
      total,
      withSerial,
      withoutSerial,
      nextSerial,
    };
  } catch (error) {
    throw error;
  }
};

export default {
  generateSerialForStudent,
  getNextSerialNumber,
  getStudentsByClassAndSession,
  hasSerialNumber,
  resetSerialNumber,
  getSerialStatistics,
};
