import { hasPermission } from '../config/permissions.js';

export const requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user || !permissions.every((permission) => hasPermission(req.user.role, permission))) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action', code: 'FORBIDDEN' });
  }
  next();
};
