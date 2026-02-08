import type { IdempotencyStore, InvocationResult } from './types.js';

interface CacheEntry {
  result: InvocationResult;
  expiresAt: number;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private cache = new Map<string, CacheEntry>();
  private defaultTtl: number;

  constructor(defaultTtlMs = 5 * 60 * 1000) {
    this.defaultTtl = defaultTtlMs;
  }

  get(key: string): InvocationResult | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.result;
  }

  set(key: string, result: InvocationResult, ttl?: number): void {
    this.cache.set(key, {
      result,
      expiresAt: Date.now() + (ttl ?? this.defaultTtl),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }
}
