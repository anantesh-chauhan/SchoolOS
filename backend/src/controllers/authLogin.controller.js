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

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = normalizeLoginId(email);

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required',
        code: 'MISSING_FIELDS',
      });
    }

    // Student and parent identities may also have legacy User rows. Their
    // authoritative credentials live on Student, so resolve them first.
    const portalStudent = await prisma.student.findFirst({
      where: {
        isActive: true,
        OR: [{ studentUserId: normalizedEmail }, { parentUserId: normalizedEmail }],
      },
      select: { ...portalStudentSelect, studentPasswordHash: true, parentPasswordHash: true },
    });
    if (portalStudent) {
      const role = portalStudent.studentUserId === normalizedEmail ? 'STUDENT' : 'PARENT';
      const passwordHash = role === 'STUDENT' ? portalStudent.studentPasswordHash : portalStudent.parentPasswordHash;
      const passwordMatches = passwordHash ? await bcryptjs.compare(password, passwordHash) : false;
      if (!passwordMatches) {
        return res.status(401).json({ success: false, message: 'Invalid email or password', code: 'INVALID_CREDENTIALS' });
      }
      const session = buildPortalSession(portalStudent, role);
      const token = generateToken(session.payload);
      const refreshToken = generateRefreshToken(session.payload);
      return res.json({
        success: true,
        message: 'Login successful',
        data: { token, accessToken: token, refreshToken, user: session.user },
      });
    }

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        password: true,
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
        alternateMobile: true,
        profileImage: true,
        sessionVersion: true,
        lastActiveRoleId: true,
        roleAssignments: {
          where: { isActive: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
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

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    if (!user.isActive) {
      return res.status(403).json({ success: false, message: 'This account is inactive', code: 'ACCOUNT_INACTIVE' });
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      return res.status(423).json({ success: false, message: 'Account temporarily locked. Try again later.', code: 'ACCOUNT_LOCKED' });
    }

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, user.password);

    if (!isPasswordValid) {
      await prisma.user.update({ where: { id: user.id }, data: { failedLoginAttempts: { increment: 1 } } });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), failedLoginAttempts: 0, lockedUntil: null } });

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

    // Generate JWT token
    const availableAssignments = (user.roleAssignments || []).filter((assignment) => {
      const now = new Date();
      return assignment.schoolId === user.schoolId
        && (!assignment.validFrom || new Date(assignment.validFrom) <= now)
        && (!assignment.validUntil || new Date(assignment.validUntil) > now);
    });
    const activeAssignment = chooseActiveAssignment(availableAssignments, user.lastActiveRoleId);
    const tokenPayload = {
      ...createSessionPayload(user, activeAssignment),
      ...(linkedStudent ? { studentId: linkedStudent.id } : {}),
    };
    const workspace = buildWorkspaceContext(user, availableAssignments, activeAssignment);
    const classTeacherContext = await getClassTeacherContext(user, activeAssignment);

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);
    if (activeAssignment) await saveAuthSession(req, tokenPayload, refreshToken);

    // Return success response
    res.json({
      success: true,
      message: 'Login successful',
      data: {
        token,
        accessToken: token,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: tokenPayload.role,
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
        ...workspace,
      },
    });
  } catch (error) {
    console.error('Login error:', error);

    if (error?.code === 'P2021') {
      return res.status(500).json({
        success: false,
        message: 'Database schema is not initialized. Run Prisma db push and seed.',
        code: 'DB_NOT_INITIALIZED',
      });
    }

    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR',
    });
  }
};
