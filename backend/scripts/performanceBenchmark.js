const baseUrl = String(process.env.BENCHMARK_BASE_URL || 'http://localhost:5000').replace(/\/$/, '');
const token = process.env.BENCHMARK_TOKEN || '';
const schoolSlug = process.env.BENCHMARK_SCHOOL_SLUG || '';
const concurrency = Math.min(50, Math.max(1, Number(process.env.BENCHMARK_CONCURRENCY) || 10));
const iterations = Math.min(1000, Math.max(1, Number(process.env.BENCHMARK_ITERATIONS) || 100));

const targets = [
  { name: 'liveness', path: '/health/live' },
  ...(schoolSlug ? [{ name: 'public-bootstrap', path: `/api/public/${encodeURIComponent(schoolSlug)}/bootstrap` }] : []),
  ...(token ? [{ name: 'dashboard-summary', path: '/api/dashboard/summary', authenticated: true }] : []),
];

const percentile = (values, ratio) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] || 0;
};

const runTarget = async (target) => {
  const durations = []; let failures = 0; let next = 0; const failureReasons = {};
  const worker = async () => {
    while (next < iterations) {
      next += 1;
      const started = performance.now();
      try {
        const response = await fetch(`${baseUrl}${target.path}`, { headers: target.authenticated ? { Authorization: `Bearer ${token}` } : {} });
        if (!response.ok) {
          failures += 1;
          failureReasons[`HTTP_${response.status}`] = (failureReasons[`HTTP_${response.status}`] || 0) + 1;
        }
        await response.arrayBuffer();
      } catch (error) {
        failures += 1;
        const reason = error?.cause?.code || error?.name || 'NETWORK_ERROR';
        failureReasons[reason] = (failureReasons[reason] || 0) + 1;
      }
      durations.push(performance.now() - started);
    }
  };
  await Promise.all(Array.from({ length: concurrency }, worker));
  return {
    target: target.name,
    requests: durations.length,
    failures,
    failureReasons,
    latencyMs: {
      p50: Number(percentile(durations, 0.5).toFixed(2)),
      p95: Number(percentile(durations, 0.95).toFixed(2)),
      p99: Number(percentile(durations, 0.99).toFixed(2)),
    },
  };
};

const results = [];
for (const target of targets) results.push(await runTarget(target));
console.log(JSON.stringify({ baseUrl, concurrency, iterations, results }, null, 2));
if (results.some((result) => result.failures)) process.exitCode = 1;
