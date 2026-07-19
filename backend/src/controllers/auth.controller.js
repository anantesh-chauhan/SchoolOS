import bcryptjs from 'bcryptjs';
import prisma from '../config/prisma.client.js';
import { generateRefreshToken, generateToken, verifyRefreshToken } from '../utils/jwt.util.js';

const normalizeLoginId = (value) => String(value ?? '').trim().toLowerCase();
const instantLoginEnabled = () => process.env.NODE_ENV !== 'production' || process.env.ENABLE_INSTANT_LOGIN === 'true';

const portalStudentSelect = {
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

const findPortalStudent = async ({ role, email, studentId, schoolId }) => {
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

const buildPortalSession = (student, role) => {
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
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
      employeeId: user.employeeId,
      sessionVersion: user.sessionVersion,
      ...(linkedStudent ? { studentId: linkedStudent.id } : {}),
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
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
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
        },
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

export const getMe = async (req, res) => {
  try {
    if (['STUDENT', 'PARENT'].includes(req.user.role)) {
      const portalStudent = await findPortalStudent({
        role: req.user.role,
        email: req.user.email,
        studentId: req.user.studentId,
        schoolId: req.user.schoolId,
      });
      if (!portalStudent) {
        return res.status(404).json({ success: false, message: 'Portal account not found or inactive', code: 'NOT_FOUND' });
      }
      return res.json({ success: true, data: buildPortalSession(portalStudent, req.user.role).user });
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

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
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

export const logout = async (req, res) => {
  try {
    // JWT tokens are stateless, so we just return success
    // Client should remove token from storage
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
    if (['STUDENT', 'PARENT'].includes(decoded.role)) {
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

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
      employeeId: user.employeeId,
      sessionVersion: user.sessionVersion,
      ...(linkedStudent ? { studentId: linkedStudent.id } : {}),
    };

    const accessToken = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);

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
          role: user.role,
          schoolId: user.schoolId,
          studentId: linkedStudent?.id || null,
          school: user.school,
        },
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

export const getDemoAccounts = async (req, res) => {
  try {
    if (!instantLoginEnabled()) {
      return res.status(404).json({ success: false, message: 'Instant login is disabled' });
    }

    const [users, portalStudents] = await Promise.all([prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['PLATFORM_OWNER', 'SCHOOL_OWNER', 'ADMIN', 'CURRICULUM_MANAGER', 'FEE_MANAGER', 'HR', 'TEACHER', 'STUDENT', 'PARENT', 'STAFF'] },
      },
      select: {
        id: true,
        email: true,
        contactEmail: true,
        name: true,
        role: true,
        schoolId: true,
        employeeId: true,
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

    const teacherEmails = users.filter((user) => user.role === 'TEACHER').map((user) => user.email);
    const teacherUsers = users.filter((user) => user.role === 'TEACHER');
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
      ADMIN: 'Administrators',
      TEACHER: 'Teachers',
      STUDENT: 'Students',
      PARENT: 'Parents',
      STAFF: 'Staff',
      CURRICULUM_MANAGER: 'Curriculum Managers',
      FEE_MANAGER: 'Fee Managers',
      HR: 'Human Resources',
    };

    const groups = ['Platform Owner', 'School Owners', 'Administrators', 'Curriculum Managers', 'Fee Managers', 'Human Resources', 'Teachers', 'Staff', 'Students', 'Parents']
      .map((role) => ({ role, users: [] }));
    const groupByLabel = new Map(groups.map((group) => [group.role, group]));
    const portalLoginIds = new Set(portalStudents.flatMap((student) => [student.studentUserId, student.parentUserId]).filter(Boolean).map(normalizeLoginId));

    users.forEach((user) => {
      if (['STUDENT', 'PARENT'].includes(user.role) && portalLoginIds.has(normalizeLoginId(user.email))) return;
      const label = labelByRole[user.role];
      if (!label || !groupByLabel.has(label)) return;
      const teacher = user.role === 'TEACHER'
        ? teacherByLoginEmail.get(user.email)
          || teacherByContactEmail.get(user.contactEmail)
          || teacherByEmployee.get(`${user.schoolId}:${user.employeeId}`)
        : null;
      const assignmentPreview = teacher?.teacherAssignments?.length
        ? teacher.teacherAssignments
            .slice(0, 4)
            .map((row) => `${row.class.className}-${row.section.sectionName} ${row.subject.subjectName}`)
            .join(', ')
        : '';

      groupByLabel.get(label).users.push({
        accountKey: `user:${user.id}`,
        name: user.name,
        email: user.email,
        role: user.role,
        schoolName: user.school?.schoolName || teacher?.school?.schoolName || 'Platform',
        className: user.class?.className || teacher?.teacherAssignments?.[0]?.class?.className || null,
        sectionName: user.section?.sectionName || teacher?.teacherAssignments?.[0]?.section?.sectionName || null,
        assignmentPreview,
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

    const [accountType, accountId] = String(req.body.accountKey || '').split(':');
    if (!accountId || !['user', 'student', 'parent'].includes(accountType)) {
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
        school: { select: { id: true, schoolName: true, schoolCode: true, logoUrl: true, address: true, city: true, state: true, phone: true, email: true, status: true } },
        class: { select: { id: true, className: true, classOrder: true } },
        section: { select: { id: true, sectionName: true, sectionOrder: true, classId: true } },
      },
    });
    if (!user) return res.status(404).json({ success: false, message: 'Account is no longer active' });

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
      employeeId: user.employeeId,
      sessionVersion: user.sessionVersion,
    };
    const token = generateToken(payload);
    const refreshToken = generateRefreshToken(payload);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    return res.json({
      success: true,
      message: 'Instant login successful',
      data: {
        token,
        accessToken: token,
        refreshToken,
        user: { ...user, studentId: null },
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
