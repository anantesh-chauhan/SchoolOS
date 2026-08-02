import cache from './cache.service.js';
import { cacheKeys } from './cache-key-builder.js';
import prisma from '../../config/prisma.client.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const invalidateSchool = async (schoolId) => {
  if (!schoolId) return;
  await Promise.all([
    cache.deleteByPrefix(cacheKeys.schoolPrefix(schoolId)),
    cache.deleteByPrefix('public:'),
  ]);
};

export const cacheInvalidationAfterMutation = (req, res, next) => {
  if (SAFE_METHODS.has(req.method)) return next();
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 400 || !req.user?.schoolId) return originalJson(body);
    const publicContentMutation = /^\/api\/(?:v1\/)?(?:gallery|school-settings|school)(?:\/|$)/.test(req.originalUrl || '');
    const bumpVersion = publicContentMutation
      ? prisma.school.update({ where: { id: req.user.schoolId }, data: { publicationVersion: { increment: 1 } }, select: { id: true } })
      : Promise.resolve();
    bumpVersion.then(() => invalidateSchool(req.user.schoolId))
      .catch((error) => console.warn(JSON.stringify({ level: 'warn', event: 'cache_invalidation_error', message: error.message })))
      .finally(() => originalJson(body));
    return res;
  };
  next();
};
