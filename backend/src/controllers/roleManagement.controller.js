import prisma from '../config/prisma.client.js';
import { recordWorkspaceAudit, ROLE_METADATA } from '../services/workspace.service.js';
import { validateSeparationPolicy } from '../services/separationOfDuties.service.js';

export const ROLE_TEMPLATES = Object.freeze({
  SMALL_SCHOOL_ACADEMIC_HEAD: ['EXAM_CONTROLLER', 'CURRICULUM_MANAGER', 'TEACHER'],
  SENIOR_TEACHER: ['TEACHER', 'CLASS_TEACHER'],
  ADMINISTRATIVE_HEAD: ['ADMIN', 'FEE_MANAGER', 'HR_MANAGER'],
});

const fail = (res, status, message, code = 'VALIDATION_ERROR') =>
  res.status(status).json({ success: false, message, code });

const assignmentInclude = { scopes: true };

export const listStaffRoles = async (req, res) => {
  const userId = String(req.params.userId || '').trim();
  const user = await prisma.user.findFirst({
    where: { id: userId, schoolId: req.user.schoolId },
    select: { id: true, name: true, email: true, roleAssignments: { include: assignmentInclude, orderBy: { createdAt: 'asc' } } },
  });
  if (!user) return fail(res, 404, 'Staff member not found', 'NOT_FOUND');
  return res.json({ success: true, data: user });
};

export const saveStaffRole = async (req, res) => {
  const userId = String(req.params.userId || '').trim();
  const role = String(req.body.role || '').trim().toUpperCase();
  const user = await prisma.user.findFirst({ where: { id: userId, schoolId: req.user.schoolId }, include: { roleAssignments: true } });
  if (!user) return fail(res, 404, 'Staff member not found', 'NOT_FOUND');
  if (!ROLE_METADATA[role]) return fail(res, 400, 'Choose a supported responsibility');

  const privilegedStaffRoles = new Set(['SCHOOL_OWNER', 'PRINCIPAL', 'ADMIN', 'EXAM_CONTROLLER', 'EXAM_COORDINATOR', 'CURRICULUM_MANAGER', 'FEE_MANAGER', 'HR', 'HR_MANAGER', 'TEACHER', 'CLASS_TEACHER', 'STAFF']);
  const existingRoles = new Set(user.roleAssignments.filter((item) => item.isActive).map((item) => item.role));
  if (['STUDENT', 'PARENT'].includes(role) && [...existingRoles].some((item) => privilegedStaffRoles.has(item))) {
    return fail(res, 409, 'Student or parent access cannot be mixed with staff responsibilities');
  }
  if (privilegedStaffRoles.has(role) && [...existingRoles].some((item) => ['STUDENT', 'PARENT'].includes(item))) {
    return fail(res, 409, 'Staff responsibilities cannot be added to a student or parent account');
  }

  const validFrom = req.body.validFrom ? new Date(req.body.validFrom) : null;
  const validUntil = req.body.validUntil ? new Date(req.body.validUntil) : null;
  if (validFrom && Number.isNaN(validFrom.getTime())) return fail(res, 400, 'Effective date is invalid');
  if (validUntil && Number.isNaN(validUntil.getTime())) return fail(res, 400, 'Expiry date is invalid');
  if (validFrom && validUntil && validUntil <= validFrom) return fail(res, 400, 'Expiry must be after the effective date');

  const scopes = Array.isArray(req.body.scopes) ? req.body.scopes : [];
  if (role === 'CLASS_TEACHER' && req.body.isActive !== false && !scopes.some((scope) => scope.classId && scope.sectionId)) {
    return fail(res, 400, 'Choose a class and section for the Class Teacher workspace');
  }

  const assignment = await prisma.$transaction(async (tx) => {
    if (req.body.isDefault) {
      await tx.userSchoolRole.updateMany({ where: { userId, schoolId: req.user.schoolId }, data: { isDefault: false } });
    }
    const saved = await tx.userSchoolRole.upsert({
      where: { userId_schoolId_role: { userId, schoolId: req.user.schoolId, role } },
      update: {
        isActive: req.body.isActive !== false,
        isDefault: Boolean(req.body.isDefault),
        validFrom,
        validUntil,
        assignmentNotes: req.body.assignmentNotes || null,
        updatedById: req.user.id,
      },
      create: {
        userId,
        schoolId: req.user.schoolId,
        role,
        isActive: req.body.isActive !== false,
        isDefault: Boolean(req.body.isDefault),
        validFrom,
        validUntil,
        assignmentNotes: req.body.assignmentNotes || null,
        assignedById: req.user.id,
        updatedById: req.user.id,
      },
    });
    if (Array.isArray(req.body.scopes)) {
      await tx.roleScope.deleteMany({ where: { roleAssignmentId: saved.id } });
      if (scopes.length) await tx.roleScope.createMany({ data: scopes.map((scope) => ({
        roleAssignmentId: saved.id,
        scopeType: String(scope.scopeType || 'ASSIGNED').toUpperCase(),
        classId: scope.classId || null,
        sectionId: scope.sectionId || null,
        subjectId: scope.subjectId || null,
        sessionId: scope.sessionId || null,
        examinationId: scope.examinationId || null,
        metadata: scope.metadata,
      })) });
    }
    return tx.userSchoolRole.findUnique({ where: { id: saved.id }, include: assignmentInclude });
  });

  await recordWorkspaceAudit(req, {
    userId: req.user.id, schoolId: req.user.schoolId, activeRole: req.user.role,
    roleAssignmentId: req.user.roleAssignmentId, sessionId: req.user.sessionId,
    action: 'ROLE_ASSIGNMENT_UPDATED', entityType: 'UserSchoolRole', entityId: assignment.id,
    newValue: { userId, role, isActive: assignment.isActive, isDefault: assignment.isDefault },
  });
  return res.json({ success: true, message: 'Assigned responsibilities updated', data: assignment });
};

