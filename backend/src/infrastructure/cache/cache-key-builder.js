import { createHash } from 'node:crypto';

const clean = (value, label) => {
  const normalized = String(value ?? '').trim();
  if (!normalized || normalized.includes(':') || normalized.includes('*')) throw new Error(`${label} is required and cannot contain cache delimiters`);
  return normalized;
};

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
  return value;
};

export const hashParams = (params = {}) => createHash('sha256')
  .update(JSON.stringify(stableValue(params)))
  .digest('hex').slice(0, 16);

export const cacheKeys = {
  schoolPrefix: (schoolId) => `school:${clean(schoolId, 'schoolId')}:`,
  schoolResource: ({ schoolId, sessionId, resource, params }) => [
    `school:${clean(schoolId, 'schoolId')}`,
    sessionId ? `session:${clean(sessionId, 'sessionId')}` : null,
    `resource:${clean(resource, 'resource')}`,
    params ? `params:${hashParams(params)}` : null,
  ].filter(Boolean).join(':'),
  privateResource: ({ schoolId, userId, role, resource, params }) => [
    `school:${clean(schoolId, 'schoolId')}`,
    `user:${clean(userId, 'userId')}`,
    `role:${clean(role, 'role')}`,
    `resource:${clean(resource, 'resource')}`,
    params ? `params:${hashParams(params)}` : null,
  ].filter(Boolean).join(':'),
  publicPrefix: (schoolIdentity = '') => schoolIdentity ? `public:school:${clean(schoolIdentity, 'schoolIdentity')}:` : 'public:',
  publicResource: ({ schoolIdentity, version = 'current', resource, params }) => [
    `public:school:${clean(schoolIdentity, 'schoolIdentity')}`,
    `published-version:${clean(version, 'version')}`,
    `resource:${clean(resource, 'resource')}`,
    params ? `params:${hashParams(params)}` : null,
  ].filter(Boolean).join(':'),
  platformResource: ({ resource, params }) => `platform:resource:${clean(resource, 'resource')}${params ? `:params:${hashParams(params)}` : ''}`,
};
