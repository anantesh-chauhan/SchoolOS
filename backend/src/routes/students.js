import express from 'express';
import {
  createStudent,
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
  downloadStudentPdfController,
  promoteStudentController,
} from '../controllers/student.controller.js';
import { authMiddleware } from '../middleware/auth.middleware.js';

const router = express.Router();

// Middleware to authenticate requests
router.use(authMiddleware);

/**
 * POST /api/students
 * Create a new student
 * Required: studentFirstName, dob, gender, className, fatherName, parentMobile, session
 */
router.post('/', createStudent);

/**
 * POST /api/students/generate-serial
 * Generate serial number for a student
 * Required: studentId
 * Serial number is unique per className + session
 */
router.post('/generate-serial', generateStudentSerial);

/**
 * POST /api/students/generate-student-id
 * Generate student user ID for a student
 * Required: studentId
 * studentId must have serialNo generated first
 * Format: firstname.C{class}.S{serial}.{sessionYear}@{schoolCode}.schoolos.edu
 */
router.post('/generate-student-id', generateStudentUserIdController);

/**
 * POST /api/students/generate-parent-id
 * Generate parent user ID for a student's parent
 * Required: studentId
 * studentId must have serialNo generated first
 * Format: father.student.c{class}.{serial}.{sessionYear}@{schoolCode}.schoolos.edu
 */
router.post('/generate-parent-id', generateParentUserIdController);

/**
 * POST /api/students/generate-passwords
 * Generate and securely store passwords for student and parent
 * Required: studentId, optional: forceRegenerate
 * Returns plain text passwords ONLY ONCE
 * Format: Student: firstname@serial@YY (e.g., rahul@112@24)
 * Format: Parent: fathername#serial#dobDay (e.g., mohan#112#15)
 */
router.post('/generate-passwords', generatePasswordsController);

/**
 * POST /api/students/generate-passwords/bulk
 * Generate passwords for multiple students
 * Required: studentIds (array)
 * Returns array of generation results
 */
router.post('/generate-passwords/bulk', bulkGeneratePasswordsController);

/**
 * POST /api/students/generate-all
 * Master Credential Generator - One-click complete credential generation
 * Required: studentId
 * Orchestrates: Serial → Student ID → Parent ID → Passwords → PDF
 * If serial exists: skips serial generation
 * Returns: serialNo, studentUserId, parentUserId, studentPassword, parentPassword, pdfUrl
 */
router.post('/generate-all', generateAllCredentialsController);

/**
 * POST /api/students/:id/credentials
 * Generate or fetch admission credentials
 */
router.post('/:id/credentials', generateStudentCredentialsController);

/**
 * GET /api/students/:id/pdf
 * Download the admission slip PDF
 */
router.get('/:id/pdf', downloadStudentPdfController);

/**
 * POST /api/students/:id/promote
 * Promote a student and archive current academic state
 */
router.post('/:id/promote', promoteStudentController);

/**
 * GET /api/students
 * Get all students (paginated)
 * Query params: page, limit, session
 */
router.get('/', getStudents);

/**
 * GET /api/students/:id
 * Get a specific student by ID
 */
router.get('/:id', getStudentById);

/**
 * PUT /api/students/:id
 * Update a student
 */
router.put('/:id', updateStudent);

/**
 * DELETE /api/students/:id
 * Delete a student
 */
router.delete('/:id', deleteStudent);

export default router;
