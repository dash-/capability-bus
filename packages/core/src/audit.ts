import type { AuditLogger, AuditRecord } from './types.js';

export class InMemoryAuditLogger implements AuditLogger {
  private log: AuditRecord[] = [];

  record(entry: AuditRecord): void {
    this.log.push(entry);
  }

  getLog(): AuditRecord[] {
    return [...this.log];
  }

  clear(): void {
    this.log = [];
  }
}
