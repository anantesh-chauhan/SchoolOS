import { randomUUID } from 'node:crypto';
import prisma from '../config/prisma.client.js';
import { permissionsForRole } from '../config/permissions.js';

export const ROLE_METADATA = Object.freeze({
  PLATFORM_OWNER: { label: 'Platform Owner', description: 'Manage the SchoolOS platform', risk: 90 },
  SCHOOL_OWNER: { label: 'School Owner', description: 'Manage school governance and settings', risk: 80 },
  PRINCIPAL: { label: 'Principal', description: 'Oversee school academics and approvals', risk: 70 },
  ADMIN: { label: 'Administrator', description: 'Manage people, classes and school operations', risk: 60 },
  EXAM_COORDINATOR: { label: 'Exam Controller', description: 'Configure examinations and publish results', risk: 55 },
  EXAM_CONTROLLER: { label: 'Exam Controller', description: 'Configure examinations and publish results', risk: 55 },
  CURRICULUM_MANAGER: { label: 'Curriculum Manager', description: 'Plan curriculum and academic progress', risk: 45 },
  FEE_MANAGER: { label: 'Fee Manager', description: 'Manage fees, collections and reports', risk: 45 },
  HR: { label: 'HR Manager', description: 'Manage employees, attendance and payroll', risk: 45 },
  HR_MANAGER: { label: 'HR Manager', description: 'Manage employees, attendance and payroll', risk: 45 },
  CLASS_TEACHER: { label: 'Class Teacher', description: 'Manage your section, attendance and verification', risk: 20 },
  TEACHER: { label: 'Subject Teacher', description: 'Manage assigned subjects, homework and marks', risk: 10 },
  STAFF: { label: 'Staff', description: 'Access staff services and school communication', risk: 15 },
  PARENT: { label: 'Parent', description: 'Follow your child’s school journey', risk: 5 },
  STUDENT: { label: 'Student', description: 'Access learning, attendance and results', risk: 5 },
});

export const assignmentIsValid = (assignment, now = new Date()) => Boolean(
  assignment?.isActive
  && (!assignment.validFrom || new Date(assignment.validFrom) <= now)
  && (!assignment.validUntil || new Date(assignment.validUntil) > now)
);

export const serializeAssignment = (assignment) => ({
  assignmentId: assignment.id,
  role: assignment.role,
  label: ROLE_METADATA[assignment.role]?.label || assignment.role,
  description: ROLE_METADATA[assignment.role]?.description || 'Open this workspace',
  isDefault: assignment.isDefault,
  validFrom: assignment.validFrom,
  validUntil: assignment.validUntil,
  pendingTasks: Number(assignment.pendingTasks || 0),
});

export const chooseActiveAssignment = (assignments, lastActiveRoleId) => {
  const valid = assignments.filter((item) => assignmentIsValid(item));
  return valid.find((item) => item.id === lastActiveRoleId)
    || valid.find((item) => item.isDefault)
    || [...valid].sort((a, b) =>
      (ROLE_METADATA[a.role]?.risk ?? 50) - (ROLE_METADATA[b.role]?.risk ?? 50))[0]
    || null;
};

export const getAvailableAssignments = async (userId, schoolId) => {
  if (!schoolId) return [];
  const now = new Date();
  return prisma.userSchoolRole.findMany({
    where: {
      userId,
      schoolId,
      isActive: true,
      AND: [
        { OR: [{ validFrom: null }, { validFrom: { lte: now } }] },
        { OR: [{ validUntil: null }, { validUntil: { gt: now } }] },
      ],
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    include: { scopes: true },
  });
};

export const getClassTeacherContext = async (user, assignment) => {
  if (assignment?.role !== 'CLASS_TEACHER' || !user?.schoolId) return null;
  const teacher = await prisma.teacher.findFirst({
    where: {
      schoolId: user.schoolId,
      deletedAt: null,
      OR: [
        { email: user.email },
        ...(user.contactEmail ? [{ email: user.contactEmail }] : []),
        ...(user.employeeId ? [{ employeeId: user.employeeId }] : []),
      ],
    },
    select: {
      id: true,
      teacherName: true,
      teacherAssignments: {
        where: { isActive: true, roleType: { in: ['CLASS_TEACHER', 'BOTH'] } },
        select: { classId: true, sectionId: true, class: { select: { className: true } }, section: { select: { sectionName: true } } },
      },
    },
  });
  if (!teacher) return null;
  const canonicalAssignments = await prisma.sectionClassTeacherAssignment.findMany({
    where: {
      schoolId: user.schoolId,
      teacherId: teacher.id,
      status: 'ACTIVE',
      isPrimary: true,
      startDate: { lte: new Date() },
      OR: [{ endDate: null }, { endDate: { gte: new Date() } }],
    },
    select: { sectionId: true, section: { select: { classId: true, sectionName: true, class: { select: { className: true } } } } },
  });
  const sections = new Map();
  canonicalAssignments.forEach((row) => sections.set(row.sectionId, {
    classId: row.section.classId, className: row.section.class.className,
    sectionId: row.sectionId, sectionName: row.section.sectionName,
  }));
  teacher.teacherAssignments.forEach((row) => sections.set(row.sectionId, {
    classId: row.classId, className: row.class.className,
    sectionId: row.sectionId, sectionName: row.section.sectionName,
  }));
  return {
    teacherId: teacher.id,
    teacherName: teacher.teacherName,
    sections: [...sections.values()],
  };
};

export const createSessionPayload = (user, assignment, existingSessionId) => ({
  id: user.id,
  sub: user.id,
  email: user.email,
  name: user.name,
  role: assignment?.role || user.role,
  activeRole: assignment?.role || user.role,
  roleAssignmentId: assignment?.id || null,
  schoolId: assignment?.schoolId || user.schoolId,
  employeeId: user.employeeId,
  sessionId: existingSessionId || randomUUID(),
  sessionVersion: user.sessionVersion,
  tokenVersion: 1,
});

export const buildWorkspaceContext = (user, assignments, activeAssignment) => ({
  availableRoles: assignments.map(serializeAssignment),
  activeRole: activeAssignment ? serializeAssignment(activeAssignment) : null,
  activeRoleAssignmentId: activeAssignment?.id || null,
  permissions: permissionsForRole(activeAssignment?.role || user.role),
  requiresWorkspaceSelection: assignments.length > 1 && !user.lastActiveRoleId
    && !assignments.some((item) => item.isDefault),
});

export const recordWorkspaceAudit = async (req, data) => {
  if (!data.userId || !data.schoolId || !data.activeRole) return null;
  return prisma.workspaceAuditLog.create({ data: {
    userId: data.userId,
    schoolId: data.schoolId,
    activeRole: data.activeRole,
    roleAssignmentId: data.roleAssignmentId || null,
    action: data.action,
    entityType: data.entityType || null,
    entityId: data.entityId || null,
    oldValue: data.oldValue,
    newValue: data.newValue,
    reason: data.reason || null,
    ipAddress: req?.ip || null,
    userAgent: req?.get?.('user-agent') || null,
    sessionId: data.sessionId || null,
  } });
};
