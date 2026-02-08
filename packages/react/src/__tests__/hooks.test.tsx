import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { z } from 'zod';
import { CapabilityBus } from '@capability-bus/core';
import { BusProvider } from '../BusProvider.js';
import { useCapabilityBus } from '../use-capability-bus.js';
import { useCapability } from '../use-capability.js';
import { useBusEvents } from '../use-bus-events.js';
import { useConfirmation } from '../use-confirmation.js';

function makeBus() {
  const bus = new CapabilityBus();
  bus.register({
    name: 'test.greet',
    description: 'Greet someone',
    input: z.object({ name: z.string() }),
    output: z.object({ greeting: z.string() }),
    sideEffect: 'pure' as const,
    permissions: [],
    concurrency: 'concurrent' as const,
    handler: async (input: { name: string }) => ({
      greeting: `Hello, ${input.name}!`,
    }),
  });
  return bus;
}

function makeWrapper(bus: CapabilityBus) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <BusProvider bus={bus}>{children}</BusProvider>;
  };
}

describe('useCapabilityBus', () => {
  it('returns the bus from context', () => {
    const bus = makeBus();
    const { result } = renderHook(() => useCapabilityBus(), {
      wrapper: makeWrapper(bus),
    });
    expect(result.current).toBe(bus);
  });

  it('throws if used outside BusProvider', () => {
    expect(() => {
      renderHook(() => useCapabilityBus());
    }).toThrow('useCapabilityBus must be used within a <BusProvider>');
  });
});

describe('useCapability', () => {
  it('invokes capability and returns result', async () => {
    const bus = makeBus();
    const { result } = renderHook(() => useCapability('test.greet'), {
      wrapper: makeWrapper(bus),
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.result).toBeNull();

    let invokeResult: unknown;
    await act(async () => {
      invokeResult = await result.current.invoke({ name: 'World' });
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.result?.status).toBe('success');
    if (result.current.result?.status === 'success') {
      expect(result.current.result.data).toEqual({ greeting: 'Hello, World!' });
    }
  });

  it('captures errors', async () => {
    const bus = makeBus();
    const { result } = renderHook(() => useCapability('test.greet'), {
      wrapper: makeWrapper(bus),
    });

    await act(async () => {
      await result.current.invoke({ name: 123 }); // wrong type
    });

    expect(result.current.error?.status).toBe('error');
  });

  it('resets state', async () => {
    const bus = makeBus();
    const { result } = renderHook(() => useCapability('test.greet'), {
      wrapper: makeWrapper(bus),
    });

    await act(async () => {
      await result.current.invoke({ name: 'World' });
    });

    expect(result.current.result).not.toBeNull();

    act(() => {
      result.current.reset();
    });

    expect(result.current.result).toBeNull();
    expect(result.current.error).toBeNull();
  });
});

describe('useBusEvents', () => {
  it('receives events from the bus', async () => {
    const bus = makeBus();
    const events: unknown[] = [];
    const handler = vi.fn((e: unknown) => events.push(e));

    renderHook(() => useBusEvents(handler), {
      wrapper: makeWrapper(bus),
    });

    // Trigger an event by invoking
    await act(async () => {
      await bus.invoke('test.greet', { name: 'X' }, { type: 'test', source: 'test' });
    });

    expect(events.length).toBeGreaterThan(0);
  });
});

describe('useConfirmation', () => {
  it('manages confirmation lifecycle', async () => {
    const { result } = renderHook(() => useConfirmation());

    expect(result.current.state.pending).toBe(false);

    let resolved: boolean | undefined;
    act(() => {
      result.current.requestConfirmation('Delete item?', { id: '123' }).then((v) => {
        resolved = v;
      });
    });

    expect(result.current.state.pending).toBe(true);
    expect(result.current.state.request?.description).toBe('Delete item?');

    await act(async () => {
      result.current.state.confirm();
    });

    expect(result.current.state.pending).toBe(false);
    expect(resolved).toBe(true);
  });

  it('handles denial', async () => {
    const { result } = renderHook(() => useConfirmation());

    let resolved: boolean | undefined;
    act(() => {
      result.current.requestConfirmation('Delete?', {}).then((v) => {
        resolved = v;
      });
    });

    await act(async () => {
      result.current.state.deny();
    });

    expect(resolved).toBe(false);
  });
});
