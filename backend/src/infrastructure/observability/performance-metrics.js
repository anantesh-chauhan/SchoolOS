const MAX_ENDPOINTS = 200;
const MAX_SAMPLES = 500;
const metrics = new Map();
const startedAt = new Date();

const percentile = (values, value) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return Math.round(sorted[Math.min(sorted.length - 1, Math.ceil(value * sorted.length) - 1)] * 100) / 100;
};

export const recordRequestMetric = ({ method, route, durationMs, statusCode, cacheStatus }) => {
  const key = `${method} ${route}`;
  if (!metrics.has(key) && metrics.size >= MAX_ENDPOINTS) return;
  const entry = metrics.get(key) || { requests: 0, errors: 0, cacheHits: 0, cacheMisses: 0, durations: [] };
  entry.requests += 1;
  if (statusCode >= 500) entry.errors += 1;
  if (cacheStatus === 'HIT') entry.cacheHits += 1;
  if (cacheStatus === 'MISS') entry.cacheMisses += 1;
  entry.durations.push(durationMs);
  if (entry.durations.length > MAX_SAMPLES) entry.durations.shift();
  metrics.set(key, entry);
};

export const getPerformanceSnapshot = () => ({
  collectedSince: startedAt.toISOString(),
  generatedAt: new Date().toISOString(),
  process: {
    uptimeSeconds: Math.round(process.uptime()),
    memory: process.memoryUsage(),
  },
  endpoints: [...metrics.entries()].map(([endpoint, entry]) => ({
    endpoint,
    requests: entry.requests,
    errorRate: entry.requests ? Math.round((entry.errors / entry.requests) * 10000) / 100 : 0,
    latencyMs: {
      p50: percentile(entry.durations, 0.5),
      p95: percentile(entry.durations, 0.95),
      p99: percentile(entry.durations, 0.99),
    },
    cache: {
      hits: entry.cacheHits,
      misses: entry.cacheMisses,
      hitRate: entry.cacheHits + entry.cacheMisses
        ? Math.round((entry.cacheHits / (entry.cacheHits + entry.cacheMisses)) * 10000) / 100
        : null,
    },
  })).sort((a, b) => b.latencyMs.p95 - a.latencyMs.p95),
});

