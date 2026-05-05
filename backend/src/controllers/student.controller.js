import { PrismaClient } from '@prisma/client';
import * as parentUserIdService from '../services/parentUserId.service.js';
import * as passwordService from '../services/password.service.js';
import * as credentialService from '../services/credential.service.js';
import {
  createStudentAdmission,
  generateStudentCredentials,
  generateStudentAdmissionPdf,
  promoteStudentAdmission,
  softDeleteStudentAdmission,
  updateStudentAdmission,
} from '../services/studentAdmission.service.js';

const prisma = new PrismaClient();

// Validation rules for creating a student
const validateStudentData = (data) => {
  const errors = {};
  const studentFirstName = data.studentFirstName || data.firstName;
  const currentClass = data.currentClass || data.className || data.studentClass;
  const fatherName = data.fatherName || data.father_name || data.parentName;
  const parentMobile = data.parentMobile || data.parent_mobile || data.mobile;
  const session = data.session || data.academicSession;

  // Required fields
  if (!studentFirstName || !String(studentFirstName).trim()) {
    errors.studentFirstName = 'Student first name is required';
  }
  if (!data.dob) {
    errors.dob = 'Date of birth is required';
  }
  if (!data.gender || !data.gender.trim()) {
    errors.gender = 'Gender is required';
  }
  if (!(currentClass && String(currentClass).trim())) {
    errors.currentClass = 'Current class is required';
  }
  if (!fatherName || !String(fatherName).trim()) {
    errors.fatherName = 'Father name is required';
  }
  if (!parentMobile || !String(parentMobile).trim()) {
    errors.parentMobile = 'Parent mobile is required';
  } else if (!/^\d{10}$/.test(String(parentMobile).replace(/\D/g, ''))) {
    errors.parentMobile = 'Parent mobile must be exactly 10 digits';
  }
  if (data.mobile && !/^\d{10}$/.test(String(data.mobile).replace(/\D/g, ''))) {
    errors.mobile = 'Mobile must be exactly 10 digits';
  }
  if (data.alternateMobile && !/^\d{10}$/.test(String(data.alternateMobile).replace(/\D/g, ''))) {
    errors.alternateMobile = 'Alternate mobile must be exactly 10 digits';
  }
  if (!session || !String(session).trim()) {
    errors.session = 'Session is required';
  }

  return errors;
};

// Create a new student
export const createStudent = async (req, res) => {
  try {
    const schoolId = req.user?.schoolId || req.body.schoolId;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID is required',
      });
    }

    if (!['ADMIN', 'SCHOOL_OWNER'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can create student admissions',
      });
    }

    const validationErrors = validateStudentData(req.body);
    if (Object.keys(validationErrors).length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Required fields missing',
        errors: validationErrors,
      });
    }

    const result = await createStudentAdmission({
      schoolId,
      payload: req.body,
    });

    return res.status(201).json({
      success: true,
      message: 'Student created successfully',
      data: {
        id: result.student.id,
        student: result.student,
        credentials: result.credentials,
        pdfUrl: `/api/students/${result.student.id}/pdf`,
      },
    });
  } catch (error) {
    console.error('Error creating student:', error);
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Failed to create student',
      error: error.errors || error.message,
    });
  }
};

// Get all students (paginated)
export const getStudents = async (req, res) => {
  try {
    const { page = 1, limit = 10, session, includeInactive = 'false' } = req.query;
    const schoolId = req.user?.schoolId;

    if (!schoolId) {
      return res.status(400).json({
        success: false,
        message: 'School ID is required',
      });
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { schoolId };
    if (session) {
      where.session = session;
    }

    if (includeInactive !== 'true') {
      where.isActive = true;
    }

    const students = await prisma.student.findMany({
      where,
      skip,
      take: parseInt(limit),
      include: {
        school: {
          select: {
            id: true,
            schoolName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const total = await prisma.student.count({ where });

    return res.status(200).json({
      success: true,
      data: students,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Error fetching students:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch students',
      error: error.message,
    });
  }
};

// Get student by ID
export const getStudentById = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;

    const student = await prisma.student.findUnique({
      where: { id },
      include: {
        school: {
          select: {
            id: true,
            schoolName: true,
          },
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

    return res.status(200).json({
      success: true,
      data: student,
    });
  } catch (error) {
    console.error('Error fetching student:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch student',
      error: error.message,
    });
  }
};

// Update student
export const updateStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;
    const student = await updateStudentAdmission({
      id,
      schoolId,
      role: req.user?.role,
      actorStudentId: req.user?.studentId,
      payload: req.body,
    });

    return res.status(200).json({
      success: true,
      message: 'Student updated successfully',
      data: student,
    });
  } catch (error) {
    console.error('Error updating student:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update student',
      error: error.message,
    });
  }
};

// Delete student
export const deleteStudent = async (req, res) => {
  try {
    const { id } = req.params;
    const schoolId = req.user?.schoolId;

    if (!['ADMIN', 'SCHOOL_OWNER'].includes(req.user?.role)) {
      return res.status(403).json({
        success: false,
        message: 'Only admins can deactivate students',
      });
    }

    await softDeleteStudentAdmission({ id, schoolId });

    return res.status(200).json({
      success: true,
      message: 'Student deactivated successfully',
    });
  } catch (error) {
    console.error('Error deleting student:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete student',
      error: error.message,
    });
  }
};

// Generate serial number for student
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

    const generatedUserId = generateUserIdFormat(
      student.studentFirstName,
      student.session,
      student.admissionNo,
      student.school.schoolCode
    );

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

// Helper function to generate user ID format
function generateUserIdFormat(firstName, session, admissionNo, schoolCode) {
  const cleanFirstName = String(firstName || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');
  const sessionShort = String(session || '').replace(/-/g, '').slice(-4);
  const admissionTail = String(admissionNo || '').replace(/\D/g, '').padStart(4, '0').slice(-4);
  const cleanSchoolCode = String(schoolCode || '').toLowerCase().replace(/\s+/g, '').replace(/[^a-z0-9]/g, '');

  return `${cleanFirstName}.${sessionShort}.${admissionTail}@${cleanSchoolCode}.schoolos`;
}

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
