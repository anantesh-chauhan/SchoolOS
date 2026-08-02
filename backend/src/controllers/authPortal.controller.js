import bcryptjs from 'bcryptjs';
import prisma from '../config/prisma.client.js';
import { generateRefreshToken, generateToken, verifyRefreshToken } from '../utils/jwt.util.js';
import { permissionsForRole } from '../config/permissions.js';
import {
  buildWorkspaceContext,
  chooseActiveAssignment,
  createSessionPayload,
  getAvailableAssignments,
  getClassTeacherContext,
  recordWorkspaceAudit,
  ROLE_METADATA,
} from '../services/workspace.service.js';
import { revokeAllAuthSessions, revokeAuthSession, saveAuthSession, validateRefreshSession } from '../services/authSession.service.js';
import { normalizeLoginId, instantLoginEnabled, portalStudentSelect, findPortalStudent, buildPortalSession } from "./auth.shared.js";

export const loginStudent = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        code: 'MISSING_FIELDS',
      });
    }

    // Find student by studentUserId
    const normalizedEmail = normalizeLoginId(email);
    const student = await prisma.student.findUnique({
      where: { studentUserId: normalizedEmail },
      include: {
        school: {
          select: {
            id: true,
            schoolName: true,
            schoolCode: true,
          },
        },
      },
    });

    if (!student || !student.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Check if passwordHash exists
    if (!student.studentPasswordHash) {
      return res.status(401).json({
        success: false,
        message: 'Student password not configured. Please contact administrator.',
        code: 'PASSWORD_NOT_SET',
      });
    }

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, student.studentPasswordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Generate JWT token
    const tokenPayload = {
      id: student.id,
      email: student.studentUserId,
      name: student.studentFirstName,
      role: 'STUDENT',
      schoolId: student.schoolId,
      studentId: student.id,
      sessionVersion: student.sessionVersion,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        accessToken: token,
        refreshToken,
        user: {
          id: student.id,
          email: student.studentUserId,
          name: student.studentFirstName,
          role: 'STUDENT',
          schoolId: student.schoolId,
          studentId: student.id,
          school: student.school,
        },
      },
    });
  } catch (error) {
    console.error('Student login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
};

/**
 * Login endpoint for parents using parentUserId
 * POST /auth/login-parent
 * Body: { email: parentUserId, password: parentPassword }
 */
export const loginParent = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        code: 'MISSING_FIELDS',
      });
    }

    // Find student by parentUserId
    const normalizedEmail = normalizeLoginId(email);
    const student = await prisma.student.findUnique({
      where: { parentUserId: normalizedEmail },
      include: {
        school: {
          select: {
            id: true,
            schoolName: true,
            schoolCode: true,
          },
        },
      },
    });

    if (!student || !student.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Check if parentPasswordHash exists
    if (!student.parentPasswordHash) {
      return res.status(401).json({
        success: false,
        message: 'Parent password not configured. Please contact administrator.',
        code: 'PASSWORD_NOT_SET',
      });
    }

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, student.parentPasswordHash);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Generate JWT token
    const tokenPayload = {
      id: `parent_${student.id}`,
      email: student.parentUserId,
      name: student.fatherName,
      role: 'PARENT',
      schoolId: student.schoolId,
      studentId: student.id,
      sessionVersion: student.sessionVersion,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        accessToken: token,
        refreshToken,
        user: {
          id: `parent_${student.id}`,
          email: student.parentUserId,
          name: student.fatherName,
          role: 'PARENT',
          schoolId: student.schoolId,
          studentId: student.id,
          school: student.school,
        },
      },
    });
  } catch (error) {
    console.error('Parent login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
};
