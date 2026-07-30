import express from 'express';
import {
  createStudent,
  allocateStudent,
  getStudentAllocationRoster,
  getStudents,
  getStudentById,
  updateStudent,
  deleteStudent,
  generateStudentSerial,
  generateStudentUserIdController,
  generateParentUserIdController,
  generatePasswordsController,
  bulkGeneratePasswordsController,
  generateAllCredentialsController,
  generateStudentCredentialsController,
  getMyStudentAcademics,
  downloadStudentPdfController,
  promoteStudentController,
} from '../controllers/student.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';
import { requirePermission } from '../middleware/permission.middleware.js';
import { requireStudentAccess } from '../middleware/scope.middleware.js';
import { PERMISSIONS } from '../config/permissions.js';

const router = express.Router();

// Middleware to authenticate requests
router.use(authMiddleware);

/**
 * POST /api/students
 * Create a new student
 * Required: studentFirstName, dob, gender, className, fatherName, parentMobile, session
 */
router.post('/', requirePermission(PERMISSIONS.STUDENTS_CREATE), createStudent);

router.get('/allocation/roster', requirePermission(PERMISSIONS.STUDENTS_ALLOCATE), getStudentAllocationRoster);
router.put('/:id/allocation', requirePermission(PERMISSIONS.STUDENTS_ALLOCATE), allocateStudent);

/**
 * POST /api/students/generate-serial
 * Generate serial number for a student
 * Required: studentId
 * Serial number is unique per className + session
 */
router.post('/generate-serial', requirePermission(PERMISSIONS.STUDENTS_CREDENTIALS_MANAGE), generateStudentSerial);

/**
 * POST /api/students/generate-student-id
 * Generate student user ID for a student
 * Required: studentId
 * studentId must have serialNo generated first
 * Format: firstname.C{class}.S{serial}.{sessionYear}@{schoolCode}.schoolos.edu
 */
router.post('/generate-student-id', requirePermission(PERMISSIONS.STUDENTS_CREDENTIALS_MANAGE), generateStudentUserIdController);

/**
 * POST /api/students/generate-parent-id
 * Generate parent user ID for a student's parent
 * Required: studentId
 * studentId must have serialNo generated first
 * Format: father.student.c{class}.{serial}.{sessionYear}@{schoolCode}.schoolos.edu
 */
router.post('/generate-parent-id', requirePermission(PERMISSIONS.STUDENTS_CREDENTIALS_MANAGE), generateParentUserIdController);

/**
 * POST /api/students/generate-passwords
 * Generate and securely store passwords for student and parent
 * Required: studentId, optional: forceRegenerate
 * Returns plain text passwords ONLY ONCE
 * Format: Student: firstname@serial@YY (e.g., rahul@112@24)
 * Format: Parent: fathername#serial#dobDay (e.g., mohan#112#15)
 */
router.post('/generate-passwords', requirePermission(PERMISSIONS.STUDENTS_CREDENTIALS_MANAGE), generatePasswordsController);

/**
 * POST /api/students/generate-passwords/bulk
 * Generate passwords for multiple students
 * Required: studentIds (array)
 * Returns array of generation results
 */
router.post('/generate-passwords/bulk', requirePermission(PERMISSIONS.STUDENTS_CREDENTIALS_MANAGE), bulkGeneratePasswordsController);

/**
 * POST /api/students/generate-all
 * Master Credential Generator - One-click complete credential generation
 * Required: studentId
 * Orchestrates: Serial → Student ID → Parent ID → Passwords → PDF
 * If serial exists: skips serial generation
 * Returns: serialNo, studentUserId, parentUserId, studentPassword, parentPassword, pdfUrl
 */
router.post('/generate-all', requirePermission(PERMISSIONS.STUDENTS_CREDENTIALS_MANAGE), generateAllCredentialsController);

/**
 * POST /api/students/:id/credentials
 * Generate or fetch admission credentials
 */
router.post('/:id/credentials', requirePermission(PERMISSIONS.STUDENTS_CREDENTIALS_MANAGE), generateStudentCredentialsController);

/**
 * GET /api/students/:id/pdf
 * Download the admission slip PDF
 */
router.get('/:id/pdf', requirePermission(PERMISSIONS.STUDENTS_CREDENTIALS_MANAGE), downloadStudentPdfController);

/**
 * POST /api/students/:id/promote
 * Promote a student and archive current academic state
 */
router.post('/:id/promote', requirePermission(PERMISSIONS.STUDENTS_PROMOTE), promoteStudentController);

router.get('/me/academics', requirePermission(PERMISSIONS.STUDENTS_VIEW), getMyStudentAcademics);

/**
 * GET /api/students
 * Get all students (paginated)
 * Query params: page, limit, session
 */
router.get('/', requirePermission(PERMISSIONS.STUDENTS_DIRECTORY_VIEW), getStudents);

/**
 * GET /api/students/:id
 * Get a specific student by ID
 */
router.get(
  '/:id',
  requirePermission(PERMISSIONS.STUDENTS_VIEW),
  requireStudentAccess(PERMISSIONS.STUDENTS_VIEW),
  getStudentById,
);

/**
 * PUT /api/students/:id
 * Update a student
 */
router.put('/:id', requirePermission(PERMISSIONS.STUDENTS_UPDATE), updateStudent);

/**
 * DELETE /api/students/:id
 * Delete a student
 */
router.delete('/:id', requirePermission(PERMISSIONS.STUDENTS_ARCHIVE), deleteStudent);

export default router;
