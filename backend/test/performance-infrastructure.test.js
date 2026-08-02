import test from 'node:test';
import assert from 'node:assert/strict';
import { MemoryCacheProvider } from '../src/infrastructure/cache/memory-cache.provider.js';
import { CacheService } from '../src/infrastructure/cache/cache.service.js';
import { cacheKeys, hashParams } from '../src/infrastructure/cache/cache-key-builder.js';
import { publicCache, privateNoStore } from '../src/middleware/http-cache.middleware.js';
import { paginationMeta, parsePagination } from '../src/utils/pagination.util.js';
import { enforceQueryBounds } from '../src/middleware/query-bounds.middleware.js';

test('tenant, user, and role identities cannot collide in private cache keys', () => {
  const base = { userId: 'user-1', role: 'ADMIN', resource: 'dashboard' };
  const schoolA = cacheKeys.privateResource({ ...base, schoolId: 'school-a' });
  const schoolB = cacheKeys.privateResource({ ...base, schoolId: 'school-b' });
  const teacher = cacheKeys.privateResource({ ...base, schoolId: 'school-a', role: 'TEACHER' });
  assert.notEqual(schoolA, schoolB);
  assert.notEqual(schoolA, teacher);
});

test('filter hashes are stable for nested objects regardless of key order', () => {
  assert.equal(
    hashParams({ page: 1, filters: { sectionId: 's1', classId: 'c1' } }),
    hashParams({ filters: { classId: 'c1', sectionId: 's1' }, page: 1 }),
  );
});

test('memory provider expires values and evicts the least recently used entry', async () => {
  let time = 0;
  const provider = new MemoryCacheProvider({ maxEntries: 2, now: () => time });
  await provider.set('a', 1, 10);
  await provider.set('b', 2, 10);
  await provider.get('a');
  await provider.set('c', 3, 10);
  assert.equal(await provider.get('b'), undefined);
  assert.equal(await provider.get('a'), 1);
  time = 11_000;
  assert.equal(await provider.get('a'), undefined);
});

test('getOrSet coalesces concurrent misses into one fetch', async () => {
  const provider = new MemoryCacheProvider();
  const service = new CacheService({ provider, fallback: provider, jitterRatio: 0 });
  let calls = 0;
  const fetcher = async () => { calls += 1; await new Promise((resolve) => setImmediate(resolve)); return { ok: true }; };
  const values = await Promise.all(Array.from({ length: 10 }, () => service.getOrSet('same-key', fetcher, 30)));
  assert.equal(calls, 1);
  assert.deepEqual(values, Array.from({ length: 10 }, () => ({ ok: true })));
});

test('prefix invalidation cannot delete another tenant cache', async () => {
  const provider = new MemoryCacheProvider();
  const service = new CacheService({ provider, fallback: provider, jitterRatio: 0 });
  await service.set('school:a:students:list', ['a'], 30);
  await service.set('school:b:students:list', ['b'], 30);
  await service.deleteByPrefix('school:a:');
  assert.equal(await service.get('school:a:students:list'), undefined);
  assert.deepEqual(await service.get('school:b:students:list'), ['b']);
});

test('HTTP cache policies keep authenticated data private and public data explicitly cacheable', () => {
  const headers = {};
  const res = { setHeader: (key, value) => { headers[key] = value; } };
  privateNoStore({}, res, () => {});
  assert.equal(headers['Cache-Control'], 'private, no-store');
  publicCache({ maxAge: 60, staleWhileRevalidate: 300 })({}, res, () => {});
  assert.equal(headers['Cache-Control'], 'public, max-age=60, stale-while-revalidate=300');
});

test('pagination clamps invalid values and preserves compatibility metadata', () => {
  assert.deepEqual(parsePagination({ page: '-2', limit: '100000' }), { page: 1, limit: 100, skip: 0, take: 100 });
  assert.deepEqual(paginationMeta({ page: 2, limit: 25, total: 60 }), {
    page: 2, limit: 25, total: 60, pages: 3, totalPages: 3, hasNextPage: true, hasPreviousPage: true,
  });
});

test('query bounds reject oversized pages, wide ranges, and large bulk payloads', () => {
  const execute = (req) => {
    let statusCode = 200; let payload; let nextCalled = false;
    const res = { status(code) { statusCode = code; return this; }, json(value) { payload = value; return this; }, getHeader: () => 'req-test' };
    enforceQueryBounds({ query: {}, body: {}, ...req }, res, () => { nextCalled = true; });
    return { statusCode, payload, nextCalled };
  };
  assert.equal(execute({ query: { limit: 101 } }).statusCode, 400);
  assert.equal(execute({ query: { startDate: '2024-01-01', endDate: '2026-01-02' } }).statusCode, 400);
  assert.equal(execute({ body: { records: Array.from({ length: 501 }) } }).statusCode, 413);
  assert.equal(execute({ query: { limit: 25, startDate: '2026-01-01', endDate: '2026-02-01' } }).nextCalled, true);
});

test('publication versions produce immutable public cache namespaces', () => {
  const first = cacheKeys.publicResource({ schoolIdentity: 'school-a', version: '1', resource: 'bootstrap' });
  const second = cacheKeys.publicResource({ schoolIdentity: 'school-a', version: '2', resource: 'bootstrap' });
  assert.notEqual(first, second);
});
