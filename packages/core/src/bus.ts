import { createErrorResult } from './errors.js';
import { EventEmitter } from './events.js';
import { InMemoryAuditLogger } from './audit.js';
import { InMemoryIdempotencyStore } from './idempotency.js';
import { SimplePermissionChecker } from './permissions.js';
import { ConcurrencyManager } from './concurrency.js';
import type {
  AppContext,
  AuditLogger,
  AuditRecord,
  BusEvent,
  BusOptions,
  CallerIdentity,
  CapabilityBusReadonly,
  CapabilityDefinition,
  CapabilityInvocation,
  CapabilityManifest,
  IdempotencyStore,
  InvocationResult,
  InvokeOptions,
  Middleware,
  PermissionChecker,
  ToolDefinition,
} from './types.js';
import { generateManifest, manifestToToolDefinitions } from './manifest.js';

function defaultRequestId(): string {
  return crypto.randomUUID();
}

export class CapabilityBus implements CapabilityBusReadonly {
  private capabilities = new Map<string, CapabilityDefinition>();
  private emitter = new EventEmitter();
  private middlewares: Middleware[] = [];
  private permissionChecker: PermissionChecker;
  private idempotencyStore: IdempotencyStore;
  private auditLogger: AuditLogger;
  private concurrency = new ConcurrencyManager();
  private generateRequestId: () => string;
  private _appContext: (() => AppContext) | undefined;

  constructor(options?: BusOptions) {
    this.permissionChecker = options?.permissionChecker ?? new SimplePermissionChecker();
    this.idempotencyStore = options?.idempotencyStore ?? new InMemoryIdempotencyStore();
    this.auditLogger = options?.auditLogger ?? new InMemoryAuditLogger();
    this.generateRequestId = options?.generateRequestId ?? defaultRequestId;
    this._appContext = options?.appContext;
    if (options?.middlewares) {
      this.middlewares = [...options.middlewares];
    }
  }

  register(definition: CapabilityDefinition): void {
    this.capabilities.set(definition.name, definition);
  }

  unregister(name: string): void {
    this.capabilities.delete(name);
  }

  getCapability(name: string): CapabilityDefinition | undefined {
    return this.capabilities.get(name);
  }

  hasCapability(name: string): boolean {
    return this.capabilities.has(name);
  }

  getRegisteredNames(): string[] {
    return Array.from(this.capabilities.keys());
  }

  use(middleware: Middleware): void {
    this.middlewares.push(middleware);
  }

  subscribe(listener: (event: BusEvent) => void): () => void {
    return this.emitter.subscribe(listener);
  }

  emit(event: BusEvent): void {
    this.emitter.emit(event);
  }

  getAuditLog(): AuditRecord[] {
    return this.auditLogger.getLog();
  }

  clearAuditLog(): void {
    this.auditLogger.clear();
  }

  getManifest(
    context: AppContext,
    appInfo: { name: string; version: string } = { name: 'app', version: '0.0.0' },
  ): CapabilityManifest {
    return generateManifest(this.capabilities, context, appInfo);
  }

  getToolDefinitions(context: AppContext): ToolDefinition[] {
    const manifest = this.getManifest(context);
    return manifestToToolDefinitions(manifest);
  }

  async invoke<T = unknown>(
    name: string,
    args: unknown,
    caller: CallerIdentity,
    options?: InvokeOptions,
  ): Promise<InvocationResult<T>> {
    const requestId = options?.requestId ?? this.generateRequestId();
    const startTime = Date.now();

    // 1. Look up capability
    const capability = this.capabilities.get(name);
    if (!capability) {
      const result = createErrorResult(requestId, 'NOT_FOUND', `Unknown capability: ${name}`);
      this.recordAudit(name, args, caller, requestId, result, startTime);
      return result as InvocationResult<T>;
    }

    // 2. Validate input
    const parsed = capability.input.safeParse(args);
    if (!parsed.success) {
      const result = createErrorResult(requestId, 'VALIDATION', parsed.error.message);
      this.recordAudit(name, args, caller, requestId, result, startTime);
      return result as InvocationResult<T>;
    }

    // 3. Check idempotency
    const idempotencyKey = options?.idempotencyKey;
    if (idempotencyKey) {
      const cached = this.idempotencyStore.get(idempotencyKey);
      if (cached) return cached as InvocationResult<T>;
    }

    // 4. Check permissions
    const context = this._appContext?.() ?? { permissions: [] };
    const permitted = await this.permissionChecker.check(
      capability.permissions,
      context,
      caller,
    );
    if (!permitted) {
      const result = createErrorResult(requestId, 'FORBIDDEN', 'Insufficient permissions');
      this.recordAudit(name, args, caller, requestId, result, startTime);
      return result as InvocationResult<T>;
    }

    // 5. Acquire concurrency lock
    const acquired = this.concurrency.acquire(name, capability.concurrency);
    if (!acquired) {
      const result = createErrorResult(
        requestId,
        'CONFLICT',
        `Capability "${name}" is currently executing (exclusive concurrency)`,
      );
      this.recordAudit(name, args, caller, requestId, result, startTime);
      return result as InvocationResult<T>;
    }

    try {
      // 6. Check preconditions
      if (capability.preconditions) {
        const precheck = await capability.preconditions(parsed.data, {
          caller,
          requestId,
          bus: this,
        });
        if (!precheck.met) {
          const result = createErrorResult(
            requestId,
            precheck.code,
            precheck.message,
            precheck.recoveryHint,
          );
          this.recordAudit(name, args, caller, requestId, result, startTime);
          return result as InvocationResult<T>;
        }
      }

      // 7. Build execution chain with middleware
      const invocation: CapabilityInvocation = {
        capability: name,
        arguments: parsed.data as Record<string, unknown>,
        requestId,
        idempotencyKey,
        caller,
      };

      const handler = async (): Promise<InvocationResult> => {
        try {
          const data = await capability.handler(parsed.data, {
            caller,
            requestId,
            bus: this,
          });
          return {
            status: 'success',
            requestId,
            data,
            timestamp: Date.now(),
          };
        } catch (err) {
          return createErrorResult(
            requestId,
            'INTERNAL',
            err instanceof Error ? err.message : 'An unexpected error occurred',
          );
        }
      };

      // 8. Execute through middleware chain
      let chain = handler;
      for (let i = this.middlewares.length - 1; i >= 0; i--) {
        const mw = this.middlewares[i];
        const next = chain;
        chain = () => mw(invocation, capability, next);
      }

      const result = await chain();

      // 9. Record audit, emit event, cache idempotency
      this.recordAudit(name, args, caller, requestId, result, startTime);

      // Only cache successful results — failed invocations should be retriable
      // with the same idempotency key rather than returning a cached error.
      if (idempotencyKey && result.status === 'success') {
        this.idempotencyStore.set(idempotencyKey, result);
      }

      return result as InvocationResult<T>;
    } finally {
      // 10. Release concurrency lock
      if (capability.concurrency === 'exclusive') {
        this.concurrency.release(name);
      }
    }
  }

  private recordAudit(
    name: string,
    args: unknown,
    caller: CallerIdentity,
    requestId: string,
    result: InvocationResult,
    startTime: number,
  ): void {
    const record: AuditRecord = {
      invocation: {
        capability: name,
        arguments: args as Record<string, unknown>,
        requestId,
        caller,
      },
      result,
      duration: Date.now() - startTime,
      timestamp: startTime,
    };
    this.auditLogger.record(record);

    this.emitter.emit({
      type: 'invocation',
      capability: name,
      caller,
      result,
      timestamp: Date.now(),
    });
  }
}
