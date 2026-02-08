import type { z } from 'zod';

// === Side Effect Classification ===

export type SideEffect = 'pure' | 'ui-only' | 'network' | 'destructive';

// === Concurrency Policy ===

export type ConcurrencyPolicy = 'concurrent' | 'exclusive';

// === Caller Identity ===

export interface CallerIdentity {
  type: 'ui' | 'agent' | 'test';
  source?: string;
  triggeringMessage?: string;
}

// === Error Codes ===

export type ErrorCode =
  | 'VALIDATION'
  | 'FORBIDDEN'
  | 'PRECONDITION_FAILED'
  | 'CONFLICT'
  | 'NOT_FOUND'
  | 'TRANSIENT'
  | 'INTERNAL';

// === Invocation Results ===

export type InvocationResult<T = unknown> =
  | SuccessResult<T>
  | ErrorResult;

export interface SuccessResult<T = unknown> {
  status: 'success';
  requestId: string;
  data: T;
  timestamp: number;
}

export interface ErrorResult {
  status: 'error';
  requestId: string;
  code: ErrorCode;
  message: string;
  recoveryHint?: string;
  timestamp: number;
}

// === Availability ===

export interface AvailabilityResult {
  available: boolean;
  unavailableReason?: string;
}

// === Precondition ===

export type PreconditionResult =
  | { met: true }
  | { met: false; code: 'PRECONDITION_FAILED'; message: string; recoveryHint?: string };

// === Invocation Context (passed to handlers) ===

export interface InvocationContext {
  caller: CallerIdentity;
  requestId: string;
  bus: CapabilityBusReadonly;
}

// === Read-only bus interface for handler use ===

export interface CapabilityBusReadonly {
  invoke<T = unknown>(
    name: string,
    args: unknown,
    caller: CallerIdentity,
    options?: InvokeOptions,
  ): Promise<InvocationResult<T>>;
  getCapability(name: string): CapabilityDefinition | undefined;
  hasCapability(name: string): boolean;
  getRegisteredNames(): string[];
}

// === Capability Definition ===

export interface CapabilityDefinition<
  TInput extends z.ZodType = z.ZodType,
  TOutput extends z.ZodType = z.ZodType,
> {
  name: string;
  description: string;
  input: TInput;
  output: TOutput;
  sideEffect: SideEffect;
  permissions: string[];
  concurrency: ConcurrencyPolicy;
  handler: (input: z.infer<TInput>, context: InvocationContext) => Promise<z.infer<TOutput>>;
  preconditions?: (input: z.infer<TInput>, context: InvocationContext) => Promise<PreconditionResult>;
  isAvailable?: (context: AppContext) => AvailabilityResult;
}

// === Invocation Request ===

export interface CapabilityInvocation {
  capability: string;
  arguments: Record<string, unknown>;
  requestId: string;
  idempotencyKey?: string;
  caller: CallerIdentity;
}

// === Invoke Options ===

export interface InvokeOptions {
  idempotencyKey?: string;
  requestId?: string;
  timeout?: number;
}

// === Bus Events ===

export type BusEvent =
  | InvocationEvent
  | StateChangeEvent
  | NotificationEvent
  | ProgressEvent;

export interface InvocationEvent {
  type: 'invocation';
  capability: string;
  caller: CallerIdentity;
  result: InvocationResult;
  timestamp: number;
}

export interface StateChangeEvent {
  type: 'stateChange';
  domain: string;
  summary: string;
  timestamp: number;
}

export interface NotificationEvent {
  type: 'notification';
  level: 'info' | 'warning' | 'error';
  message: string;
  timestamp: number;
}

export interface ProgressEvent {
  type: 'progress';
  taskId: string;
  percent: number;
  timestamp: number;
}

// === App Context (for manifest filtering and permissions) ===

export interface AppContext {
  permissions: string[];
  [key: string]: unknown;
}

// === Audit Record ===

export interface AuditRecord {
  invocation: CapabilityInvocation;
  result: InvocationResult;
  duration: number;
  timestamp: number;
}

// === Manifest ===

export interface CapabilityManifest {
  schema_version: string;
  application: { name: string; version: string };
  capabilities: ManifestCapabilityEntry[];
  generated_at: string;
}

export interface ManifestCapabilityEntry {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
  output_schema: Record<string, unknown>;
  side_effect: SideEffect;
  permissions: string[];
  concurrency: ConcurrencyPolicy;
  available: boolean;
  unavailable_reason: string | null;
}

// === Middleware ===

export type Middleware = (
  invocation: CapabilityInvocation,
  capability: CapabilityDefinition,
  next: () => Promise<InvocationResult>,
) => Promise<InvocationResult>;

// === Permission Checker ===

export interface PermissionChecker {
  check(
    required: string[],
    context: AppContext,
    caller: CallerIdentity,
  ): Promise<boolean> | boolean;
}

// === Idempotency Store ===

export interface IdempotencyStore {
  get(key: string): InvocationResult | undefined;
  set(key: string, result: InvocationResult, ttl?: number): void;
  has(key: string): boolean;
  clear(): void;
}

// === Audit Logger ===

export interface AuditLogger {
  record(entry: AuditRecord): void;
  getLog(): AuditRecord[];
  clear(): void;
}

// === Tool Definition (for LLM integration) ===

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

// === Bus Options ===

export interface BusOptions {
  permissionChecker?: PermissionChecker;
  idempotencyStore?: IdempotencyStore;
  auditLogger?: AuditLogger;
  middlewares?: Middleware[];
  generateRequestId?: () => string;
  appContext?: () => AppContext;
}
