import type { BusEvent } from './types.js';

export type EventListener = (event: BusEvent) => void;

export class EventEmitter {
  private listeners = new Set<EventListener>();

  subscribe(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  emit(event: BusEvent): void {
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  listenerCount(): number {
    return this.listeners.size;
  }

  clear(): void {
    this.listeners.clear();
  }
}
