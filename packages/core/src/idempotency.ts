import type { IdempotencyStore, InvocationResult } from './types.js';

interface CacheEntry {
  result: InvocationResult;
  expiresAt: number;
}

export class InMemoryIdempotencyStore implements IdempotencyStore {
  private cache = new Map<string, CacheEntry>();
  private defaultTtl: number;
  private sweepThreshold: number;

  constructor(defaultTtlMs = 5 * 60 * 1000, sweepThreshold = 1000) {
    this.defaultTtl = defaultTtlMs;
    this.sweepThreshold = sweepThreshold;
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
    if (this.cache.size > this.sweepThreshold) {
      this.sweep();
    }
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  sweep(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}
