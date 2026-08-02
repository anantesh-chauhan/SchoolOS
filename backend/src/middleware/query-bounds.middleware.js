const MAX_DATE_RANGE_DAYS = 366;
const MAX_BULK_RECORDS = 500;

const dateValue = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export const enforceQueryBounds = (req, res, next) => {
  const requestedLimit = Number(req.query.limit ?? req.query.pageSize);
  if (Number.isFinite(requestedLimit) && (requestedLimit < 1 || requestedLimit > 100)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_PAGE_SIZE', message: 'Page size must be between 1 and 100.', requestId: res.getHeader('X-Request-Id') } });
  }
  if (String(req.query.search || req.query.q || '').length > 200) {
    return res.status(400).json({ success: false, error: { code: 'SEARCH_TOO_LONG', message: 'Search text cannot exceed 200 characters.', requestId: res.getHeader('X-Request-Id') } });
  }
  const datePairs = [
    [req.query.startDate, req.query.endDate],
    [req.query.dateFrom, req.query.dateTo],
    [req.query.from, req.query.to],
  ];
  for (const [rawStart, rawEnd] of datePairs) {
    if (!rawStart && !rawEnd) continue;
    const start = dateValue(rawStart); const end = dateValue(rawEnd);
    if (!start || !end || end < start || (end - start) / 86_400_000 > MAX_DATE_RANGE_DAYS) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_DATE_RANGE', message: 'Provide a valid date range no wider than 366 days.', requestId: res.getHeader('X-Request-Id') } });
    }
  }
  const bulk = req.body?.records || req.body?.items || req.body?.studentIds;
  if (Array.isArray(bulk) && bulk.length > MAX_BULK_RECORDS) {
    return res.status(413).json({ success: false, error: { code: 'BULK_LIMIT_EXCEEDED', message: `Bulk requests support at most ${MAX_BULK_RECORDS} records.`, requestId: res.getHeader('X-Request-Id') } });
  }
  next();
};
