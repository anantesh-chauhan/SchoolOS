export const publicCache = ({ maxAge = 60, staleWhileRevalidate = 300 } = {}) => (_req, res, next) => {
  res.setHeader('Cache-Control', `public, max-age=${maxAge}, stale-while-revalidate=${staleWhileRevalidate}`);
  next();
};

export const privateNoStore = (_req, res, next) => {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Pragma', 'no-cache');
  next();
};

export const requestTimeout = (timeoutMs = 15000) => (req, res, next) => {
  res.setTimeout(timeoutMs, () => {
    if (!res.headersSent) res.status(503).json({ success: false, error: { code: 'REQUEST_TIMEOUT', message: 'The request took too long.', requestId: res.getHeader('X-Request-Id') } });
  });
  next();
};

