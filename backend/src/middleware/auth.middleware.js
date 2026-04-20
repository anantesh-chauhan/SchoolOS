import { verifyToken } from '../utils/jwt.util.js';

const VALID_ROLES = new Set([
  'PLATFORM_OWNER',
  'SCHOOL_OWNER',
  'ADMIN',
  'TEACHER',
  'PARENT',
  'STUDENT',
  'STAFF',
]);

// Verify JWT token middleware
export const authMiddleware = (req, res, next) => {
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

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Forbidden for role ${req.user.role}`,
        code: 'FORBIDDEN',
      });
    }

    next();
  };
};
