import type { ConcurrencyPolicy } from './types.js';

export class ConcurrencyManager {
  private locks = new Set<string>();

  acquire(capabilityName: string, policy: ConcurrencyPolicy): boolean {
    if (policy === 'concurrent') return true;
    if (this.locks.has(capabilityName)) return false;
    this.locks.add(capabilityName);
    return true;
  }

  release(capabilityName: string): void {
    this.locks.delete(capabilityName);
  }

  isLocked(capabilityName: string): boolean {
    return this.locks.has(capabilityName);
  }
}
