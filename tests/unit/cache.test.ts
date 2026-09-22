import { describe, it, expect } from 'vitest';
import { MemoryCache } from '../../src/api/cache';

describe('MemoryCache', () => {
  it('stores and retrieves cached data with TTL validity', () => {
    const cache = new MemoryCache();
    cache.set('test_key', { foo: 'bar' }, 60);

    const hit = cache.get<{ foo: string }>('test_key');
    expect(hit).not.toBeNull();
    expect(hit?.data.foo).toBe('bar');
    expect(hit?.isStale).toBe(false);
  });

  it('invalidates cache by prefix pattern', () => {
    const cache = new MemoryCache();
    cache.set('/v9/projects/1', { name: 'p1' }, 60);
    cache.set('/v9/projects/2', { name: 'p2' }, 60);
    cache.set('/v6/deployments', { list: [] }, 60);

    cache.invalidatePattern('/v9/projects');
    expect(cache.get('/v9/projects/1')).toBeNull();
    expect(cache.get('/v9/projects/2')).toBeNull();
    expect(cache.get('/v6/deployments')).not.toBeNull();
  });
});
