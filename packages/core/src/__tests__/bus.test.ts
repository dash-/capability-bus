import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { CapabilityBus } from '../bus.js';
import type {
  CallerIdentity,
  CapabilityDefinition,
  InvocationResult,
  Middleware,
} from '../types.js';

const uiCaller: CallerIdentity = { type: 'ui', source: 'test-component' };
const agentCaller: CallerIdentity = { type: 'agent', source: 'test-agent' };

function makeCapability(
  overrides: Partial<CapabilityDefinition> = {},
): CapabilityDefinition {
  return {
    name: 'test.action',
    description: 'A test action',
    input: z.object({ value: z.string() }),
    output: z.object({ result: z.string() }),
    sideEffect: 'pure',
    permissions: [],
    concurrency: 'concurrent',
    handler: async (input) => ({ result: `handled:${input.value}` }),
    ...overrides,
  };
}

function makeBus(opts?: Parameters<typeof CapabilityBus.prototype.constructor>[0]) {
  return new CapabilityBus(opts);
}

describe('CapabilityBus', () => {
  describe('registration', () => {
    it('registers and retrieves a capability', () => {
      const bus = makeBus();
      const cap = makeCapability();
      bus.register(cap);

      expect(bus.hasCapability('test.action')).toBe(true);
      expect(bus.getCapability('test.action')).toBe(cap);
      expect(bus.getRegisteredNames()).toEqual(['test.action']);
    });

    it('unregisters a capability', () => {
      const bus = makeBus();
      bus.register(makeCapability());
      bus.unregister('test.action');

      expect(bus.hasCapability('test.action')).toBe(false);
      expect(bus.getRegisteredNames()).toEqual([]);
    });
  });

  describe('invoke - happy path', () => {
    it('validates input, executes handler, returns success', async () => {
      const bus = makeBus();
      bus.register(makeCapability());

      const result = await bus.invoke('test.action', { value: 'hello' }, uiCaller);

      expect(result.status).toBe('success');
      if (result.status === 'success') {
        expect(result.data).toEqual({ result: 'handled:hello' });
        expect(result.requestId).toBeTruthy();
        expect(result.timestamp).toBeGreaterThan(0);
      }
    });
  });

  describe('invoke - NOT_FOUND', () => {
    it('returns NOT_FOUND for unknown capability', async () => {
      const bus = makeBus();
      const result = await bus.invoke('nonexistent', {}, uiCaller);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('NOT_FOUND');
      }
    });

    it('records audit for NOT_FOUND', async () => {
      const bus = makeBus();
      await bus.invoke('nonexistent', {}, uiCaller);

      const log = bus.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].result.status).toBe('error');
      if (log[0].result.status === 'error') {
        expect(log[0].result.code).toBe('NOT_FOUND');
      }
    });
  });

  describe('invoke - VALIDATION', () => {
    it('returns VALIDATION error on bad input', async () => {
      const bus = makeBus();
      bus.register(makeCapability());

      const result = await bus.invoke('test.action', { value: 123 }, uiCaller);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('VALIDATION');
      }
    });

    it('returns VALIDATION error on missing required field', async () => {
      const bus = makeBus();
      bus.register(makeCapability());

      const result = await bus.invoke('test.action', {}, uiCaller);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('VALIDATION');
      }
    });

    it('records audit for VALIDATION errors', async () => {
      const bus = makeBus();
      bus.register(makeCapability());
      await bus.invoke('test.action', { value: 123 }, uiCaller);

      const log = bus.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].result.status).toBe('error');
      if (log[0].result.status === 'error') {
        expect(log[0].result.code).toBe('VALIDATION');
      }
    });
  });

  describe('invoke - FORBIDDEN', () => {
    it('returns FORBIDDEN when permissions are not met', async () => {
      const bus = makeBus({
        appContext: () => ({ permissions: ['user.authenticated'] }),
      });
      bus.register(
        makeCapability({
          permissions: ['user.authenticated', 'admin'],
        }),
      );

      const result = await bus.invoke('test.action', { value: 'x' }, uiCaller);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('FORBIDDEN');
      }
    });

    it('records audit for FORBIDDEN errors', async () => {
      const bus = makeBus({
        appContext: () => ({ permissions: ['user.authenticated'] }),
      });
      bus.register(
        makeCapability({
          permissions: ['user.authenticated', 'admin'],
        }),
      );

      await bus.invoke('test.action', { value: 'x' }, uiCaller);

      const log = bus.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].result.status).toBe('error');
      if (log[0].result.status === 'error') {
        expect(log[0].result.code).toBe('FORBIDDEN');
      }
    });

    it('succeeds when all permissions are present', async () => {
      const bus = makeBus({
        appContext: () => ({ permissions: ['user.authenticated', 'admin'] }),
      });
      bus.register(
        makeCapability({
          permissions: ['user.authenticated', 'admin'],
        }),
      );

      const result = await bus.invoke('test.action', { value: 'x' }, uiCaller);
      expect(result.status).toBe('success');
    });
  });

  describe('invoke - PRECONDITION_FAILED', () => {
    it('returns PRECONDITION_FAILED when preconditions not met', async () => {
      const bus = makeBus();
      bus.register(
        makeCapability({
          preconditions: async () => ({
            met: false,
            code: 'PRECONDITION_FAILED',
            message: 'Cart is empty',
            recoveryHint: 'Add items to cart first',
          }),
        }),
      );

      const result = await bus.invoke('test.action', { value: 'x' }, uiCaller);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('PRECONDITION_FAILED');
        expect(result.message).toBe('Cart is empty');
        expect(result.recoveryHint).toBe('Add items to cart first');
      }
    });
  });

  describe('invoke - CONFLICT (exclusive concurrency)', () => {
    it('returns CONFLICT when exclusive capability is already running', async () => {
      const bus = makeBus();
      let resolveFirst: () => void;
      const firstBlocks = new Promise<void>((r) => {
        resolveFirst = r;
      });

      bus.register(
        makeCapability({
          concurrency: 'exclusive',
          handler: async (input) => {
            await firstBlocks;
            return { result: `done:${input.value}` };
          },
        }),
      );

      // Start first invocation (it will block)
      const first = bus.invoke('test.action', { value: '1' }, uiCaller);

      // Second invocation should get CONFLICT
      const second = await bus.invoke('test.action', { value: '2' }, uiCaller);

      expect(second.status).toBe('error');
      if (second.status === 'error') {
        expect(second.code).toBe('CONFLICT');
      }

      // Resolve first
      resolveFirst!();
      const firstResult = await first;
      expect(firstResult.status).toBe('success');
    });

    it('records audit for CONFLICT errors', async () => {
      const bus = makeBus();
      let resolveFirst: () => void;
      const firstBlocks = new Promise<void>((r) => {
        resolveFirst = r;
      });

      bus.register(
        makeCapability({
          concurrency: 'exclusive',
          handler: async (input) => {
            await firstBlocks;
            return { result: `done:${input.value}` };
          },
        }),
      );

      const first = bus.invoke('test.action', { value: '1' }, uiCaller);
      await bus.invoke('test.action', { value: '2' }, uiCaller);

      // CONFLICT should be audited (first invocation hasn't finished yet)
      const log = bus.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].result.status).toBe('error');
      if (log[0].result.status === 'error') {
        expect(log[0].result.code).toBe('CONFLICT');
      }

      resolveFirst!();
      await first;
    });

    it('allows concurrent capabilities to run simultaneously', async () => {
      const bus = makeBus();
      let resolveFirst: () => void;
      const firstBlocks = new Promise<void>((r) => {
        resolveFirst = r;
      });

      bus.register(
        makeCapability({
          concurrency: 'concurrent',
          handler: async (input) => {
            if (input.value === '1') await firstBlocks;
            return { result: `done:${input.value}` };
          },
        }),
      );

      const first = bus.invoke('test.action', { value: '1' }, uiCaller);
      const second = await bus.invoke('test.action', { value: '2' }, uiCaller);

      expect(second.status).toBe('success');

      resolveFirst!();
      const firstResult = await first;
      expect(firstResult.status).toBe('success');
    });
  });

  describe('invoke - INTERNAL (handler throws)', () => {
    it('returns INTERNAL error when handler throws', async () => {
      const bus = makeBus();
      bus.register(
        makeCapability({
          handler: async () => {
            throw new Error('Something went wrong');
          },
        }),
      );

      const result = await bus.invoke('test.action', { value: 'x' }, uiCaller);

      expect(result.status).toBe('error');
      if (result.status === 'error') {
        expect(result.code).toBe('INTERNAL');
        expect(result.message).toBe('Something went wrong');
      }
    });
  });

  describe('idempotency', () => {
    it('returns cached result for duplicate idempotency key', async () => {
      const bus = makeBus();
      let callCount = 0;
      bus.register(
        makeCapability({
          handler: async (input) => {
            callCount++;
            return { result: `call:${callCount}` };
          },
        }),
      );

      const first = await bus.invoke('test.action', { value: 'x' }, uiCaller, {
        idempotencyKey: 'key-1',
      });
      const second = await bus.invoke('test.action', { value: 'x' }, uiCaller, {
        idempotencyKey: 'key-1',
      });

      expect(first.status).toBe('success');
      expect(second.status).toBe('success');
      if (first.status === 'success' && second.status === 'success') {
        expect(first.data).toEqual({ result: 'call:1' });
        expect(second.data).toEqual({ result: 'call:1' }); // same cached result
      }
      expect(callCount).toBe(1); // handler called only once
    });

    it('executes handler for different idempotency keys', async () => {
      const bus = makeBus();
      let callCount = 0;
      bus.register(
        makeCapability({
          handler: async () => {
            callCount++;
            return { result: `call:${callCount}` };
          },
        }),
      );

      await bus.invoke('test.action', { value: 'x' }, uiCaller, { idempotencyKey: 'key-1' });
      await bus.invoke('test.action', { value: 'x' }, uiCaller, { idempotencyKey: 'key-2' });

      expect(callCount).toBe(2);
    });
  });

  describe('audit log', () => {
    it('records invocations in the audit log', async () => {
      const bus = makeBus();
      bus.register(makeCapability());

      await bus.invoke('test.action', { value: 'hello' }, uiCaller);

      const log = bus.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].invocation.capability).toBe('test.action');
      expect(log[0].invocation.caller).toEqual(uiCaller);
      expect(log[0].result.status).toBe('success');
      expect(log[0].duration).toBeGreaterThanOrEqual(0);
    });

    it('records failed invocations too (precondition)', async () => {
      const bus = makeBus();
      bus.register(
        makeCapability({
          preconditions: async () => ({
            met: false,
            code: 'PRECONDITION_FAILED',
            message: 'nope',
          }),
        }),
      );

      await bus.invoke('test.action', { value: 'x' }, uiCaller);

      const log = bus.getAuditLog();
      expect(log).toHaveLength(1);
      expect(log[0].result.status).toBe('error');
    });

    it('clears audit log', async () => {
      const bus = makeBus();
      bus.register(makeCapability());
      await bus.invoke('test.action', { value: 'x' }, uiCaller);

      bus.clearAuditLog();
      expect(bus.getAuditLog()).toHaveLength(0);
    });
  });

  describe('event emission', () => {
    it('emits invocation event on success', async () => {
      const bus = makeBus();
      bus.register(makeCapability());

      const events: unknown[] = [];
      bus.subscribe((e) => events.push(e));

      await bus.invoke('test.action', { value: 'x' }, uiCaller);

      expect(events).toHaveLength(1);
      const event = events[0] as { type: string; capability: string };
      expect(event.type).toBe('invocation');
      expect(event.capability).toBe('test.action');
    });

    it('emits invocation event on handler error', async () => {
      const bus = makeBus();
      bus.register(
        makeCapability({
          handler: async () => {
            throw new Error('fail');
          },
        }),
      );

      const events: unknown[] = [];
      bus.subscribe((e) => events.push(e));

      await bus.invoke('test.action', { value: 'x' }, uiCaller);

      expect(events).toHaveLength(1);
    });
  });

  describe('middleware', () => {
    it('executes middleware around handler', async () => {
      const bus = makeBus();
      bus.register(makeCapability());

      const order: string[] = [];
      const mw: Middleware = async (inv, cap, next) => {
        order.push('before');
        const result = await next();
        order.push('after');
        return result;
      };
      bus.use(mw);

      await bus.invoke('test.action', { value: 'x' }, uiCaller);

      expect(order).toEqual(['before', 'after']);
    });

    it('middleware can short-circuit execution', async () => {
      const bus = makeBus();
      const handler = vi.fn(async () => ({ result: 'should not run' }));
      bus.register(makeCapability({ handler }));

      bus.use(async (inv, cap, next) => ({
        status: 'error' as const,
        requestId: inv.requestId,
        code: 'FORBIDDEN' as const,
        message: 'Blocked by middleware',
        timestamp: Date.now(),
      }));

      const result = await bus.invoke('test.action', { value: 'x' }, uiCaller);

      expect(result.status).toBe('error');
      expect(handler).not.toHaveBeenCalled();
    });

    it('executes middlewares in order (first registered = outermost)', async () => {
      const bus = makeBus();
      bus.register(makeCapability());

      const order: string[] = [];
      bus.use(async (_inv, _cap, next) => {
        order.push('mw1-before');
        const r = await next();
        order.push('mw1-after');
        return r;
      });
      bus.use(async (_inv, _cap, next) => {
        order.push('mw2-before');
        const r = await next();
        order.push('mw2-after');
        return r;
      });

      await bus.invoke('test.action', { value: 'x' }, uiCaller);

      expect(order).toEqual(['mw1-before', 'mw2-before', 'mw2-after', 'mw1-after']);
    });
  });

  describe('manifest', () => {
    it('generates a manifest from registered capabilities', () => {
      const bus = makeBus();
      bus.register(makeCapability());
      bus.register(
        makeCapability({
          name: 'test.other',
          description: 'Another action',
          sideEffect: 'destructive',
        }),
      );

      const manifest = bus.getManifest({ permissions: [] }, { name: 'test-app', version: '1.0.0' });

      expect(manifest.schema_version).toBe('0.1.0');
      expect(manifest.application.name).toBe('test-app');
      expect(manifest.capabilities).toHaveLength(2);
      expect(manifest.capabilities[0].name).toBe('test.action');
      expect(manifest.capabilities[1].name).toBe('test.other');
      expect(manifest.capabilities[1].side_effect).toBe('destructive');
    });

    it('reflects availability from isAvailable', () => {
      const bus = makeBus();
      bus.register(
        makeCapability({
          isAvailable: (ctx) => ({
            available: ctx.permissions.includes('admin'),
            unavailableReason: 'Requires admin',
          }),
        }),
      );

      const manifest = bus.getManifest({ permissions: [] });
      expect(manifest.capabilities[0].available).toBe(false);
      expect(manifest.capabilities[0].unavailable_reason).toBe('Requires admin');
    });

    it('getToolDefinitions returns only available capabilities', () => {
      const bus = makeBus();
      bus.register(makeCapability({ name: 'available.action' }));
      bus.register(
        makeCapability({
          name: 'unavailable.action',
          isAvailable: () => ({ available: false, unavailableReason: 'nope' }),
        }),
      );

      const tools = bus.getToolDefinitions({ permissions: [] });
      expect(tools).toHaveLength(1);
      expect(tools[0].name).toBe('available.action');
    });
  });

  describe('caller agnosticism', () => {
    it('treats UI and agent callers identically', async () => {
      const bus = makeBus();
      bus.register(makeCapability());

      const uiResult = await bus.invoke('test.action', { value: 'from-ui' }, uiCaller);
      const agentResult = await bus.invoke('test.action', { value: 'from-agent' }, agentCaller);

      expect(uiResult.status).toBe('success');
      expect(agentResult.status).toBe('success');
      if (uiResult.status === 'success' && agentResult.status === 'success') {
        expect(uiResult.data).toEqual({ result: 'handled:from-ui' });
        expect(agentResult.data).toEqual({ result: 'handled:from-agent' });
      }

      // Both appear in audit log
      const log = bus.getAuditLog();
      expect(log).toHaveLength(2);
      expect(log[0].invocation.caller.type).toBe('ui');
      expect(log[1].invocation.caller.type).toBe('agent');
    });
  });
});
