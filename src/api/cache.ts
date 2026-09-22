interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttlMs: number;
}

export class MemoryCache {
  private cache = new Map<string, CacheEntry<unknown>>();

  public get<T>(key: string): { data: T; isStale: boolean } | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (!entry) {
      return null;
    }

    const age = Date.now() - entry.timestamp;
    const isStale = age > entry.ttlMs;

    return {
      data: entry.data,
      isStale
    };
  }

  public set<T>(key: string, data: T, ttlSeconds: number): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttlMs: ttlSeconds * 1000
    });
  }

  public delete(key: string): void {
    this.cache.delete(key);
  }

  public invalidatePattern(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  public clear(): void {
    this.cache.clear();
  }
}
