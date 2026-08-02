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

export const generatePasswordsController = async (req, res) => {
  try {
    const { studentId, forceRegenerate } = req.body;
    const schoolId = req.user?.schoolId || req.body.schoolId;

    if (!['ADMIN', 'SCHOOL_OWNER'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can generate credentials',
      });
    }

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

    const result = await generateStudentCredentials({
      id: studentId,
      schoolId,
      forceRegenerate: Boolean(forceRegenerate),
    });

    res.status(200).json({
      success: true,
      message: result.credentials.alreadyGenerated
        ? 'Credentials already generated for this student'
        : 'Credentials generated successfully',
      data: {
        admissionNo: result.credentials.admissionNo,
        studentUserId: result.credentials.studentUserId,
        parentUserId: result.credentials.parentUserId,
        studentPassword: result.credentials.studentPassword,
        parentPassword: result.credentials.parentPassword,
        warning: result.credentials.alreadyGenerated
          ? 'Passwords were already issued and are not returned again.'
          : 'Store these passwords securely. They will not be shown again!'
      }
    });
  } catch (error) {
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
        message: 'Student serial number must be generated first',
        error: error.message
      });
    }

    if (error.message === 'Passwords already generated for this student') {
      return res.status(400).json({
        success: false,
        message: 'Passwords already generated for this student',
        note: 'Use forceRegenerate: true to regenerate'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Error generating passwords',
      error: error.message
    });
  }
};

/**
 * Bulk Generate Passwords Controller
 * Generate passwords for multiple students
 */
export const bulkGeneratePasswordsController = async (req, res) => {
  try {
    const { studentIds } = req.body;
    const schoolId = req.user?.schoolId || req.body.schoolId;

    if (!['ADMIN', 'SCHOOL_OWNER'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can generate credentials',
      });
    }

    if (!Array.isArray(studentIds) || studentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'studentIds must be a non-empty array'
      });
    }

    if (studentIds.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'Maximum 100 students per request'
      });
    }

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: School ID required'
      });
    }

    const results = [];
    for (const studentId of studentIds) {
      try {
        const result = await generateStudentCredentials({ id: studentId, schoolId });
        results.push({
          studentId,
          success: true,
          admissionNo: result.credentials.admissionNo,
          studentUserId: result.credentials.studentUserId,
          parentUserId: result.credentials.parentUserId,
          studentPassword: result.credentials.studentPassword,
          parentPassword: result.credentials.parentPassword,
          alreadyGenerated: result.credentials.alreadyGenerated,
        });
      } catch (error) {
        results.push({
          studentId,
          success: false,
          message: error.message,
        });
      }
    }

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    res.status(200).json({
      success: true,
      message: `Generated passwords for ${successful} students, ${failed} failed`,
      data: {
        total: results.length,
        successful,
        failed,
        results
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error generating passwords in bulk',
      error: error.message
    });
  }
};

/**
 * Generate All Credentials Controller (Master)
 * One-click credential generation
 * Orchestrates: Serial → Student ID → Parent ID → Passwords → PDF
 * 
 * Returns: serialNo, studentUserId, parentUserId, pdfUrl
 * If serial exists: skips serial generation
 */
export const generateAllCredentialsController = async (req, res) => {
  try {
    const { studentId } = req.body;
    const schoolId = req.user?.schoolId || req.body.schoolId;

    if (!['ADMIN', 'SCHOOL_OWNER'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can generate credentials',
      });
    }

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

    const result = await generateStudentCredentials({
      id: studentId,
      schoolId,
    });

    res.status(200).json({
      success: true,
      message: result.credentials.alreadyGenerated
        ? 'Credentials already generated for this student'
        : 'Credentials generated successfully',
      data: {
        admissionNo: result.credentials.admissionNo,
        studentUserId: result.credentials.studentUserId,
        parentUserId: result.credentials.parentUserId,
        studentPassword: result.credentials.studentPassword,
        parentPassword: result.credentials.parentPassword,
        pdfUrl: `/api/students/${studentId}/pdf`,
        warning: result.credentials.alreadyGenerated
          ? 'Passwords were already issued and are not returned again.'
          : 'Store these passwords securely. They will not be shown again.',
      }
    });
  } catch (error) {
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

    res.status(500).json({
      success: false,
      message: 'Error generating credentials',
      error: error.message
    });
  }
};
