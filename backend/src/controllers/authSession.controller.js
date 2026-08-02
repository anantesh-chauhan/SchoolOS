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

export const logout = async (req, res) => {
  try {
    await revokeAuthSession(req.user.sessionId, req.user.id);
    res.json({
      success: true,
      message: 'Logout successful',
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
};

export const refreshSession = async (req, res) => {
  try {
    const incomingToken = req.body?.refreshToken;
    if (!incomingToken) {
      return res.status(400).json({
        success: false,
        message: 'refreshToken is required',
        code: 'MISSING_REFRESH_TOKEN',
      });
    }

    const decoded = verifyRefreshToken(incomingToken);
    if (['STUDENT', 'PARENT'].includes(decoded.role) && decoded.studentId) {
      const portalStudent = await findPortalStudent({
        role: decoded.role,
        email: decoded.email,
        studentId: decoded.studentId,
        schoolId: decoded.schoolId,
      });
      if (!portalStudent) {
        return res.status(401).json({ success: false, message: 'Portal account not found or inactive', code: 'INVALID_REFRESH_TOKEN' });
      }

      const session = buildPortalSession(portalStudent, decoded.role);
      const accessToken = generateToken(session.payload);
      const refreshToken = generateRefreshToken(session.payload);
      return res.json({
        success: true,
        message: 'Session refreshed',
        data: { token: accessToken, accessToken, refreshToken, user: session.user },
      });
    }

    const refreshSession = await validateRefreshSession(decoded, incomingToken);
    if (refreshSession === false) {
      return res.status(401).json({ success: false, message: 'Refresh token was already used or revoked', code: 'REFRESH_REUSE_DETECTED' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { school: true },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found for refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    const linkedStudent = ['STUDENT', 'PARENT'].includes(user.role)
      ? await prisma.student.findFirst({
          where: {
            schoolId: user.schoolId,
            isActive: true,
            ...(user.role === 'STUDENT' ? { studentUserId: user.email } : { parentUserId: user.email }),
          },
          select: { id: true },
        })
      : null;

    const assignments = await getAvailableAssignments(user.id, user.schoolId);
    const activeAssignment = decoded.roleAssignmentId
      ? assignments.find((item) => item.id === decoded.roleAssignmentId)
      : chooseActiveAssignment(assignments, user.lastActiveRoleId);
    if (decoded.roleAssignmentId && !activeAssignment) {
      return res.status(401).json({ success: false, message: 'Workspace access was revoked', code: 'ROLE_REVOKED' });
    }
    const payload = {
      ...createSessionPayload(user, activeAssignment, decoded.sessionId),
      ...(linkedStudent ? { studentId: linkedStudent.id } : {}),
    };
    const workspace = buildWorkspaceContext(user, assignments, activeAssignment);

    const accessToken = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);
    if (activeAssignment) await saveAuthSession(req, payload, refreshToken);

    return res.json({
      success: true,
      message: 'Session refreshed',
      data: {
        token: accessToken,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: payload.role,
          schoolId: user.schoolId,
          studentId: linkedStudent?.id || null,
          school: user.school,
          ...workspace,
        },
        ...workspace,
      },
    });
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: error.message || 'Failed to refresh session',
      code: 'REFRESH_FAILED',
    });
  }
};

export const logoutAllDevices = async (req, res) => {
  await revokeAllAuthSessions(req.user.id);
  return res.json({ success: true, message: 'Signed out from all devices' });
};

export const switchRole = async (req, res) => {
  try {
    const roleAssignmentId = String(req.body?.roleAssignmentId || '').trim();
    if (!roleAssignmentId) {
      return res.status(400).json({ success: false, message: 'Choose a workspace', code: 'MISSING_ROLE_ASSIGNMENT' });
    }

    const now = new Date();
    const user = await prisma.user.findFirst({
      where: { id: req.user.id, isActive: true },
      include: { school: true },
    });
    if (!user || !user.schoolId || user.school?.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'Your school account is not active', code: 'ACCOUNT_INACTIVE' });
    }

    const assignment = await prisma.userSchoolRole.findFirst({
      where: {
        id: roleAssignmentId,
        userId: user.id,
        schoolId: req.user.schoolId,
        isActive: true,
        AND: [
          { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
          { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
        ],
      },
    });
    if (!assignment) {
      return res.status(403).json({ success: false, message: 'That workspace is not available', code: 'INVALID_ROLE_ASSIGNMENT' });
    }

    const previous = req.user.roleAssignmentId
      ? await prisma.userSchoolRole.findUnique({ where: { id: req.user.roleAssignmentId } })
      : null;
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { lastActiveRoleId: assignment.id } });
      if (req.body?.setDefault === true) {
        await tx.userSchoolRole.updateMany({ where: { userId: user.id, schoolId: assignment.schoolId }, data: { isDefault: false } });
        await tx.userSchoolRole.update({ where: { id: assignment.id }, data: { isDefault: true } });
        assignment.isDefault = true;
      }
    });
    const payload = createSessionPayload(user, assignment, req.user.sessionId);
    const accessToken = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const assignments = await getAvailableAssignments(user.id, assignment.schoolId);
    const workspace = buildWorkspaceContext({ ...user, lastActiveRoleId: assignment.id }, assignments, assignment);
    const classTeacherContext = await getClassTeacherContext(user, assignment);
    await saveAuthSession(req, payload, refreshToken);

    await recordWorkspaceAudit(req, {
      userId: user.id,
      schoolId: assignment.schoolId,
      activeRole: assignment.role,
      roleAssignmentId: assignment.id,
      sessionId: payload.sessionId,
      action: 'WORKSPACE_SWITCHED',
      entityType: 'UserSchoolRole',
      entityId: assignment.id,
      oldValue: previous ? { assignmentId: previous.id, role: previous.role } : undefined,
      newValue: { assignmentId: assignment.id, role: assignment.role },
    });

    return res.json({
      success: true,
      message: `Switched to ${workspace.activeRole.label} workspace`,
      data: {
        token: accessToken,
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: assignment.role,
          schoolId: assignment.schoolId,
          school: user.school,
          classTeacherContext,
          roleScope: assignment.scopes || [],
          ...workspace,
        },
        ...workspace,
      },
    });
  } catch (error) {
    console.error('Switch role error:', error);
    return res.status(500).json({ success: false, message: 'Could not switch workspace', code: 'SWITCH_ROLE_FAILED' });
  }
};
