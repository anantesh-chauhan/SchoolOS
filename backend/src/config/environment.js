const booleanValue = (name, fallback) => process.env[name] === undefined ? fallback : !['false', '0', 'off'].includes(process.env[name].toLowerCase());
const numberValue = (name, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const value = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(value) || value < min || value > max) throw new Error(`${name} must be between ${min} and ${max}`);
  return value;
};

export const validateEnvironment = () => {
  const production = process.env.NODE_ENV === 'production';
  const required = ['DATABASE_URL', ...(production ? ['CORS_ORIGINS'] : [])];
  const jwtSecret = process.env.ACCESS_TOKEN_SECRET || process.env.JWT_SECRET;
  const refreshSecret = process.env.REFRESH_TOKEN_SECRET || process.env.JWT_SECRET;
  if (production) {
    if (!jwtSecret || jwtSecret.length < 32) required.push('ACCESS_TOKEN_SECRET (or JWT_SECRET, at least 32 characters)');
    if (!refreshSecret || refreshSecret.length < 32) required.push('REFRESH_TOKEN_SECRET (or JWT_SECRET, at least 32 characters)');
  }
  const missing = required.filter((name) => name.includes('(') || !String(process.env[name] || '').trim());
  if (missing.length) throw new Error(`Missing required environment configuration: ${missing.join(', ')}`);
  const cacheProvider = String(process.env.CACHE_PROVIDER || 'memory').toLowerCase();
  if (!['memory', 'redis'].includes(cacheProvider)) throw new Error('CACHE_PROVIDER must be memory or redis');
  if (cacheProvider === 'redis' && !process.env.REDIS_URL) throw new Error('REDIS_URL is required when CACHE_PROVIDER=redis');
  return {
    production,
    cacheProvider,
    cacheEnabled: booleanValue('CACHE_ENABLED', true),
    rateLimitEnabled: booleanValue('RATE_LIMIT_ENABLED', true),
    requestTimeoutMs: numberValue('REQUEST_TIMEOUT_MS', 15000, { min: 1000, max: 120000 }),
  };
};

