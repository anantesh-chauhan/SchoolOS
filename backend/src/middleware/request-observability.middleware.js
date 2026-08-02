import { randomUUID } from 'node:crypto';
import { runWithRequestContext } from '../infrastructure/observability/request-context.js';
import { recordRequestMetric } from '../infrastructure/observability/performance-metrics.js';

const SENSITIVE_QUERY_KEYS = new Set(['token', 'accessToken', 'refreshToken', 'password', 'securityAnswer']);

const safePath = (req) => {
  const url = new URL(req.originalUrl || req.url, 'http://schoolos.local');
  for (const key of [...url.searchParams.keys()]) {
    if (SENSITIVE_QUERY_KEYS.has(key)) url.searchParams.set(key, '[REDACTED]');
  }
  return `${url.pathname}${url.search}`;
};

export const requestObservability = (req, res, next) => {
  const requestId = String(req.get('x-request-id') || randomUUID());
  const startedAt = process.hrtime.bigint();
  const context = { requestId, cacheStatus: 'BYPASS' };
  res.setHeader('X-Request-Id', requestId);

  runWithRequestContext(context, () => {
    res.once('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const event = {
        level: durationMs >= 2000 ? 'error' : durationMs >= 500 ? 'warn' : 'info',
        event: 'http_request',
        requestId,
        method: req.method,
        path: safePath(req),
        statusCode: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
        schoolId: req.user?.schoolId || null,
        userId: req.user?.id || null,
        activeRole: req.user?.activeRole || req.user?.role || null,
        cacheStatus: context.cacheStatus,
      };
      recordRequestMetric({ method: req.method, route: req.route?.path || req.path, durationMs, statusCode: res.statusCode, cacheStatus: context.cacheStatus });
      const writer = event.level === 'error' ? console.error : event.level === 'warn' ? console.warn : console.info;
      writer(JSON.stringify(event));
    });
    next();
  });
};
