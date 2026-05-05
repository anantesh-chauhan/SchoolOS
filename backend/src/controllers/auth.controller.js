import bcryptjs from 'bcryptjs';
import { PrismaClient } from '@prisma/client';
import { generateRefreshToken, generateToken, verifyRefreshToken } from '../utils/jwt.util.js';

const prisma = new PrismaClient();

export const login = async (req, res) => {
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

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email },
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

    // Verify password
    const isPasswordValid = await bcryptjs.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password',
        code: 'INVALID_CREDENTIALS',
      });
    }

    // Generate JWT token
    const tokenPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
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
      return res.status(404).json({
        success: false,
        message: 'User not found',
        code: 'NOT_FOUND',
      });
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        schoolId: user.schoolId,
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
    const student = await prisma.student.findUnique({
      where: { studentUserId: email },
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

    if (!student) {
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
    const student = await prisma.student.findUnique({
      where: { parentUserId: email },
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

    if (!student) {
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
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      include: { school: true },
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found for refresh token',
        code: 'INVALID_REFRESH_TOKEN',
      });
    }

    const payload = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      schoolId: user.schoolId,
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
