# API Reference

## @capability-bus/core

### `CapabilityBus`

The central execution engine. All application actions flow through it.

```typescript
import { CapabilityBus } from '@capability-bus/core';

const bus = new CapabilityBus(options?: BusOptions);
```

#### `BusOptions`

```typescript
interface BusOptions {
  permissionChecker?: PermissionChecker;  // Default: SimplePermissionChecker
  idempotencyStore?: IdempotencyStore;    // Default: InMemoryIdempotencyStore
  auditLogger?: AuditLogger;             // Default: InMemoryAuditLogger
  middlewares?: Middleware[];             // Initial middleware stack
  generateRequestId?: () => string;      // Custom request ID generator
  appContext?: () => AppContext;          // Application context provider
}
```

#### Methods

##### `register(definition: CapabilityDefinition): void`

Register a capability on the bus.

##### `unregister(name: string): void`

Remove a registered capability.

##### `invoke<T>(name, args, caller, options?): Promise<InvocationResult<T>>`

Invoke a capability. Executes the full pipeline: validate → permissions → idempotency → concurrency → preconditions → middleware → handler → audit → emit.

```typescript
const result = await bus.invoke(
  'cart.addItem',
  { productId: 'prod_123', quantity: 1 },
  { type: 'ui', source: 'ProductCard' },
);

if (result.status === 'success') {
  console.log(result.data); // typed output
} else {
  console.log(result.code, result.message, result.recoveryHint);
}
```

##### `getCapability(name: string): CapabilityDefinition | undefined`

Look up a registered capability by name.

##### `hasCapability(name: string): boolean`

Check if a capability is registered.

##### `getRegisteredNames(): string[]`

List all registered capability names.

##### `getManifest(context, appInfo?): CapabilityManifest`

Generate a JSON manifest of all capabilities, with availability status.

##### `getToolDefinitions(context): ToolDefinition[]`

Get available capabilities formatted as LLM tool definitions (only includes available capabilities).

##### `subscribe(listener): () => void`

Subscribe to bus events. Returns an unsubscribe function.

##### `emit(event: BusEvent): void`

Emit a custom event (e.g., stateChange, notification, progress).

##### `use(middleware: Middleware): void`

Add middleware to the invocation pipeline.

##### `getAuditLog(): AuditRecord[]`

Get all recorded audit entries.

##### `clearAuditLog(): void`

Clear the audit log.

---

### `CapabilityDefinition`

```typescript
interface CapabilityDefinition<TInput, TOutput> {
  name: string;                    // e.g., 'cart.addItem'
  description: string;             // Human/agent-readable description
  input: TInput;                   // Zod schema for input validation
  output: TOutput;                 // Zod schema for output
  sideEffect: SideEffect;         // 'pure' | 'ui-only' | 'network' | 'destructive'
  permissions: string[];           // Required permissions
  concurrency: ConcurrencyPolicy;  // 'concurrent' | 'exclusive'
  handler: (input, context) => Promise<output>;
  preconditions?: (input, context) => Promise<PreconditionResult>;
  isAvailable?: (context: AppContext) => AvailabilityResult;
}
```

---

### `CallerIdentity`

```typescript
interface CallerIdentity {
  type: 'ui' | 'agent' | 'test';
  source?: string;             // Component name, agent session, test ID
  triggeringMessage?: string;  // User message that led to this invocation
}
```

---

### `InvocationResult<T>`

```typescript
type InvocationResult<T> =
  | { status: 'success'; requestId: string; data: T; timestamp: number }
  | { status: 'error'; requestId: string; code: ErrorCode; message: string;
      recoveryHint?: string; timestamp: number };
```

**Error codes:** `VALIDATION`, `FORBIDDEN`, `PRECONDITION_FAILED`, `CONFLICT`, `NOT_FOUND`, `TRANSIENT`, `INTERNAL`

---

### `BusEvent`

```typescript
type BusEvent =
  | { type: 'invocation'; capability: string; caller: CallerIdentity;
      result: InvocationResult; timestamp: number }
  | { type: 'stateChange'; domain: string; summary: string; timestamp: number }
  | { type: 'notification'; level: 'info'|'warning'|'error'; message: string;
      timestamp: number }
  | { type: 'progress'; taskId: string; percent: number; timestamp: number };
```

---

### `Middleware`

```typescript
type Middleware = (
  invocation: CapabilityInvocation,
  capability: CapabilityDefinition,
  next: () => Promise<InvocationResult>,
) => Promise<InvocationResult>;
```

#### Built-in Middlewares

```typescript
import {
  createLoggingMiddleware,
  createTimingMiddleware,
  createConfirmationMiddleware,
} from '@capability-bus/core';

// Log all invocations
bus.use(createLoggingMiddleware(console));

// Track execution timing
bus.use(createTimingMiddleware((name, ms) => console.log(`${name}: ${ms}ms`)));

// Require confirmation for destructive agent actions
bus.use(createConfirmationMiddleware(
  async (description, args) => window.confirm(description)
));
```

---

### Utility Classes

#### `SimplePermissionChecker`

Checks that all required permissions exist in `context.permissions`.

#### `InMemoryIdempotencyStore`

In-memory cache with TTL for deduplicating invocations by idempotency key.

#### `InMemoryAuditLogger`

In-memory audit log. Use `getLog()` to retrieve, `clear()` to reset.

#### `zodToJsonSchema(schema)`

Converts a Zod schema to JSON Schema (for manifest generation).

---

## @capability-bus/react

### `BusProvider`

Provides the bus instance to the React tree.

```tsx
import { CapabilityBus } from '@capability-bus/core';
import { BusProvider } from '@capability-bus/react';

const bus = new CapabilityBus();
// ... register capabilities ...

function App() {
  return (
    <BusProvider bus={bus}>
      <YourApp />
    </BusProvider>
  );
}
```

### `useCapabilityBus(): CapabilityBus`

Returns the bus instance from context.

### `useCapability<T>(name, callerSource?): UseCapabilityReturn<T>`

Binds a single capability for use in a component. Manages loading/result/error state.

```tsx
function AddToCartButton({ productId }: { productId: string }) {
  const { invoke, isLoading } = useCapability('cart.addItem');

  return (
    <button
      disabled={isLoading}
      onClick={() => invoke({ productId, quantity: 1 })}
    >
      {isLoading ? 'Adding...' : 'Add to Cart'}
    </button>
  );
}
```

**Returns:**

```typescript
interface UseCapabilityReturn<T> {
  invoke: (args: unknown, options?: InvokeOptions) => Promise<InvocationResult<T>>;
  isLoading: boolean;
  result: InvocationResult<T> | null;
  error: InvocationResult<T> | null;
  reset: () => void;
}
```

### `useBusEvents(handler, filter?): void`

Subscribe to bus events with automatic cleanup on unmount.

```tsx
useBusEvents(
  (event) => console.log('Event:', event),
  (event) => event.type === 'notification',
);
```

### `useAgentContext(contextProvider, deps?): AgentContextValue`

Provides context data for the agent about the current page state.

### `useConfirmation()`

Manages the confirmation dialog lifecycle for destructive agent actions.

```tsx
const { state, requestConfirmation } = useConfirmation();

// Pass requestConfirmation to createConfirmationMiddleware
// state.pending, state.request, state.confirm, state.deny for dialog UI
```
