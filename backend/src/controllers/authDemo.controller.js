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

export const getDemoAccounts = async (req, res) => {
  try {
    if (!instantLoginEnabled()) {
      return res.status(404).json({ success: false, message: 'Instant login is disabled' });
    }

    const [users, portalStudents] = await Promise.all([prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['PLATFORM_OWNER', 'SCHOOL_OWNER', 'PRINCIPAL', 'EXAM_COORDINATOR', 'EXAM_CONTROLLER', 'ADMIN', 'CURRICULUM_MANAGER', 'FEE_MANAGER', 'HR', 'HR_MANAGER', 'TEACHER', 'CLASS_TEACHER', 'STAFF'] },
      },
      select: {
        id: true,
        email: true,
        contactEmail: true,
        name: true,
        role: true,
        schoolId: true,
        employeeId: true,
        lastActiveRoleId: true,
        roleAssignments: {
          where: { isActive: true },
          include: { scopes: true },
          orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
        },
        school: { select: { id: true, schoolName: true } },
        class: { select: { className: true } },
        section: { select: { sectionName: true } },
      },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
    }), prisma.student.findMany({
      where: { isActive: true },
      select: {
        id: true,
        studentFirstName: true,
        studentLastName: true,
        fatherName: true,
        studentUserId: true,
        parentUserId: true,
        className: true,
        section: true,
        school: { select: { schoolName: true } },
      },
      orderBy: [{ schoolId: 'asc' }, { className: 'asc' }, { section: 'asc' }, { studentFirstName: 'asc' }],
    })]);

    const teacherUsers = users.filter((user) => user.role === 'TEACHER'
      || user.roleAssignments.some((item) => ['TEACHER', 'CLASS_TEACHER'].includes(item.role)));
    const teacherEmails = teacherUsers.map((user) => user.email);
    const teacherContactEmails = teacherUsers.map((user) => user.contactEmail).filter(Boolean);
    const teacherEmployeeIds = teacherUsers.map((user) => user.employeeId).filter(Boolean);
    const teachers = teacherUsers.length
      ? await prisma.teacher.findMany({
          where: {
            deletedAt: null,
            OR: [
              ...(teacherEmails.length ? [{ email: { in: teacherEmails } }] : []),
              ...(teacherContactEmails.length ? [{ email: { in: teacherContactEmails } }] : []),
              ...(teacherEmployeeIds.length ? [{ employeeId: { in: teacherEmployeeIds } }] : []),
            ],
          },
          include: {
            school: { select: { schoolName: true } },
            teacherAssignments: {
              where: { isActive: true },
              include: {
                class: { select: { className: true } },
                section: { select: { sectionName: true } },
                subject: { select: { subjectName: true } },
              },
              orderBy: [{ class: { classOrder: 'asc' } }, { section: { sectionOrder: 'asc' } }],
            },
          },
        })
      : [];

    const teacherByLoginEmail = new Map();
    const teacherByContactEmail = new Map();
    const teacherByEmployee = new Map();
    teachers.forEach((teacher) => {
      teacherByLoginEmail.set(teacher.email, teacher);
      teacherByContactEmail.set(teacher.email, teacher);
      teacherByEmployee.set(`${teacher.schoolId}:${teacher.employeeId}`, teacher);
    });
    const labelByRole = {
      PLATFORM_OWNER: 'Platform Owner',
      SCHOOL_OWNER: 'School Owners',
      PRINCIPAL: 'Principals',
      EXAM_COORDINATOR: 'Exam Controllers',
      EXAM_CONTROLLER: 'Exam Controllers',
      ADMIN: 'Administrators',
      TEACHER: 'Teachers',
      CLASS_TEACHER: 'Class Teachers',
      STUDENT: 'Students',
      PARENT: 'Parents',
      STAFF: 'Staff',
      CURRICULUM_MANAGER: 'Curriculum Managers',
      FEE_MANAGER: 'Fee Managers',
      HR: 'Human Resources',
      HR_MANAGER: 'Human Resources',
    };

    const groups = ['Platform Owner', 'School Owners', 'Principals', 'Exam Controllers', 'Administrators', 'Curriculum Managers', 'Fee Managers', 'Human Resources', 'Class Teachers', 'Teachers', 'Staff', 'Students', 'Parents']
      .map((role) => ({ role, users: [] }));
    const groupByLabel = new Map(groups.map((group) => [group.role, group]));
    users.forEach((user) => {
      if (['STUDENT', 'PARENT'].includes(user.role)) return;
      const now = new Date();
      const activeAssignments = user.roleAssignments.filter((item) =>
        item.schoolId === user.schoolId
        && (!item.validFrom || new Date(item.validFrom) <= now)
        && (!item.validUntil || new Date(item.validUntil) > now));
      const workspaces = activeAssignments.length ? activeAssignments : [{ id: null, role: user.role, scopes: [] }];
      const teacher = workspaces.some((item) => ['TEACHER', 'CLASS_TEACHER'].includes(item.role))
        ? teacherByLoginEmail.get(user.email)
          || teacherByContactEmail.get(user.contactEmail)
          || teacherByEmployee.get(`${user.schoolId}:${user.employeeId}`)
        : null;
      workspaces.forEach((workspace) => {
        const label = labelByRole[workspace.role];
        if (!label || !groupByLabel.has(label)) return;
        const isClassTeacher = workspace.role === 'CLASS_TEACHER';
        const relevantAssignments = isClassTeacher
          ? (teacher?.teacherAssignments || []).filter((row) => ['CLASS_TEACHER', 'BOTH'].includes(row.roleType))
          : (teacher?.teacherAssignments || []);
        const scoped = workspace.scopes?.[0];
        const assignmentPreview = relevantAssignments.length
          ? relevantAssignments.slice(0, 4).map((row) => `${row.class.className}-${row.section.sectionName}${isClassTeacher ? ' · Class Teacher' : ` ${row.subject.subjectName}`}`).join(', ')
          : isClassTeacher ? 'Class-teacher section is awaiting allocation' : ROLE_METADATA[workspace.role]?.description || '';
        const firstAssignment = relevantAssignments[0];
        const className = user.class?.className || firstAssignment?.class?.className || null;
        const sectionName = user.section?.sectionName || firstAssignment?.section?.sectionName || null;
        groupByLabel.get(label).users.push({
          accountKey: workspace.id ? `workspace:${user.id}:${workspace.id}` : `user:${user.id}`,
          name: user.name,
          email: user.email,
          role: workspace.role,
          workspaceLabel: ROLE_METADATA[workspace.role]?.label || workspace.role,
          schoolName: user.school?.schoolName || teacher?.school?.schoolName || 'Platform',
          className,
          sectionName,
          scope: scoped || null,
          assignmentPreview,
        });
      });
    });

    portalStudents.forEach((student) => {
      const studentName = [student.studentFirstName, student.studentLastName].filter(Boolean).join(' ');
      if (student.studentUserId) {
        groupByLabel.get('Students').users.push({
          accountKey: `student:${student.id}`,
          name: studentName,
          email: student.studentUserId,
          role: 'STUDENT',
          schoolName: student.school?.schoolName || 'School',
          className: student.className || null,
          sectionName: student.section || null,
          assignmentPreview: '',
        });
      }
      if (student.parentUserId) {
        groupByLabel.get('Parents').users.push({
          accountKey: `parent:${student.id}`,
          name: student.fatherName || `Parent of ${studentName}`,
          email: student.parentUserId,
          role: 'PARENT',
          schoolName: student.school?.schoolName || 'School',
          className: student.className || null,
          sectionName: student.section || null,
          assignmentPreview: `Parent of ${studentName}`,
        });
      }
    });

    groups.forEach((group) => group.users.sort((a, b) => a.name.localeCompare(b.name)));

    return res.json({ success: true, data: groups });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Failed to load demo accounts',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

