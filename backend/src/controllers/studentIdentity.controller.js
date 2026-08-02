import prisma from '../config/prisma.client.js';
import * as parentUserIdService from '../services/parentUserId.service.js';
import * as passwordService from '../services/password.service.js';
import * as credentialService from '../services/credential.service.js';
import { formatStudentUserId } from '../services/identity.service.js';
import {
  createStudentAdmission,
  allocateStudentAdmission,
  generateStudentCredentials,
  generateStudentAdmissionPdf,
  promoteStudentAdmission,
  softDeleteStudentAdmission,
  updateStudentAdmission,
} from '../services/studentAdmission.service.js';
import { syncNewStudentFeeAssignments } from '../modules/fees/feeAdvanced.service.js';
import { paginationMeta, parsePagination } from '../utils/pagination.util.js';

export const generateStudentSerial = async (req, res) => {
  try {
    const { studentId } = req.body;
    const schoolId = req.user?.schoolId;

    // Validate studentId
    if (!studentId || typeof studentId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required and must be a string',
      });
    }

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
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Check if user has access to this school's data
    if (student.schoolId !== schoolId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Check if serial already exists
    if (student.serialNo !== null) {
      return res.status(400).json({
        success: false,
        message: 'Serial already generated',
        data: {
          studentId: student.id,
          serialNo: student.serialNo,
        },
      });
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

    return res.status(200).json({
      success: true,
      message: 'Serial number generated successfully',
      data: {
        studentId: updatedStudent.id,
        serialNo: updatedStudent.serialNo,
        className: updatedStudent.className,
        session: updatedStudent.session,
      },
    });
  } catch (error) {
    console.error('Error generating student serial:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate serial number',
      error: error.message,
    });
  }
};

// Generate student user ID
export const generateStudentUserIdController = async (req, res) => {
  try {
    const { studentId } = req.body;
    const schoolId = req.user?.schoolId;

    // Validate studentId
    if (!studentId || typeof studentId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required and must be a string',
      });
    }

    // Get student details with school code
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      include: {
        school: {
          select: { schoolCode: true },
        },
      },
    });

    if (!student) {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
      });
    }

    // Check if user has access to this school's data
    if (student.schoolId !== schoolId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
      });
    }

    // Ensure serial number exists
    if (student.serialNo === null) {
      return res.status(400).json({
        success: false,
        message: 'Student serial number must be generated first',
      });
    }

    // Check if user ID already exists
    if (student.studentUserId !== null) {
      return res.status(400).json({
        success: false,
        message: 'Student user ID already generated',
        data: {
          studentId: student.id,
          studentUserId: student.studentUserId,
        },
      });
    }

    const generatedUserId = formatStudentUserId({
      firstName: student.studentFirstName,
      session: student.session,
      admissionNo: student.admissionNo,
      schoolCode: student.school.schoolCode,
    });

    // Update student record with studentUserId
    const updatedStudent = await prisma.student.update({
      where: { id: studentId },
      data: { studentUserId: generatedUserId },
      include: {
        school: {
          select: { schoolCode: true },
        },
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Student user ID generated successfully',
      data: {
        studentId: updatedStudent.id,
        studentUserId: updatedStudent.studentUserId,
        studentFirstName: updatedStudent.studentFirstName,
        className: updatedStudent.className,
        serialNo: updatedStudent.serialNo,
        session: updatedStudent.session,
        schoolCode: updatedStudent.school.schoolCode,
      },
    });
  } catch (error) {
    console.error('Error generating student user ID:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate student user ID',
      error: error.message,
    });
  }
};

/**
 * Generate Parent User ID Controller
 * Format: father.student.c{class}.{serial}.{year}@{school}.schoolos.edu
 * Example: mohan.rahul.c9.112.26@dps.schoolos.edu
 */
export const generateParentUserIdController = async (req, res) => {
  const { studentId } = req.body;

  try {
    const schoolId = req.user?.schoolId || req.body.schoolId;

    // Validate input
    if (!studentId || typeof studentId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Student ID is required and must be a string'
      });
    }

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: School ID required'
      });
    }

    // Generate parent user ID
    const result = await parentUserIdService.generateParentUserId(studentId, schoolId);

    res.status(200).json({
      success: true,
      message: 'Parent user ID generated successfully',
      data: result
    });
  } catch (error) {
    // Handle specific errors
    if (error.message === 'Student not found') {
      return res.status(404).json({
        success: false,
        message: 'Student not found',
        error: error.message
      });
    }

    if (error.message === 'Unauthorized access to student') {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized',
        error: error.message
      });
    }

    if (error.message === 'Student serial number must be generated first') {
      return res.status(400).json({
        success: false,
        message: 'Student serial number must be generated first'
      });
    }

    if (error.message === 'Parent user ID already generated') {
      // Fetch the existing parent user ID to return it
      const student = await prisma.student.findUnique({
        where: { id: studentId },
        select: {
          id: true,
          studentFirstName: true,
          fatherName: true,
          parentUserId: true
        }
      });

      return res.status(400).json({
        success: false,
        message: 'Parent user ID already generated',
        data: {
          studentId: student.id,
          parentUserId: student.parentUserId
        }
      });
    }

    // Generic error response
    res.status(500).json({
      success: false,
      message: 'Error generating parent user ID',
      error: error.message
    });
  }
};

/**
 * Generate Passwords Controller
 * Generates and securely stores passwords for students and parents
 * Passwords are returned ONLY once
 */
