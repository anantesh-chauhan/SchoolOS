export class MemoryCacheProvider {
  constructor({ maxEntries = 1000, now = () => Date.now() } = {}) {
    this.maxEntries = maxEntries;
    this.now = now;
    this.entries = new Map();
  }

  async get(key) {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return undefined;
    }
    this.entries.delete(key);
    this.entries.set(key, entry);
    return entry.value;
  }

  async set(key, value, ttlSeconds) {
    this.entries.delete(key);
    this.entries.set(key, { value, expiresAt: this.now() + Math.max(1, ttlSeconds) * 1000 });
    while (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
  }

  async delete(key) { return this.entries.delete(key); }

  async deleteByPrefix(prefix) {
    let deleted = 0;
    for (const key of this.entries.keys()) {
      if (key.startsWith(prefix)) {
        this.entries.delete(key);
        deleted += 1;
      }
    }
    return deleted;
  }

  async ping() { return true; }
  async close() { this.entries.clear(); }
}

