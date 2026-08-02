const integer = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const parsePagination = (query = {}, { defaultLimit = 25, maxLimit = 100 } = {}) => {
  const page = Math.max(1, integer(query.page, 1));
  const limit = Math.min(maxLimit, Math.max(1, integer(query.limit ?? query.pageSize, defaultLimit)));
  return { page, limit, skip: (page - 1) * limit, take: limit };
};

export const paginationMeta = ({ page, limit, total }) => {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    pages: totalPages,
    totalPages,
    hasNextPage: page < totalPages,
    hasPreviousPage: page > 1,
  };
};