export const instantLogin = async (req, res) => {
  try {
    if (!instantLoginEnabled()) {
      return res.status(404).json({ success: false, message: 'Instant login is disabled' });
    }

    const [accountType, accountId, requestedAssignmentId] = String(req.body.accountKey || '').split(':');
    if (!accountId || !['workspace', 'user', 'student', 'parent'].includes(accountType)) {
      return res.status(400).json({ success: false, message: 'A valid instant-login account is required' });
    }

    if (accountType === 'student' || accountType === 'parent') {
      const student = await prisma.student.findFirst({
        where: { id: accountId, isActive: true },
        select: portalStudentSelect,
      });
      if (!student) return res.status(404).json({ success: false, message: 'Account is no longer active' });

      const session = buildPortalSession(student, accountType === 'parent' ? 'PARENT' : 'STUDENT');
      const token = generateToken(session.payload);
      const refreshToken = generateRefreshToken(session.payload);
      return res.json({
        success: true,
        message: 'Instant login successful',
        data: { token, accessToken: token, refreshToken, user: session.user },
      });
    }

    const user = await prisma.user.findFirst({
      where: { id: accountId, isActive: true },
      select: {
        id: true, email: true, name: true, role: true, schoolId: true, classId: true, sectionId: true,
        contactEmail: true, employeeId: true, joiningYear: true, mustChangePassword: true,
        alternateMobile: true, profileImage: true, sessionVersion: true,
        lastActiveRoleId: true,
        school: { select: { id: true, schoolName: true, schoolCode: true, logoUrl: true, address: true, city: true, state: true, phone: true, email: true, status: true } },
        class: { select: { id: true, className: true, classOrder: true } },
        section: { select: { id: true, sectionName: true, sectionOrder: true, classId: true } },
      },
    });
    if (!user) return res.status(404).json({ success: false, message: 'Account is no longer active' });
    if (user.role !== 'PLATFORM_OWNER' && user.school?.status !== 'ACTIVE') {
      return res.status(403).json({ success: false, message: 'School access is inactive' });
    }

    const assignments = await getAvailableAssignments(user.id, user.schoolId);
    let activeAssignment = requestedAssignmentId
      ? assignments.find((item) => item.id === requestedAssignmentId)
      : chooseActiveAssignment(assignments, user.lastActiveRoleId);
    if (accountType === 'workspace' && !activeAssignment) {
      return res.status(403).json({ success: false, message: 'That demo workspace is no longer active' });
    }
    if (activeAssignment) {
      activeAssignment = await prisma.userSchoolRole.findUnique({ where: { id: activeAssignment.id }, include: { scopes: true } });
    }
    const payload = createSessionPayload(user, activeAssignment);
    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);
    if (activeAssignment) await saveAuthSession(req, payload, refreshToken);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date(), ...(activeAssignment ? { lastActiveRoleId: activeAssignment.id } : {}) } });

    const classTeacherContext = await getClassTeacherContext(user, activeAssignment);
    const workspace = buildWorkspaceContext({ ...user, lastActiveRoleId: activeAssignment?.id || null }, assignments, activeAssignment);

    return res.json({
      success: true,
      message: 'Instant login successful',
      data: {
        token,
        accessToken: token,
        refreshToken,
        user: {
          ...user,
          role: payload.role,
          studentId: null,
          classTeacherContext,
          roleScope: activeAssignment?.scopes || [],
          ...workspace,
        },
        ...workspace,
      },
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Instant login failed',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};
