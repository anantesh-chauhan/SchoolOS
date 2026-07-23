const store = new Map();
const DEFAULT_TTL_MS = 60_000;

export const analyticsCache = {
  get(key) {
    const item = store.get(key);
    if (!item) return null;
    if (item.expiresAt <= Date.now()) {
      store.delete(key);
      return null;
    }
    return structuredClone(item.value);
  },
  set(key, value, ttlMs = DEFAULT_TTL_MS) {
    store.set(key, { value: structuredClone(value), expiresAt: Date.now() + ttlMs });
    return value;
  },
  invalidate(prefix) {
    for (const key of store.keys()) if (key.startsWith(prefix)) store.delete(key);
  },
  clear() {
    store.clear();
  },
};

export const studentCacheKey = (schoolId, studentId, session) =>
  `analytics:student:${schoolId}:${studentId}:${session || 'current'}`;

