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

export const normalizeLoginId = (value) => String(value ?? '').trim().toLowerCase();
export const instantLoginEnabled = () => process.env.NODE_ENV !== 'production' || process.env.ENABLE_INSTANT_LOGIN === 'true';

export const portalStudentSelect = {
  id: true,
  schoolId: true,
  studentFirstName: true,
  studentLastName: true,
  fatherName: true,
  studentUserId: true,
  parentUserId: true,
  className: true,
  section: true,
  isActive: true,
  sessionVersion: true,
  studentMustChangePassword: true,
  parentMustChangePassword: true,
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
};

export const findPortalStudent = async ({ role, email, studentId, schoolId }) => {
  if (!['STUDENT', 'PARENT'].includes(role)) return null;
  const normalizedEmail = normalizeLoginId(email);
  return prisma.student.findFirst({
    where: {
      ...(studentId ? { id: studentId } : {}),
      ...(schoolId ? { schoolId } : {}),
      isActive: true,
      ...(role === 'STUDENT' ? { studentUserId: normalizedEmail } : { parentUserId: normalizedEmail }),
    },
    select: portalStudentSelect,
  });
};

export const buildPortalSession = (student, role) => {
  const isParent = role === 'PARENT';
  const id = isParent ? `parent_${student.id}` : student.id;
  const email = isParent ? student.parentUserId : student.studentUserId;
  const name = isParent
    ? student.fatherName
    : [student.studentFirstName, student.studentLastName].filter(Boolean).join(' ');
  return {
    payload: { id, email, name, role, schoolId: student.schoolId, studentId: student.id, sessionVersion: student.sessionVersion },
    user: {
      id,
      email,
      name,
      role,
      schoolId: student.schoolId,
      studentId: student.id,
      linkedStudent: {
        id: student.id,
        studentFirstName: student.studentFirstName,
        studentLastName: student.studentLastName,
        className: student.className,
        section: student.section,
      },
      classId: null,
      sectionId: null,
      mustChangePassword: isParent ? student.parentMustChangePassword : student.studentMustChangePassword,
      school: student.school,
    },
  };
};
