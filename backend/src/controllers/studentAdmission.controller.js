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

export const generateStudentCredentialsController = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId || req.body.schoolId;
    const { forceRegenerate = false } = req.body || {};

    if (!['ADMIN', 'SCHOOL_OWNER'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can generate credentials',
      });
    }

    const result = await generateStudentCredentials({
      id,
      schoolId,
      forceRegenerate: Boolean(forceRegenerate),
    });

    return res.status(200).json({
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
        alreadyGenerated: result.credentials.alreadyGenerated,
        pdfUrl: `/api/students/${id}/pdf`,
      },
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to generate credentials',
    });
  }
};

export const downloadStudentPdfController = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;
    const includePasswords = req.query.includePasswords === 'true';

    if (!['ADMIN', 'SCHOOL_OWNER'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can download credential PDFs',
      });
    }

    const pdfBuffer = await generateStudentAdmissionPdf({
      id,
      schoolId,
      includePasswords,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="student-${id}.pdf"`);
    return res.status(200).send(pdfBuffer);
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to generate PDF',
    });
  }
};

export const promoteStudentController = async (req, res) => {
  try {
    if (!['ADMIN', 'SCHOOL_OWNER'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can promote students',
      });
    }

    const { id } = req.params;
    const schoolId = req.user?.schoolId;

    const updated = await promoteStudentAdmission({
      id,
      schoolId,
      payload: req.body,
    });

    return res.status(200).json({
      success: true,
      message: 'Student promoted successfully',
      data: updated,
    });
  } catch (error) {
    const statusCode = error.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      message: error.message || 'Failed to promote student',
    });
  }
};
