import { createClient } from 'redis';

export class RedisCacheProvider {
  constructor({ url, connectTimeout = 2000 } = {}) {
    if (!url) throw new Error('REDIS_URL is required for the Redis cache provider');
    this.client = createClient({ url, socket: { connectTimeout, reconnectStrategy: (attempt) => Math.min(attempt * 100, 2000) } });
    this.client.on('error', (error) => console.warn(JSON.stringify({ level: 'warn', event: 'cache_error', provider: 'redis', message: error.message })));
    this.connectPromise = null;
  }

  async connect() {
    if (this.client.isReady) return;
    if (!this.connectPromise) this.connectPromise = this.client.connect().finally(() => { this.connectPromise = null; });
    await this.connectPromise;
  }

  async get(key) {
    await this.connect();
    const value = await this.client.get(key);
    return value === null ? undefined : JSON.parse(value);
  }

  async set(key, value, ttlSeconds) {
    await this.connect();
    await this.client.set(key, JSON.stringify(value), { EX: Math.max(1, ttlSeconds) });
  }

  async delete(key) { await this.connect(); return this.client.del(key); }

  async deleteByPrefix(prefix) {
    await this.connect();
    let deleted = 0;
    for await (const keys of this.client.scanIterator({ MATCH: `${prefix}*`, COUNT: 100 })) {
      const batch = Array.isArray(keys) ? keys : [keys];
      if (batch.length) deleted += await this.client.del(batch);
    }
    return deleted;
  }

  async ping() { await this.connect(); return (await this.client.ping()) === 'PONG'; }
  async close() { if (this.client.isOpen) await this.client.quit(); }
}

