import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { CapabilityBus } from '../bus.js';
import {
  createLoggingMiddleware,
  createTimingMiddleware,
  createConfirmationMiddleware,
} from '../middleware.js';
import type { CallerIdentity, CapabilityDefinition } from '../types.js';

const uiCaller: CallerIdentity = { type: 'ui', source: 'test' };
const agentCaller: CallerIdentity = { type: 'agent', source: 'test-agent' };

function makeCapability(overrides: Partial<CapabilityDefinition> = {}): CapabilityDefinition {
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

describe('createLoggingMiddleware', () => {
  it('logs invocation and result', async () => {
    const logger = { log: vi.fn() };
    const bus = new CapabilityBus();
    bus.register(makeCapability());
    bus.use(createLoggingMiddleware(logger));

    await bus.invoke('test.action', { value: 'x' }, uiCaller);

    expect(logger.log).toHaveBeenCalledTimes(2);
    expect(logger.log).toHaveBeenCalledWith(
      '[bus] invoking test.action',
      { value: 'x' },
    );
    expect(logger.log).toHaveBeenCalledWith('[bus] test.action → success');
  });
});

describe('createTimingMiddleware', () => {
  it('reports timing', async () => {
    const onTiming = vi.fn();
    const bus = new CapabilityBus();
    bus.register(makeCapability());
    bus.use(createTimingMiddleware(onTiming));

    await bus.invoke('test.action', { value: 'x' }, uiCaller);

    expect(onTiming).toHaveBeenCalledOnce();
    expect(onTiming.mock.calls[0][0]).toBe('test.action');
    expect(onTiming.mock.calls[0][1]).toBeGreaterThanOrEqual(0);
  });
});

describe('createConfirmationMiddleware', () => {
  it('prompts for destructive agent-invoked capabilities', async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    const bus = new CapabilityBus();
    bus.register(makeCapability({ sideEffect: 'destructive' }));
    bus.use(createConfirmationMiddleware(confirm));

    const result = await bus.invoke('test.action', { value: 'x' }, agentCaller);

    expect(confirm).toHaveBeenCalledOnce();
    expect(confirm).toHaveBeenCalledWith('A test action', { value: 'x' });
    expect(result.status).toBe('success');
  });

  it('blocks when user declines', async () => {
    const confirm = vi.fn().mockResolvedValue(false);
    const bus = new CapabilityBus();
    bus.register(makeCapability({ sideEffect: 'destructive' }));
    bus.use(createConfirmationMiddleware(confirm));

    const result = await bus.invoke('test.action', { value: 'x' }, agentCaller);

    expect(result.status).toBe('error');
    if (result.status === 'error') {
      expect(result.code).toBe('FORBIDDEN');
      expect(result.message).toBe('User declined the action');
    }
  });

  it('skips confirmation for UI callers', async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    const bus = new CapabilityBus();
    bus.register(makeCapability({ sideEffect: 'destructive' }));
    bus.use(createConfirmationMiddleware(confirm));

    const result = await bus.invoke('test.action', { value: 'x' }, uiCaller);

    expect(confirm).not.toHaveBeenCalled();
    expect(result.status).toBe('success');
  });

  it('skips confirmation for non-destructive agent actions', async () => {
    const confirm = vi.fn().mockResolvedValue(true);
    const bus = new CapabilityBus();
    bus.register(makeCapability({ sideEffect: 'network' }));
    bus.use(createConfirmationMiddleware(confirm));

    const result = await bus.invoke('test.action', { value: 'x' }, agentCaller);

    expect(confirm).not.toHaveBeenCalled();
    expect(result.status).toBe('success');
  });
});
