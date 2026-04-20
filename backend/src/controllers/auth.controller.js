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
      include: {
        school: true,
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
          school: user.school,
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
      include: {
        school: true,
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
        school: user.school,
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