export const revokeStaffRole = async (req, res) => {
  const assignment = await prisma.userSchoolRole.findFirst({ where: { id: req.params.assignmentId, schoolId: req.user.schoolId } });
  if (!assignment) return fail(res, 404, 'Workspace assignment not found', 'NOT_FOUND');
  await prisma.$transaction([
    prisma.userSchoolRole.update({ where: { id: assignment.id }, data: { isActive: false, isDefault: false, updatedById: req.user.id } }),
    prisma.user.updateMany({ where: { id: assignment.userId, lastActiveRoleId: assignment.id }, data: { lastActiveRoleId: null } }),
  ]);
  await recordWorkspaceAudit(req, {
    userId: req.user.id, schoolId: req.user.schoolId, activeRole: req.user.role,
    roleAssignmentId: req.user.roleAssignmentId, sessionId: req.user.sessionId,
    action: 'ROLE_ASSIGNMENT_REVOKED', entityType: 'UserSchoolRole', entityId: assignment.id,
    oldValue: { userId: assignment.userId, role: assignment.role },
  });
  return res.json({ success: true, message: 'Workspace access revoked' });
};

export const getRoleTemplates = (_req, res) => res.json({ success: true, data: ROLE_TEMPLATES });

export const getAuditLog = async (req, res) => {
  const rows = await prisma.workspaceAuditLog.findMany({
    where: { schoolId: req.user.schoolId },
    orderBy: { createdAt: 'desc' },
    take: Math.min(Number(req.query.limit) || 100, 250),
    include: { user: { select: { name: true, email: true } } },
  });
  return res.json({ success: true, data: rows });
};

export const getSeparationPolicy = async (req, res) => {
  const policy = await prisma.separationOfDutiesPolicy.findUnique({ where: { schoolId: req.user.schoolId } });
  return res.json({ success: true, data: policy || { schoolId: req.user.schoolId, mode: 'STRICT', principalApprovalRequired: false } });
};

export const saveSeparationPolicy = async (req, res) => {
  try {
    const policy = validateSeparationPolicy(req.body);
    const saved = await prisma.separationOfDutiesPolicy.upsert({
      where: { schoolId: req.user.schoolId },
      update: { ...policy, workflows: req.body.workflows, updatedById: req.user.id },
      create: { schoolId: req.user.schoolId, ...policy, workflows: req.body.workflows, updatedById: req.user.id },
    });
    return res.json({ success: true, message: 'Approval safeguards updated', data: saved });
  } catch (error) { return fail(res, 400, error.message); }
};
