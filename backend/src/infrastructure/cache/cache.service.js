import { markCacheStatus } from '../observability/request-context.js';
import { MemoryCacheProvider } from './memory-cache.provider.js';
import { RedisCacheProvider } from './redis-cache.provider.js';

const asBoolean = (value, fallback) => value === undefined ? fallback : !['false', '0', 'off'].includes(String(value).toLowerCase());
const memory = new MemoryCacheProvider({ maxEntries: Math.max(50, Number(process.env.CACHE_MAX_ENTRIES) || 1000) });
const providerName = String(process.env.CACHE_PROVIDER || 'memory').toLowerCase();
const primary = providerName === 'redis' ? new RedisCacheProvider({ url: process.env.REDIS_URL }) : memory;

export class CacheService {
  constructor({ provider = primary, fallback = memory, enabled = asBoolean(process.env.CACHE_ENABLED, true), jitterRatio = 0.1 } = {}) {
    this.provider = provider;
    this.fallback = fallback;
    this.enabled = enabled;
    this.jitterRatio = jitterRatio;
    this.inFlight = new Map();
  }

  async safely(operation, fallbackOperation) {
    try { return await operation(); }
    catch (error) {
      markCacheStatus('ERROR');
      console.warn(JSON.stringify({ level: 'warn', event: 'cache_error', message: error.message }));
      return fallbackOperation ? fallbackOperation() : undefined;
    }
  }

  async get(key) {
    if (!this.enabled) { markCacheStatus('BYPASS'); return undefined; }
    const value = await this.safely(() => this.provider.get(key), this.provider === this.fallback ? null : () => this.fallback.get(key));
    markCacheStatus(value === undefined ? 'MISS' : 'HIT');
    return value;
  }

  async set(key, value, ttlSeconds = Number(process.env.CACHE_DEFAULT_TTL) || 300) {
    if (!this.enabled) return;
    const jitter = 1 + ((Math.random() * 2 - 1) * this.jitterRatio);
    const ttl = Math.max(1, Math.round(ttlSeconds * jitter));
    await this.safely(() => this.provider.set(key, value, ttl), this.provider === this.fallback ? null : () => this.fallback.set(key, value, ttl));
  }

  async delete(key) { if (this.enabled) await this.safely(() => this.provider.delete(key), () => this.fallback.delete(key)); }
  async deleteByPrefix(prefix) {
    if (!this.enabled) return 0;
    const deleted = await this.safely(() => this.provider.deleteByPrefix(prefix), () => this.fallback.deleteByPrefix(prefix));
    markCacheStatus('INVALIDATED');
    return deleted || 0;
  }

  async getOrSet(key, fetcher, ttlSeconds) {
    const cached = await this.get(key);
    if (cached !== undefined) return cached;
    if (this.inFlight.has(key)) return this.inFlight.get(key);
    const pending = Promise.resolve().then(fetcher).then(async (value) => { await this.set(key, value, ttlSeconds); return value; }).finally(() => this.inFlight.delete(key));
    this.inFlight.set(key, pending);
    return pending;
  }

  remember(key, ttlSeconds, fetcher) { return this.getOrSet(key, fetcher, ttlSeconds); }
  async ping() { return this.enabled ? this.safely(() => this.provider.ping(), () => this.fallback.ping()) : true; }
  async close() { await this.safely(() => this.provider.close()); if (this.fallback !== this.provider) await this.fallback.close(); }
}

export const cache = new CacheService();
export default cache;

