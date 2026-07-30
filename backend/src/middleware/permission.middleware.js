import { hasPermission, permissionScopes } from '../config/permissions.js';

export const requirePermission = (...permissions) => (req, res, next) => {
  if (!req.user || !permissions.every((permission) => hasPermission(req.user.role, permission))) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action', code: 'FORBIDDEN' });
  }
  req.permissionScopes = Object.fromEntries(
    permissions.map((permission) => [permission, permissionScopes(req.user.role, permission)]),
  );
  next();
};

export const requireAnyPermission = (...permissions) => (req, res, next) => {
  if (!req.user || !permissions.some((permission) => hasPermission(req.user.role, permission))) {
    return res.status(403).json({ success: false, message: 'You do not have permission to perform this action', code: 'FORBIDDEN' });
  }
  req.permissionScopes = Object.fromEntries(
    permissions.filter((permission) => hasPermission(req.user.role, permission))
      .map((permission) => [permission, permissionScopes(req.user.role, permission)]),
  );
  next();
};
