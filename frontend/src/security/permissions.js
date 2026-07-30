/**
 * UI authorization helpers. The API supplies the canonical flattened grant
 * list from backend/src/config/permissions.js on /auth/me.
 */
export const can = (user, permission) =>
  Boolean(user && Array.isArray(user.permissions) && user.permissions.includes(permission));

export const canAny = (user, permissions = []) =>
  permissions.some((permission) => can(user, permission));

export const canAll = (user, permissions = []) =>
  permissions.every((permission) => can(user, permission));

const PATH_PERMISSIONS = [
  [/^\/dashboard\/platform\/schools/, 'school.view'],
  [/^\/dashboard\/platform\/school-settings/, 'platform.settings.manage'],
  [/^\/dashboard\/platform\/fees/, 'platform.report.export'],
  [/^\/platform\/issues/, 'platform.audit.view'],
  [/^\/dashboard\/school\/settings/, 'school.settings.manage'],
  [/\/credentials/, 'users.credentials.view'],
  [/\/users/, 'users.view'],
  [/\/students\/add/, 'students.create'],
  [/\/students\/allocation/, 'students.allocate'],
  [/\/students/, 'students.view'],
  [/\/teachers|teacher-assignment|class-teachers/, 'staffing.view'],
  [/\/subjects|subject-assignment/, 'subjects.view'],
  [/\/weekly-slots/, 'weeklySlots.view'],
  [/\/timetable/, 'weeklySlots.view'],
  [/^\/attendance|\/attendance\//, 'attendance.view'],
  [/\/fees/, 'fees.view'],
  [/\/curriculum/, 'curriculum.view'],
  [/\/homework/, 'homework.view'],
  [/\/analytics/, 'analytics.view'],
  [/\/calendar/, 'academicCalendar.view'],
  [/\/communication/, 'communication.view'],
  [/\/notifications/, 'notification.view'],
];

export const requiredPermissionForPath = (path = '') =>
  PATH_PERMISSIONS.find(([pattern]) => pattern.test(path))?.[1] || null;

export const filterNavigation = (groups, user) =>
  (groups || [])
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const required = item.permission || requiredPermissionForPath(item.href);
        return !required || can(user, required);
      }),
    }))
    .filter((group) => group.items.length > 0);
