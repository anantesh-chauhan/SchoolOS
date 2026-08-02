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

export const getMe = async (req, res) => {
  try {
    if (['STUDENT', 'PARENT'].includes(req.user.role) && req.user.studentId) {
      const portalStudent = await findPortalStudent({
        role: req.user.role,
        email: req.user.email,
        studentId: req.user.studentId,
        schoolId: req.user.schoolId,
      });
      if (!portalStudent) {
        return res.status(404).json({ success: false, message: 'Portal account not found or inactive', code: 'NOT_FOUND' });
      }
      return res.json({
        success: true,
        data: {
          ...buildPortalSession(portalStudent, req.user.role).user,
          permissions: permissionsForRole(req.user.role),
        },
      });
    }

    // user is already attached by authMiddleware
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        schoolId: true,
        classId: true,
        sectionId: true,
        contactEmail: true,
        employeeId: true,
        joiningYear: true,
        mustChangePassword: true,
        isActive: true,
        sessionVersion: true,
        lastActiveRoleId: true,
        lockedUntil: true,
        failedLoginAttempts: true,
        alternateMobile: true,
        profileImage: true,
        school: {
          select: {
            id: true,
            schoolName: true,
            schoolCode: true,
            logoUrl: true,
            address: true,
            city: true,
            state: true,
            phone: true,
            email: true,
            status: true,
          },
        },
        class: {
          select: {
            id: true,
            className: true,
            classOrder: true,
          },
        },
        section: {
          select: {
            id: true,
            sectionName: true,
            sectionOrder: true,
            classId: true,
          },
        },
      },
    });

    if (!user || !user.isActive) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'NOT_FOUND',
      });
    }

    const linkedStudent = ['STUDENT', 'PARENT'].includes(user.role)
      ? await prisma.student.findFirst({
          where: {
            schoolId: user.schoolId,
            isActive: true,
            ...(user.role === 'STUDENT' ? { studentUserId: user.email } : { parentUserId: user.email }),
          },
          select: {
            id: true,
            studentFirstName: true,
            studentLastName: true,
            className: true,
            section: true,
          },
        })
      : null;

    const availableAssignments = await getAvailableAssignments(user.id, user.schoolId);
    const activeAssignment = availableAssignments.find((item) => item.id === req.user.roleAssignmentId)
      || chooseActiveAssignment(availableAssignments, user.lastActiveRoleId);
    const workspace = buildWorkspaceContext(user, availableAssignments, activeAssignment);
    const classTeacherContext = await getClassTeacherContext(user, activeAssignment);

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: activeAssignment?.role || req.user.role || user.role,
        schoolId: user.schoolId,
        studentId: linkedStudent?.id || null,
        linkedStudent,
        classId: user.classId,
        sectionId: user.sectionId,
        contactEmail: user.contactEmail,
        employeeId: user.employeeId,
        joiningYear: user.joiningYear,
        mustChangePassword: user.mustChangePassword,
        alternateMobile: user.alternateMobile,
        profileImage: user.profileImage,
        school: user.school,
        class: user.class,
        section: user.section,
        classTeacherContext,
        roleScope: activeAssignment?.scopes || [],
        ...workspace,
      },
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
};

/**
 * Login endpoint for students using studentUserId
 * POST /auth/login-student
 * Body: { email: studentUserId, password: studentPassword }
 */
