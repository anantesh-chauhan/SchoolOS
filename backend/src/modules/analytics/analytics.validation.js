const clean = (value, max = 5000) => typeof value === 'string' ? value.trim().slice(0, max) : value;

export const parseAnalyticsFilters = (query = {}) => {
  const errors = [];
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(query.limit) || 20));
  const dateFrom = query.dateFrom ? new Date(query.dateFrom) : null;
  const dateTo = query.dateTo ? new Date(query.dateTo) : null;
  if (dateFrom && Number.isNaN(dateFrom.getTime())) errors.push('dateFrom must be a valid date.');
  if (dateTo && Number.isNaN(dateTo.getTime())) errors.push('dateTo must be a valid date.');
  if (dateFrom && dateTo && dateFrom > dateTo) errors.push('dateFrom cannot be after dateTo.');
  return {
    errors,
    value: {
      ...query, page, limit,
      search: clean(query.search, 100) || undefined,
      className: clean(query.className, 100) || undefined,
      section: clean(query.section, 100) || undefined,
      academicSessionId: clean(query.academicSessionId, 100) || undefined,
      dateFrom: dateFrom?.toISOString(),
      dateTo: dateTo?.toISOString(),
    },
  };
};

export const validateSnapshot = (body = {}) => {
  const errors = [];
  if (!clean(body.studentId, 100)) errors.push('studentId is required.');
  if (!clean(body.academicSessionId, 100)) errors.push('academicSessionId is required.');
  const types = new Set(['MONTHLY', 'FINAL_EXAM', 'TERM_REPORT', 'SESSION_END', 'COMPILED_CHAPTER', 'MANUAL']);
  if (body.snapshotType && !types.has(body.snapshotType)) errors.push('Invalid snapshotType.');
  return { errors, value: body };
};

export const validateIntervention = (body = {}, partial = false) => {
  const errors = [];
  if (!partial) ['studentId', 'subjectId', 'chapterId', 'reason', 'recommendedAction'].forEach((key) => {
    if (!clean(body[key])) errors.push(`${key} is required.`);
  });
  const statuses = new Set(['PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_RESPONSE', 'FOLLOW_UP_REQUIRED']);
  if (body.status && !statuses.has(body.status)) errors.push('Invalid intervention status.');
  const priorities = new Set(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);
  if (body.priority && !priorities.has(body.priority)) errors.push('Invalid intervention priority.');
  return { errors, value: body };
};

