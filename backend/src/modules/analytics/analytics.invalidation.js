import { analyticsCache } from './analytics.cache.js';

const SOURCE_PREFIXES = [
  '/api/attendance',
  '/api/homework',
  '/api/resources',
  '/api/academic-content',
  '/api/chapter-feedback',
  '/api/chapter-polls',
  '/api/teacher/polls',
  '/api/student/polls',
  '/api/assessments',
];

export const invalidateSchoolAnalytics = (schoolId) => {
  if (!schoolId) return;
  analyticsCache.invalidate(`analytics:student:${schoolId}:`);
  analyticsCache.invalidate(`analytics:class:${schoolId}:`);
  analyticsCache.invalidate(`analytics:section:${schoolId}:`);
  analyticsCache.invalidate(`analytics:school:${schoolId}:`);
};

// Source modules predate a shared domain-event bus. This response-finish hook
// provides request-safe invalidation without coupling their business services to
// analytics internals. Failed writes never invalidate.
export const analyticsInvalidationMiddleware = (req, res, next) => {
  if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) || !SOURCE_PREFIXES.some((prefix) => req.originalUrl.startsWith(prefix))) {
    return next();
  }
  res.once('finish', () => {
    if (res.statusCode >= 200 && res.statusCode < 400) invalidateSchoolAnalytics(req.user?.schoolId);
  });
  return next();
};

