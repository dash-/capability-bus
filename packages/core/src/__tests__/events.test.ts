import { describe, it, expect, vi } from 'vitest';
import { EventEmitter } from '../events.js';
import type { BusEvent } from '../types.js';

describe('EventEmitter', () => {
  const makeEvent = (type: BusEvent['type'] = 'notification'): BusEvent => ({
    type: 'notification',
    level: 'info',
    message: 'test',
    timestamp: Date.now(),
  });

  it('calls listener on emit', () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();
    emitter.subscribe(listener);

    const event = makeEvent();
    emitter.emit(event);

    expect(listener).toHaveBeenCalledOnce();
    expect(listener).toHaveBeenCalledWith(event);
  });

  it('supports multiple listeners', () => {
    const emitter = new EventEmitter();
    const a = vi.fn();
    const b = vi.fn();
    emitter.subscribe(a);
    emitter.subscribe(b);

    emitter.emit(makeEvent());

    expect(a).toHaveBeenCalledOnce();
    expect(b).toHaveBeenCalledOnce();
  });

  it('unsubscribes via returned function', () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();
    const unsub = emitter.subscribe(listener);

    emitter.emit(makeEvent());
    expect(listener).toHaveBeenCalledOnce();

    unsub();
    emitter.emit(makeEvent());
    expect(listener).toHaveBeenCalledOnce(); // not called again
  });

  it('reports listener count', () => {
    const emitter = new EventEmitter();
    expect(emitter.listenerCount()).toBe(0);

    const unsub = emitter.subscribe(() => {});
    expect(emitter.listenerCount()).toBe(1);

    unsub();
    expect(emitter.listenerCount()).toBe(0);
  });

  it('clears all listeners', () => {
    const emitter = new EventEmitter();
    const listener = vi.fn();
    emitter.subscribe(listener);
    emitter.subscribe(() => {});

    emitter.clear();
    expect(emitter.listenerCount()).toBe(0);

    emitter.emit(makeEvent());
    expect(listener).not.toHaveBeenCalled();
  });
});
