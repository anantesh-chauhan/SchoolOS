import { verifyToken } from '../utils/jwt.util.js';
import prisma from '../config/prisma.client.js';

const VALID_ROLES = new Set([
  'PLATFORM_OWNER',
  'SCHOOL_OWNER',
  'PRINCIPAL',
  'EXAM_COORDINATOR',
  'EXAM_CONTROLLER',
  'ADMIN',
  'TEACHER',
  'CLASS_TEACHER',
  'PARENT',
  'STUDENT',
  'STAFF',
  'CURRICULUM_MANAGER',
  'FEE_MANAGER',
  'HR',
  'HR_MANAGER',
]);

// Verify JWT token middleware
export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided',
        code: 'NO_TOKEN',
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    if (!decoded?.id || !decoded?.role || !VALID_ROLES.has(decoded.role)) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token payload',
        code: 'INVALID_TOKEN_PAYLOAD',
      });
    }

    const account = ['STUDENT', 'PARENT'].includes(decoded.role) && decoded.studentId
      ? await prisma.student.findFirst({
          where: { id: decoded.studentId, schoolId: decoded.schoolId, isActive: true },
          select: { sessionVersion: true, school: { select: { status: true } } },
        })
      : await prisma.user.findFirst({
          where: { id: decoded.id, isActive: true },
          select: { sessionVersion: true, school: { select: { status: true } } },
        });
    if (!account || (decoded.sessionVersion !== undefined && account.sessionVersion !== decoded.sessionVersion)) {
      return res.status(401).json({ success: false, message: 'Session is no longer valid', code: 'SESSION_REVOKED' });
    }
    if (decoded.role !== 'PLATFORM_OWNER' && account.school?.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'School access is inactive', code: 'SCHOOL_INACTIVE' });
    }

    if (decoded.sessionId && decoded.roleAssignmentId) {
      const session = await prisma.authSession.findFirst({
        where: {
          id: decoded.sessionId,
          userId: decoded.id,
          roleAssignmentId: decoded.roleAssignmentId,
          revokedAt: null,
          expiresAt: { gt: new Date() },
          tokenVersion: decoded.tokenVersion || 1,
        },
        select: { id: true },
      });
      if (!session) {
        return res.status(401).json({ success: false, message: 'Session is no longer valid', code: 'SESSION_REVOKED' });
      }
    }
    
    if (decoded.roleAssignmentId) {
      const now = new Date();
      const assignment = await prisma.userSchoolRole.findFirst({
        where: {
          id: decoded.roleAssignmentId,
          userId: decoded.id,
          schoolId: decoded.schoolId,
          role: decoded.activeRole || decoded.role,
          isActive: true,
          AND: [
            { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
            { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
          ],
        },
        select: { id: true, role: true },
      });
      if (!assignment) {
        return res.status(401).json({
          success: false,
          message: 'This workspace is no longer available',
          code: 'ROLE_REVOKED',
        });
      }
      decoded.role = assignment.role;
      decoded.activeRole = assignment.role;
    }

    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Invalid token',
      code: 'INVALID_TOKEN',
    });
  }
};

// Role-based access control middleware
export const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized',
        code: 'UNAUTHORIZED',
      });
    }

    const compatibleRole = req.user.role === 'EXAM_CONTROLLER'
      ? 'EXAM_COORDINATOR'
      : req.user.role === 'HR_MANAGER' ? 'HR' : req.user.role;
    if (!allowedRoles.includes(req.user.role) && !allowedRoles.includes(compatibleRole)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden for role ${req.user.role}`,
        code: 'FORBIDDEN',
      });
    }

    next();
  };
};
