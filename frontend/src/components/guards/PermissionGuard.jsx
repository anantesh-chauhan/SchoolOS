import React from 'react';
import { authService } from '../../services/authService';
import { can, canAll, canAny } from '../../security/permissions';

export const PermissionGuard = ({
  permission,
  any = [],
  all = [],
  fallback = null,
  children,
}) => {
  const user = authService.getCurrentUser();
  const allowed = permission
    ? can(user, permission)
    : any.length
      ? canAny(user, any)
      : canAll(user, all);
  return allowed ? children : fallback;
};

export const RoleGuard = ({ roles = [], fallback = null, children }) => {
  const role = String(authService.getCurrentUser()?.role || '').toUpperCase();
  return roles.map((item) => String(item).toUpperCase()).includes(role) ? children : fallback;
};

export const SchoolScopeGuard = ({ schoolId, fallback = null, children }) => {
  const user = authService.getCurrentUser();
  const allowed = user?.role === 'PLATFORM_OWNER' || (user?.schoolId && user.schoolId === schoolId);
  return allowed ? children : fallback;
};
